"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function checkMoreTables() {
    const candidates = [
        'partners',
        'customer_pricing_categories',
        'purchase_internal_profiles',
        'app_master_states'
    ];
    for (const c of candidates) {
        try {
            const rows = await (0, supabase_1.queryAll)(`SELECT * FROM ${c} LIMIT 2`);
            console.log(`Table ${c} count: ${rows.length}, keys:`, rows.length > 0 ? Object.keys(rows[0]) : 'empty');
        }
        catch (e) {
            console.log(`Table ${c} error:`, e.message);
        }
    }
}
checkMoreTables();
