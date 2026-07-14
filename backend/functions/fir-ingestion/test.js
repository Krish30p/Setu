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

// Require the handler
const handler = require('./index.js');

// Test Case 1: Baseline Offender "Mohd Rafiq"
const firstCaseContext = {
    body: JSON.stringify({
        fir_id: 'FIR-2024-0001',
        filing_date: '2024-06-01 10:30:00',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur',
        latitude: 13.3379,
        longitude: 77.1173,
        raw_text: 'Mohd Rafiq was arrested for chain snatching.',
        crime_type: 'chain-snatching'
    }),
    close() {}
};

// Test Case 2: Alias variant "Md. Rafique" (should merge)
const secondCaseContext = {
    body: JSON.stringify({
        fir_id: 'FIR-2024-0002',
        filing_date: '2024-06-02 14:15:00',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur',
        latitude: 13.3379,
        longitude: 77.1173,
        raw_text: 'Md. Rafique was spotted in a vehicle.',
        crime_type: 'chain-snatching'
    }),
    close() {}
};

// Test Case 3: Unrelated Offender "Suresh Kumar" (should NOT merge)
const thirdCaseContext = {
    body: JSON.stringify({
        fir_id: 'FIR-2024-0003',
        filing_date: '2024-06-03 16:45:00',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur',
        latitude: 13.3379,
        longitude: 77.1173,
        raw_text: 'Suresh Kumar committed an armed robbery.',
        crime_type: 'armed-robbery'
    }),
    close() {}
};

// Test Case 4: Variant "Mohammed Rafiq" (prefix-collapse test, should merge to OFF_MOHD_RAFIQ)
const fourthCaseContext = {
    body: JSON.stringify({
        fir_id: 'FIR-2024-0004',
        filing_date: '2024-06-04 11:20:00',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur',
        latitude: 13.3379,
        longitude: 77.1173,
        raw_text: 'Mohammed Rafiq was present near the market area.',
        crime_type: 'chain-snatching'
    }),
    close() {}
};

let outputData = null;
const testBasicIO = {
    write(data) {
        outputData = JSON.parse(data);
    }
};

async function runTest() {
    console.log("=================================================");
    console.log("STARTING SEQUENTIAL INGESTION & ALIAS RESOLUTION TEST");
    console.log("=================================================");

    // ==========================================
    // 1. Ingest Case 1 (Mohd Rafiq)
    // ==========================================
    console.log("\n--- STEP 1: Ingesting Case 1 (Mohd Rafiq) ---");
    await handler(firstCaseContext, testBasicIO);
    
    let dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const link1 = dbData.tables.offender_fir_link.find(l => l.fir_id === 'FIR-2024-0001');
    const offenderId1 = link1.offender_id;
    console.log(`Offender ID returned for Case 1: "${offenderId1}"`);

    // ==========================================
    // 2. Ingest Case 2 (Md. Rafique)
    // ==========================================
    console.log("\n--- STEP 2: Ingesting Case 2 (Md. Rafique) ---");
    await handler(secondCaseContext, testBasicIO);

    dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const link2 = dbData.tables.offender_fir_link.find(l => l.fir_id === 'FIR-2024-0002');
    const offenderId2 = link2.offender_id;
    console.log(`Offender ID returned for Case 2: "${offenderId2}"`);

    assert.strictEqual(offenderId2, offenderId1, "Case 2 must resolve to the same baseline offender ID");

    // ==========================================
    // 3. Ingest Case 3 (Suresh Kumar - Unrelated name)
    // ==========================================
    console.log("\n--- STEP 3: Ingesting Case 3 (Suresh Kumar - Unrelated name) ---");
    await handler(thirdCaseContext, testBasicIO);

    dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const link3 = dbData.tables.offender_fir_link.find(l => l.fir_id === 'FIR-2024-0003');
    const offenderId3 = link3.offender_id;
    console.log(`Offender ID returned for Case 3: "${offenderId3}"`);

    assert.notStrictEqual(offenderId3, offenderId1, "Suresh Kumar must NOT be merged with Mohd Rafiq");

    // ==========================================
    // 4. Ingest Case 4 (Mohammed Rafiq - Prefix normalization test)
    // ==========================================
    console.log("\n--- STEP 4: Ingesting Case 4 (Mohammed Rafiq - Prefix normalization test) ---");
    await handler(fourthCaseContext, testBasicIO);

    dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const link4 = dbData.tables.offender_fir_link.find(l => l.fir_id === 'FIR-2024-0004');
    const offenderId4 = link4.offender_id;
    console.log(`Offender ID returned for Case 4: "${offenderId4}"`);

    // Verify it resolves to OFF_MOHD_RAFIQ
    assert.strictEqual(offenderId4, offenderId1, "Mohammed Rafiq must resolve to the same baseline offender ID via prefix-collapse");

    // ==========================================
    // 5. Dump offenders table (expecting exactly 2 rows)
    // ==========================================
    console.log("\n--- STEP 5: Dump of 'offenders' table (expecting exactly 2 rows: Rafiq + Kumar) ---");
    console.log(JSON.stringify(dbData.tables.offenders, null, 2));
    assert.strictEqual(dbData.tables.offenders.length, 2);

    // ==========================================
    // 6. Dump offender_aliases table
    // ==========================================
    console.log("\n--- STEP 6: Dump of 'offender_aliases' table ---");
    console.log(JSON.stringify(dbData.tables.offender_aliases, null, 2));
    
    const aliasMd = dbData.tables.offender_aliases.find(a => a.alias_name === 'Md. Rafique');
    const aliasMoh = dbData.tables.offender_aliases.find(a => a.alias_name === 'Mohammed Rafiq');
    assert(aliasMd);
    assert(aliasMoh);
    assert.strictEqual(aliasMd.offender_id, 'OFF_MOHD_RAFIQ');
    assert.strictEqual(aliasMoh.offender_id, 'OFF_MOHD_RAFIQ');

    console.log("\n=================================================");
    console.log("ALL ALIAS RESOLUTION TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
