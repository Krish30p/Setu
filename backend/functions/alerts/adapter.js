const fs = require('fs');
const path = require('path');

// Global mock database path
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');

// Security helper: Sanitizes input to prevent ZCQL injection
function sanitizeZCQLString(str) {
    if (typeof str !== 'string') return '';
    const escaped = str.replace(/'/g, "''");
    if (escaped !== str) {
        console.warn(`[WARNING] Input value "${str}" contained single quotes and was SQL-escaped to "${escaped}".`);
    }
    return escaped;
}

// --- 1. SERVICE INTERFACES ---

class DataStoreClient {
    async getRow(tableName, id) { throw new Error("Method not implemented"); }
    async insertRow(tableName, data) { throw new Error("Method not implemented"); }
    async updateRow(tableName, data) { throw new Error("Method not implemented"); }
    async query(sql) { throw new Error("Method not implemented"); }
}

class MailClient {
    async sendEmail(to, subject, body) { throw new Error("Method not implemented"); }
}

// --- 2. EXPLICIT MOCK IMPLEMENTATIONS ---

class MockCatalystDataStore extends DataStoreClient {
    constructor(adapter) {
        super();
        this.adapter = adapter;
    }

    async getRow(tableName, id) {
        this.adapter.loadDb();
        const cleanId = sanitizeZCQLString(id);
        const list = this.adapter.dbData.tables[tableName] || [];
        const idKey = `${tableName.slice(0, -1)}_id`;
        const found = list.find(r => r[idKey] === cleanId || r.id === cleanId || r.mo_id === cleanId || r.phone_id === cleanId || r.vehicle_id === cleanId || r.record_id === cleanId);
        if (!found) throw new Error(`Row not found: ${cleanId} in ${tableName}`);
        return found;
    }

    async insertRow(tableName, data) {
        this.adapter.loadDb();
        if (!this.adapter.dbData.tables[tableName]) {
            this.adapter.dbData.tables[tableName] = [];
        }
        this.adapter.dbData.tables[tableName].push(data);
        this.adapter.saveDb();
        return data;
    }

    async updateRow(tableName, data) {
        this.adapter.loadDb();
        const list = this.adapter.dbData.tables[tableName] || [];
        const idKey = Object.keys(data).find(k => k.endsWith('_id') || k === 'id');
        const idx = list.findIndex(r => r[idKey] === data[idKey]);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...data };
        } else {
            list.push(data);
        }
        this.adapter.saveDb();
        return data;
    }

    async query(sql) {
        this.adapter.loadDb();
        throw new Error(`Mock DB Error: Unrecognized query string "${sql}". Ensure your mock data layer has defined this pattern.`);
    }
}

class MockMailClient extends MailClient {
    async sendEmail(to, subject, body) {
        console.log(`[MOCK Mail] Sending alert email to ${to}`);
        console.log(`[MOCK Mail] Subject: ${subject}`);
        console.log(`[MOCK Mail] Body Snippet: ${body.substring(0, 100)}...`);
        return { success: true };
    }
}

// --- 3. REAL CATALYST SERVICES IMPLEMENTATIONS ---

class RealCatalystDataStore extends DataStoreClient {
    constructor(app) {
        super();
        this.app = app;
    }

    async getRow(tableName, id) {
        return await this.app.datastore().table(tableName).row(id);
    }

    async insertRow(tableName, data) {
        return await this.app.datastore().table(tableName).insertRow(data);
    }

    async updateRow(tableName, data) {
        return await this.app.datastore().table(tableName).updateRow(data);
    }

    async query(sql) {
        return await this.app.zcql().executeZCQLQuery(sql);
    }
}

class RealMailClient extends MailClient {
    constructor(app) {
        super();
        this.app = app;
    }

    async sendEmail(to, subject, body) {
        // Send email using Zoho Catalyst Email/Mail service
        return await this.app.email().sendMail({
            to_email: [to],
            subject: subject,
            content: body,
            html_mode: true
        });
    }
}

// --- 4. CONFIGURABLE ADAPTER CONTAINER ---

class ClientAdapter {
    constructor(context) {
        const useMock = process.env.USE_MOCK === 'true';

        if (useMock) {
            console.log("SETU Platform: [MOCK MODE] Initializing Stub Services");
            this.loadDb();
            this.datastore = new MockCatalystDataStore(this);
            this.mail = new MockMailClient();
        } else {
            console.log("SETU Platform: [LIVE MODE] Initializing Catalyst Cloud Services");
            const catalyst = require('zcatalyst-sdk-node');
            const app = catalyst.initialize(context);
            this.datastore = new RealCatalystDataStore(app);
            this.mail = new RealMailClient(app);
        }
    }

    loadDb() {
        if (fs.existsSync(DB_FILE)) {
            try {
                this.dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            } catch (e) {
                this.dbData = this.getDefaultDb();
            }
        } else {
            this.dbData = this.getDefaultDb();
            this.saveDb();
        }
    }

    saveDb() {
        fs.writeFileSync(DB_FILE, JSON.stringify(this.dbData, null, 2), 'utf8');
    }

    getDefaultDb() {
        return {
            tables: {
                locations: [],
                firs: [],
                offenders: [],
                offender_aliases: [],
                offender_fir_link: [],
                offender_network_link: [],
                witnesses: [],
                witness_fir_link: [],
                witness_proximity_link: [],
                mo_tags: [],
                fir_mo_link: [],
                explainability_records: [],
                phone_numbers: [],
                offender_phone_link: [],
                vehicles: [],
                offender_vehicle_link: []
            },
            nosql: {
                fir_raw_documents: [],
                case_type_attributes: [],
                conversation_history: [],
                anomaly_flags: []
            }
        };
    }
}

module.exports = {
    getAdapter: (context) => new ClientAdapter(context),
    sanitizeZCQLString
};
