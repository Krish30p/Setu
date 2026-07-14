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
    console.log("STARTING SMARTBROWZ PDF REPORT GENERATOR TEST");
    console.log("=================================================");

    const adapter = getAdapter({});
    // Reset database to seed clean report data
    adapter.dbData = adapter.getDefaultDb();
    
    // Seed Location
    await adapter.datastore.insertRow('locations', {
        location_id: 'LOC_TUMKUR_TUMKUR_TOWN',
        station_name: 'Tumkur Town',
        district_name: 'Tumkur'
    });

    // Seed Offender
    await adapter.datastore.insertRow('offenders', {
        offender_id: 'OFF_MOHD_RAFIQ',
        full_name: 'Mohd Rafiq',
        gender: null,
        age_at_first_offense: null,
        risk_score: null,
        bail_status: null
    });

    // Seed Case
    await adapter.datastore.insertRow('firs', {
        fir_id: 'FIR-2024-0117',
        filing_date: '2024-06-01 10:30:00',
        station_id: 'LOC_TUMKUR_TUMKUR_TOWN',
        district_id: 'Tumkur',
        raw_text: 'Mohd Rafiq was arrested for chain snatching in Tumkur.',
        crime_type: 'chain-snatching',
        status: 'Under investigation'
    });

    // Link Offender and Case
    await adapter.datastore.insertRow('offender_fir_link', {
        id: 'LINK_OFF_MOHD_RAFIQ_FIR-2024-0117',
        offender_id: 'OFF_MOHD_RAFIQ',
        fir_id: 'FIR-2024-0117',
        role: 'primary'
    });

    adapter.saveDb();

    // Run PDF generator
    await handler({
        body: JSON.stringify({ fir_id: 'FIR-2024-0117' }),
        close() {}
    }, testBasicIO);

    console.log("Report Output Response (PDF Base64 length = " + outputData.pdf_base64.length + "):", JSON.stringify({
        status: outputData.status,
        fir_id: outputData.fir_id,
        evidence_record_id: outputData.evidence_record_id,
        pdf_prefix: outputData.pdf_base64.substring(0, 40) + "..."
    }, null, 2));

    // Assertions
    assert.strictEqual(outputData.status, 'success');
    assert.strictEqual(outputData.fir_id, 'FIR-2024-0117');
    
    // Verify base64 decoded string starts with %PDF (mock signature)
    const decoded = Buffer.from(outputData.pdf_base64, 'base64').toString();
    assert(decoded.startsWith('%PDF'));

    // Verify explainability record
    const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    console.log("\nDump of 'explainability_records' table:");
    console.log(JSON.stringify(dbData.tables.explainability_records, null, 2));
    assert.strictEqual(dbData.tables.explainability_records.length, 1);
    assert.strictEqual(dbData.tables.explainability_records[0].output_type, 'pdf_report');

    console.log("\n=================================================");
    console.log("ALL PDF REPORT GENERATOR TESTS PASSED SUCCESSFULLY");
    console.log("=================================================");
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
