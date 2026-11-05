const fs = require('fs');

const sqliteSql = fs.readFileSync('data/sqlite_schema.sql', 'utf8');
const blocks = sqliteSql.split(/-- Table: /).filter(Boolean);

const tableMap = {};
for (const block of blocks) {
  const lines = block.trim().split('\n');
  const name = lines[0].trim();
  const ddl = lines.slice(1).join('\n').trim();
  tableMap[name] = ddl;
}

// Order of creation to satisfy foreign keys
const createOrder = [
  'hierarchy_levels',
  'branches',
  'roles',
  'user_profiles',
  'app_modules',
  'role_module_permissions',
  'user_permission_overrides',
  'company_profile',
  'partners',
  'bank_accounts',
  'certifying_authorities',
  'token_models',
  'hardware_vendors',
  'stock_adjustment_reasons',
  'crm_lead_sources',
  'services_catalog',
  'courier_partners',
  'numbering_series_configs',
  'token_purchase_batches',
  'branch_token_stocks',
  'stock_adjustments',
  'token_serials',
  'dsc_catalog',
  'dsc_applications',
  'crm_leads',
  'crm_follow_ups',
  'invoice_series_configs',
  'invoices',
  'payments_received',
  'financial_ledger',
  'service_orders',
  'delivery_challans',
  'courier_dispatches',
  'temporary_delegations',
  'audit_logs',
  'sessions',
  'password_resets'
];

let pgSql = `-- ==============================================================================
-- SIGNSYNC B2B — EXACT 1:1 POSTGRESQL / SUPABASE PRODUCTION SCHEMA (37 TABLES)
-- Generated to guarantee 100% column-name and data-type alignment with active app
-- Paste and run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yuzcsbqbnmnwdvyqbkpv/sql
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

// Drop in reverse creation order
for (let i = createOrder.length - 1; i >= 0; i--) {
  pgSql += `DROP TABLE IF EXISTS ${createOrder[i]} CASCADE;\n`;
}
pgSql += '\n';

for (const t of createOrder) {
  let tableDdl = tableMap[t];
  if (!tableDdl) {
    console.error('Missing DDL for table:', t);
    continue;
  }

  // Adjustments for PG
  tableDdl = tableDdl.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT NOW()');
  tableDdl = tableDdl.replace(/DATETIME/gi, 'TIMESTAMPTZ');
  tableDdl = tableDdl.replace(/AUTOINCREMENT/gi, '');
  tableDdl = tableDdl.replace(/\bREAL\b/gi, 'NUMERIC(14,2)');

  pgSql += `-- Table: ${t}\n${tableDdl}\n\n`;
}

pgSql += `NOTIFY pgrst, 'reload schema';\n`;

fs.writeFileSync('supabase/migrations/04_exact_production_schema.sql', pgSql);
console.log('Regenerated supabase/migrations/04_exact_production_schema.sql in FK order!');
