const fs = require('fs');
const path = require('path');

// Global mock database path
const DB_FILE = path.join(__dirname, '..', '..', 'test_db.json');

// Security helper: Sanitizes input to prevent ZCQL injection
function sanitizeZCQLString(str) {
    if (typeof str !== 'string') return '';
    // SQL-escape single quotes by doubling them
    const escaped = str.replace(/'/g, "''");
    if (escaped !== str) {
        console.warn(`[WARNING] Input value "${str}" contained single quotes and was SQL-escaped to "${escaped}".`);
    }
    return escaped;
}

const { deterministicNameMatch } = require('../_shared/nameMatcher');

// --- 1. SERVICE INTERFACES ---

class DataStoreClient {
    async getRow(tableName, id) { throw new Error("Method not implemented"); }
    async insertRow(tableName, data) { throw new Error("Method not implemented"); }
    async updateRow(tableName, data) { throw new Error("Method not implemented"); }
    async query(sql) { throw new Error("Method not implemented"); }
    async resolveOffenderIdentity(name, firId) { throw new Error("Method not implemented"); }
}

class NoSQLClient {
    async insertItem(tableName, data) { throw new Error("Method not implemented"); }
}

class QuickMLClient {
    async executeLLM(endpointKey, prompt) { throw new Error("Method not implemented"); }
}

// --- 2. EXPLICIT MOCK IMPLEMENTATIONS ---

class MockCatalystDataStore extends DataStoreClient {
    constructor(adapter) {
        super();
        this.adapter = adapter;
    }

    async getRow(tableName, id) {
        const cleanId = sanitizeZCQLString(id);
        const list = this.adapter.dbData.tables[tableName] || [];
        const idKey = `${tableName.slice(0, -1)}_id`;
        const found = list.find(r => r[idKey] === cleanId || r.id === cleanId || r.mo_id === cleanId || r.phone_id === cleanId || r.vehicle_id === cleanId || r.record_id === cleanId);
        if (!found) throw new Error(`Row not found: ${cleanId} in ${tableName}`);
        return found;
    }

    async insertRow(tableName, data) {
        if (!this.adapter.dbData.tables[tableName]) {
            this.adapter.dbData.tables[tableName] = [];
        }
        this.adapter.dbData.tables[tableName].push(data);
        this.adapter.saveDb();
        return data;
    }

    async updateRow(tableName, data) {
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
        const lower = sql.toLowerCase();
        if (lower.includes("select offender_id, full_name from offenders")) {
            return this.adapter.dbData.tables.offenders.map(row => ({ offenders: row }));
        }
        if (lower.includes("select offender_id, alias_name from offender_aliases")) {
            return this.adapter.dbData.tables.offender_aliases.map(row => ({ offender_aliases: row }));
        }
        if (lower.includes("select offender_id from offender_fir_link")) {
            const matchFir = sql.match(/fir_id\s*=\s*'([^']+)'/i);
            const list = this.adapter.dbData.tables.offender_fir_link;
            const targetId = matchFir ? sanitizeZCQLString(matchFir[1]) : '';
            const filtered = matchFir ? list.filter(r => r.fir_id === targetId) : list;
            return filtered.map(row => ({ offender_fir_link: row }));
        }
        
        throw new Error(`Mock DB Error: Unrecognized query string "${sql}". Ensure your mock data layer has defined this pattern.`);
    }

    async resolveOffenderIdentity(name, firId) {
        const offenderRows = await this.query("SELECT offender_id, full_name FROM offenders");
        const aliasRows = await this.query("SELECT offender_id, alias_name FROM offender_aliases");

        const candidates = offenderRows.map(o => {
            const row = o.offenders;
            const offender_id = row.offender_id;
            const full_name = row.full_name;
            const aliases = aliasRows
                .filter(a => a.offender_aliases.offender_id === offender_id)
                .map(a => a.offender_aliases.alias_name);
            return { offender_id, name: full_name, aliases };
        });

        const matchResult = deterministicNameMatch(name, candidates);
        if (matchResult.is_likely_match) {
            const finalOffenderId = matchResult.matched_offender_id;
            const existingAliases = aliasRows
                .filter(a => a.offender_aliases.offender_id === finalOffenderId)
                .map(a => a.offender_aliases.alias_name);
            if (!existingAliases.includes(name)) {
                await this.insertRow('offender_aliases', {
                    alias_id: `ALIAS_${finalOffenderId}_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
                    offender_id: finalOffenderId,
                    alias_name: name
                });
            }
            return finalOffenderId;
        } else {
            const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const newOffenderId = `OFF_${cleanName}`;
            await this.insertRow('offenders', {
                offender_id: newOffenderId,
                full_name: name,
                gender: null,
                age_at_first_offense: null,
                risk_score: null,
                risk_score_last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19),
                bail_status: null
            });
            await this.insertRow('offender_aliases', {
                alias_id: `ALIAS_${newOffenderId}_${cleanName}`,
                offender_id: newOffenderId,
                alias_name: name
            });
            return newOffenderId;
        }
    }
}

class MockCatalystNoSQL extends NoSQLClient {
    constructor(adapter) {
        super();
        this.adapter = adapter;
    }

    async insertItem(tableName, data) {
        if (!this.adapter.dbData.nosql[tableName]) {
            this.adapter.dbData.nosql[tableName] = [];
        }
        this.adapter.dbData.nosql[tableName].push(data);
        this.adapter.saveDb();
        return { success: true };
    }
}

class MockQuickMLClient extends QuickMLClient {
    async executeLLM(endpointKey, prompt) {
        console.log(`[MOCK QuickML] Calling LLM Endpoint "${endpointKey}"`);
        return JSON.stringify([]);
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

    async resolveOffenderIdentity(name, firId) {
        // Execute the entity-linking serverless function deployed in Catalyst
        const functionResponse = await this.app.functions().execute("entity-linking", {
            body: JSON.stringify({ extracted_name: name, fir_id: firId })
        });
        const data = JSON.parse(functionResponse.body);
        return data.offender_id;
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
}

class RealQuickMLClient extends QuickMLClient {
    constructor(app) {
        super();
        this.app = app;
    }

    async executeLLM(endpointKey, prompt) {
        return await this.app.quickml().executeEndpoint(endpointKey, { prompt });
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
            this.quickml = new MockQuickMLClient();
        } else {
            console.log("SETU Platform: [LIVE MODE] Initializing Catalyst Cloud Services");
            const catalyst = require('zcatalyst-sdk-node');
            const app = catalyst.initialize(context);
            this.datastore = new RealCatalystDataStore(app);
            this.nosql = new RealCatalystNoSQL(app);
            this.quickml = new RealQuickMLClient(app);
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
        // Seed the 24 standard MO tags from the approved mo_taxonomy.md
        const seededMoTags = [
            // Property Crime
            { mo_id: 'chain_snatching', category: 'Property Crime', tag_type: 'primary', description: 'Theft of jewelry/valuables from a person' },
            { mo_id: 'house_breaking_day', category: 'Property Crime', tag_type: 'primary', description: 'Burglary during daylight hours' },
            { mo_id: 'house_breaking_night', category: 'Property Crime', tag_type: 'primary', description: 'Burglary during night hours' },
            { mo_id: 'vehicle_theft', category: 'Property Crime', tag_type: 'primary', description: 'Theft of a motor vehicle' },
            { mo_id: 'pickpocketing', category: 'Property Crime', tag_type: 'primary', description: 'Theft from a person\'s belongings' },
            { mo_id: 'atm_related_theft', category: 'Property Crime', tag_type: 'primary', description: 'Theft or fraud involving ATM machines/cards' },
            // Financial Crime
            { mo_id: 'online_fraud', category: 'Financial Crime', tag_type: 'primary', description: 'Digital/cyber-enabled financial fraud' },
            { mo_id: 'ponzi_investment_fraud', category: 'Financial Crime', tag_type: 'primary', description: 'Fraudulent investment schemes' },
            { mo_id: 'money_laundering', category: 'Financial Crime', tag_type: 'primary', description: 'Layering/structuring of illicit funds' },
            { mo_id: 'identity_theft_financial', category: 'Financial Crime', tag_type: 'primary', description: 'Use of stolen identity' },
            // Organized / Gang Activity
            { mo_id: 'repeat_offender_cluster', category: 'Organized / Gang Activity', tag_type: 'primary', description: 'Coordinated group activity' },
            { mo_id: 'cross_district_operation', category: 'Organized / Gang Activity', tag_type: 'primary', description: 'Crimes committed across multiple districts' },
            { mo_id: 'recruitment_pattern', category: 'Organized / Gang Activity', tag_type: 'primary', description: 'Indicators of recruitment into network' },
            // Violent Crime
            { mo_id: 'assault', category: 'Violent Crime', tag_type: 'primary', description: 'Physical assault' },
            { mo_id: 'armed_robbery', category: 'Violent Crime', tag_type: 'primary', description: 'Robbery involving a weapon' },
            { mo_id: 'extortion', category: 'Violent Crime', tag_type: 'primary', description: 'Threat-based coercion for money/property' },
            // Behavioral/Temporal Modifiers
            { mo_id: 'daytime', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Daytime temporal marker' },
            { mo_id: 'nighttime', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Nighttime temporal marker' },
            { mo_id: 'solo', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Offense committed alone' },
            { mo_id: 'group', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Offense committed in a group' },
            { mo_id: 'weapon_used', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Weapon present' },
            { mo_id: 'no_weapon', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'No weapon present' },
            { mo_id: 'repeat_location', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Occurrence at historically linked location' },
            { mo_id: 'new_location', category: 'Behavioral/Temporal Modifiers', tag_type: 'modifier', description: 'Occurrence at new location' }
        ];

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
                mo_tags: seededMoTags, // Seed the taxonomy
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
