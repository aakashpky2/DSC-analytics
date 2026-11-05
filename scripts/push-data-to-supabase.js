const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dump = JSON.parse(fs.readFileSync('data/sqlite_dump.json', 'utf8'));

// Insertion order respecting foreign keys
const tableOrder = [
  'hierarchy_levels',
  'roles',
  'branches',
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

function cleanRow(table, row) {
  const r = { ...row };
  
  // Boolean conversions
  const boolFields = [
    'can_delegate_default', 'is_active', 'can_grant_permissions', 'permissions_frozen',
    'can_view', 'can_create', 'can_edit', 'can_delete', 'can_export', 'mask_pii_fields',
    'kyc_verified', 'is_default', 'can_delegate_further'
  ];
  for (const f of boolFields) {
    if (f in r && r[f] !== null && r[f] !== undefined) {
      r[f] = Boolean(r[f]);
    }
  }

  // JSON columns
  if (table === 'invoices' && typeof r.line_items === 'string') {
    try { r.line_items = JSON.parse(r.line_items); } catch(e) {}
  }
  if (table === 'delivery_challans' && typeof r.items === 'string') {
    try { r.items = JSON.parse(r.items); } catch(e) {}
  }
  return r;
}

async function runDataMigration() {
  console.log('=== STARTING FULL SUPABASE DATA SEED / MIGRATION ===');
  let successCount = 0;
  let failCount = 0;

  for (const table of tableOrder) {
    const rows = dump[table] || [];
    if (rows.length === 0) {
      console.log(`- ${table}: 0 rows (skipped)`);
      continue;
    }

    console.log(`Migrating ${table} (${rows.length} rows)...`);
    const cleanedRows = rows.map(r => cleanRow(table, r));

    for (let i = 0; i < cleanedRows.length; i += 50) {
      const batch = cleanedRows.slice(i, i + 50);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error(`  [X] Failed ${table} batch ${i}:`, error.message);
        failCount++;
      } else {
        successCount += batch.length;
      }
    }
    console.log(`  [OK] ${table} completed.`);
  }

  console.log(`=== MIGRATION COMPLETE: ${successCount} rows inserted, ${failCount} batch errors ===`);
}

runDataMigration();

