const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.serialize(() => {
  // 1. Company Profile Table
  db.run(`
    CREATE TABLE IF NOT EXISTS company_profile (
      id TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      trade_name TEXT NOT NULL,
      gstin TEXT NOT NULL,
      pan TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      registered_address TEXT NOT NULL,
      state_code TEXT NOT NULL,
      state_name TEXT NOT NULL,
      logo_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default profile if not exists
  db.get("SELECT COUNT(*) as count FROM company_profile", (err, row) => {
    if (row && row.count === 0) {
      db.run(`
        INSERT INTO company_profile (
          id, legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name, logo_url
        ) VALUES (
          'comp-default',
          'SignSync Technologies Private Limited',
          'SignSync B2B Enterprise',
          '27AAACS1234A1Z1',
          'AAACS1234A',
          'billing@signsync.com',
          '+91 9820012345',
          'Suite 401, Nariman Point, Mumbai, Maharashtra - 400021',
          '27',
          'Maharashtra',
          '/signsync-logo.png'
        )
      `);
      console.log('Inserted default company_profile record.');
    }
  });

  // 2. Token Models Master
  db.run(`
    CREATE TABLE IF NOT EXISTS token_models (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL UNIQUE,
      manufacturer TEXT NOT NULL,
      vendor_contact TEXT,
      min_threshold INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) as count FROM token_models", (err, row) => {
    if (row && row.count === 0) {
      db.run(`
        INSERT INTO token_models (id, model_name, manufacturer, min_threshold) VALUES
        ('tm-1', 'EPASS2003 AUTO', 'Feitian Technologies Ltd', 25),
        ('tm-2', 'WATCHDATA PROXKEY', 'Watchdata Technologies', 15),
        ('tm-3', 'MTOKEN CRYPTO', 'Longmai Technology', 10)
      `);
      console.log('Inserted default token_models.');
    }
  });

  // 3. Courier Companies Master
  db.run(`
    CREATE TABLE IF NOT EXISTS courier_partners (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL UNIQUE,
      tracking_url_template TEXT,
      support_phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) as count FROM courier_partners", (err, row) => {
    if (row && row.count === 0) {
      db.run(`
        INSERT INTO courier_partners (id, company_name, tracking_url_template, support_phone) VALUES
        ('cp-1', 'Blue Dart Express', 'https://www.bluedart.com/tracking?awb={awb}', '+91 1860 233 1234'),
        ('cp-2', 'DTDC Express', 'https://www.dtdc.in/tracking/shipment-tracking.asp?awb={awb}', '+91 80 2536 5032'),
        ('cp-3', 'Delhivery Surface', 'https://www.delhivery.com/track/package/{awb}', '+91 80698 56101'),
        ('cp-4', 'India Post Speed Post', 'https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx?consNo={awb}', '+91 1800 266 6868')
      `);
      console.log('Inserted default courier_partners.');
    }
  });

  // 4. Business Services Catalog Master
  db.run(`
    CREATE TABLE IF NOT EXISTS services_catalog (
      id TEXT PRIMARY KEY,
      service_key TEXT NOT NULL UNIQUE,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL,
      government_fee REAL DEFAULT 0,
      professional_fee REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) as count FROM services_catalog", (err, row) => {
    if (row && row.count === 0) {
      db.run(`
        INSERT INTO services_catalog (id, service_key, service_name, category, government_fee, professional_fee) VALUES
        ('srv-cat-1', 'trademark', 'Trademark Class Registration', 'Intellectual Property', 4500, 2500),
        ('srv-cat-2', 'fssai_basic', 'FSSAI Basic Food Registration', 'Food Safety', 100, 1500),
        ('srv-cat-3', 'fssai_state', 'FSSAI State License', 'Food Safety', 2000, 3000),
        ('srv-cat-4', 'fssai_central', 'FSSAI Central License', 'Food Safety', 7500, 5000),
        ('srv-cat-5', 'gst_registration', 'GST Registration Filing', 'Taxation', 0, 1500),
        ('srv-cat-6', 'company_incorporation', 'Pvt Ltd Company Incorporation (SPICe+)', 'Corporate Law', 1000, 6000)
      `);
      console.log('Inserted default services_catalog.');
    }
  });

  // 5. CRM Lead Sources Master
  db.run(`
    CREATE TABLE IF NOT EXISTS crm_lead_sources (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) as count FROM crm_lead_sources", (err, row) => {
    if (row && row.count === 0) {
      db.run(`
        INSERT INTO crm_lead_sources (id, source_name) VALUES
        ('src-1', 'Direct Website Walk-in'),
        ('src-2', 'Partner CA Referral'),
        ('src-3', 'Google Search Campaign'),
        ('src-4', 'WhatsApp Business'),
        ('src-5', 'Cold Call & Field Outreach')
      `);
      console.log('Inserted default crm_lead_sources.');
    }
  });
});

