"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPurchaseBillDatabaseVerificationSuite = runPurchaseBillDatabaseVerificationSuite;
const supabase_1 = require("./supabase");
async function runPurchaseBillDatabaseVerificationSuite() {
    const results = [];
    const orgA = 'comp-default';
    const orgB = 'org-branch-del';
    function logPass(id, name, details) {
        results.push({ id, name, status: 'PASS', details });
    }
    function logFail(id, name, details) {
        results.push({ id, name, status: 'FAIL', details });
    }
    // 1. Check all 4 tables exist and contain organization_id
    try {
        const tables = ['token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks'];
        const cols = await (0, supabase_1.queryAll)(`SELECT table_name, column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')
         AND column_name = 'organization_id'`);
        if (cols.length === 4 && cols.every(c => c.is_nullable === 'NO')) {
            logPass('V-01', 'Tables organization_id existence & NOT NULL', `All 4 target tables have organization_id with NOT NULL constraint.`);
        }
        else {
            logFail('V-01', 'Tables organization_id existence & NOT NULL', `Found ${cols.length}/4 columns. Nullability details: ${JSON.stringify(cols)}`);
        }
    }
    catch (err) {
        logFail('V-01', 'Tables organization_id existence & NOT NULL', err.message);
    }
    // 2. Check no NULL organization_ids exist in the database
    try {
        const q1 = await (0, supabase_1.queryOne)('SELECT COUNT(*) as count FROM public.token_purchase_bills WHERE organization_id IS NULL');
        const q2 = await (0, supabase_1.queryOne)('SELECT COUNT(*) as count FROM public.token_purchase_bill_items WHERE organization_id IS NULL');
        const q3 = await (0, supabase_1.queryOne)('SELECT COUNT(*) as count FROM public.token_opening_stock WHERE organization_id IS NULL');
        const q4 = await (0, supabase_1.queryOne)('SELECT COUNT(*) as count FROM public.token_profile_stocks WHERE organization_id IS NULL');
        const totalNull = Number((q1 === null || q1 === void 0 ? void 0 : q1.count) || 0) + Number((q2 === null || q2 === void 0 ? void 0 : q2.count) || 0) + Number((q3 === null || q3 === void 0 ? void 0 : q3.count) || 0) + Number((q4 === null || q4 === void 0 ? void 0 : q4.count) || 0);
        if (totalNull === 0) {
            logPass('V-02', 'Zero NULL organization_id records', 'All 4 tables have 0 NULL organization_id records.');
        }
        else {
            logFail('V-02', 'Zero NULL organization_id records', `Detected ${totalNull} records with NULL organization_id.`);
        }
    }
    catch (err) {
        logFail('V-02', 'Zero NULL organization_id records', err.message);
    }
    // 3. Check RLS is enabled on all four tables
    try {
        const rls = await (0, supabase_1.queryAll)(`SELECT tablename, rowsecurity
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')`);
        if (rls.length === 4 && rls.every(r => r.rowsecurity === true)) {
            logPass('V-03', 'Row Level Security (RLS) Enabled', 'All 4 tables have RLS enabled (rowsecurity = true).');
        }
        else {
            logFail('V-03', 'Row Level Security (RLS) Enabled', `RLS status mismatch: ${JSON.stringify(rls)}`);
        }
    }
    catch (err) {
        logFail('V-03', 'Row Level Security (RLS) Enabled', err.message);
    }
    // 4. Verify NO hardcoded 'comp-default' bypass exists in RLS policies
    try {
        const bypass = await (0, supabase_1.queryAll)(`SELECT tablename, policyname, qual, with_check
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')
         AND (qual ILIKE '%comp-default%' OR with_check ILIKE '%comp-default%')`);
        if (bypass.length === 0) {
            logPass('V-04', 'No comp-default bypass in RLS policies', 'Zero RLS policies contain hardcoded comp-default bypass.');
        }
        else {
            logFail('V-04', 'No comp-default bypass in RLS policies', `Found ${bypass.length} policies containing hardcoded bypass: ${JSON.stringify(bypass)}`);
        }
    }
    catch (err) {
        logFail('V-04', 'No comp-default bypass in RLS policies', err.message);
    }
    // 5. Verify RLS policies use current_app_organization_id()
    try {
        const policies = await (0, supabase_1.queryAll)(`SELECT tablename, policyname, qual
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')`);
        const valid = policies.every(p => p.qual && p.qual.includes('current_app_organization_id()'));
        if (policies.length === 4 && valid) {
            logPass('V-05', 'Authoritative current_app_organization_id in RLS', 'All 4 tables use public.current_app_organization_id() for tenant isolation.');
        }
        else {
            logFail('V-05', 'Authoritative current_app_organization_id in RLS', `Found ${policies.length} policies: ${JSON.stringify(policies)}`);
        }
    }
    catch (err) {
        logFail('V-05', 'Authoritative current_app_organization_id in RLS', err.message);
    }
    // 6. Verify Composite Foreign Keys enforce cross-org & header/line profile matching
    try {
        const fks = await (0, supabase_1.queryAll)(`SELECT conname
       FROM pg_constraint
       WHERE conname IN (
         'fk_bill_org_profile',
         'fk_bill_item_parent_profile',
         'fk_bill_item_org_profile',
         'fk_opening_stock_org_profile',
         'fk_profile_stock_org_profile',
         'uq_purchase_bill_profile',
         'uq_purchase_bill_voucher_org',
         'uq_profile_token_model'
       )`);
        const foundNames = fks.map(f => f.conname);
        const expected = [
            'fk_bill_org_profile',
            'fk_bill_item_parent_profile',
            'fk_bill_item_org_profile',
            'fk_opening_stock_org_profile',
            'fk_profile_stock_org_profile',
            'uq_purchase_bill_profile',
            'uq_purchase_bill_voucher_org',
            'uq_profile_token_model'
        ];
        const missing = expected.filter(e => !foundNames.includes(e));
        if (missing.length === 0) {
            logPass('V-06', 'Database constraints & composite FKs', 'Composite foreign keys and unique constraints are active.');
        }
        else {
            logFail('V-06', 'Database constraints & composite FKs', `Missing constraints: ${missing.join(', ')}`);
        }
    }
    catch (err) {
        logFail('V-06', 'Database constraints & composite FKs', err.message);
    }
    // 7. Verify token_model_id is NOT NULL in token_profile_stocks
    try {
        const col = await (0, supabase_1.queryOne)(`SELECT is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'token_profile_stocks'
         AND column_name = 'token_model_id'`);
        if (col && col.is_nullable === 'NO') {
            logPass('V-07', 'token_profile_stocks.token_model_id NOT NULL', 'token_model_id is strictly NOT NULL (no ambiguous stock positions).');
        }
        else {
            logFail('V-07', 'token_profile_stocks.token_model_id NOT NULL', `Nullability: ${col === null || col === void 0 ? void 0 : col.is_nullable}`);
        }
    }
    catch (err) {
        logFail('V-07', 'token_profile_stocks.token_model_id NOT NULL', err.message);
    }
    // 8. Verify Indian GST & Accounting fields exist in token_purchase_bills
    try {
        const fields = [
            'accounting_date', 'supplier_invoice_date', 'voucher_number', 'supplier_invoice_number',
            'place_of_supply', 'vendor_gstin', 'vendor_state', 'vendor_state_code',
            'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'gst_amount',
            'other_charges', 'round_off', 'grand_total', 'company_profile_snapshot', 'vendor_snapshot'
        ];
        const cols = await (0, supabase_1.queryAll)(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'token_purchase_bills'`);
        const existing = cols.map(c => c.column_name);
        const missing = fields.filter(f => !existing.includes(f));
        if (missing.length === 0) {
            logPass('V-08', 'Indian GST & Statutory Accounting Fields', 'All required GST, date, supplier, and snapshot columns are present.');
        }
        else {
            logFail('V-08', 'Indian GST & Statutory Accounting Fields', `Missing columns: ${missing.join(', ')}`);
        }
    }
    catch (err) {
        logFail('V-08', 'Indian GST & Statutory Accounting Fields', err.message);
    }
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    return {
        summary: { total: results.length, passed, failed },
        results
    };
}
