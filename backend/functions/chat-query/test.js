const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Ensure we clean the persistent test DB file at the start of this test run
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');
if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
}

// Reconciled configuration switch: Use mock adapter
process.env.USE_MOCK = 'true';

const { getAdapter } = require('./adapter');
const handler = require('./index.js');

let outputData = null;
const testBasicIO = {
    write(data) {
        outputData = JSON.parse(data);
    }
};

async function runTest() {
    console.log("=================================================");
    console.log("STARTING CROSS-DISTRICT ALIAS RESOLUTION RAG TEST");
    console.log("=================================================");

    const adapter = getAdapter({});
    adapter.dbData = adapter.getDefaultDb();

    // 1. Seed Locations in two different districts
    await adapter.datastore.insertRow('locations', {
        location_id: 'LOC_TUMKUR_TUMKUR_TOWN',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur'
    });
    await adapter.datastore.insertRow('locations', {
        location_id: 'LOC_MYSURU_MYSURU_CITY',
        station_name: 'Mysuru City',
        district_name: 'Mysuru'
    });

    // 2. Seed Unified Offender and Alias
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_MOHD_RAFIQ',
        full_name: 'Mohd Rafiq',
        gender: null,
        age_at_first_offense: null,
        risk_score: null,
        bail_status: null
    });

    await adapter.datastore.insertRow('offender_aliases', {
        alias_id: 'ALIAS_OFF_MOHD_RAFIQ_MD__RAFIQUE',
        offender_id: 'OFF_MOHD_RAFIQ',
        alias_name: 'Md. Rafique'
    });

    // 3. Seed two FIRs in different districts linked to the offender
    await adapter.datastore.insertRow('firs', {
        fir_id: 'FIR-2024-0001',
        filing_date: '2024-06-01 10:30:00',
        station_id: 'LOC_TUMKUR_TUMKUR_TOWN',
        district_id: 'Tumkur',
        raw_text: 'Snatched a gold chain in Tumkur Town.',
        crime_type: 'chain-snatching',
        status: 'Under investigation'
    });

    await adapter.datastore.insertRow('firs', {
        fir_id: 'FIR-2024-0002',
        filing_date: '2024-06-10 16:45:00',
        station_id: 'LOC_MYSURU_MYSURU_CITY',
        district_id: 'Mysuru',
        raw_text: 'Spotted in Mysuru with a stolen vehicle.',
        crime_type: 'vehicle-theft',
        status: 'Under investigation'
    });

    await adapter.datastore.insertRow('offender_fir_link', {
        id: 'L1',
        offender_id: 'OFF_MOHD_RAFIQ',
        fir_id: 'FIR-2024-0001',
        role: 'primary'
    });

    await adapter.datastore.insertRow('offender_fir_link', {
        id: 'L2',
        offender_id: 'OFF_MOHD_RAFIQ',
        fir_id: 'FIR-2024-0002',
        role: 'primary'
    });

    adapter.saveDb();

    // 4. Run the query targeting the alias "Md. Rafique"
    console.log("\n--- EXECUTING DEMO-CRITICAL RAG SEARCH: 'show me cases linked to Md. Rafique across districts' ---");
    await handler({
        body: JSON.stringify({
            query: 'show me cases linked to Md. Rafique across districts',
            language: 'en',
            session_id: 'SESSION-DEMO-RAG'
        }),
        close() {}
    }, testBasicIO);

    console.log("\nResponse Output:", JSON.stringify(outputData, null, 2));

    // Assertions
    assert.strictEqual(outputData.status, 'success');
    // The response must successfully surface BOTH FIRs and explain the links
    assert(outputData.answer.includes('FIR-2024-0001'), "Must retrieve Tumkur Town case");
    assert(outputData.answer.includes('FIR-2024-0002'), "Must retrieve Mysuru City case");
    assert(outputData.answer.includes('Tumkur'), "Must display district Tumkur");
    assert(outputData.answer.includes('Mysuru'), "Must display district Mysuru");

    console.log("\n=================================================");
    console.log("CROSS-DISTRICT RAG SEARCH PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
