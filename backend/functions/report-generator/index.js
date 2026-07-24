const { getAdapter, sanitizeZCQLString } = require('./adapter');

module.exports = async (context, basicIO) => {
    const adapter = getAdapter(context);
    
    try {
        if (!context.body) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing request body' }));
            context.close();
            return;
        }

        const body = JSON.parse(context.body);
        const { fir_id, messages, title = 'SETU Investigation Chat Transcript', generated_by = 'INV_MOCK' } = body;

        // ponytail: Chat-to-PDF export handler when messages array is provided
        if (messages && Array.isArray(messages)) {
            const formattedMessages = messages.map(msg => {
                const sender = msg.speaker === 'user' ? 'Investigator' : 'SETU Intelligence';
                const text = typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text);
                return `<div style="margin-bottom:15px; padding:12px; background:${msg.speaker === 'user' ? '#f0f4fe' : '#f8fafc'}; border-left:4px solid ${msg.speaker === 'user' ? '#4f46e5' : '#10b981'}; border-radius:4px;">
                    <div style="font-weight:bold; font-size:12px; color:#475569; margin-bottom:4px;">${sender}</div>
                    <div style="white-space:pre-wrap; font-size:14px; color:#1e293b;">${text}</div>
                </div>`;
            }).join('');

            const htmlContent = `
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                        .header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 20px; margin-bottom: 20px; }
                        .header h1 { margin: 0; color: #1a365d; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${title}</h1>
                        <p>Exported by ${generated_by} on ${new Date().toISOString().substring(0, 10)}</p>
                    </div>
                    <div>
                        ${formattedMessages}
                    </div>
                </body>
                </html>
            `;

            const pdfBuffer = await adapter.smartbrowz.generatePDF(htmlContent);
            const recordId = `EVID_CHAT_PDF_${Date.now()}`;

            basicIO.write(JSON.stringify({
                status: 'success',
                type: 'chat_export',
                evidence_record_id: recordId,
                message_count: messages.length,
                pdf_base64: pdfBuffer.toString('base64')
            }));
            context.close();
            return;
        }

        if (!fir_id) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing mandatory field: fir_id or messages' }));
            context.close();
            return;
        }

        const cleanFirId = sanitizeZCQLString(fir_id);

        // 1. Fetch FIR details
        let fir = null;
        try {
            fir = await adapter.datastore.getRow('firs', cleanFirId);
        } catch (e) {
            basicIO.write(JSON.stringify({ status: 'error', message: `FIR not found: ${cleanFirId}` }));
            context.close();
            return;
        }

        // 2. Fetch Location details
        let location = { station_name: 'unknown', district_name: 'unknown' };
        try {
            location = await adapter.datastore.getRow('locations', fir.station_id);
        } catch (e) {}

        // 3. Fetch linked offender names
        const offenderRows = await adapter.datastore.query(`SELECT offender_id FROM offender_fir_link WHERE fir_id = '${cleanFirId}'`);
        const offenderNames = [];
        for (const row of offenderRows) {
            try {
                const offId = sanitizeZCQLString(row.offender_fir_link.offender_id);
                const off = await adapter.datastore.getRow('offenders', offId);
                offenderNames.push(off.full_name);
            } catch (e) {}
        }

        // 4. Fetch MO tags linked
        const moRows = await adapter.datastore.query(`SELECT mo_id FROM fir_mo_link WHERE fir_id = '${cleanFirId}'`);
        const moTagsList = moRows.map(r => r.fir_mo_link.mo_id);

        // 5. Construct HTML template for SmartBrowz PDF generation
        const htmlContent = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                    .header { text-align: center; border-bottom: 2px solid #1a365d; padding-bottom: 20px; }
                    .header h1 { margin: 0; color: #1a365d; }
                    .section { margin-top: 30px; }
                    .section h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #2b6cb0; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .field { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>SETU Platform Case Briefing</h1>
                    <p>Official intelligence report generated on ${new Date().toISOString().substring(0, 10)}</p>
                </div>
                <div class="section">
                    <h2>Case Details</h2>
                    <div class="grid">
                        <div><span class="field">FIR Number:</span> ${cleanFirId}</div>
                        <div><span class="field">Filing Date:</span> ${fir.filing_date}</div>
                        <div><span class="field">Police Station:</span> ${location.station_name}</div>
                        <div><span class="field">District:</span> ${location.district_name}</div>
                        <div><span class="field">Crime Type:</span> ${fir.crime_type}</div>
                        <div><span class="field">Case Status:</span> ${fir.status}</div>
                    </div>
                </div>
                <div class="section">
                    <h2>Accused Demographics</h2>
                    <p>${offenderNames.join(', ') || 'No linked suspects resolved yet.'}</p>
                </div>
                <div class="section">
                    <h2>Modus Operandi Tags</h2>
                    <p>${moTagsList.join(', ') || 'No MO tags linked.'}</p>
                </div>
                <div class="section">
                    <h2>Raw Narrative Details</h2>
                    <p>${fir.raw_text}</p>
                </div>
            </body>
            </html>
        `;

        // 6. Execute SmartBrowz PDF generation
        const pdfBuffer = await adapter.smartbrowz.generatePDF(htmlContent);

        // 7. Write Explainability / Audit Record
        const recordId = `EVID_REP_${cleanFirId}_${Date.now()}`;
        await adapter.datastore.insertRow('explainability_records', {
            record_id: recordId,
            output_type: 'pdf_report',
            function_name: 'report-generator',
            model_version: 'v1.0',
            source_fir_ids: JSON.stringify([cleanFirId]),
            matched_fields: JSON.stringify([{ field: 'fir_id', value_pattern: cleanFirId }]),
            reasoning_summary: `Compiled case information, offender lists, and MO tags. Successfully converted HTML format to PDF binary using SmartBrowz.`,
            confidence_score: 1.0,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            verification_status: 'unverified'
        });

        basicIO.write(JSON.stringify({
            status: 'success',
            fir_id: cleanFirId,
            evidence_record_id: recordId,
            pdf_base64: pdfBuffer.toString('base64')
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};
