const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Locate the persistent database file
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');

// Reconciled configuration switch: Use mock adapter
process.env.USE_MOCK = 'true';

const { getAdapter } = require('./adapter');
const handler = require('./index.js');

// Helper to seed standard cases for tests
async function seedOffenderHistory(adapter, offenderId, historicalCases, newCase) {
    // Clear and reset the database state
    adapter.dbData = adapter.getDefaultDb();
    
    // Insert Offender
    await adapter.datastore.insertRow('offenders', {
        offender_id: offenderId,
        full_name: 'Mohd Rafiq',
        risk_score: 0.5
    });

    // Seed historical cases
    for (let idx = 0; idx < historicalCases.length; idx++) {
        const firId = `FIR-2024-H0${idx}`;
        await adapter.datastore.insertRow('firs', {
            fir_id: firId,
            station_id: 'LOC_TUMKUR',
            crime_type: 'chain-snatching',
            raw_text: 'Historical incident description'
        });
        await adapter.datastore.insertRow('offender_fir_link', {
            id: `LINK_${offenderId}_${firId}`,
            offender_id: offenderId,
            fir_id: firId,
            role: 'primary'
        });
        
        for (const tag of historicalCases[idx]) {
            await adapter.datastore.insertRow('fir_mo_link', {
                id: `MO_LINK_${firId}_${tag}`,
                fir_id: firId,
                mo_id: tag
            });
        }
    }

    // Seed the new case
    const newFirId = newCase.fir_id;
    await adapter.datastore.insertRow('firs', {
        fir_id: newFirId,
        station_id: 'LOC_TUMKUR',
        crime_type: 'new-crime-type',
        raw_text: 'New incident description'
    });
    await adapter.datastore.insertRow('offender_fir_link', {
        id: `LINK_${offenderId}_${newFirId}`,
        offender_id: offenderId,
        fir_id: newFirId,
        role: 'primary'
    });
    
    for (const tag of newCase.tags) {
        await adapter.datastore.insertRow('fir_mo_link', {
            id: `MO_LINK_${newFirId}_${tag}`,
            fir_id: newFirId,
            mo_id: tag
        });
    }

    adapter.saveDb();
}

async function runTests() {
    const adapter = getAdapter({});

    // ==========================================
    // TEST CASE 1: Full MO break (deviation 1.0), 2 historical cases, high identity confidence
    // ==========================================
    console.log("\n--- TEST CASE 1: Full MO shift ---");
    await seedOffenderHistory(
        adapter,
        'OFF_MOHD_RAFIQ',
        [
            ['chain_snatching', 'daytime'],
            ['chain_snatching', 'daytime']
        ],
        { fir_id: 'FIR-2024-0117', tags: ['house_breaking_night', 'nighttime'] }
    );

    let output = null;
    const ioMock = { write(data) { output = JSON.parse(data); } };
    
    await handler({
        body: JSON.stringify({ offender_id: 'OFF_MOHD_RAFIQ', fir_id: 'FIR-2024-0117', identity_confidence: 0.90 }),
        close() {}
    }, ioMock);

    console.log("Result:", JSON.stringify(output, null, 2));
    assert.strictEqual(output.status, 'success');
    assert.strictEqual(output.deviation_score, 1.0);
    assert.strictEqual(output.is_statistically_significant, true);
    assert.strictEqual(output.raised_anomaly_flag, true, "Should trigger anomaly flag");

    // ==========================================
    // TEST CASE 2: Partial MO overlap near the 0.70 threshold (2 shared out of 4 total unique tags)
    // ==========================================
    console.log("\n--- TEST CASE 2: Partial MO overlap (2/4 overlap, deviation 0.667) ---");
    await seedOffenderHistory(
        adapter,
        'OFF_MOHD_RAFIQ',
        [
            ['chain_snatching', 'daytime', 'solo', 'no_weapon'],
            ['chain_snatching', 'daytime', 'solo', 'no_weapon']
        ],
        { fir_id: 'FIR-2024-0117', tags: ['chain_snatching', 'daytime', 'group', 'weapon_used'] }
    );

    await handler({
        body: JSON.stringify({ offender_id: 'OFF_MOHD_RAFIQ', fir_id: 'FIR-2024-0117', identity_confidence: 0.90 }),
        close() {}
    }, ioMock);

    console.log("Result:", JSON.stringify(output, null, 2));
    assert.strictEqual(output.status, 'success');
    // Jaccard similarity: intersection (chain_snatching, daytime) / union (chain_snatching, daytime, solo, no_weapon, group, weapon_used) = 2/6 = 0.333
    // Deviation score: 1.0 - 0.333 = 0.667
    assert(Math.abs(output.deviation_score - 0.667) < 0.01, "Deviation should be close to 0.667");
    assert.strictEqual(output.raised_anomaly_flag, false, "Should NOT trigger anomaly flag (0.667 < 0.70)");

    // ==========================================
    // TEST CASE 3: Only 1 historical case (is_statistically_significant should block flag)
    // ==========================================
    console.log("\n--- TEST CASE 3: Only 1 historical case ---");
    await seedOffenderHistory(
        adapter,
        'OFF_MOHD_RAFIQ',
        [
            ['chain_snatching', 'daytime']
        ],
        { fir_id: 'FIR-2024-0117', tags: ['house_breaking_night', 'nighttime'] }
    );

    await handler({
        body: JSON.stringify({ offender_id: 'OFF_MOHD_RAFIQ', fir_id: 'FIR-2024-0117', identity_confidence: 0.90 }),
        close() {}
    }, ioMock);

    console.log("Result:", JSON.stringify(output, null, 2));
    assert.strictEqual(output.status, 'success');
    assert.strictEqual(output.deviation_score, 1.0);
    assert.strictEqual(output.is_statistically_significant, false);
    assert.strictEqual(output.raised_anomaly_flag, false, "Should NOT trigger anomaly flag for single-case history");

    // ==========================================
    // TEST CASE 4: High deviation but identity_confidence below 0.80
    // ==========================================
    console.log("\n--- TEST CASE 4: Low identity confidence ---");
    await seedOffenderHistory(
        adapter,
        'OFF_MOHD_RAFIQ',
        [
            ['chain_snatching', 'daytime'],
            ['chain_snatching', 'daytime']
        ],
        { fir_id: 'FIR-2024-0117', tags: ['house_breaking_night', 'nighttime'] }
    );

    await handler({
        body: JSON.stringify({ offender_id: 'OFF_MOHD_RAFIQ', fir_id: 'FIR-2024-0117', identity_confidence: 0.70 }),
        close() {}
    }, ioMock);

    console.log("Result:", JSON.stringify(output, null, 2));
    assert.strictEqual(output.status, 'success');
    assert.strictEqual(output.deviation_score, 1.0);
    assert.strictEqual(output.raised_anomaly_flag, false, "Should NOT trigger anomaly flag due to low identity confidence (0.70 < 0.80)");

    console.log("\nAll anomaly-detection test scenarios completed successfully!");
}

runTests().catch(err => {
    console.error("Test execution failed: ", err);
    process.exit(1);
});
