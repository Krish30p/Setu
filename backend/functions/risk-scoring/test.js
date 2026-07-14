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
    console.log("STARTING RISK SCORING METHODOLOGY TEST");
    console.log("=================================================");

    const adapter = getAdapter({});
    // Reset database to seed clean RAG data
    adapter.dbData = adapter.getDefaultDb();
    adapter.saveDb();

    // ==========================================
    // STEP 1: Seed Offender A (High Risk: 3 cases, recent violent robbery, has MO shift flag)
    // ==========================================
    console.log("\n--- STEP 1: Seeding Offender A (High Risk: OFF_RAFIQ) ---");
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_RAFIQ',
        full_name: 'Mohd Rafiq',
        gender: null,
        age_at_first_offense: null,
        risk_score: 0.0,
        risk_score_last_updated: null,
        bail_status: null
    });

    await adapter.datastore.insertRow('firs', { fir_id: 'FIR-001', crime_type: 'chain-snatching' });
    await adapter.datastore.insertRow('firs', { fir_id: 'FIR-002', crime_type: 'chain-snatching' });
    await adapter.datastore.insertRow('firs', { fir_id: 'FIR-003', crime_type: 'armed-robbery' }); // Violent crime type

    await adapter.datastore.insertRow('offender_fir_link', { id: 'L1', offender_id: 'OFF_RAFIQ', fir_id: 'FIR-001', role: 'primary' });
    await adapter.datastore.insertRow('offender_fir_link', { id: 'L2', offender_id: 'OFF_RAFIQ', fir_id: 'FIR-002', role: 'primary' });
    await adapter.datastore.insertRow('offender_fir_link', { id: 'L3', offender_id: 'OFF_RAFIQ', fir_id: 'FIR-003', role: 'primary' });

    // Seed MO Shift Anomaly Flag in NoSQL
    await adapter.nosql.insertItem('anomaly_flags', {
        flag_id: 'ANOM_OFF_RAFIQ_1',
        offender_id: 'OFF_RAFIQ',
        flag_type: 'mo_shift',
        confidence: 0.85
    });

    adapter.saveDb();

    // Run high risk scoring
    await handler({
        body: JSON.stringify({ offender_id: 'OFF_RAFIQ', fir_id: 'FIR-003' }),
        close() {}
    }, testBasicIO);

    console.log("High Risk Offender Output:", JSON.stringify(outputData, null, 2));
    
    // Assertions:
    // math: (3/10 * 0.40) + (1.0 * 0.40) + 0.20 = 0.12 + 0.40 + 0.20 = 0.72
    assert.strictEqual(outputData.status, 'success');
    assert(Math.abs(outputData.risk_score - 0.72) < 0.01);
    assert(outputData.witness_tampering_risk > 0.50);

    // ==========================================
    // STEP 2: Seed Offender B (Low Risk: Negative Case - 1 case, minor property crime, no MO shift)
    // ==========================================
    console.log("\n--- STEP 2: Seeding Offender B (Low Risk: OFF_RAMESH) ---");
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_RAMESH',
        full_name: 'Ramesh Kumar',
        gender: null,
        age_at_first_offense: null,
        risk_score: 0.0,
        risk_score_last_updated: null,
        bail_status: null
    });

    await adapter.datastore.insertRow('firs', { fir_id: 'FIR-004', crime_type: 'online-fraud' });
    await adapter.datastore.insertRow('offender_fir_link', { id: 'L4', offender_id: 'OFF_RAMESH', fir_id: 'FIR-004', role: 'primary' });
    adapter.saveDb();

    // Run low risk scoring
    await handler({
        body: JSON.stringify({ offender_id: 'OFF_RAMESH', fir_id: 'FIR-004' }),
        close() {}
    }, testBasicIO);

    console.log("Low Risk Offender Output:", JSON.stringify(outputData, null, 2));

    // Assertions:
    // math: (1/10 * 0.40) + (0.3 * 0.40) + 0.0 = 0.04 + 0.12 = 0.16
    assert.strictEqual(outputData.status, 'success');
    assert(Math.abs(outputData.risk_score - 0.16) < 0.01);

    // ==========================================
    // STEP 3: Verify and Dump database tables
    // ==========================================
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

    console.log("\n--- STEP 3: Dump of the 'offenders' table showing calculations & null demographics ---");
    console.log(JSON.stringify(dbData.tables.offenders, null, 2));
    
    // Verify null values preserved
    const offenderRafiq = dbData.tables.offenders.find(o => o.offender_id === 'OFF_RAFIQ');
    assert.strictEqual(offenderRafiq.gender, null);
    assert.strictEqual(offenderRafiq.age_at_first_offense, null);
    assert.strictEqual(offenderRafiq.risk_score, 0.72);

    console.log("\n--- STEP 3 (Cont.): Dump of 'explainability_records' table ---");
    console.log(JSON.stringify(dbData.tables.explainability_records, null, 2));

    console.log("\n=================================================");
    console.log("ALL RISK SCORING TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
