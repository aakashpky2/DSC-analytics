const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/signsync.db');

db.all("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;", (err, rows) => {
  if (err) throw err;
  const existingInSupabase = new Set([
    'user_permission_overrides',
    'courier_dispatches',
    'app_modules',
    'invoice_series_configs',
    'partners',
    'role_module_permissions',
    'hierarchy_levels',
    'service_orders',
    'crm_follow_ups',
    'crm_leads',
    'branches',
    'dsc_applications',
    'invoices',
    'user_profiles',
    'branch_token_stocks',
    'delivery_challans',
    'dsc_catalog',
    'token_purchase_batches',
    'roles',
    'payments_received',
    'bank_accounts',
    'financial_ledger'
  ]);

  const missing = rows.filter(r => !existingInSupabase.has(r.name) && r.name !== 'sqlite_sequence' && r.name !== 'test');
  console.log(`Missing tables (${missing.length}):`, missing.map(m => m.name));
  console.log('\n--- DDL FOR MISSING TABLES ---');
  for (const m of missing) {
    console.log(`\n-- Table: ${m.name}\n${m.sql};`);
  }
  db.close();
});

