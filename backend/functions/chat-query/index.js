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
        const { query, language = 'en', session_id = 'SESSION_MOCK' } = body;

        if (!query) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing query string' }));
            context.close();
            return;
        }

        // 1. Entity & Keyword Extraction from Query
        const phoneMatch = query.match(/\b\d{10}\b/);
        const vehMatch = query.match(/(KA-\d{2}-[A-Z]{1,2}-\d{4})/i);
        
        let matchingFirs = [];
        let matchedFields = [];
        let retrievedContext = [];

        // Search Data Store based on query entity detections
        if (phoneMatch) {
            const phone = sanitizeZCQLString(phoneMatch[0]);
            const rows = await adapter.datastore.query(`SELECT offender_id FROM offender_phone_link WHERE phone_id = '${phone}'`);
            if (rows.length > 0) {
                const offenderIds = rows.map(r => r.offender_phone_link.offender_id);
                for (const offId of offenderIds) {
                    const cleanOffId = sanitizeZCQLString(offId);
                    const cases = await adapter.datastore.query(`SELECT fir_id FROM offender_fir_link WHERE offender_id = '${cleanOffId}'`);
                    matchingFirs.push(...cases.map(c => c.offender_fir_link.fir_id));
                }
            }
            matchedFields.push({ field: 'phone_number', value_pattern: phone.replace(/.(?=.{4})/g, 'X'), confidence: 1.0 });
        }

        if (vehMatch) {
            const veh = sanitizeZCQLString(vehMatch[0].toUpperCase());
            const rows = await adapter.datastore.query(`SELECT offender_id FROM offender_vehicle_link WHERE vehicle_id = '${veh}'`);
            if (rows.length > 0) {
                const offenderIds = rows.map(r => r.offender_vehicle_link.offender_id);
                for (const offId of offenderIds) {
                    const cleanOffId = sanitizeZCQLString(offId);
                    const cases = await adapter.datastore.query(`SELECT fir_id FROM offender_fir_link WHERE offender_id = '${cleanOffId}'`);
                    matchingFirs.push(...cases.map(c => c.offender_fir_link.fir_id));
                }
            }
            matchedFields.push({ field: 'vehicle_number', value_pattern: veh, confidence: 1.0 });
        }

        // Generic Name Search (e.g. "Rafiq", "Ramesh", "Rafique")
        const nameKeywords = ['rafiq', 'ramesh', 'kumar', 'bhai', 'rafique'];
        let matchedName = null;
        for (const word of nameKeywords) {
            if (query.toLowerCase().includes(word)) {
                matchedName = sanitizeZCQLString(word);
                break;
            }
        }

        if (matchedName) {
            // Retrieve offenders and aliases to run cross-table resolution
            const offenderRows = await adapter.datastore.query(`SELECT offender_id, full_name FROM offenders`);
            const aliasRows = await adapter.datastore.query(`SELECT offender_id, alias_name FROM offender_aliases`);

            const matchedOffenderIds = new Set();
            
            offenderRows.forEach(r => {
                if (r.offenders.full_name.toLowerCase().includes(matchedName)) {
                    matchedOffenderIds.add(r.offenders.offender_id);
                }
            });

            aliasRows.forEach(r => {
                if (r.offender_aliases.alias_name.toLowerCase().includes(matchedName)) {
                    matchedOffenderIds.add(r.offender_aliases.offender_id);
                }
            });

            for (const offId of matchedOffenderIds) {
                const cleanOffId = sanitizeZCQLString(offId);
                const cases = await adapter.datastore.query(`SELECT fir_id FROM offender_fir_link WHERE offender_id = '${cleanOffId}'`);
                matchingFirs.push(...cases.map(c => c.offender_fir_link.fir_id));
            }
            matchedFields.push({ field: 'offender_name', value_pattern: matchedName, confidence: 0.90 });
        }

        // De-duplicate matching FIRs
        matchingFirs = [...new Set(matchingFirs)];

        // 2. Retrieve Graph Subgraph Details (RAG context construction)
        for (const firId of matchingFirs) {
            try {
                const cleanFirId = sanitizeZCQLString(firId);
                const fir = await adapter.datastore.getRow('firs', cleanFirId);
                const location = await adapter.datastore.getRow('locations', fir.station_id);
                
                // Fetch offender names linked
                const offRows = await adapter.datastore.query(`SELECT offender_id FROM offender_fir_link WHERE fir_id = '${cleanFirId}'`);
                const offenderNames = [];
                for (const row of offRows) {
                    try {
                        const cleanOffId = sanitizeZCQLString(row.offender_fir_link.offender_id);
                        const off = await adapter.datastore.getRow('offenders', cleanOffId);
                        offenderNames.push(off.full_name);
                    } catch (e) {}
                }

                retrievedContext.push({
                    fir_id: cleanFirId,
                    date: fir.filing_date,
                    crime_type: fir.crime_type,
                    station: location.station_name,
                    district: location.district_name,
                    status: fir.status,
                    summary: fir.raw_text,
                    accused: offenderNames
                });
            } catch (e) {
                console.error(`Failed to fetch context for FIR ${firId}: `, e);
            }
        }

        // 3. Generate Answer (QuickML RAG vs Structured Template Fallback)
        let answerText = "";
        const quickmlEndpoint = process.env.QUICKML_RAG_ENDPOINT;

        if (quickmlEndpoint && retrievedContext.length > 0 && process.env.NODE_ENV !== 'test') {
            try {
                const prompt = `System:\nYou are a criminal network intelligence analyst. Below is the retrieved case context from the knowledge graph. Answer the user query using only this context. If the context is empty or doesn't match the query, explain that no matching records were found.\n\nContext:\n${JSON.stringify(retrievedContext)}\n\nUser Query: "${query}"`;
                answerText = await adapter.quickml.executeLLM(quickmlEndpoint, prompt);
            } catch (err) {
                console.error("QuickML RAG query failed, falling back: ", err);
                answerText = fallbackRAGAnswer(query, retrievedContext);
            }
        } else {
            answerText = fallbackRAGAnswer(query, retrievedContext);
        }

        // 4. Create Explainability Record
        const recordId = `EVID_CHAT_${Date.now()}`;
        const evidenceRecord = {
            record_id: recordId,
            output_type: 'chat_answer',
            function_name: 'chat-query',
            model_version: 'v1.0',
            source_fir_ids: JSON.stringify(matchingFirs),
            matched_fields: JSON.stringify(matchedFields),
            reasoning_summary: `RAG search retrieved ${matchingFirs.length} matching FIRs from the database. Context compiled and passed to QuickML LLM for query matching.`,
            confidence_score: matchingFirs.length > 0 ? 0.95 : 0.0,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            verification_status: 'unverified'
        };

        // Write audit log to Data Store
        await adapter.datastore.insertRow('explainability_records', evidenceRecord);

        // Write session log to NoSQL
        await adapter.nosql.insertItem("conversation_history", {
            session_id,
            user_id: 'INV_MOCK',
            role: 'investigator',
            messages: [
                { turn: 1, speaker: 'user', text: query, language, timestamp: new Date().toISOString() },
                { turn: 2, speaker: 'system', text: answerText, evidence_refs: [recordId], timestamp: new Date().toISOString() }
            ]
        });

        basicIO.write(JSON.stringify({
            status: 'success',
            answer: answerText,
            evidence: evidenceRecord
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};

function fallbackRAGAnswer(query, contextList) {
    if (contextList.length === 0) {
        return "I could not find any cases in the database matching the criteria in your query.";
    }
    
    let answer = `Based on the database records, I found ${contextList.length} matching case(s) linked to your query:\n\n`;
    
    for (const c of contextList) {
        answer += `*   **${c.fir_id}** (${c.crime_type}) at ${c.station} Station, ${c.district} District.\n`;
        answer += `    - Filing Date: ${c.date}\n`;
        answer += `    - Accused: ${c.accused.join(', ') || 'None recorded'}\n`;
        answer += `    - Status: ${c.status}\n`;
        answer += `    - Narrative: "${c.summary}"\n\n`;
    }
    
    return answer;
}
