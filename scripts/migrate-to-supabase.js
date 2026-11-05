const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dump = JSON.parse(fs.readFileSync('data/sqlite_dump.json', 'utf8'));

// Helper to convert boolean-like integers to true/false for postgres boolean columns
function sanitizeRow(table, row) {
  const r = { ...row };
  
  // Boolean conversions based on table schema
  if (table === 'hierarchy_levels') {
    r.can_delegate_default = Boolean(r.can_delegate_default);
  }
  if (table === 'user_profiles') {
    r.can_grant_permissions = Boolean(r.can_grant_permissions);
    r.permissions_frozen = Boolean(r.permissions_frozen);
  }
  if (table === 'role_module_permissions') {
    r.can_view = Boolean(r.can_view);
    r.can_create = Boolean(r.can_create);
    r.can_edit = Boolean(r.can_edit);
    r.can_delete = Boolean(r.can_delete);
    r.can_export = Boolean(r.can_export);
    r.mask_pii_fields = Boolean(r.mask_pii_fields);
  }
  if (table === 'partners') {
    r.kyc_verified = Boolean(r.kyc_verified);
    delete r.state_name; // if not in table
  }
  if (table === 'dsc_catalog') {
    r.is_active = Boolean(r.is_active);
  }
  if (table === 'bank_accounts') {
    r.is_default = Boolean(r.is_default);
    r.is_active = Boolean(r.is_active);
  }
  if (table === 'invoice_series_configs') {
    r.is_active = Boolean(r.is_active);
  }
  if (table === 'invoices') {
    if (typeof r.line_items === 'string') {
      try { r.line_items = JSON.parse(r.line_items); } catch(e) {}
    }
  }
  return r;
}

async function migrateExistingTables() {
  console.log('Migrating data to existing Supabase tables...');

  // Insertion order matters for Foreign Keys
  const order = [
    'hierarchy_levels',
    'roles',
    'branches',
    'user_profiles',
    'app_modules',
    'role_module_permissions',
    'partners',
    'dsc_catalog',
    'bank_accounts',
    'token_purchase_batches',
    'branch_token_stocks',
    'invoice_series_configs',
    'invoices',
    'payments_received',
    'financial_ledger',
    'crm_leads',
    'crm_follow_ups',
    'service_orders',
    'delivery_challans',
    'courier_dispatches'
  ];

  for (const table of order) {
    const rows = dump[table] || [];
    if (rows.length === 0) continue;

    console.log(`Syncing ${table} (${rows.length} rows)...`);
    const sanitized = rows.map(r => sanitizeRow(table, r));

    // Upsert in batches of 50
    for (let i = 0; i < sanitized.length; i += 50) {
      const batch = sanitized.slice(i, i + 50);
      const { data, error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error(`Error upserting ${table}:`, error.message);
      }
    }
  }
  console.log('Finished migrating existing tables.');
}

migrateExistingTables();

