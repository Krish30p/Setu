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
    console.log("STARTING ALERTS NOTIFICATION ENGINE TEST");
    console.log("=================================================");

    const adapter = getAdapter({});
    adapter.dbData = adapter.getDefaultDb();
    
    // Seed High Risk Offender A
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_RAFIQ',
        full_name: 'Mohd Rafiq',
        gender: null,
        age_at_first_offense: null,
        risk_score: 0.72,
        risk_score_last_updated: '2026-07-14 10:00:00',
        bail_status: null
    });

    // Seed Low Risk Offender B (Negative Case - should NOT trigger alert)
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_RAMESH',
        full_name: 'Ramesh Kumar',
        gender: null,
        age_at_first_offense: null,
        risk_score: 0.16,
        risk_score_last_updated: '2026-07-14 10:00:00',
        bail_status: null
    });

    adapter.saveDb();

    // ==========================================
    // 1. Run for high risk offender
    // ==========================================
    console.log("\n--- STEP 1: Running Alert check for High Risk Offender (OFF_RAFIQ) ---");
    await handler({
        body: JSON.stringify({ offender_id: 'OFF_RAFIQ', recipient_email: 'investigator@ksp.gov.in' }),
        close() {}
    }, testBasicIO);

    console.log("High Risk Alert Output:", JSON.stringify(outputData, null, 2));
    assert.strictEqual(outputData.status, 'success');
    assert.strictEqual(outputData.alert_triggered, true, "Alert must be triggered for OFF_RAFIQ (0.72 >= 0.70)");

    // ==========================================
    // 2. Run for low risk offender
    // ==========================================
    console.log("\n--- STEP 2: Running Alert check for Low Risk Offender (OFF_RAMESH) ---");
    await handler({
        body: JSON.stringify({ offender_id: 'OFF_RAMESH', recipient_email: 'investigator@ksp.gov.in' }),
        close() {}
    }, testBasicIO);

    console.log("Low Risk Alert Output:", JSON.stringify(outputData, null, 2));
    assert.strictEqual(outputData.status, 'success');
    assert.strictEqual(outputData.alert_triggered, false, "Alert must NOT be triggered for OFF_RAMESH (0.16 < 0.70)");

    // ==========================================
    // 3. Verify explainability logs
    // ==========================================
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    console.log("\n--- STEP 3: Dump of 'explainability_records' table (expecting exactly 1 alert record) ---");
    console.log(JSON.stringify(dbData.tables.explainability_records, null, 2));
    assert.strictEqual(dbData.tables.explainability_records.length, 1);
    assert.strictEqual(dbData.tables.explainability_records[0].output_type, 'alert_notification');

    console.log("\n=================================================");
    console.log("ALL ALERTS TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
