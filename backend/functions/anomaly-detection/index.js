const { getAdapter, sanitizeZCQLString } = require('./adapter');

// Configurable constants
// Jaccard Distance (1.0 - Jaccard Similarity) threshold to declare an MO break/anomaly.
// A distance >= 0.70 means less than 30% overlap in MO tags between the new case and the offender's historical sequence.
const MO_SHIFT_THRESHOLD = parseFloat(process.env.MO_SHIFT_THRESHOLD) || 0.70;

module.exports = async (context, basicIO) => {
    const adapter = getAdapter(context);
    
    try {
        if (!context.body) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing request body' }));
            context.close();
            return;
        }

        const body = JSON.parse(context.body);
        const { offender_id, fir_id, identity_confidence = 0.90 } = body;

        if (!offender_id || !fir_id) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing mandatory fields: offender_id, fir_id' }));
            context.close();
            return;
        }

        // Sanitize parameters to mitigate ZCQL injection risk
        const cleanOffenderId = sanitizeZCQLString(offender_id);
        const cleanFirId = sanitizeZCQLString(fir_id);

        // 1. Fetch all cases linked to the offender
        const caseRows = await adapter.datastore.query(`SELECT fir_id FROM offender_fir_link WHERE offender_id = '${cleanOffenderId}'`);
        const linkedFirIds = caseRows.map(r => r.offender_fir_link.fir_id);

        if (linkedFirIds.length === 0) {
            basicIO.write(JSON.stringify({ status: 'error', message: `No cases linked to offender ${cleanOffenderId}` }));
            context.close();
            return;
        }

        // Separate current case from historical cases
        const historicalFirIds = linkedFirIds.filter(id => id !== cleanFirId);

        // 2. Retrieve MO tags for new case
        const newMoRows = await adapter.datastore.query(`SELECT mo_id FROM fir_mo_link WHERE fir_id = '${cleanFirId}'`);
        const newTags = newMoRows.map(r => r.fir_mo_link.mo_id);

        // Retrieve MO tags for historical cases
        const historicalTagsSet = new Set();
        for (const histId of historicalFirIds) {
            const histMoRows = await adapter.datastore.query(`SELECT mo_id FROM fir_mo_link WHERE fir_id = '${sanitizeZCQLString(histId)}'`);
            histMoRows.forEach(r => historicalTagsSet.add(r.fir_mo_link.mo_id));
        }
        const historicalTags = Array.from(historicalTagsSet);

        // 3. Compute Deviation Score (1.0 - Jaccard overlap)
        let deviationScore = 0.0;
        let raisedFlag = false;
        let flagId = null;
        let evidenceRecord = null;

        if (historicalTags.length > 0 && newTags.length > 0) {
            const intersection = historicalTags.filter(t => newTags.includes(t));
            const union = Array.from(new Set([...historicalTags, ...newTags]));
            const jaccard = union.length > 0 ? intersection.length / union.length : 0.0;
            deviationScore = 1.0 - jaccard;
        } else if (newTags.length > 0) {
            deviationScore = 1.0;
        }

        // Anomaly requires at least 2 historical cases to be statistically meaningful (see anomaly-detection-notes.md)
        const isStatisticallySignificant = historicalFirIds.length >= 2;

        // 4. Raise Flag if deviation exceeds threshold and identity confidence is high
        if (deviationScore >= MO_SHIFT_THRESHOLD && isStatisticallySignificant && identity_confidence >= 0.80) {
            raisedFlag = true;
            flagId = `ANOM_${cleanOffenderId}_${Date.now()}`;

            const reasoning = `Shift in Modus Operandi detected for offender ${cleanOffenderId}. Historical pattern: [${historicalTags.join(', ')}]. New case ${cleanFirId} patterns: [${newTags.join(', ')}].`;

            // Write to NoSQL Collection: anomaly_flags
            await adapter.nosql.insertItem("anomaly_flags", {
                flag_id: flagId,
                offender_id: cleanOffenderId,
                flag_type: 'mo_shift',
                description: reasoning,
                prior_mo_tags: historicalTags,
                current_mo_tags: newTags,
                confidence: deviationScore, // ponytail: simple confidence representation, upgrading with historical density later
                detected_at: new Date().toISOString(),
                verification_status: 'unverified'
            });

            // Write to explainability records
            const recordId = `EVID_ANOM_${flagId}`;
            evidenceRecord = {
                record_id: recordId,
                output_type: 'anomaly_flag',
                function_name: 'anomaly-detection',
                model_version: 'v1.0',
                source_fir_ids: JSON.stringify([cleanFirId, ...historicalFirIds]),
                matched_fields: JSON.stringify([
                    { field: 'mo_tags', value_pattern: newTags.join(','), confidence: deviationScore }
                ]),
                reasoning_summary: reasoning,
                confidence_score: deviationScore,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                verification_status: 'unverified'
            };

            await adapter.datastore.insertRow('explainability_records', evidenceRecord);
        }

        basicIO.write(JSON.stringify({
            status: 'success',
            offender_id: cleanOffenderId,
            fir_id: cleanFirId,
            deviation_score: deviationScore,
            historical_cases_count: historicalFirIds.length,
            is_statistically_significant: isStatisticallySignificant,
            raised_anomaly_flag: raisedFlag,
            flag_id: flagId,
            evidence: evidenceRecord
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};
