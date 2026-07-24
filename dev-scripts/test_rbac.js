const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// 1. Start server process
const serverProcess = spawn('node', [path.join(__dirname, '..', 'backend', 'server.cjs')], { stdio: 'ignore' });
serverProcess.on('error', () => {});

function request(urlPath, method = 'GET') {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5001,
            path: urlPath,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTest() {
    // Wait 1s for server to start
    await new Promise(r => setTimeout(r, 1000));

    console.log("=== SEEDING GRAPH DATA ===");
    const seedRes = await request('/api/seed-graph', 'POST');
    console.log("Seed Status:", seedRes);

    console.log("\n=======================================================");
    console.log("TEST 1: /api/get-graph for Investigator (Tumkur Scoped)");
    console.log("=======================================================");
    const investigatorRes = await request('/api/get-graph?role=investigator&district=Tumkur');
    console.log("Scoped Role:", investigatorRes.scoped_role);
    console.log("Scoped District:", investigatorRes.scoped_district);
    console.log("FIRs Count:", investigatorRes.firs.length, investigatorRes.firs.map(f => f.fir_id));
    console.log("Locations Count:", investigatorRes.locations.length, investigatorRes.locations.map(l => l.station_name));
    console.log("Offenders Count:", investigatorRes.offenders.length, investigatorRes.offenders.map(o => o.full_name));

    console.log("\n=======================================================");
    console.log("TEST 2: /api/get-graph for Analyst (Cross-District Read)");
    console.log("=======================================================");
    const analystRes = await request('/api/get-graph?role=analyst&district=Tumkur');
    console.log("Scoped Role:", analystRes.scoped_role);
    console.log("Scoped District:", analystRes.scoped_district);
    console.log("FIRs Count:", analystRes.firs.length, analystRes.firs.map(f => f.fir_id));
    console.log("Locations Count:", analystRes.locations.length, analystRes.locations.map(l => l.station_name));
    console.log("Offenders Count:", analystRes.offenders.length, analystRes.offenders.map(o => o.full_name));

    serverProcess.kill();
    process.exit(0);
}

runTest().catch(err => {
    console.error(err);
    serverProcess.kill();
    process.exit(1);
});
