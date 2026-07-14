require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;
const DB_FILE = path.join(__dirname, 'test_db.json');

// Default to mock mode if not set in .env
if (!process.env.USE_MOCK) process.env.USE_MOCK = 'true';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

app.use(cors());
app.use(express.json());

// Graph Data Seeding Endpoint
app.post('/api/seed-graph', (req, res) => {
    try {
        const dbData = {
            tables: {
                locations: [
                    { location_id: 'LOC_TUMKUR_TUMKUR_TOWN', station_name: 'Tumkur Town', district_name: 'Tumkur', latitude: 13.3409, longitude: 77.1006 },
                    { location_id: 'LOC_MYSURU_MYSURU_CITY', station_name: 'Mysuru City', district_name: 'Mysuru', latitude: 12.2958, longitude: 76.6394 },
                    { location_id: 'LOC_BENGALURU_KAMPAPURA', station_name: 'Kampapura Station', district_name: 'Bengaluru Rural', latitude: 13.0900, longitude: 77.5700 }
                ],
                firs: [
                    { fir_id: 'FIR-2024-0001', filing_date: '2024-06-01 10:30:00', station_id: 'LOC_TUMKUR_TUMKUR_TOWN', district_id: 'Tumkur', raw_text: 'Chain-snatching reported near bus terminal.', crime_type: 'chain-snatching', status: 'Under investigation' },
                    { fir_id: 'FIR-2024-0002', filing_date: '2024-06-10 16:45:00', station_id: 'LOC_MYSURU_MYSURU_CITY', district_id: 'Mysuru', raw_text: 'Two-wheeler stolen from hospital parking.', crime_type: 'vehicle-theft', status: 'Under investigation' },
                    { fir_id: 'FIR-2024-0117', filing_date: '2024-07-02 22:15:00', station_id: 'LOC_TUMKUR_TUMKUR_TOWN', district_id: 'Tumkur', raw_text: 'Locked house broken into during night hours.', crime_type: 'house-breaking-night', status: 'Under investigation' }
                ],
                offenders: [
                    { offender_id: 'OFF_MOHD_RAFIQ', full_name: 'Mohd Rafiq', gender: null, age_at_first_offense: null, risk_score: 0.72, risk_score_last_updated: '2026-07-14 10:00:00', bail_status: null },
                    { offender_id: 'OFF_RAMESH_KUMAR', full_name: 'Ramesh Kumar', gender: null, age_at_first_offense: null, risk_score: 0.35, risk_score_last_updated: '2026-07-14 10:00:00', bail_status: null }
                ],
                offender_aliases: [
                    { alias_id: 'ALIAS_OFF_MOHD_RAFIQ_MD__RAFIQUE', offender_id: 'OFF_MOHD_RAFIQ', alias_name: 'Md. Rafique' }
                ],
                offender_fir_link: [
                    { id: 'L1', offender_id: 'OFF_MOHD_RAFIQ', fir_id: 'FIR-2024-0001', role: 'primary' },
                    { id: 'L2', offender_id: 'OFF_RAMESH_KUMAR', fir_id: 'FIR-2024-0001', role: 'co-accused' }
                ],
                offender_network_link: [
                    { id: 'EDGE_OFF_MOHD_RAFIQ_OFF_RAMESH_KUMAR_FIR-2024-0001', offender_id_a: 'OFF_MOHD_RAFIQ', offender_id_b: 'OFF_RAMESH_KUMAR', relationship_type: 'co-accused', source_fir_id: 'FIR-2024-0001' }
                ],
                phone_numbers: [
                    { phone_id: '9876543210', first_seen_case_id: 'FIR-2024-0001', last_seen_case_id: 'FIR-2024-0001' }
                ],
                offender_phone_link: [
                    { id: 'P1', offender_id: 'OFF_MOHD_RAFIQ', phone_id: '9876543210', first_seen_date: '2026-07-14 10:00:00', last_seen_date: '2026-07-14 10:00:00' },
                    { id: 'P2', offender_id: 'OFF_RAMESH_KUMAR', phone_id: '9876543210', first_seen_date: '2026-07-14 10:00:00', last_seen_date: '2026-07-14 10:00:00' }
                ],
                explainability_records: [
                    {
                        record_id: 'EVID_EDGE_OFF_MOHD_RAFIQ_OFF_RAMESH_KUMAR_FIR-2024-0001',
                        output_type: 'entity_link',
                        function_name: 'entity-linking',
                        model_version: 'v1.0',
                        source_fir_ids: '["FIR-2024-0001"]',
                        matched_fields: '[{"field":"co-accused","value_pattern":"Mohd Rafiq / Ramesh Kumar"}]',
                        reasoning_summary: 'Co-accused network edge established from joint arrest records in FIR-2024-0001.',
                        confidence_score: 0.95,
                        timestamp: '2026-07-14 10:00:00',
                        verification_status: 'unverified'
                    },
                    {
                        record_id: 'EVID_PHONE_LINK_9876543210',
                        output_type: 'entity_link',
                        function_name: 'fir-ingestion',
                        model_version: 'v1.0',
                        source_fir_ids: '["FIR-2024-0001"]',
                        matched_fields: '[{"field":"phone_number","value_pattern":"9876543210"}]',
                        reasoning_summary: 'Suspects linked via shared phone number 9876543210 appearing in mutual registration links.',
                        confidence_score: 0.99,
                        timestamp: '2026-07-14 10:00:00',
                        verification_status: 'unverified'
                    }
                ],
                vehicles: [],
                offender_vehicle_link: [],
                witnesses: [],
                witness_fir_link: [],
                witness_proximity_link: [],
                mo_tags: [],
                fir_mo_link: []
            },
            nosql: {
                fir_raw_documents: [],
                case_type_attributes: [],
                conversation_history: [],
                anomaly_flags: [
                    { flag_id: 'ANOM_OFF_MOHD_RAFIQ_1', offender_id: 'OFF_MOHD_RAFIQ', flag_type: 'mo_shift', confidence: 0.85 }
                ]
            }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');
        res.json({ status: 'success', message: 'Graph demo dataset seeded successfully.' });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.toString() });
    }
});

