import { getRelationalStore, saveRelationalStore } from './dscMasterStore';
import { queryAll } from './supabase';

async function testStores() {
  const allStores = [
    'purchase_internal_profiles',
    'employee_master_directory',
    'employees',
    'user_data_visibility_scopes',
  ];

  for (const s of allStores) {
    const data = await getRelationalStore(s);
    console.log(`Store '${s}': ${data.length} records.`, data.slice(0, 2));
  }
}

testStores();

