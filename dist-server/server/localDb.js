"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initLocalDatabase = initLocalDatabase;
exports.queryAll = queryAll;
exports.queryOne = queryOne;
exports.runQuery = runQuery;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataDir = path_1.default.resolve(process.cwd(), 'data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path_1.default.resolve(dataDir, 'signsync.db');
const db = new sqlite3_1.default.Database(dbPath);
exports.db = db;
// Initialize SQLite Schema matching the SignSync v2.4 Enterprise Model
function initLocalDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Hierarchy & Roles
            db.run(`
        CREATE TABLE IF NOT EXISTS hierarchy_levels (
          id TEXT PRIMARY KEY,
          level_order INTEGER UNIQUE NOT NULL,
          level_name TEXT NOT NULL,
          can_delegate_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS branches (
          id TEXT PRIMARY KEY,
          branch_name TEXT NOT NULL,
          branch_code TEXT UNIQUE NOT NULL,
          address TEXT,
          city TEXT,
          state_code TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          full_name TEXT NOT NULL,
          phone_number TEXT,
          role_id TEXT REFERENCES roles(id),
          hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
          reports_to_user_id TEXT REFERENCES user_profiles(id),
          can_grant_permissions INTEGER DEFAULT 0,
          permissions_frozen INTEGER DEFAULT 0,
          branch_id TEXT REFERENCES branches(id),
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS app_modules (
          id TEXT PRIMARY KEY,
          module_key TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          route_path TEXT NOT NULL
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS role_module_permissions (
          id TEXT PRIMARY KEY,
          role_id TEXT REFERENCES roles(id),
          module_id TEXT REFERENCES app_modules(id),
          can_view INTEGER DEFAULT 0,
          can_create INTEGER DEFAULT 0,
          can_edit INTEGER DEFAULT 0,
          can_delete INTEGER DEFAULT 0,
          can_export INTEGER DEFAULT 0,
          mask_pii_fields INTEGER DEFAULT 1,
          UNIQUE(role_id, module_id)
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS user_permission_overrides (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES user_profiles(id),
          module_id TEXT REFERENCES app_modules(id),
          can_view INTEGER,
          can_create INTEGER,
          can_edit INTEGER,
          can_delete INTEGER,
          can_export INTEGER,
          mask_pii_fields INTEGER,
          granted_by_user_id TEXT REFERENCES user_profiles(id),
          UNIQUE(user_id, module_id)
        );
      `);
            // 2. Partners
            db.run(`
        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY,
          partner_code TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          company_name TEXT NOT NULL,
          contact_person TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          gstin TEXT,
          pan TEXT,
          billing_address TEXT NOT NULL,
          state_code TEXT NOT NULL,
          credit_period_days INTEGER DEFAULT 0,
          credit_limit REAL DEFAULT 0.00,
          wallet_balance REAL DEFAULT 0.00,
          kyc_verified INTEGER DEFAULT 0,
          kyc_document_url TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 3. DSC Catalog & Applications
            db.run(`
        CREATE TABLE IF NOT EXISTS dsc_catalog (
          id TEXT PRIMARY KEY,
          class_type TEXT NOT NULL,
          certificate_type TEXT NOT NULL,
          validity_years TEXT NOT NULL,
          vendor_base_price REAL NOT NULL,
          partner_price REAL NOT NULL,
          mrp REAL NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(class_type, certificate_type, validity_years)
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS dsc_applications (
          id TEXT PRIMARY KEY,
          application_number TEXT UNIQUE NOT NULL,
          partner_id TEXT REFERENCES partners(id),
          catalog_id TEXT REFERENCES dsc_catalog(id),
          applicant_name TEXT NOT NULL,
          applicant_email TEXT NOT NULL,
          applicant_phone TEXT NOT NULL,
          applicant_pan TEXT,
          stage TEXT DEFAULT 'intake',
          documents_submitted TEXT DEFAULT '{}',
          video_verification_url TEXT,
          ca_reference_no TEXT,
          assigned_staff_id TEXT REFERENCES user_profiles(id),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 4. Token Inventory & Landed Cost
            db.run(`
        CREATE TABLE IF NOT EXISTS token_purchase_batches (
          id TEXT PRIMARY KEY,
          batch_number TEXT UNIQUE NOT NULL,
          token_model TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          quantity_purchased INTEGER NOT NULL,
          base_unit_price REAL NOT NULL,
          inward_shipping_cost REAL DEFAULT 0.00,
          customs_or_taxes REAL DEFAULT 0.00,
          handling_charges REAL DEFAULT 0.00,
          total_landed_cost REAL NOT NULL,
          unit_landed_cost REAL NOT NULL,
          allocated_quantity INTEGER DEFAULT 0,
          damaged_quantity INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS branch_token_stocks (
          id TEXT PRIMARY KEY,
          branch_id TEXT REFERENCES branches(id),
          token_model TEXT NOT NULL,
          quantity_on_hand INTEGER DEFAULT 0,
          quarantine_damaged INTEGER DEFAULT 0,
          min_threshold INTEGER DEFAULT 10,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(branch_id, token_model)
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS delivery_challans (
          id TEXT PRIMARY KEY,
          challan_number TEXT UNIQUE NOT NULL,
          source_branch_id TEXT REFERENCES branches(id),
          destination_branch_id TEXT REFERENCES branches(id),
          partner_id TEXT REFERENCES partners(id),
          token_model TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          issued_by TEXT REFERENCES user_profiles(id),
          status TEXT DEFAULT 'dispatched',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 5. CRM Leads & Deduplication
            db.run(`
        CREATE TABLE IF NOT EXISTS crm_leads (
          id TEXT PRIMARY KEY,
          lead_code TEXT UNIQUE NOT NULL,
          company_name TEXT NOT NULL,
          contact_person TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          gstin TEXT,
          pan TEXT,
          status TEXT DEFAULT 'new',
          requirement_summary TEXT,
          assigned_to TEXT REFERENCES user_profiles(id),
          is_merged INTEGER DEFAULT 0,
          merged_into_lead_id TEXT REFERENCES crm_leads(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS crm_follow_ups (
          id TEXT PRIMARY KEY,
          lead_id TEXT REFERENCES crm_leads(id),
          channel TEXT NOT NULL,
          scheduled_at DATETIME NOT NULL,
          completed_at DATETIME,
          status TEXT DEFAULT 'pending',
          disposition TEXT,
          notes TEXT,
          conducted_by TEXT REFERENCES user_profiles(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 6. Business Services
            db.run(`
        CREATE TABLE IF NOT EXISTS service_orders (
          id TEXT PRIMARY KEY,
          order_number TEXT UNIQUE NOT NULL,
          service_type TEXT NOT NULL,
          partner_id TEXT REFERENCES partners(id),
          client_name TEXT NOT NULL,
          client_contact TEXT NOT NULL,
          stage TEXT DEFAULT 'draft_review',
          portal_ack_number TEXT,
          government_fees REAL DEFAULT 0.00,
          professional_fees REAL DEFAULT 0.00,
          uploaded_documents TEXT DEFAULT '{}',
          final_certificate_url TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 7. Multi-Account Billing & Ledger
            db.run(`
        CREATE TABLE IF NOT EXISTS bank_accounts (
          id TEXT PRIMARY KEY,
          account_nickname TEXT NOT NULL,
          bank_name TEXT NOT NULL,
          account_number TEXT NOT NULL,
          ifsc_code TEXT NOT NULL,
          branch_name TEXT NOT NULL,
          account_holder_name TEXT NOT NULL,
          upi_id TEXT,
          google_pay_number TEXT,
          qr_code_image_path TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS invoice_series_configs (
          id TEXT PRIMARY KEY,
          series_name TEXT NOT NULL,
          prefix TEXT NOT NULL,
          suffix TEXT,
          current_counter INTEGER DEFAULT 1000,
          is_gst_compliant INTEGER NOT NULL,
          mapped_bank_account_id TEXT REFERENCES bank_accounts(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          series_id TEXT REFERENCES invoice_series_configs(id),
          partner_id TEXT REFERENCES partners(id),
          invoice_type TEXT DEFAULT 'gst_tax_invoice',
          invoice_date DATE DEFAULT (DATE('now')),
          due_date DATE NOT NULL,
          subtotal REAL NOT NULL,
          cgst_amount REAL DEFAULT 0.00,
          sgst_amount REAL DEFAULT 0.00,
          igst_amount REAL DEFAULT 0.00,
          total_amount REAL NOT NULL,
          paid_amount REAL DEFAULT 0.00,
          outstanding_balance REAL NOT NULL,
          status TEXT DEFAULT 'unpaid',
          bank_account_snapshot_id TEXT REFERENCES bank_accounts(id),
          line_items TEXT NOT NULL DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS payments_received (
          id TEXT PRIMARY KEY,
          invoice_id TEXT REFERENCES invoices(id),
          partner_id TEXT REFERENCES partners(id),
          amount_paid REAL NOT NULL,
          payment_mode TEXT NOT NULL,
          bank_account_id TEXT REFERENCES bank_accounts(id),
          transaction_reference_utr TEXT,
          screenshot_proof_url TEXT,
          verified_status TEXT DEFAULT 'pending_verification',
          verified_by TEXT REFERENCES user_profiles(id),
          verified_at DATETIME,
          rejection_remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            db.run(`
        CREATE TABLE IF NOT EXISTS financial_ledger (
          id TEXT PRIMARY KEY,
          partner_id TEXT REFERENCES partners(id),
          entry_date DATE DEFAULT (DATE('now')),
          transaction_type TEXT NOT NULL,
          reference_id TEXT,
          debit REAL DEFAULT 0.00,
          credit REAL DEFAULT 0.00,
          running_balance REAL NOT NULL,
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // 8. Logistics & Couriers
            db.run(`
        CREATE TABLE IF NOT EXISTS courier_dispatches (
          id TEXT PRIMARY KEY,
          dispatch_number TEXT UNIQUE NOT NULL,
          carrier_name TEXT NOT NULL,
          awb_number TEXT UNIQUE NOT NULL,
          recipient_name TEXT NOT NULL,
          recipient_phone TEXT NOT NULL,
          shipping_address TEXT NOT NULL,
          package_contents TEXT NOT NULL,
          status TEXT DEFAULT 'manifested',
          delivery_challan_id TEXT REFERENCES delivery_challans(id),
          proof_of_delivery_url TEXT,
          dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivered_at DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
            // Insert Initial Hierarchy Tiers
            const tiers = [
                ['tier-0', 0, 'Super Admin', 1],
                ['tier-1', 1, 'Partner / Regional Admin', 1],
                ['tier-2', 2, 'Operations / Branch Manager', 1],
                ['tier-3', 3, 'Senior Staff / Executive', 0],
                ['tier-4', 4, 'Field Staff / Tele-caller', 0],
            ];
            tiers.forEach(([id, order, name, delegate]) => {
                db.run(`INSERT OR IGNORE INTO hierarchy_levels (id, level_order, level_name, can_delegate_default) VALUES (?, ?, ?, ?)`, [id, order, name, delegate]);
            });
            // Insert Initial Roles
            const roles = [
                ['role-super-admin', 'tier-0', 'Super Administrator', 'Master root authority with global administrative control'],
                ['role-partner-admin', 'tier-1', 'Regional Partner Admin', 'Manages regional partner distribution and wholesale pricing'],
                ['role-branch-mgr', 'tier-2', 'Branch Operations Manager', 'Oversees inventory allocations, payment verifications and CRM'],
                ['role-senior-exec', 'tier-3', 'Senior Operations Executive', 'Processes DSC applications, invoices and logistics'],
                ['role-field-staff', 'tier-4', 'Field Tele-caller', 'Executes lead follow-ups with field-level masked PII'],
            ];
            roles.forEach(([id, lvl, name, desc]) => {
                db.run(`INSERT OR IGNORE INTO roles (id, hierarchy_level_id, name, description) VALUES (?, ?, ?, ?)`, [id, lvl, name, desc]);
            });
            // Insert Initial Modules
            const modules = [
                ['mod-dashboard', 'dashboard', 'Executive Dashboard', '/'],
                ['mod-users', 'admin_users', 'User Administration & RBAC', '/admin/users'],
                ['mod-partners', 'partners', 'Partner Network', '/partners'],
                ['mod-dsc', 'dsc', 'DSC Catalogue & Pipeline', '/dsc/catalog'],
                ['mod-inventory', 'inventory', 'Token Inventory & Landed Cost', '/inventory/tokens'],
                ['mod-crm', 'crm', 'CRM Leads & Deduplication', '/crm/leads'],
                ['mod-services', 'services', 'Business Services Hub', '/services'],
                ['mod-billing', 'billing', 'Multi-Account Billing & Ledger', '/billing/invoices'],
                ['mod-courier', 'courier', 'Courier & POD Tracking', '/courier'],
            ];
            modules.forEach(([id, key, name, route]) => {
                db.run(`INSERT OR IGNORE INTO app_modules (id, module_key, display_name, route_path) VALUES (?, ?, ?, ?)`, [id, key, name, route]);
            });
            // Insert Default Branch
            db.run(`INSERT OR IGNORE INTO branches (id, branch_name, branch_code, city, state_code) VALUES (?, ?, ?, ?, ?)`, ['branch-hq', 'Headquarters - Mumbai', 'HQ-MUM', 'Mumbai', 'MH']);
            // Insert Default Super Admin User
            db.run(`INSERT OR IGNORE INTO user_profiles (id, email, password_hash, full_name, phone_number, role_id, hierarchy_level_id, can_grant_permissions, permissions_frozen, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                'usr-admin-root',
                'admin@signsync.io',
                'admin123',
                'SignSync Master Admin',
                '+91 99999 88888',
                'role-super-admin',
                'tier-0',
                1,
                0,
                'active',
            ]);
            // Insert Initial Bank Account
            db.run(`INSERT OR IGNORE INTO bank_accounts (id, account_nickname, bank_name, account_number, ifsc_code, branch_name, account_holder_name, upi_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                'bank-hdfc-01',
                'HDFC Current Primary',
                'HDFC Bank Ltd',
                '50200088992211',
                'HDFC0001234',
                'Nariman Point, Mumbai',
                'SignSync Enterprise Solutions Pvt Ltd',
                'signsync@hdfcbank',
                1,
            ]);
            // Insert Initial Invoice Series
            db.run(`INSERT OR IGNORE INTO invoice_series_configs (id, series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                'series-gst-2627',
                'GST Tax Invoices FY26-27',
                'INV-2627/',
                '',
                1001,
                1,
                'bank-hdfc-01',
            ]);
            // Insert Sample DSC Catalog Items
            const catalog = [
                ['cat-1', 'class_3_individual', 'signing_only', '2_years', 600.0, 950.0, 1500.0],
                ['cat-2', 'class_3_individual', 'combo_signing_encryption', '2_years', 950.0, 1450.0, 2200.0],
                ['cat-3', 'class_3_organization', 'combo_signing_encryption', '2_years', 1800.0, 2600.0, 3800.0],
                ['cat-4', 'dgft', 'signing_only', '2_years', 1200.0, 1850.0, 2800.0],
            ];
            catalog.forEach(([id, cls, typ, val, base, partner, mrp]) => {
                db.run(`INSERT OR IGNORE INTO dsc_catalog (id, class_type, certificate_type, validity_years, vendor_base_price, partner_price, mrp, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, [id, cls, typ, val, base, partner, mrp]);
            });
            // Insert Initial Partner
            db.run(`INSERT OR IGNORE INTO partners (id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, wallet_balance, kyc_verified, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                'part-001',
                'PRT-MUM-1001',
                'dsc_partner',
                'Apex Digital Certifications LLP',
                'Rajesh Singhania',
                'rajesh@apexdigital.in',
                '+91 98200 12345',
                '27AAACA1234A1Z5',
                'AAACA1234A',
                '402 Trade Centre, BKC, Mumbai',
                '27',
                150000.0,
                30,
                24500.0,
                1,
                'active',
            ]);
            resolve();
        });
    });
}
// Helper query wrappers returning Promises
function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
}
function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row || null);
        });
    });
}
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
