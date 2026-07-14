const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Locate mock database file
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');

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
    console.log("STARTING ENTITY LINKING & GRAPH NETWORK TEST");
    console.log("=================================================");

    const adapter = getAdapter({});
    // Reset database to ensure clean test execution
    adapter.dbData = adapter.getDefaultDb();
    adapter.saveDb();

    // 1. Seed the FIR first
    await adapter.datastore.insertRow('firs', {
        fir_id: 'FIR-2024-0001',
        station_id: 'LOC_TUMKUR',
        crime_type: 'chain-snatching',
        raw_text: 'Theft incident.'
    });

    // ==========================================
    // STEP 1: Link "Mohd Rafiq"
    // ==========================================
    console.log("\n--- STEP 1: Linking Offender 'Mohd Rafiq' to FIR-2024-0001 ---");
    await handler({
        body: JSON.stringify({
            extracted_name: 'Mohd Rafiq',
            fir_id: 'FIR-2024-0001',
            role: 'accused',
            confidence: 0.95
        }),
        close() {}
    }, testBasicIO);

    console.log(`Offender ID returned for Step 1: "${outputData.offender_id}"`);
    assert.strictEqual(outputData.status, 'success');
    assert.strictEqual(outputData.offender_id, 'OFF_MOHD_RAFIQ');

    // ==========================================
    // STEP 2: Link "Md. Rafique" (Alias - should merge)
    // ==========================================
    console.log("\n--- STEP 2: Linking Alias variant 'Md. Rafique' to FIR-2024-0001 ---");
    await handler({
        body: JSON.stringify({
            extracted_name: 'Md. Rafique',
            fir_id: 'FIR-2024-0001',
            role: 'co-accused',
            confidence: 0.90
        }),
        close() {}
    }, testBasicIO);

    console.log(`Offender ID returned for Step 2: "${outputData.offender_id}"`);
    assert.strictEqual(outputData.status, 'success');
    assert.strictEqual(outputData.offender_id, 'OFF_MOHD_RAFIQ', 'Should resolve to baseline ID');

    // ==========================================
    // STEP 3: Link "Ramesh Kumar" (Negative case - should NOT merge)
    // ==========================================
    console.log("\n--- STEP 3: Linking Unrelated Offender 'Ramesh Kumar' to FIR-2024-0001 ---");
    await handler({
        body: JSON.stringify({
            extracted_name: 'Ramesh Kumar',
            fir_id: 'FIR-2024-0001',
            role: 'co-accused',
            confidence: 0.95
        }),
        close() {}
    }, testBasicIO);

    console.log(`Offender ID returned for Step 3: "${outputData.offender_id}"`);
    assert.strictEqual(outputData.status, 'success');
    assert.notStrictEqual(outputData.offender_id, 'OFF_MOHD_RAFIQ');

    // ==========================================
    // STEP 4: Dump offenders and aliases tables
    // ==========================================
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    console.log("\n--- STEP 4: Dump of the 'offenders' table (expecting exactly 2 rows: Rafiq + Ramesh) ---");
    console.log(JSON.stringify(dbData.tables.offenders, null, 2));
    assert.strictEqual(dbData.tables.offenders.length, 2);

    console.log("\n--- STEP 4 (Cont.): Dump of the 'offender_aliases' table ---");
    console.log(JSON.stringify(dbData.tables.offender_aliases, null, 2));

    // ==========================================
    // STEP 5: Verify and Dump co-accused network links
    // ==========================================
    console.log("\n--- STEP 5: Dump of the 'offender_network_link' table (expecting exactly 1 co-accused edge) ---");
    console.log(JSON.stringify(dbData.tables.offender_network_link, null, 2));
    assert.strictEqual(dbData.tables.offender_network_link.length, 1);
    assert.strictEqual(dbData.tables.offender_network_link[0].offender_id_a, 'OFF_MOHD_RAFIQ');
    assert.strictEqual(dbData.tables.offender_network_link[0].offender_id_b, 'OFF_RAMESH_KUMAR');

    console.log("\n=================================================");
    console.log("ALL ENTITY LINKING TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
