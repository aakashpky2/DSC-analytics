"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqliteDb = void 0;
exports.query = query;
exports.run = run;
exports.getOne = getOne;
exports.initDatabase = initDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = path_1.default.resolve(process.cwd(), 'data', 'dsc_analytics.db');
// Ensure directory exists
const dir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dir)) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
exports.sqliteDb = new sqlite3_1.default.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to open SQLite database:', err);
    }
    else {
        console.log(`> [Database] Connected to local SQLite database at: ${DB_PATH}`);
    }
});
// SQLite promise helper
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.sqliteDb.all(sql, params, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows);
        });
    });
}
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.sqliteDb.run(sql, params, function (err) {
            if (err)
                return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        exports.sqliteDb.get(sql, params, (err, row) => {
            if (err)
                return reject(err);
            resolve(row || null);
        });
    });
}
// Initialize tables and initial seed data if not present
async function initDatabase() {
    await run(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      is_active INTEGER NOT NULL DEFAULT 1,
      daily_call_target INTEGER DEFAULT 80,
      daily_conversion_target INTEGER DEFAULT 8,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS lead_sources (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS dsc_types (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      company_name TEXT,
      email TEXT,
      dsc_requirement TEXT,
      lead_source_name TEXT NOT NULL DEFAULT 'Direct Enquiry',
      assigned_staff_id TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_contacted_at TEXT,
      next_followup_at TEXT,
      is_converted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (assigned_staff_id) REFERENCES staff(id)
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS call_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      call_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      outcome TEXT NOT NULL,
      is_connected INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      assigned_staff_id TEXT NOT NULL,
      due_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Pending',
      notes TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_staff_id) REFERENCES staff(id)
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS conversions (
      id TEXT PRIMARY KEY,
      lead_id TEXT UNIQUE NOT NULL,
      converted_by_staff_id TEXT NOT NULL,
      converted_at TEXT NOT NULL DEFAULT (datetime('now')),
      dsc_type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (converted_by_staff_id) REFERENCES staff(id)
    );
  `);
    await run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
    // Seed default staff if table is empty
    const staffCount = await getOne('SELECT count(*) as count FROM staff');
    if (staffCount && staffCount.count === 0) {
        console.log('> Seeding initial staff, lead sources, and DSC types...');
        const defaultStaff = [
            { id: 'usr_admin', name: 'Rajesh Sharma (Manager)', email: 'rajesh@dscanalytics.com', role: 'admin', daily_call_target: 60, daily_conversion_target: 10 },
            { id: 'usr_amit', name: 'Amit Verma', email: 'amit@dscanalytics.com', role: 'staff', daily_call_target: 90, daily_conversion_target: 8 },
            { id: 'usr_priya', name: 'Priya Nair', email: 'priya@dscanalytics.com', role: 'staff', daily_call_target: 100, daily_conversion_target: 12 },
            { id: 'usr_rohit', name: 'Rohit Kulkarni', email: 'rohit@dscanalytics.com', role: 'staff', daily_call_target: 85, daily_conversion_target: 7 },
            { id: 'usr_sneha', name: 'Sneha Patel', email: 'sneha@dscanalytics.com', role: 'staff', daily_call_target: 95, daily_conversion_target: 9 },
        ];
        for (const s of defaultStaff) {
            await run('INSERT INTO staff (id, name, email, role, daily_call_target, daily_conversion_target) VALUES (?, ?, ?, ?, ?, ?)', [s.id, s.name, s.email, s.role, s.daily_call_target, s.daily_conversion_target]);
        }
        const defaultSources = [
            { id: 'src_1', name: 'Google Ads' },
            { id: 'src_2', name: 'Meta Ads' },
            { id: 'src_3', name: 'Website' },
            { id: 'src_4', name: 'WhatsApp' },
            { id: 'src_5', name: 'Referral' },
            { id: 'src_6', name: 'Existing Customer' },
            { id: 'src_7', name: 'Direct Enquiry' },
            { id: 'src_8', name: 'Imported Database' },
            { id: 'src_9', name: 'Other' },
        ];
        for (const src of defaultSources) {
            await run('INSERT INTO lead_sources (id, name) VALUES (?, ?)', [src.id, src.name]);
        }
        const defaultDscTypes = [
            { id: 'dsc_1', name: 'Class 3 - Individual Signing', description: 'For Income Tax, MCA, RoC e-filing' },
            { id: 'dsc_2', name: 'Class 3 - Individual Combo (Sign + Encrypt)', description: 'For e-Tendering & e-Procurement' },
            { id: 'dsc_3', name: 'Class 3 - Organization Signing', description: 'For Company Authorized Signatory' },
            { id: 'dsc_4', name: 'Class 3 - Organization Combo', description: 'Government & Corporate tenders' },
            { id: 'dsc_5', name: 'DGFT DSC', description: 'Foreign Trade & ICEGATE customs' },
        ];
        for (const d of defaultDscTypes) {
            await run('INSERT INTO dsc_types (id, name, description) VALUES (?, ?, ?)', [d.id, d.name, d.description]);
        }
        // Insert rich realistic leads
        const initialLeads = [
            { id: 'lead_1', customer_name: 'Anil Agarwal', mobile_number: '+91 98201 12345', company_name: 'Agarwal Exports Ltd', email: 'anil@agarwalexports.in', dsc_requirement: 'DGFT DSC', lead_source_name: 'Google Ads', assigned_staff_id: 'usr_priya', status: 'Interested', notes: 'Needs DGFT certificate before Friday for IEC export audit.' },
            { id: 'lead_2', customer_name: 'Vikram Mehta', mobile_number: '+91 98112 23344', company_name: 'Mehta & Associates CA', email: 'vikram@mehtaca.com', dsc_requirement: 'Class 3 - Individual Signing', lead_source_name: 'Referral', assigned_staff_id: 'usr_amit', status: 'Converted', notes: 'CA firm renewal for 5 partners.' },
            { id: 'lead_3', customer_name: 'Suresh Kumar', mobile_number: '+91 97110 55443', company_name: 'SK Infra Solutions', email: 'sk@skinfra.com', dsc_requirement: 'Class 3 - Organization Combo', lead_source_name: 'Website', assigned_staff_id: 'usr_priya', status: 'Follow-up', notes: 'Tender deadline on 15th. Call back tomorrow morning 11 AM.' },
            { id: 'lead_4', customer_name: 'Pooja Hegde', mobile_number: '+91 98450 99887', company_name: 'Apex Pharma Tech', email: 'pooja@apexpharma.co', dsc_requirement: 'Class 3 - Organization Signing', lead_source_name: 'Direct Enquiry', assigned_staff_id: 'usr_rohit', status: 'Contacted', notes: 'Director out of town. Discussed basic documentation.' },
            { id: 'lead_5', customer_name: 'Manish Tiwari', mobile_number: '+91 94150 44332', company_name: 'Tiwari Logistics', email: 'manish@tiwarilogistics.com', dsc_requirement: 'Class 3 - Individual Combo (Sign + Encrypt)', lead_source_name: 'Meta Ads', assigned_staff_id: 'usr_sneha', status: 'New', notes: 'Fresh web lead submitted 1 hour ago.' },
            { id: 'lead_6', customer_name: 'Sunil Rao', mobile_number: '+91 99001 88776', company_name: 'Bangalore Softworks', email: 'sunil@bsoft.in', dsc_requirement: 'Class 3 - Individual Signing', lead_source_name: 'WhatsApp', assigned_staff_id: 'usr_amit', status: 'Not Interested', notes: 'Already purchased DSC last week elsewhere.' },
            { id: 'lead_7', customer_name: 'Ramesh Gupta', mobile_number: '+91 98390 11223', company_name: 'Gupta Builders', email: 'ramesh@guptabuilders.in', dsc_requirement: 'Class 3 - Organization Combo', lead_source_name: 'Google Ads', assigned_staff_id: 'usr_priya', status: 'Converted', notes: 'CPWD tender submission. Payment received via UPI.' },
            { id: 'lead_8', customer_name: 'Deepak Chawla', mobile_number: '+91 98711 77665', company_name: 'Chawla & Sons Traders', email: 'deepak@chawlatraders.com', dsc_requirement: 'DGFT DSC', lead_source_name: 'Imported Database', assigned_staff_id: 'usr_sneha', status: 'No Response', notes: 'Called twice, phone ringing no answer.' }
        ];
        for (const l of initialLeads) {
            const isConverted = l.status === 'Converted' ? 1 : 0;
            await run(`INSERT INTO leads (id, customer_name, mobile_number, company_name, email, dsc_requirement, lead_source_name, assigned_staff_id, status, notes, is_converted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [l.id, l.customer_name, l.mobile_number, l.company_name, l.email, l.dsc_requirement, l.lead_source_name, l.assigned_staff_id, l.status, l.notes, isConverted]);
        }
        // Add conversions
        await run(`
      INSERT INTO conversions (id, lead_id, converted_by_staff_id, dsc_type, amount, notes, converted_at)
      VALUES 
        ('conv_1', 'lead_2', 'usr_amit', 'Class 3 - Individual Signing', 1800, 'Paid via NetBanking', datetime('now', '-2 hours')),
        ('conv_2', 'lead_7', 'usr_priya', 'Class 3 - Organization Combo', 3400, 'UPI payment verified', datetime('now', '-4 hours'))
    `);
        // Add call activities for analytics
        const callLogs = [
            { id: 'call_1', lead_id: 'lead_2', staff_id: 'usr_amit', outcome: 'Converted', is_connected: 1, duration: 180, notes: 'Client confirmed token payment and shared Aadhaar OTP.' },
            { id: 'call_2', lead_id: 'lead_7', staff_id: 'usr_priya', outcome: 'Converted', is_connected: 1, duration: 240, notes: 'Organization documents verified. Sent download link.' },
            { id: 'call_3', lead_id: 'lead_1', staff_id: 'usr_priya', outcome: 'Connected — Interested', is_connected: 1, duration: 120, notes: 'Explained DGFT pricing and paperless e-KYC process.' },
            { id: 'call_4', lead_id: 'lead_3', staff_id: 'usr_priya', outcome: 'Connected — Call Back Later', is_connected: 1, duration: 90, notes: 'Requested call tomorrow 11 AM.' },
            { id: 'call_5', lead_id: 'lead_4', staff_id: 'usr_rohit', outcome: 'Connected — Call Back Later', is_connected: 1, duration: 75, notes: 'Director in meeting.' },
            { id: 'call_6', lead_id: 'lead_6', staff_id: 'usr_amit', outcome: 'Connected — Not Interested', is_connected: 1, duration: 45, notes: 'Bought from competitor.' },
            { id: 'call_7', lead_id: 'lead_8', staff_id: 'usr_sneha', outcome: 'No Answer', is_connected: 0, duration: 0, notes: 'Ringing, no pickup.' },
            { id: 'call_8', lead_id: 'lead_5', staff_id: 'usr_sneha', outcome: 'Busy', is_connected: 0, duration: 0, notes: 'Line busy.' }
        ];
        for (const c of callLogs) {
            await run(`
        INSERT INTO call_activities (id, lead_id, staff_id, outcome, is_connected, duration_seconds, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [c.id, c.lead_id, c.staff_id, c.outcome, c.is_connected, c.duration, c.notes]);
        }
        // Add follow-ups
        const followUps = [
            { id: 'flw_1', lead_id: 'lead_3', assigned_staff_id: 'usr_priya', due_at: new Date(Date.now() + 86400000).toISOString(), priority: 'High', status: 'Pending', notes: 'Urgent CPWD tender quotation follow-up' },
            { id: 'flw_2', lead_id: 'lead_1', assigned_staff_id: 'usr_priya', due_at: new Date(Date.now() + 3600000 * 3).toISOString(), priority: 'Medium', status: 'Pending', notes: 'Check if IEC certificate copy was emailed' },
            { id: 'flw_3', lead_id: 'lead_4', assigned_staff_id: 'usr_rohit', due_at: new Date(Date.now() - 3600000 * 5).toISOString(), priority: 'High', status: 'Pending', notes: 'Call director regarding board resolution doc' }
        ];
        for (const f of followUps) {
            await run(`
        INSERT INTO follow_ups (id, lead_id, assigned_staff_id, due_at, priority, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [f.id, f.lead_id, f.assigned_staff_id, f.due_at, f.priority, f.status, f.notes]);
        }
        console.log('> Database seeded successfully with realistic DSC calling data.');
    }
}
