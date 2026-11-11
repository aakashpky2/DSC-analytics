import { supabase } from './supabase';

async function inspectSchema() {
  // Let's test what tables exist by querying with limit 1
  const candidateTables = [
    'employees',
    'employee_master',
    'staff',
    'user_profiles',
    'users',
    'roles',
    'hierarchy_levels',
    'company_profiles',
    'user_company_access',
    'user_profiles_company_access',
    'user_permissions',
    'audit_logs'
  ];

  for (const table of candidateTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': NOT FOUND or error (${error.message})`);
    } else {
      console.log(`Table '${table}': FOUND! sample keys:`, data && data[0] ? Object.keys(data[0]) : '(empty table)');
    }
  }
}

inspectSchema();

