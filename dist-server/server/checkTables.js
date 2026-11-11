"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function check() {
    const tables = await (0, supabase_1.queryAll)(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
    console.log('Tables:', tables.map((t) => t.table_name).join(', '));
    const empCols = await (0, supabase_1.queryAll)(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('employees', 'user_profiles', 'users', 'staff')
    ORDER BY table_name, ordinal_position
  `);
    console.log('Columns:', empCols);
}
check();
