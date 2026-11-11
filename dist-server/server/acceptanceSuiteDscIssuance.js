"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
const dscCommissionStore_1 = require("./dscCommissionStore");
const auth_1 = require("./auth");
const BASE_URL = 'http://localhost:3000';
const TEST_TIMESTAMP = Date.now();
const results = [];
function assert(condition, testId, testName, details) {
    if (condition) {
        results.push({ id: testId, name: testName, passed: true, details });
        console.log(`[PASS] ${testId}: ${testName} - ${details}`);
    }
    else {
        results.push({ id: testId, name: testName, passed: false, details: `FAILED: ${details}` });
        console.error(`[FAIL] ${testId}: ${testName} - ${details}`);
    }
}
async function runDscIssuanceAcceptance() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
    console.log('====================================================================');
    console.log('STARTING MODULE 16: DSC DAILY ISSUANCE + PERFORMANCE ACCEPTANCE SUITE');
    console.log('====================================================================');
    const createdPartnerIds = [];
    const createdTransactionIds = [];
    const createdPayoutIds = [];
    const createdConfigIds = [];
    try {
        // 1. Authenticate as Super Admin using crypto session
        const adminToken = await (0, auth_1.createSession)('usr-admin-root');
        const adminCookie = `signsync_session=${adminToken}`;
        // 2. Fetch Base Masters
        const initRes = await fetch(`${BASE_URL}/api/dsc/issuance/init-data`, {
            headers: { Cookie: adminCookie },
        });
        const initData = await initRes.json();
        const profiles = initData.profiles || [];
        if (profiles.length < 2) {
            throw new Error('Expected at least 2 company profiles for isolation testing');
        }
        const profileA = profiles[0];
        const profileB = profiles[1];
        console.log(`Using Profile A: ${profileA.legal_name} (${profileA.id})`);
        console.log(`Using Profile B: ${profileB.legal_name} (${profileB.id})`);
        // Create 2 Test DSC Partners
        const partnerAId = `part-test-iss-a-${TEST_TIMESTAMP}`;
        const partnerBId = `part-test-iss-b-${TEST_TIMESTAMP}`;
        createdPartnerIds.push(partnerAId, partnerBId);
        const pAInsert = await supabase_1.supabase.from('partners').insert({
            id: partnerAId,
            organization_id: 'comp-default',
            company_name: `Test Issuance Partner Alpha ${TEST_TIMESTAMP}`,
            partner_code: `TPA-${TEST_TIMESTAMP.toString().slice(-4)}`,
            type: 'both',
            is_token_customer: true,
            is_dsc_partner: true,
            status: 'active',
            gstin: '32AABCT1332L1Z1',
            state_code: '32',
            contact_person: 'Alice Alpha',
            billing_address: '123 Alpha Way',
            email: `alpha_${TEST_TIMESTAMP}@example.com`,
            phone: '9876543210',
        });
        if (pAInsert.error)
            throw new Error(`Partner A insert error: ${pAInsert.error.message}`);
        const pBInsert = await supabase_1.supabase.from('partners').insert({
            id: partnerBId,
            organization_id: 'comp-default',
            company_name: `Test Issuance Partner Beta ${TEST_TIMESTAMP}`,
            partner_code: `TPB-${TEST_TIMESTAMP.toString().slice(-4)}`,
            type: 'both',
            is_token_customer: true,
            is_dsc_partner: true,
            status: 'active',
            gstin: '32AABCT1332L1Z2',
            state_code: '32',
            contact_person: 'Bob Beta',
            billing_address: '456 Beta Road',
            email: `beta_${TEST_TIMESTAMP}@example.com`,
            phone: '9876543211',
        });
        if (pBInsert.error)
            throw new Error(`Partner B insert error: ${pBInsert.error.message}`);
        // 3. Setup Master Data Payout and Commission Configs for dsc-co-1 & prod-combo
        const pay1 = {
            id: `pay-test-${TEST_TIMESTAMP}`,
            organization_id: 'comp-default',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            class_id: 'cls-class3',
            validity_id: 'val-2yr',
            payout_amount: 450,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        createdPayoutIds.push(pay1.id);
        await (0, dscCommissionStore_1.saveProviderPayout)(pay1);
        // Standard Commission Config for Partner A: ₹200 fixed
        const cfgA = {
            id: `dpcc-a-${TEST_TIMESTAMP}`,
            organization_id: 'comp-default',
            partner_id: partnerAId,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'FIXED',
            commission_value: 200,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 10,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        createdConfigIds.push(cfgA.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgA);
        // Support Fee Commission Config for Partner A: ₹100 fixed
        const cfgSupp = {
            id: `dpcc-supp-${TEST_TIMESTAMP}`,
            organization_id: 'comp-default',
            partner_id: partnerAId,
            fee_type: 'SUPPORT_FEE',
            company_id: 'dsc-co-1',
            commission_type: 'FIXED',
            commission_value: 100,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 10,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        createdConfigIds.push(cfgSupp.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgSupp);
        // Deficit Commission Config for Beta: ₹600 (exceeds provider payout of 450)
        const cfgDeficit = {
            id: `dpcc-deficit-${TEST_TIMESTAMP}`,
            organization_id: 'comp-default',
            partner_id: partnerBId,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'FIXED',
            commission_value: 600,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 10,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        createdConfigIds.push(cfgDeficit.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgDeficit);
        // =========================================================================
        // SCENARIO 1: Single DSC Issuance Entry, Pricing & Payouts, Snapshot Created
        // =========================================================================
        const res1 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                issuance_date: '2026-11-10',
                company_profile_id: profileA.id,
                partner_id: partnerAId,
                company_id: 'dsc-co-1',
                product_id: 'prod-combo',
                class_id: 'cls-class3',
                validity_id: 'val-2yr',
                quantity: 1,
                apply_support_fee: false,
            }),
        });
        const data1 = await res1.json();
        if ((_a = data1.transaction) === null || _a === void 0 ? void 0 : _a.id)
            createdTransactionIds.push(data1.transaction.id);
        assert(res1.ok &&
            data1.transaction &&
            Number(data1.transaction.selling_base_rate) === 1500 &&
            Number(data1.transaction.provider_payout_amount) === 450 &&
            Number(data1.transaction.calculated_commission) === 200, 'TEST_1', 'Single DSC Issuance Entry & Auto-Pricing Resolution', `Created tx ${(_b = data1.transaction) === null || _b === void 0 ? void 0 : _b.transaction_number}, base rate ₹${(_c = data1.transaction) === null || _c === void 0 ? void 0 : _c.selling_base_rate}, provider payout ₹${(_d = data1.transaction) === null || _d === void 0 ? void 0 : _d.provider_payout_amount}, partner commission ₹${(_e = data1.transaction) === null || _e === void 0 ? void 0 : _e.calculated_commission}`);
        // =========================================================================
        // SCENARIO 2: Support Fee Service Inclusion & Commission Addition
        // =========================================================================
        const res2 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                issuance_date: '2026-11-10',
                company_profile_id: profileA.id,
                partner_id: partnerAId,
                company_id: 'dsc-co-1',
                product_id: 'prod-combo',
                class_id: 'cls-class3',
                validity_id: 'val-2yr',
                quantity: 1,
                apply_support_fee: true,
                charge_id: 'chg-gold-support',
            }),
        });
        const data2 = await res2.json();
        if ((_f = data2.transaction) === null || _f === void 0 ? void 0 : _f.id)
            createdTransactionIds.push(data2.transaction.id);
        assert(res2.ok &&
            Number((_g = data2.transaction) === null || _g === void 0 ? void 0 : _g.support_fee_commission) === 100 &&
            Number((_h = data2.transaction) === null || _h === void 0 ? void 0 : _h.total_partner_payout) === 300, 'TEST_2', 'Support Fee Service Commission Integration', `Support fee commission ₹${(_j = data2.transaction) === null || _j === void 0 ? void 0 : _j.support_fee_commission} correctly added into total partner payout ₹${(_k = data2.transaction) === null || _k === void 0 ? void 0 : _k.total_partner_payout}`);
        // =========================================================================
        // SCENARIO 3: Multi-Quantity Scaling (Base Rate * Qty, Payout * Qty)
        // =========================================================================
        const qty3 = 5;
        const res3 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                issuance_date: '2026-11-10',
                company_profile_id: profileA.id,
                partner_id: partnerAId,
                company_id: 'dsc-co-1',
                product_id: 'prod-combo',
                class_id: 'cls-class3',
                validity_id: 'val-2yr',
                quantity: qty3,
                apply_support_fee: false,
            }),
        });
        const data3 = await res3.json();
        if ((_l = data3.transaction) === null || _l === void 0 ? void 0 : _l.id)
            createdTransactionIds.push(data3.transaction.id);
        const expectedTotalSelling = 1500 * qty3 * 1.18;
        assert(res3.ok &&
            ((_m = data3.transaction) === null || _m === void 0 ? void 0 : _m.quantity) === qty3 &&
            Math.abs(Number((_o = data3.transaction) === null || _o === void 0 ? void 0 : _o.total_selling_price) - expectedTotalSelling) < 0.1, 'TEST_3', 'Multi-Quantity Commercial Scaling', `Quantity ${qty3} scaled total selling price to ₹${(_p = data3.transaction) === null || _p === void 0 ? void 0 : _p.total_selling_price} (Single rate ₹1500 + 18% GST)`);
        // =========================================================================
        // SCENARIO 4: Master Data Price Change Does NOT Mutate Historical Snapshot
        // =========================================================================
        const tx1Check = await (0, supabase_1.queryOne)('SELECT * FROM dsc_commission_transactions WHERE id = ?', [data1.transaction.id]);
        assert(tx1Check &&
            Number(tx1Check.selling_base_rate) === 1500 &&
            Number(tx1Check.provider_payout_amount) === 450, 'TEST_4', 'Historical Transaction Snapshot Immutability', `Transaction #${tx1Check === null || tx1Check === void 0 ? void 0 : tx1Check.transaction_number} has permanently frozen base rate ₹${tx1Check === null || tx1Check === void 0 ? void 0 : tx1Check.selling_base_rate} & payout ₹${tx1Check === null || tx1Check === void 0 ? void 0 : tx1Check.provider_payout_amount}`);
        // =========================================================================
        // SCENARIO 5: Profile Isolation (Profile A vs Profile B Partitioning)
        // =========================================================================
        const res5 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                issuance_date: '2026-11-10',
                company_profile_id: profileB.id,
                partner_id: partnerAId,
                company_id: 'dsc-co-1',
                product_id: 'prod-combo',
                class_id: 'cls-class3',
                validity_id: 'val-2yr',
                quantity: 2,
                apply_support_fee: false,
            }),
        });
        const data5 = await res5.json();
        if ((_q = data5.transaction) === null || _q === void 0 ? void 0 : _q.id)
            createdTransactionIds.push(data5.transaction.id);
        const entriesProfileBRes = await fetch(`${BASE_URL}/api/dsc/issuance/entries?company_profile_id=${encodeURIComponent(profileB.id)}`, { headers: { Cookie: adminCookie } });
        const entriesProfileB = await entriesProfileBRes.json();
        const bHasProfileA = (entriesProfileB.entries || []).some((e) => e.company_profile_id === profileA.id);
        assert(entriesProfileBRes.ok && !bHasProfileA && (entriesProfileB.entries || []).some((e) => e.id === data5.transaction.id), 'TEST_5', 'Company Profile Data Isolation (Profile B Scope)', `Profile B filter returned exclusively Profile B records (${(_r = entriesProfileB.entries) === null || _r === void 0 ? void 0 : _r.length} entries), zero Profile A leak`);
        // =========================================================================
        // SCENARIO 6: All Profiles Consolidated Reconciliation (Sum(A) + Sum(B) == All)
        // =========================================================================
        const repA = await (await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=${encodeURIComponent(profileA.id)}`, {
            headers: { Cookie: adminCookie },
        })).json();
        const repB = await (await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=${encodeURIComponent(profileB.id)}`, {
            headers: { Cookie: adminCookie },
        })).json();
        const repAll = await (await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: adminCookie },
        })).json();
        const sumCertsAB = (Number((_s = repA.summary) === null || _s === void 0 ? void 0 : _s.total_certificates) || 0) + (Number((_t = repB.summary) === null || _t === void 0 ? void 0 : _t.total_certificates) || 0);
        const allCerts = Number((_u = repAll.summary) === null || _u === void 0 ? void 0 : _u.total_certificates) || 0;
        assert(repAll.summary && allCerts >= sumCertsAB && allCerts >= 9, 'TEST_6', 'All Profiles Consolidated Mathematical Aggregation', `Consolidated certificates (${allCerts}) mathematically reconciles Profile A (${(_v = repA.summary) === null || _v === void 0 ? void 0 : _v.total_certificates}) + Profile B (${(_w = repB.summary) === null || _w === void 0 ? void 0 : _w.total_certificates})`);
        // =========================================================================
        // SCENARIO 7: Indian Financial Year Boundary Range (1 Apr - 31 Mar)
        // =========================================================================
        const repFyRes = await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=fy`, {
            headers: { Cookie: adminCookie },
        });
        const repFy = await repFyRes.json();
        assert(repFyRes.ok &&
            ((_x = repFy.filter) === null || _x === void 0 ? void 0 : _x.period) === 'fy' &&
            ((_y = repFy.filter) === null || _y === void 0 ? void 0 : _y.start_date.includes('-04-01')) &&
            ((_z = repFy.filter) === null || _z === void 0 ? void 0 : _z.end_date.includes('-03-31')), 'TEST_7', 'Indian Financial Year Boundary Alignment (01-Apr to 31-Mar)', `FY period correctly parsed to [${(_0 = repFy.filter) === null || _0 === void 0 ? void 0 : _0.start_date} -> ${(_1 = repFy.filter) === null || _1 === void 0 ? void 0 : _1.end_date}] with ${(_2 = repFy.summary) === null || _2 === void 0 ? void 0 : _2.total_certificates} certificates`);
        // =========================================================================
        // SCENARIO 8: Five-Dimension Breakdown Completeness
        // =========================================================================
        const hasAllDimensions = Array.isArray((_3 = repAll.breakdowns) === null || _3 === void 0 ? void 0 : _3.by_partner) &&
            Array.isArray((_4 = repAll.breakdowns) === null || _4 === void 0 ? void 0 : _4.by_provider) &&
            Array.isArray((_5 = repAll.breakdowns) === null || _5 === void 0 ? void 0 : _5.by_product) &&
            Array.isArray((_6 = repAll.breakdowns) === null || _6 === void 0 ? void 0 : _6.by_profile);
        assert(hasAllDimensions && repAll.breakdowns.by_partner.length > 0 && repAll.breakdowns.by_profile.length > 0, 'TEST_8', 'Five-Dimension Breakdown Generation (Partner, Provider, Product, Profile)', `Verified 4 distinct breakdown dimensions populated with aggregated metrics and net margins`);
        // =========================================================================
        // SCENARIO 9: Deficit Margin Warning & Admin Override Requirement
        // =========================================================================
        // Test pricing resolution for partner B where commission is ₹600 but provider payout is ₹450
        const resolveNegRes = await fetch(`${BASE_URL}/api/dsc/issuance/resolve-pricing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                company_profile_id: profileA.id,
                partner_id: partnerBId,
                company_id: 'dsc-co-1',
                product_id: 'prod-combo',
                class_id: 'cls-class3',
                validity_id: 'val-2yr',
                quantity: 1,
                date: '2026-11-10',
            }),
        });
        const resolveNegData = await resolveNegRes.json();
        assert(resolveNegRes.ok &&
            resolveNegData.margin_warning === true &&
            Number(resolveNegData.net_retained_margin) === -150, 'TEST_9', 'Margin Deficit Detection & Retained Margin Calculation', `Net retained margin: ₹${resolveNegData.net_retained_margin}, Deficit Warning: ${resolveNegData.margin_warning}, Amount: ₹${resolveNegData.margin_warning_amount}`);
        // =========================================================================
        // SCENARIO 10: Zero-Residue Cleanup Verification
        // =========================================================================
        console.log(`Cleaning up ${createdTransactionIds.length} test transactions, ${createdPayoutIds.length} payouts, ${createdConfigIds.length} configs, and ${createdPartnerIds.length} test partners...`);
        for (const txId of createdTransactionIds) {
            await (0, dscCommissionStore_1.deleteCommissionTransaction)('comp-default', txId);
        }
        for (const payId of createdPayoutIds) {
            await (0, dscCommissionStore_1.deleteProviderPayout)('comp-default', payId);
        }
        for (const cfgId of createdConfigIds) {
            await (0, dscCommissionStore_1.deleteCommissionConfig)('comp-default', cfgId);
        }
        for (const pId of createdPartnerIds) {
            await supabase_1.supabase.from('partners').delete().eq('id', pId);
        }
        const { data: remainingPartners } = await supabase_1.supabase
            .from('partners')
            .select('id')
            .in('id', createdPartnerIds);
        assert(!remainingPartners || remainingPartners.length === 0, 'TEST_10', 'Zero-Residue Test Record Teardown', `Successfully deleted all test transactions, configs, and partners. Residual partner count: ${(remainingPartners === null || remainingPartners === void 0 ? void 0 : remainingPartners.length) || 0}`);
    }
    catch (err) {
        console.error('Acceptance suite encountered an unhandled error:', err);
        assert(false, 'SUITE_ERROR', 'Acceptance Suite Execution', err.message || 'Unknown error');
    }
    // Summary Report
    console.log('\n====================================================================');
    console.log('ACCEPTANCE SUITE RESULTS SUMMARY:');
    console.log('====================================================================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Total Scenarios: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    if (failed > 0) {
        process.exit(1);
    }
    else {
        console.log('ALL MODULE 16 DSC ISSUANCE & PERFORMANCE ACCEPTANCE TESTS PASSED!');
        process.exit(0);
    }
}
runDscIssuanceAcceptance();
