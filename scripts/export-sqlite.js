const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sqlite = new sqlite3.Database('data/signsync.db');

function queryAll(sql, params = []) {
  return new Promise((res, rej) => {
    sqlite.all(sql, params, (err, rows) => {
      if (err) rej(err);
      else res(rows);
    });
  });
}

async function exportSqliteData() {
  console.log('Exporting SQLite data...');
  const tables = [
    'hierarchy_levels',
    'roles',
    'branches',
    'user_profiles',
    'app_modules',
    'role_module_permissions',
    'partners',
    'dsc_catalog',
    'dsc_applications',
    'bank_accounts',
    'token_purchase_batches',
    'branch_token_stocks',
    'invoices',
    'invoice_series_configs',
    'payments_received',
    'financial_ledger',
    'crm_leads',
    'crm_follow_ups',
    'service_orders',
    'delivery_challans',
    'courier_dispatches',
    'user_permission_overrides',
    // Tables from 03_complete_schema.sql:
    'company_profile',
    'certifying_authorities',
    'token_models',
    'hardware_vendors',
    'stock_adjustment_reasons',
    'stock_adjustments',
    'token_serials',
    'crm_lead_sources',
    'services_catalog',
    'courier_partners',
    'numbering_series_configs',
    'temporary_delegations',
    'audit_logs',
    'sessions',
    'password_resets'
  ];

  const exportData = {};
  for (const t of tables) {
    try {
      const rows = await queryAll(`SELECT * FROM ${t}`);
      exportData[t] = rows;
      console.log(`- ${t}: ${rows.length} rows`);
    } catch (e) {
      console.warn(`! Failed to read ${t}:`, e.message);
      exportData[t] = [];
    }
  }

  fs.writeFileSync('data/sqlite_dump.json', JSON.stringify(exportData, null, 2));
  console.log('Saved data/sqlite_dump.json successfully!');
  sqlite.close();
}

exportSqliteData();

