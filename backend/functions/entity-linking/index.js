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
        const { extracted_name, fir_id, role = 'co-accused', confidence = 0.90 } = body;

        if (!extracted_name || !fir_id) {
            basicIO.write(JSON.stringify({ status: 'error', message: 'Missing mandatory fields: extracted_name, fir_id' }));
            context.close();
            return;
        }

        // Sanitize incoming parameters to prevent SQL injection
        const cleanExtractedName = sanitizeZCQLString(extracted_name);
        const cleanFirId = sanitizeZCQLString(fir_id);

        // 1. Fetch all existing offenders and their aliases
        const offenderRows = await adapter.datastore.query("SELECT offender_id, full_name FROM offenders");
        const aliasRows = await adapter.datastore.query("SELECT offender_id, alias_name FROM offender_aliases");

        // Structure candidates
        const candidates = offenderRows.map(o => {
            const row = o.offenders;
            const offender_id = row.offender_id;
            const name = row.full_name;
            const aliases = aliasRows
                .filter(a => a.offender_aliases.offender_id === offender_id)
                .map(a => a.offender_aliases.alias_name);
            return { offender_id, name, aliases };
        });

        // 2. Perform Name Matching (QuickML LLM vs Fallback)
        let matchResult = { is_likely_match: false, matched_offender_id: null, confidence: 0.0, reasoning_summary: 'No candidates available' };
        
        if (candidates.length > 0) {
            const quickmlEndpoint = process.env.QUICKML_LLM_ENDPOINT;
            if (quickmlEndpoint && process.env.NODE_ENV !== 'test') {
                try {
                    const prompt = `System:\nGiven a newly extracted name, determine if it matches an existing offender. Respond ONLY with JSON: {"is_likely_match": true/false, "matched_offender_id": "...", "confidence": 0-1, "reasoning_summary": "..."}\n\nUser:\nNew name: "${cleanExtractedName}"\nCandidates: ${JSON.stringify(candidates)}`;
                    const response = await adapter.quickml.executeLLM(quickmlEndpoint, prompt);
                    matchResult = JSON.parse(response);
                } catch (err) {
                    console.error("QuickML name-matching failed, falling back to deterministic: ", err);
                    matchResult = await adapter.datastore.resolveNameMatch(cleanExtractedName, candidates);
                }
            } else {
                matchResult = await adapter.datastore.resolveNameMatch(cleanExtractedName, candidates);
            }
        }

        let finalOffenderId = matchResult.matched_offender_id;

        // 3. Resolve Offender ID
        if (matchResult.is_likely_match && finalOffenderId) {
            // Register new alias if not already present
            const existingAliases = aliasRows
                .filter(a => a.offender_aliases.offender_id === finalOffenderId)
                .map(a => a.offender_aliases.alias_name);
            if (!existingAliases.includes(cleanExtractedName)) {
                await adapter.datastore.insertRow('offender_aliases', {
                    alias_id: `ALIAS_${finalOffenderId}_${cleanExtractedName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
                    offender_id: finalOffenderId,
                    alias_name: cleanExtractedName
                });
            }
        } else {
            // Create a new offender with null demographics to preserve data integrity
            finalOffenderId = `OFF_${cleanExtractedName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
            await adapter.datastore.insertRow('offenders', {
                offender_id: finalOffenderId,
                full_name: cleanExtractedName,
                gender: null,
                age_at_first_offense: null,
                risk_score: null,
                risk_score_last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19),
                bail_status: null
            });
            // Register their baseline name as an alias
            await adapter.datastore.insertRow('offender_aliases', {
                alias_id: `ALIAS_${finalOffenderId}_${cleanExtractedName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
                offender_id: finalOffenderId,
                alias_name: cleanExtractedName
            });
        }

        // 4. Link to current FIR if not linked
        const linkId = `LINK_${finalOffenderId}_${cleanFirId}`;
        let linkExists = false;
        try {
            await adapter.datastore.getRow('offender_fir_link', linkId);
            linkExists = true;
        } catch (e) {}

        if (!linkExists) {
            await adapter.datastore.insertRow('offender_fir_link', {
                id: linkId,
                offender_id: finalOffenderId,
                fir_id: cleanFirId,
                role: role === 'accused' ? 'primary' : 'co-accused'
            });
        }

        // 5. Create Co-Accused Network Edges
        // Fetch all offenders linked to this FIR
        const linkedOffendersRows = await adapter.datastore.query(`SELECT offender_id FROM offender_fir_link WHERE fir_id = '${cleanFirId}'`);
        const offenderIds = [...new Set(linkedOffendersRows.map(r => r.offender_fir_link.offender_id))];

        for (let i = 0; i < offenderIds.length; i++) {
            for (let j = i + 1; j < offenderIds.length; j++) {
                const idA = offenderIds[i];
                const idB = offenderIds[j];
                if (idA === idB) continue;
                const edgeId = `EDGE_${idA}_${idB}_${cleanFirId}`;
                
                let edgeExists = false;
                try {
                    await adapter.datastore.getRow('offender_network_link', edgeId);
                    edgeExists = true;
                } catch (e) {}

                if (!edgeExists) {
                    await adapter.datastore.insertRow('offender_network_link', {
                        id: edgeId,
                        offender_id_a: idA,
                        offender_id_b: idB,
                        relationship_type: 'co-accused',
                        source_fir_id: cleanFirId
                    });
                }
            }
        }

        // 6. Write Explainability Record
        const recordId = `EVID_LINK_${finalOffenderId}_${cleanFirId}`;
        await adapter.datastore.insertRow('explainability_records', {
            record_id: recordId,
            output_type: 'entity_link',
            function_name: 'entity-linking',
            model_version: 'v1.0',
            source_fir_ids: JSON.stringify([cleanFirId]),
            matched_fields: JSON.stringify([{ field: 'full_name', value_pattern: cleanExtractedName, confidence }]),
            reasoning_summary: matchResult.is_likely_match 
                ? `Resolved "${cleanExtractedName}" to existing offender ID ${finalOffenderId}. Reasoning: ${matchResult.reasoning_summary}`
                : `Created new offender record for "${cleanExtractedName}" as no matching candidate was found.`,
            confidence_score: matchResult.is_likely_match ? matchResult.confidence : 1.0,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            verification_status: 'unverified'
        });

        basicIO.write(JSON.stringify({
            status: 'success',
            message: 'Entity linking completed successfully',
            offender_id: finalOffenderId,
            is_likely_match: matchResult.is_likely_match,
            evidence_record_id: recordId
        }));

    } catch (e) {
        basicIO.write(JSON.stringify({ status: 'error', message: e.toString(), stack: e.stack }));
    }

    context.close();
};
