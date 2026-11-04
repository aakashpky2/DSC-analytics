const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.serialize(() => {
  console.log('Migrating Centralized ID & Numbering Master Schema...');

  // 1. Central Numbering Series Configuration Table
  db.run(`
    CREATE TABLE IF NOT EXISTS numbering_series_configs (
      id TEXT PRIMARY KEY,
      series_name TEXT NOT NULL,
      document_type TEXT NOT NULL UNIQUE, -- 'invoice', 'dsc_application', 'partner', 'lead', 'token_batch', 'delivery_challan', 'service_order', 'courier_dispatch', 'token_serial'
      prefix TEXT,
      suffix TEXT,
      separator TEXT DEFAULT '-', -- '/', '-', '_', ''
      parts_order TEXT DEFAULT '["prefix", "fy", "counter", "suffix"]', -- JSON array defining order of segments
      fy_format TEXT DEFAULT 'YY-YY', -- 'none', 'YYYY', 'YY-YY' (e.g. 26-27), 'YYYY-YY'
      company_code TEXT,
      branch_code TEXT,
      counter_padding INT DEFAULT 5, -- 00001
      current_counter INT DEFAULT 1000,
      starting_counter INT DEFAULT 1001,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating numbering_series_configs:', err);
    else console.log('numbering_series_configs table ready.');
  });

  // 2. Physical Token Serial Numbers Table (Hardware tracking)
  db.run(`
    CREATE TABLE IF NOT EXISTS token_serials (
      id TEXT PRIMARY KEY,
      serial_number TEXT NOT NULL UNIQUE,
      token_model TEXT NOT NULL,
      batch_id TEXT,
      branch_id TEXT NOT NULL,
      status TEXT DEFAULT 'in_stock', -- 'in_stock', 'allocated', 'dispatched', 'quarantined'
      partner_id TEXT,
      delivery_challan_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(batch_id) REFERENCES token_purchase_batches(id),
      FOREIGN KEY(branch_id) REFERENCES branches(id)
    )
  `, (err) => {
    if (err) console.error('Error creating token_serials:', err);
    else console.log('token_serials table ready.');
  });

  // Seed default series for all document types if empty
  const defaultSeries = [
    {
      id: 'num-dsc-app',
      series_name: 'DSC Application Series',
      document_type: 'dsc_application',
      prefix: 'DSC',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "fy", "counter"]',
      fy_format: 'YYYY',
      counter_padding: 5,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-partner',
      series_name: 'Partner Code Series',
      document_type: 'partner',
      prefix: 'PRT',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "counter"]',
      fy_format: 'none',
      counter_padding: 4,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-lead',
      series_name: 'Customer Lead Code Series',
      document_type: 'lead',
      prefix: 'LD',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "counter"]',
      fy_format: 'none',
      counter_padding: 6,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-token-batch',
      series_name: 'Hardware Token Purchase Batch Series',
      document_type: 'token_batch',
      prefix: 'BAT',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "fy", "counter"]',
      fy_format: 'YYYY',
      counter_padding: 4,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-challan',
      series_name: 'Inter-Branch Delivery Challan Series',
      document_type: 'delivery_challan',
      prefix: 'DC',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "fy", "counter"]',
      fy_format: 'YYYY',
      counter_padding: 5,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-service-order',
      series_name: 'Business Service Order Series',
      document_type: 'service_order',
      prefix: 'SRV',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "fy", "counter"]',
      fy_format: 'YYYY',
      counter_padding: 5,
      current_counter: 1000,
      starting_counter: 1001,
    },
    {
      id: 'num-courier',
      series_name: 'Logistics Courier Dispatch Series',
      document_type: 'courier_dispatch',
      prefix: 'DSP',
      suffix: '',
      separator: '-',
      parts_order: '["prefix", "counter"]',
      fy_format: 'none',
      counter_padding: 6,
      current_counter: 1000,
      starting_counter: 1001,
    },
  ];

  defaultSeries.forEach(s => {
    db.run(`
      INSERT OR IGNORE INTO numbering_series_configs (
        id, series_name, document_type, prefix, suffix, separator, parts_order, fy_format, counter_padding, current_counter, starting_counter, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [s.id, s.series_name, s.document_type, s.prefix, s.suffix, s.separator, s.parts_order, s.fy_format, s.counter_padding, s.current_counter, s.starting_counter]);
  });
});

db.close(() => {
  console.log('Numbering master migrations completed.');
});

