const { getAdapter, sanitizeZCQLString } = require('./adapter');

// Configurable alert threshold
const RISK_ALERT_THRESHOLD = parseFloat(process.env.RISK_ALERT_THRESHOLD) || 0.70;

module.exports = async (context, basicIO) => {
    const adapter = getAdapter(context);
    
    try {
        if (!context.body) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing request body' }));
            context.close();
            return;
        }

        const body = JSON.parse(context.body);
        const { offender_id, recipient_email = 'superintendent@ksp.gov.in' } = body;

        if (!offender_id) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing mandatory field: offender_id' }));
            context.close();
            return;
        }

        const cleanOffenderId = sanitizeZCQLString(offender_id);

        // 1. Fetch Offender Details
        let offender = null;
        try {
            offender = await adapter.datastore.getRow('offenders', cleanOffenderId);
        } catch (e) {
            basicIO.write(JSON.stringify({ status: 'error', message: `Offender not found: ${cleanOffenderId}` }));
            context.close();
            return;
        }

        const currentScore = offender.risk_score || 0.0;
        let alertTriggered = false;
        let recordId = null;

        // 2. Trigger Alert if Risk Score is higher than threshold (0.70)
        if (currentScore >= RISK_ALERT_THRESHOLD) {
            alertTriggered = true;
            
            const subject = `[SETU platform ALERT] High Risk Offender Escalation: ${offender.full_name}`;
            const messageBody = `
                <h2>SETU Platform Escalation Notice</h2>
                <p>This is an automated decision-support alert from the SETU piattaforma.</p>
                <p><strong>Offender Name:</strong> ${offender.full_name}</p>
                <p><strong>Offender ID:</strong> ${cleanOffenderId}</p>
                <p><strong>Current Calculated Risk Score:</strong> ${currentScore.toFixed(2)} (exceeds threshold ${RISK_ALERT_THRESHOLD})</p>
                <p><strong>Recommended Action:</strong> Flag for bail-status review or witness protection security detail.</p>
                <hr/>
                <p><em>Audit Reference: EVID_ALERT_${cleanOffenderId}</em></p>
            `;

            // Trigger Email Dispatch
            await adapter.mail.sendEmail(recipient_email, subject, messageBody);

            // 3. Write Explainability Record
            recordId = `EVID_ALERT_${cleanOffenderId}_${Date.now()}`;
            await adapter.datastore.insertRow('explainability_records', {
                record_id: recordId,
                output_type: 'alert_notification',
                function_name: 'alerts',
                model_version: 'v1.0',
                source_fir_ids: JSON.stringify([]),
                matched_fields: JSON.stringify([
                    { field: 'risk_score', value_pattern: `${currentScore}`, confidence: 1.0 }
                ]),
                reasoning_summary: `High risk score alert triggered for offender ${offender.full_name} (${cleanOffenderId}). Current risk score ${currentScore.toFixed(2)} exceeds threshold of ${RISK_ALERT_THRESHOLD}. Email dispatch initiated.`,
                confidence_score: 1.0,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                verification_status: 'unverified'
            });
        }

        basicIO.write(JSON.stringify({
            status: 'success',
            offender_id: cleanOffenderId,
            risk_score: currentScore,
            alert_triggered: alertTriggered,
            evidence_record_id: recordId
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};
