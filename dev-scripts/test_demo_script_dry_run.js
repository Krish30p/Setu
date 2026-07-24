const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const serverProcess = spawn('node', [path.join(__dirname, '..', 'backend', 'server.cjs')], { stdio: 'ignore' });
serverProcess.on('error', () => {});

function requestGet(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5001,
            path: urlPath,
            method: 'GET'
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

function requestPost(urlPath, bodyData) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(bodyData);
        const req = http.request({
            hostname: 'localhost',
            port: 5001,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function runDryRun() {
    await new Promise(r => setTimeout(r, 1000));

    console.log("==========================================================");
    console.log("STARTING FULL DEMO SCRIPT DRY RUN (ROLE: ANALYST)");
    console.log("==========================================================");

    const session = {
        role: 'analyst',
        district: 'Tumkur',
        username: 'ANALYST_K_PATEL'
    };

    // SETUP
    console.log("\n[SETUP] Seeding graph data...");
    const seedRes = await requestPost('/api/seed-graph', {});
    console.log("-> Seed result:", seedRes.status);

    // STEP 2: Ask the System
    console.log("\n[STEP 2 - Ask System] Conversational search for Md. Rafique across districts...");
    const chatRes = await requestPost('/api/chat-query', {
        query: "show me cases linked to Md. Rafique across districts",
        role: session.role,
        district: session.district
    });
    console.log("-> Full Chat Query Answer:\n" + chatRes.answer);

    // STEP 3: Explainability & Graph
    console.log("\n[STEP 3 - Explainability & Graph] Retrieving knowledge graph for Analyst...");
    const graphRes = await requestGet(`/api/get-graph?role=${session.role}&district=${session.district}`);
    console.log("-> Total FIRs retrieved:", graphRes.firs.length);
    console.log("-> Total Locations retrieved:", graphRes.locations.length);
    console.log("-> Total Offenders retrieved:", graphRes.offenders.length);
    console.log("-> Seed Explainability Records:", graphRes.explainability_records.length);

    // STEP 4: Pattern-Break Anomaly Detection
    console.log("\n[STEP 4 - Pattern-Break Anomaly] Scanning MO anomalies for OFF_MOHD_RAFIQ...");
    const anomalyRes = await requestPost('/api/anomaly-detection', {
        offender_id: 'OFF_MOHD_RAFIQ',
        fir_id: 'FIR-2024-0117',
        role: session.role,
        district: session.district
    });
    console.log("-> Anomaly flag raised:", anomalyRes.raised_anomaly_flag);
    console.log("-> Deviation score:", (anomalyRes.deviation_score * 100).toFixed(0) + "%");

    // STEP 5: Risk Scoring & Witness Tampering Risk
    console.log("\n[STEP 5 - Risk Scoring] Calculating reoffense & witness risk for OFF_MOHD_RAFIQ...");
    const riskRes = await requestPost('/api/risk-scoring', {
        offender_id: 'OFF_MOHD_RAFIQ',
        fir_id: 'FIR-2024-0001',
        role: session.role,
        district: session.district
    });
    console.log("-> Reoffense risk score:", (riskRes.risk_score * 100).toFixed(0) + "%");
    console.log("-> Witness tampering risk:", (riskRes.witness_tampering_risk * 100).toFixed(0) + "%");
    console.log("-> Witness tampering reasoning:", riskRes.witness_tampering_reasoning);

    // STEP 6: PDF Export & Governance
    console.log("\n[STEP 6 - PDF Export & Governance] Exporting investigation chat transcript as PDF...");
    const pdfRes = await requestPost('/api/report-generator', {
        type: 'chat',
        title: 'SETU Investigation Chat Transcript - Live Pitch Demo',
        generated_by: session.username,
        messages: [
            { speaker: 'user', text: "show me cases linked to Md. Rafique across districts" },
            { speaker: 'system', text: chatRes.answer },
            { speaker: 'user', text: "scan for Modus Operandi anomalies on OFF_MOHD_RAFIQ" },
            { speaker: 'system', text: `Anomaly Flag Raised: ${anomalyRes.raised_anomaly_flag}` }
        ]
    });
    console.log("-> PDF generation status:", pdfRes.status);
    console.log("-> Evidence record ID:", pdfRes.evidence_record_id);

    // AUDIT LOG CHECK: Inspect total explainability_records generated across all steps
    const fs = require('fs');
    const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'test_db.json'), 'utf8'));
    const records = dbData.tables.explainability_records || [];
    console.log("\n--- EXPLAINABILITY AUDIT TRAIL RECORDS IN DB (" + records.length + " Total) ---");
    records.forEach(r => {
        console.log(`- [${r.function_name}] ID: ${r.record_id} | Type: ${r.output_type} | Reasoning: ${r.reasoning_summary.substring(0, 75)}...`);
    });

    console.log("\n==========================================================");
    console.log("DEMO SCRIPT DRY RUN COMPLETED SUCCESSFULLY WITH 0 ERRORS!");
    console.log("==========================================================");

    serverProcess.kill();
    process.exit(0);
}

runDryRun().catch(err => {
    console.error(err);
    serverProcess.kill();
    process.exit(1);
});