// Graph Data Retrieval Endpoint
app.get('/api/get-graph', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            res.json({
                status: 'success',
                offenders: dbData.tables.offenders || [],
                aliases: dbData.tables.offender_aliases || [],
                network_links: dbData.tables.offender_network_link || [],
                phone_links: dbData.tables.offender_phone_link || [],
                vehicle_links: dbData.tables.offender_vehicle_link || [],
                anomaly_flags: dbData.nosql.anomaly_flags || [],
                explainability_records: dbData.tables.explainability_records || [],
                locations: dbData.tables.locations || [],
                firs: dbData.tables.firs || []
            });
        } else {
            res.json({ status: 'success', offenders: [], aliases: [], network_links: [], phone_links: [], vehicle_links: [], anomaly_flags: [], explainability_records: [], locations: [], firs: [] });
        }
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.toString() });
    }
});

// Generic endpoint routing to Catalyst serverless handlers
app.post('/api/:functionName', async (req, res) => {
    const { functionName } = req.params;
    console.log(`[API Gateway Simulation] Routing request to function: ${functionName}`);

    try {
        const handlerPath = path.join(__dirname, 'functions', functionName, 'index.js');
        
        // Clear require cache to reload DB dynamically across requests
        delete require.cache[require.resolve(handlerPath)];
        
        const handler = require(handlerPath);

        let responseSent = false;
        let outputBuffer = "";

        const mockContext = {
            body: JSON.stringify(req.body),
            close() {
                if (!responseSent) {
                    responseSent = true;
                    try {
                        const parsed = JSON.parse(outputBuffer);
                        res.json(parsed);
                    } catch (e) {
                        res.send(outputBuffer);
                    }
                }
            }
        };

        const mockBasicIO = {
            write(data) {
                outputBuffer += data;
            }
        };

        await handler(mockContext, mockBasicIO);

    } catch (err) {
        console.error(`[API Error] Failed to execute ${functionName}:`, err);
        res.status(500).json({ status: 'error', message: err.toString(), stack: err.stack });
    }
});

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`SETU Platform Local API Server listening on port ${PORT}`);
    console.log(`=================================================`);
});
