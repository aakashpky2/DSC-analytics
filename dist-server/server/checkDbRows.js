"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function checkRows() {
    const [quotes, estimates, profiles, locations, parties, salesPayments] = await Promise.all([
        (0, supabase_1.queryAll)('SELECT * FROM token_vendor_quotes LIMIT 2'),
        (0, supabase_1.queryAll)('SELECT * FROM token_purchase_estimates LIMIT 2'),
        (0, supabase_1.queryAll)('SELECT * FROM purchase_internal_profiles LIMIT 2'),
        (0, supabase_1.queryAll)('SELECT * FROM purchase_delivery_locations LIMIT 2'),
        (0, supabase_1.queryAll)('SELECT * FROM token_purchase_parties WHERE is_active = true LIMIT 2'),
        (0, supabase_1.queryAll)('SELECT * FROM token_sales_payments LIMIT 2')
    ]);
    console.log('Quotes:', quotes);
    console.log('Estimates:', estimates);
    console.log('Profiles:', profiles);
    console.log('Locations:', locations);
    console.log('Parties:', parties);
    console.log('SalesPayments:', salesPayments);
    process.exit(0);
}
checkRows();
