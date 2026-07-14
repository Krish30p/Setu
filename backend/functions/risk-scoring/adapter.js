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

class NoSQLClient {
    async insertItem(tableName, data) { throw new Error("Method not implemented"); }
    async findItems(tableName, filterFunc) { throw new Error("Method not implemented"); }
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
        const idKey = Object.keys(data).find(k => k.endsWith('_id') || k === 'id' || k === 'offender_id');
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
        const lower = sql.toLowerCase();
        
        if (lower.includes("select fir_id from offender_fir_link")) {
            const matchOff = sql.match(/offender_id\s*=\s*'([^']+)'/i);
            const targetId = matchOff ? sanitizeZCQLString(matchOff[1]) : '';
            const list = this.adapter.dbData.tables.offender_fir_link || [];
            const filtered = matchOff ? list.filter(r => r.offender_id === targetId) : list;
            return filtered.map(row => ({ offender_fir_link: row }));
        }
        if (lower.includes("select crime_type from firs")) {
            const matchFir = sql.match(/fir_id\s*=\s*'([^']+)'/i);
            const targetId = matchFir ? sanitizeZCQLString(matchFir[1]) : '';
            const list = this.adapter.dbData.tables.firs || [];
            const filtered = matchFir ? list.filter(r => r.fir_id === targetId) : list;
            return filtered.map(row => ({ firs: row }));
        }
        
        throw new Error(`Mock DB Error: Unrecognized query string "${sql}". Ensure your mock data layer has defined this pattern.`);
    }
}

class MockCatalystNoSQL extends NoSQLClient {
    constructor(adapter) {
        super();
        this.adapter = adapter;
    }

    async insertItem(tableName, data) {
        this.adapter.loadDb();
        if (!this.adapter.dbData.nosql[tableName]) {
            this.adapter.dbData.nosql[tableName] = [];
        }
        this.adapter.dbData.nosql[tableName].push(data);
        this.adapter.saveDb();
        return { success: true };
    }

    async findItems(tableName, filterFunc) {
        this.adapter.loadDb();
        const list = this.adapter.dbData.nosql[tableName] || [];
        return list.filter(filterFunc);
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

class RealCatalystNoSQL extends NoSQLClient {
    constructor(app) {
        super();
        this.app = app;
    }

    async insertItem(tableName, data) {
        const table = await this.app.nosql().getTable(tableName);
        const { NoSQLItem } = require('zcatalyst-sdk-node/lib/no-sql');
        return await table.insertItems(NoSQLItem.from(data));
    }

    async findItems(tableName, filterFunc) {
        const table = await this.app.nosql().getTable(tableName);
        const queryResult = await table.query();
        return queryResult.filter(filterFunc);
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
            this.nosql = new MockCatalystNoSQL(this);
        } else {
            console.log("SETU Platform: [LIVE MODE] Initializing Catalyst Cloud Services");
            const catalyst = require('zcatalyst-sdk-node');
            const app = catalyst.initialize(context);
            this.datastore = new RealCatalystDataStore(app);
            this.nosql = new RealCatalystNoSQL(app);
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
