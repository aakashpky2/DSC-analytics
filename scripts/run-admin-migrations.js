const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.serialize(() => {
  console.log('Running Admin & Security Schema Migrations...');

  // 1. Temporary Delegations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS temporary_delegations (
      id TEXT PRIMARY KEY,
      grantor_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      module_key TEXT NOT NULL,
      action_key TEXT NOT NULL,
      branch_id TEXT,
      valid_from DATETIME NOT NULL,
      valid_until DATETIME NOT NULL,
      reason TEXT NOT NULL,
      can_delegate_further INTEGER DEFAULT 0,
      parent_delegation_id TEXT,
      status TEXT DEFAULT 'active',
      revoked_at DATETIME,
      revoked_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(grantor_user_id) REFERENCES user_profiles(id),
      FOREIGN KEY(recipient_user_id) REFERENCES user_profiles(id),
      FOREIGN KEY(parent_delegation_id) REFERENCES temporary_delegations(id)
    )
  `, (err) => {
    if (err) console.error('Error creating temporary_delegations:', err);
    else console.log('temporary_delegations table ready.');
  });

  // 2. Administrative Audit Logs Table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      module_key TEXT NOT NULL,
      table_affected TEXT NOT NULL,
      record_id TEXT,
      old_value_json TEXT,
      new_value_json TEXT,
      reason TEXT,
      delegation_id TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES user_profiles(id)
    )
  `, (err) => {
    if (err) console.error('Error creating audit_logs:', err);
    else console.log('audit_logs table ready.');
  });

  // 3. Certifying Authorities (CA) Master
  db.run(`
    CREATE TABLE IF NOT EXISTS certifying_authorities (
      id TEXT PRIMARY KEY,
      ca_name TEXT NOT NULL UNIQUE,
      ca_code TEXT NOT NULL UNIQUE,
      api_endpoint TEXT,
      support_contact TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating certifying_authorities:', err);
    else {
      console.log('certifying_authorities table ready.');
      // Seed default CAs if empty
      db.run(`
        INSERT OR IGNORE INTO certifying_authorities (id, ca_name, ca_code, is_active)
        VALUES 
          ('ca-emudhra', 'eMudhra Limited', 'EMUDHRA', 1),
          ('ca-capricorn', 'Capricorn CA', 'CAPRICORN', 1),
          ('ca-vsign', 'Verasys (V-Sign)', 'VSIGN', 1),
          ('ca-pantasign', 'PantaSign CA', 'PANTASIGN', 1)
      `);
    }
  });

  // 4. Hardware Token Vendors Master
  db.run(`
    CREATE TABLE IF NOT EXISTS hardware_vendors (
      id TEXT PRIMARY KEY,
      vendor_name TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      gstin TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating hardware_vendors:', err);
    else {
      console.log('hardware_vendors table ready.');
      db.run(`
        INSERT OR IGNORE INTO hardware_vendors (id, vendor_name, contact_person, is_active)
        VALUES 
          ('ven-feitian', 'Feitian Technologies Ltd', 'Overseas Supply Desk', 1),
          ('ven-watchdata', 'Watchdata India Corp', 'Regional Sales', 1)
      `);
    }
  });

  // 5. Stock Adjustment Reasons Master
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_adjustment_reasons (
      id TEXT PRIMARY KEY,
      reason_code TEXT NOT NULL UNIQUE,
      reason_label TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating stock_adjustment_reasons:', err);
    else {
      console.log('stock_adjustment_reasons table ready.');
      db.run(`
        INSERT OR IGNORE INTO stock_adjustment_reasons (id, reason_code, reason_label, adjustment_type, is_active)
        VALUES 
          ('rsn-damage', 'DAMAGED_HARDWARE', 'Faulty / Damaged Chip Quarantine', 'quarantine_damaged', 1),
          ('rsn-reconcile-add', 'AUDIT_SURPLUS', 'Physical Inventory Count Surplus', 'reconcile_add', 1),
          ('rsn-reconcile-sub', 'AUDIT_DEFICIT', 'Physical Inventory Audit Shortage', 'reconcile_deduct', 1)
      `);
    }
  });

  // 6. Add snapshot columns to invoices and delivery challans if missing
  db.run(`ALTER TABLE invoices ADD COLUMN company_snapshot TEXT`, (err) => {
    // Ignore duplicate column error if already exists
  });
  db.run(`ALTER TABLE delivery_challans ADD COLUMN company_snapshot TEXT`, (err) => {
    // Ignore duplicate column error if already exists
  });
});

db.close(() => {
  console.log('All migrations completed successfully.');
});

