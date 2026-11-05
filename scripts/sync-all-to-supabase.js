const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dump = JSON.parse(fs.readFileSync('data/sqlite_dump.json', 'utf8'));

const tableOrder = [
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

async function syncToSupabase() {
  console.log('=== SYNCING EXACT SQLITE DUMP TO SUPABASE ===');
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const table of tableOrder) {
    const rows = dump[table] || [];
    if (rows.length === 0) {
      console.log(`- ${table}: 0 rows (skipped)`);
      continue;
    }

    console.log(`Pushing ${table} (${rows.length} rows)...`);
    
    // For roles, ensure all foreign keys exist or fix known test roles
    let cleanRows = rows;
    if (table === 'roles') {
      // Add missing roles if any user references them
      const extraRoles = [
        { id: 'role-ops-manager', hierarchy_level_id: 'tier-2', name: 'Operations Manager', description: 'Branch Operations Manager' },
        { id: 'role-senior-staff', hierarchy_level_id: 'tier-3', name: 'Senior Staff', description: 'Senior Executive Staff' }
      ];
      for (const er of extraRoles) {
        if (!cleanRows.find(r => r.id === er.id)) {
          cleanRows.push(er);
        }
      }
    }

    for (let i = 0; i < cleanRows.length; i += 50) {
      const batch = cleanRows.slice(i, i + 50);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error(`  [X] Error on ${table}:`, error.message);
        totalErrors++;
      } else {
        totalSuccess += batch.length;
        console.log(`  [OK] ${table} (${batch.length} rows upserted)`);
      }
    }
  }

  console.log(`\n=== FINAL RESULT: ${totalSuccess} rows synced, ${totalErrors} errors ===`);
}

syncToSupabase();
