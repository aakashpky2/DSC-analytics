"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function checkMoreTables() {
    const [payments, invoices] = await Promise.all([
        (0, supabase_1.queryAll)('SELECT * FROM token_sales_payments LIMIT 5'),
        (0, supabase_1.queryAll)('SELECT * FROM token_sales_invoices LIMIT 5')
    ]);
    console.log('token_sales_payments:', payments);
    console.log('token_sales_invoices:', invoices);
    process.exit(0);
}
checkMoreTables();
