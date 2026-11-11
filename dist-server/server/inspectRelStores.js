"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("./dist-server/server/supabase.js");
async function inspectStores() {
    const ids = [
        'token_sales_estimates',
        'token_sales_invoices',
        'dsc_issuance_applications',
        'dsc_commission_transactions',
        'dsc_direct_rate_cards',
        'document_numbering_series',
        'document_numbering_rules',
        'customer_pricing_categories',
        'customer_category_assignments'
    ];
    for (const id of ids) {
        const rows = await (0, supabase_js_1.queryAll)(`SELECT id, registered_address FROM company_profile WHERE id = '${id}'`);
        if (rows && rows[0] && rows[0].registered_address) {
            try {
                const parsed = JSON.parse(rows[0].registered_address);
                console.log(`${id}: Array length = ${Array.isArray(parsed) ? parsed.length : 'object'}`);
            }
            catch (e) {
                console.log(`${id}: could not parse JSON (${rows[0].registered_address.slice(0, 40)})`);
            }
        }
        else {
            console.log(`${id}: no record or empty`);
        }
    }
}
inspectStores().catch(console.error);
