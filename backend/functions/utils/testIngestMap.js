const fs = require('fs');
const path = require('path');

// Reconciled configuration switch: Use mock adapter
process.env.USE_MOCK = 'true';

const ingestHandler = require('../fir-ingestion/index.js');
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');

async function runTest() {
    console.log("=================================================");
    console.log("INGESTING NEW DISTRICT CASE FOR MAP VERIFICATION");
    console.log("=================================================");

    // 1. Prepare Request Payload for a completely new district (Mandya)
    const payload = {
        fir_id: 'FIR-2024-9999',
        filing_date: '2024-07-14 11:30:00',
        station_name: 'Mandya Central',
        district_name: 'Mandya',
        raw_text: 'Suresh Kumar was caught driving a stolen motor vehicle in Mandya Central jurisdiction.',
        raw_text_kannada: '',
        crime_type: 'vehicle-theft',
        accused_name: 'Suresh Kumar',
        mo_tags: ['vehicle-theft', 'daytime'],
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

    // 2. Run Ingestion Function
    await ingestHandler(mockContext, mockIO);
    console.log("Ingestion execution response:", JSON.stringify(outputData, null, 2));

    // 3. Inspect updated database locations and firs
    if (fs.existsSync(DB_FILE)) {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const mandyaLoc = db.tables.locations.find(l => l.district_name === 'Mandya');
        const mandyaFir = db.tables.firs.find(f => f.fir_id === 'FIR-2024-9999');

        console.log("\n--- DATABASE VERIFICATION OUTPUT ---");
        console.log("Mandya Location Node in DB:", JSON.stringify(mandyaLoc, null, 2));
        console.log("Mandya FIR Node in DB:", JSON.stringify(mandyaFir, null, 2));

        if (mandyaLoc && mandyaFir) {
            console.log("\nSUCCESS: Real database state contains the 4th district (Mandya) and FIR 9999.");
        } else {
            console.error("\nFAILURE: Mandya nodes were not written to the mock database.");
            process.exit(1);
        }
    }
}

runTest().catch(err => {
    console.error("Test failed: ", err);
    process.exit(1);
});
