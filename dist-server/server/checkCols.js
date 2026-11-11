"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function checkColumns() {
    const sample = await (0, supabase_1.queryAll)('SELECT * FROM user_profiles LIMIT 1');
    console.log('user_profiles keys:', sample.length > 0 ? Object.keys(sample[0]) : 'empty');
    // Check if we can alter table to add columns or if we already have columns
    // Let's test checking column existence
    try {
        const res = await (0, supabase_1.queryAll)('SELECT employee_code, password_change_required FROM user_profiles LIMIT 1');
        console.log('Columns employee_code and password_change_required exist!', res);
    }
    catch (err) {
        console.log('Columns test error:', err.message);
    }
}
checkColumns();
