import { queryAll } from './supabase';

async function check() {
  const tables = await queryAll(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log('Tables:', tables.map((t: any) => t.table_name).join(', '));
  
  const empCols = await queryAll(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('employees', 'user_profiles', 'users', 'staff')
    ORDER BY table_name, ordinal_position
  `);
  console.log('Columns:', empCols);
}
check();

