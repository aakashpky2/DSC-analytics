const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.run(`
  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    token_model TEXT NOT NULL,
    adjustment_type TEXT NOT NULL, -- 'quarantine_damaged' | 'reconcile_add' | 'reconcile_deduct'
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  console.log('stock_adjustments table created:', err || 'OK');
  db.close();
});

