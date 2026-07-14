const fs = require('fs');
const path = require('path');

// Reconciled configuration switch: Use mock adapter
process.env.USE_MOCK = 'true';

const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');
const { getAdapter } = require('../fir-ingestion/adapter.js');
const ingestHandler = require('../fir-ingestion/index.js');

// Simulate the React AnalyticsPage aggregation logic
function calculateAnalytics(dbData) {
    const firList = dbData.tables.firs || [];
    const offenderList = dbData.tables.offenders || [];
    const anomalyList = dbData.nosql.anomaly_flags || [];

    const crimeTypes = {};
    firList.forEach(f => {
        crimeTypes[f.crime_type] = (crimeTypes[f.crime_type] || 0) + 1;
    });

    const riskCategories = { Low: 0, Medium: 0, High: 0 };
    offenderList.forEach(o => {
        const score = o.risk_score;
        if (score === null || score === undefined) {
            riskCategories.Low++;
        } else if (score >= 0.70) {
            riskCategories.High++;
        } else if (score >= 0.40) {
            riskCategories.Medium++;
        } else {
            riskCategories.Low++;
        }
    });

    return {
        totalCases: firList.length,
        totalOffenders: offenderList.length,
        totalAnomalies: anomalyList.length,
        crimeTypes,
        riskCategories
    };
}

async function runVerification() {
    console.log("=================================================");
    console.log("ANALYTICS DYNAMIC SHIFT INTEGRATION VERIFICATION");
    console.log("=================================================");

    const adapter = getAdapter({});
    
    // --- PHASE 1: Reset and Seed Original State (3 Cases) ---
    console.log("\n--- STEP 1: Seeding original state (3 Cases: 2 chain-snatching, 1 vehicle-theft) ---");
    const dbData = adapter.getDefaultDb();
    
    dbData.tables.locations = [
        { location_id: 'LOC_TUMKUR_TUMKUR_TOWN', station_name: 'Tumkur Town', district_name: 'Tumkur', latitude: 13.3409, longitude: 77.1006 },
        { location_id: 'LOC_MYSURU_MYSURU_CITY', station_name: 'Mysuru City', district_name: 'Mysuru', latitude: 12.2958, longitude: 76.6394 }
    ];

    dbData.tables.firs = [
        { fir_id: 'FIR-2024-0001', filing_date: '2024-06-01 10:30:00', station_id: 'LOC_TUMKUR_TUMKUR_TOWN', district_id: 'Tumkur', raw_text: 'Chain snatched.', crime_type: 'chain-snatching', status: 'Under investigation' },
        { fir_id: 'FIR-2024-0002', filing_date: '2024-06-10 16:45:00', station_id: 'LOC_MYSURU_MYSURU_CITY', district_id: 'Mysuru', raw_text: 'Bike stolen.', crime_type: 'vehicle-theft', status: 'Under investigation' },
        { fir_id: 'FIR-2024-0117', filing_date: '2024-07-02 22:15:00', station_id: 'LOC_TUMKUR_TUMKUR_TOWN', district_id: 'Tumkur', raw_text: 'House broken into.', crime_type: 'chain-snatching', status: 'Under investigation' }
    ];

    dbData.tables.offenders = [
        { offender_id: 'OFF_MOHD_RAFIQ', full_name: 'Mohd Rafiq', risk_score: 0.72 }
    ];

    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf8');

    // Run first calculation
    const beforeStats = calculateAnalytics(dbData);
    console.log("BEFORE STATS:", JSON.stringify(beforeStats, null, 2));

    // --- PHASE 2: Ingest Mandya Case (4th Case, crime_type: vehicle-theft) ---
    console.log("\n--- STEP 2: Ingesting FIR-2024-9999 (vehicle-theft) at Mandya ---");
    const payload = {
        fir_id: 'FIR-2024-9999',
        filing_date: '2024-07-14 11:30:00',
        station_name: 'Mandya Central',
        district_name: 'Mandya',
        raw_text: 'Suresh Kumar was caught driving a stolen motor vehicle in Mandya.',
        raw_text_kannada: '',
        crime_type: 'vehicle-theft',
        accused_name: 'Suresh Kumar',
        mo_tags: ['vehicle-theft'],
        demographics: { gender: 'Male', age: 34 }
    };

    let outputData = null;
    const mockIO = {
        write(data) {
            outputData = JSON.parse(data);
        }
    };

    const mockContext = {
        body: JSON.stringify(payload),
        close() {}
    };

    await ingestHandler(mockContext, mockIO);

    // --- PHASE 3: Fetch updated database and calculate stats ---
    const updatedDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const afterStats = calculateAnalytics(updatedDb);
    console.log("AFTER STATS:", JSON.stringify(afterStats, null, 2));

    // Assertions to verify dynamic shift
    console.log("\n--- SHIFT ASSERTION VERIFICATION ---");
    console.log(`Total Cases: ${beforeStats.totalCases} -> ${afterStats.totalCases} (Shift: +${afterStats.totalCases - beforeStats.totalCases})`);
    console.log(`Total Offenders: ${beforeStats.totalOffenders} -> ${afterStats.totalOffenders} (Shift: +${afterStats.totalOffenders - beforeStats.totalOffenders})`);
    console.log(`Vehicle Theft: ${beforeStats.crimeTypes['vehicle-theft'] || 0} -> ${afterStats.crimeTypes['vehicle-theft'] || 0} (Shift: +${(afterStats.crimeTypes['vehicle-theft'] || 0) - (beforeStats.crimeTypes['vehicle-theft'] || 0)})`);

    if (afterStats.totalCases === 4 && afterStats.totalOffenders === 2 && afterStats.crimeTypes['vehicle-theft'] === 2) {
        console.log("\nSUCCESS: Analytics stats shifted dynamically! 100% verified.");
    } else {
        console.error("\nFAILURE: Stats failed to shift correctly.");
        process.exit(1);
    }
}

runVerification().catch(err => {
    console.error("Verification failed: ", err);
    process.exit(1);
});
