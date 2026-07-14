const { getAdapter, sanitizeZCQLString } = require('./adapter');

// Configurable weights for rule-based fallback model
const WEIGHT_OFFENSE_COUNT = 0.40;
const WEIGHT_MO_SHIFT = 0.20;
const WEIGHT_SEVERITY_VIOLENT = 0.40;

module.exports = async (context, basicIO) => {
    const adapter = getAdapter(context);
    
    try {
        if (!context.body) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing request body' }));
            context.close();
            return;
        }

        const body = JSON.parse(context.body);
        const { offender_id, fir_id } = body;

        if (!offender_id) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing offender_id' }));
            context.close();
            return;
        }

        const cleanOffenderId = sanitizeZCQLString(offender_id);
        const cleanFirId = fir_id ? sanitizeZCQLString(fir_id) : null;

        // 1. Fetch Offender cases
        const linkRows = await adapter.datastore.query(`SELECT fir_id FROM offender_fir_link WHERE offender_id = '${cleanOffenderId}'`);
        const linkedFirIds = linkRows.map(r => r.offender_fir_link.fir_id);
        const priorOffenseCount = linkedFirIds.length;

        // 2. Fetch Crime Severity
        let crimeSeverityScore = 0.0;
        let recentCrimeType = 'unknown';

        if (priorOffenseCount > 0) {
            // Find most recent crime type
            const targetFir = linkedFirIds[linkedFirIds.length - 1];
            const cleanTargetFir = sanitizeZCQLString(targetFir);
            const firRows = await adapter.datastore.query(`SELECT crime_type FROM firs WHERE fir_id = '${cleanTargetFir}'`);
            if (firRows.length > 0) {
                recentCrimeType = firRows[0].firs.crime_type;
                if (recentCrimeType === 'armed-robbery' || recentCrimeType === 'assault' || recentCrimeType === 'extortion') {
                    crimeSeverityScore = 1.0; // Violent Crime
                } else if (recentCrimeType === 'chain-snatching' || recentCrimeType === 'house-breaking-night' || recentCrimeType === 'house-breaking-day') {
                    crimeSeverityScore = 0.6; // Serious Property Crime
                } else {
                    // ponytail: fallback if crime_type is not matched. 
                    // Note: defaults to 0.3 (same as minor/financial tier) so unrecognized 
                    // inputs fail gracefully rather than crashing, but this is a fallback 
                    // and should not be mistaken for a deliberate legal classification.
                    crimeSeverityScore = 0.3; 
                }
            }
        }

        // 3. Fetch Anomaly Flags from NoSQL
        const anomalyFlags = await adapter.nosql.findItems("anomaly_flags", item => item.offender_id === cleanOffenderId);
        const moShiftDetected = anomalyFlags.some(flag => flag.flag_type === 'mo_shift');

        // 4. Calculate Offender Reoffense Risk Score (Rule-Based Fallback per risk-scoring-methodology.md)
        const offenseCountScore = Math.min(priorOffenseCount / 10.0, 1.0);
        
        let calculatedScore = (offenseCountScore * WEIGHT_OFFENSE_COUNT) +
                              (crimeSeverityScore * WEIGHT_SEVERITY_VIOLENT);

        if (moShiftDetected) {
            calculatedScore += WEIGHT_MO_SHIFT;
        }

        calculatedScore = Math.min(Math.max(calculatedScore, 0.0), 1.0);

        // Update offender's risk score in the Data Store
        let offenderRow = null;
        try {
            offenderRow = await adapter.datastore.getRow('offenders', cleanOffenderId);
        } catch (e) {}

        if (offenderRow) {
            await adapter.datastore.updateRow('offenders', {
                offender_id: cleanOffenderId,
                full_name: offenderRow.full_name,
                gender: offenderRow.gender || null, // Preserve null demographics per data integrity policy
                age_at_first_offense: offenderRow.age_at_first_offense || null,
                risk_score: calculatedScore,
                risk_score_last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19),
                bail_status: offenderRow.bail_status || null
            });
        }

        // 5. Witness Tampering Intimidation Risk Score (if fir_id is provided)
        let witnessTamperingScore = 0.0;
        let witnessTamperingReasoning = "No linked FIR context provided.";

        if (cleanFirId) {
            const severityIntimidationVal = crimeSeverityScore * 0.50;
            const graphCentralityCentral = priorOffenseCount > 2;
            const networkHopMultiplier = graphCentralityCentral ? 0.50 : 0.20;

            witnessTamperingScore = Math.min(severityIntimidationVal + networkHopMultiplier, 1.0);
            witnessTamperingReasoning = `Witness linked to offender ${cleanOffenderId} via FIR ${cleanFirId}. Case severity factor: ${crimeSeverityScore}. Network centrality factor: ${graphCentralityCentral ? 'high' : 'low'}.`;
        }

        // 6. Write Explainability Record
        const recordId = `EVID_RISK_${cleanOffenderId}_${Date.now()}`;
        const evidenceRecord = {
            record_id: recordId,
            output_type: 'risk_score',
            function_name: 'risk-scoring',
            model_version: 'v1.0',
            source_fir_ids: JSON.stringify(linkedFirIds),
            matched_fields: JSON.stringify([
                { field: 'prior_offenses', value_pattern: `${priorOffenseCount}`, confidence: 1.0 },
                { field: 'mo_shift', value_pattern: `${moShiftDetected}`, confidence: 1.0 }
            ]),
            reasoning_summary: `Calculated offender reoffense score = ${calculatedScore.toFixed(2)}. Witness tampering risk = ${witnessTamperingScore.toFixed(2)}. Factors: Offense count = ${priorOffenseCount}, Recent type = ${recentCrimeType}, MO shift = ${moShiftDetected}.`,
            confidence_score: 0.90, // Rule-based score confidence
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            verification_status: 'unverified'
        };

        await adapter.datastore.insertRow('explainability_records', evidenceRecord);

        basicIO.write(JSON.stringify({
            status: 'success',
            offender_id: cleanOffenderId,
            risk_score: calculatedScore,
            witness_tampering_risk: witnessTamperingScore,
            witness_tampering_reasoning: witnessTamperingReasoning,
            evidence: evidenceRecord
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};
