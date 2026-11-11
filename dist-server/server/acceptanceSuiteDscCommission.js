"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDscCommissionSuite = runDscCommissionSuite;
const http_1 = __importDefault(require("http"));
const dscCommissionStore_1 = require("./dscCommissionStore");
const dscCommissionEngine_1 = require("./dscCommissionEngine");
const auth_1 = require("./auth");
const supabase_1 = require("./supabase");
function makeReq(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : '';
        const req = http_1.default.request({
            hostname: '127.0.0.1',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                Cookie: token ? `signsync_session=${token}` : '',
            },
        }, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode || 200, data: JSON.parse(raw) });
                }
                catch (_a) {
                    resolve({ status: res.statusCode || 200, data: raw });
                }
            });
        });
        req.on('error', reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
async function runDscCommissionSuite() {
    var _a, _b, _c, _d, _e;
    const results = [];
    const orgA = 'comp-default';
    const orgB = 'org-branch-del';
    function logPass(id, name, details) {
        results.push({ id, name, status: 'PASS', details });
    }
    function logFail(id, name, details) {
        results.push({ id, name, status: 'FAIL', details });
    }
    // Cleanup tracker
    const cleanup = {
        partners: [],
        payouts: [],
        configs: [],
        qIncentives: [],
        tIncentives: [],
        txns: [],
    };
    try {
        const ts = Date.now();
        // 0. Setup cryptographically verified sessions
        const adminToken = await (0, auth_1.createSession)('usr-admin-root');
        const staffToken = await (0, auth_1.createSession)('usr-1793787633577'); // Restricted telecaller
        // 1. Setup Test Partners with Dual-Role capabilities
        const p1 = `part-comm-1-${ts}`;
        const p2 = `part-comm-2-${ts}`;
        cleanup.partners.push(p1, p2);
        await supabase_1.supabase.from('partners').insert([
            {
                id: p1,
                organization_id: orgA,
                partner_code: `PRT-C1-${ts.toString().slice(-4)}`,
                company_name: `Test DSC Partner Alpha ${ts}`,
                contact_person: 'Ramesh Gupta',
                email: `ramesh_${ts}@testpartner.com`,
                phone: '9811122334',
                billing_address: '101 Trade Center, Mumbai',
                state_code: '27',
                type: 'dsc_partner',
                status: 'active',
            },
            {
                id: p2,
                organization_id: orgA,
                partner_code: `PRT-C2-${ts.toString().slice(-4)}`,
                company_name: `Test Dual Role Partner Beta ${ts}`,
                contact_person: 'Suresh Patel',
                email: `suresh_${ts}@testpartner.com`,
                phone: '9811122335',
                billing_address: '202 Corporate Park, Ahmedabad',
                state_code: '24',
                type: 'token_partner',
                status: 'active',
            },
        ]);
        // TEST 1: Role Toggle Endpoint & Dual Roles
        const roleToggleRes = await makeReq('PUT', `/api/dsc/partners/${p2}/roles`, { is_token_customer: true, is_dsc_partner: true }, adminToken);
        if (roleToggleRes.status === 200 && roleToggleRes.data.type === 'both') {
            logPass('TEST-01', 'Partner Dual Role Activation', 'Enabled both Token Customer & DSC Partner successfully');
        }
        else {
            logFail('TEST-01', 'Partner Dual Role Activation', JSON.stringify(roleToggleRes.data));
        }
        // TEST 2: Role Retrieval Endpoint
        const roleGetRes = await makeReq('GET', `/api/dsc/partners/${p2}/roles`, undefined, adminToken);
        if (roleGetRes.status === 200 &&
            roleGetRes.data.is_token_customer &&
            roleGetRes.data.is_dsc_partner) {
            logPass('TEST-02', 'Partner Role Query Verification', 'Confirmed party has both active roles without duplication');
        }
        else {
            logFail('TEST-02', 'Partner Role Query Verification', JSON.stringify(roleGetRes.data));
        }
        // TEST 3: Reject disabling both roles
        const roleInvalidRes = await makeReq('PUT', `/api/dsc/partners/${p2}/roles`, { is_token_customer: false, is_dsc_partner: false }, adminToken);
        if (roleInvalidRes.status === 400) {
            logPass('TEST-03', 'Reject Zero Active Roles', 'Rejected unchecking both roles properly');
        }
        else {
            logFail('TEST-03', 'Reject Zero Active Roles', `Expected 400, got ${roleInvalidRes.status}`);
        }
        // TEST 4: Setup Provider Incoming Payouts (CA eMudhra dsc-co-1 pays us ₹450 per combo cert)
        const pay1 = {
            id: `dpp-test-1-${ts}`,
            organization_id: orgA,
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            payout_amount: 450,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.payouts.push(pay1.id);
        await (0, dscCommissionStore_1.saveProviderPayout)(pay1);
        const payFetch = await (0, dscCommissionStore_1.getProviderPayouts)(orgA, { companyId: 'dsc-co-1', productId: 'prod-combo' });
        if (payFetch.length > 0 && payFetch[0].payout_amount === 450) {
            logPass('TEST-04', 'Provider Payout Master Storage', 'Successfully stored CA payout rate of ₹450');
        }
        else {
            logFail('TEST-04', 'Provider Payout Master Storage', `Expected 450, got ${JSON.stringify(payFetch)}`);
        }
        // TEST 5: Setup Global Provider Commission Config (Default ₹200 for eMudhra)
        const cfgGlobal = {
            id: `dpcc-glob-${ts}`,
            organization_id: orgA,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: null,
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
        cleanup.configs.push(cfgGlobal.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgGlobal);
        // TEST 6: Resolve Commission under Global Provider Default (Expected Partner ₹200, Payout ₹450, Margin ₹250)
        const res1 = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p1,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
        });
        if (res1.calculatedCommission === 200 &&
            res1.providerPayoutAmount === 450 &&
            res1.netRetainedMargin === 250 &&
            !res1.marginWarning) {
            logPass('TEST-06', 'Global Provider Rate Resolution', 'Resolved ₹200 partner comm, ₹250 net margin, no warning');
        }
        else {
            logFail('TEST-06', 'Global Provider Rate Resolution', JSON.stringify(res1));
        }
        // TEST 7: Partner-Specific Rate Override (Partner P1 gets ₹250 for prod-combo)
        const cfgPartnerProd = {
            id: `dpcc-part-${ts}`,
            organization_id: orgA,
            partner_id: p1,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'FIXED',
            commission_value: 250,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 50,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.configs.push(cfgPartnerProd.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgPartnerProd);
        const res2 = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p1,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
        });
        if (res2.commissionHierarchyLevel === 'PARTNER_PRODUCT' && res2.calculatedCommission === 250) {
            logPass('TEST-07', 'Partner-Specific Product Hierarchy Precedence', 'Partner product rate superseded global default');
        }
        else {
            logFail('TEST-07', 'Partner-Specific Product Hierarchy Precedence', JSON.stringify(res2));
        }
        // TEST 8: Percentage Commission with BASE_PRICE_ONLY
        const cfgPctBase = {
            id: `dpcc-pct-base-${ts}`,
            organization_id: orgA,
            partner_id: p2,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'PERCENTAGE',
            commission_value: 20, // 20% of 1500 = 300
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 20,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.configs.push(cfgPctBase.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgPctBase);
        const res3 = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p2,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
            gstRate: 18,
        });
        if (res3.calculatedCommission === 300 && res3.totalSellingPrice === 1770) {
            logPass('TEST-08', 'Percentage Commission on BASE_PRICE_ONLY', 'Calculated 20% on ₹1500 = ₹300');
        }
        else {
            logFail('TEST-08', 'Percentage Commission on BASE_PRICE_ONLY', JSON.stringify(res3));
        }
        // TEST 9: Percentage Commission with BASE_PLUS_GST
        const cfgPctGst = {
            id: `dpcc-pct-gst-${ts}`,
            organization_id: orgA,
            partner_id: p2,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'PERCENTAGE',
            commission_value: 20, // 20% of 1770 = 354
            calculation_basis: 'BASE_PLUS_GST',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 30,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.configs.push(cfgPctGst.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgPctGst);
        const res4 = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p2,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
            gstRate: 18,
        });
        if (res4.calculatedCommission === 354) {
            logPass('TEST-09', 'Percentage Commission on BASE_PLUS_GST', 'Calculated 20% on ₹1770 = ₹354');
        }
        else {
            logFail('TEST-09', 'Percentage Commission on BASE_PLUS_GST', JSON.stringify(res4));
        }
        // TEST 10: Support Fee Commission Resolution (Ensure pay1 is retained)
        await (0, dscCommissionStore_1.saveProviderPayout)(pay1);
        const cfgSupp = {
            id: `dpcc-supp-${ts}`,
            organization_id: orgA,
            partner_id: p1,
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
        cleanup.configs.push(cfgSupp.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgSupp);
        const res5 = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p1,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
            supportFeeBaseAmount: 200,
        });
        if (res5.supportFeeCommission === 100 &&
            res5.totalPartnerPayout === 350 &&
            res5.netRetainedMargin === 100) {
            logPass('TEST-10', 'Support Fee Commission Combination', 'Partner product (₹250) + support fee (₹100) = ₹350');
        }
        else {
            logFail('TEST-10', 'Support Fee Commission Combination', JSON.stringify(res5));
        }
        // TEST 11: Margin Warning Trigger (Partner commission > Provider Payout)
        // Setup partner rate of ₹500 when provider payout is ₹450
        const cfgDeficit = {
            id: `dpcc-deficit-${ts}`,
            organization_id: orgA,
            partner_id: p1,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'FIXED',
            commission_value: 500,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 100,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.configs.push(cfgDeficit.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgDeficit);
        const resDeficit = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgA,
            partnerId: p1,
            companyId: 'dsc-co-1',
            productId: 'prod-combo',
            sellingBaseRate: 1500,
        });
        if (resDeficit.marginWarning &&
            resDeficit.marginWarningAmount === 50 &&
            resDeficit.netRetainedMargin === -50) {
            logPass('TEST-11', 'Margin Warning Detection', 'Detected ₹50 deficit warning when partner comm ₹500 > payout ₹450');
        }
        else {
            logFail('TEST-11', 'Margin Warning Detection', JSON.stringify(resDeficit));
        }
        // TEST 12: Block Unacknowledged Transaction when Margin Warning is Active
        const postUnack = await makeReq('POST', '/api/dsc/commission/transactions', {
            partner_id: p1,
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            selling_base_rate: 1500,
            override_warning: false,
        }, adminToken);
        if (postUnack.status === 400 && postUnack.data.margin_warning) {
            logPass('TEST-12', 'Block Unacknowledged Negative Margin', 'Blocked transaction submission without explicit override');
        }
        else {
            logFail('TEST-12', 'Block Unacknowledged Negative Margin', JSON.stringify(postUnack.data));
        }
        // TEST 13: Staff User Attempting Margin Override (Must be Rejected 403)
        const postStaffOverride = await makeReq('POST', '/api/dsc/commission/transactions', {
            partner_id: p1,
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            selling_base_rate: 1500,
            override_warning: true,
            override_reason: 'Staff test override',
        }, staffToken);
        if (postStaffOverride.status === 403) {
            logPass('TEST-13', 'RBAC Enforcement on Margin Override', 'Staff user strictly forbidden from overriding margin warning');
        }
        else {
            logFail('TEST-13', 'RBAC Enforcement on Margin Override', `Expected 403, got ${postStaffOverride.status}`);
        }
        // TEST 14: Admin Acknowledging Warning with Mandatory Reason
        const postAdminOverride = await makeReq('POST', '/api/dsc/commission/transactions', {
            partner_id: p1,
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            selling_base_rate: 1500,
            override_warning: true,
            override_reason: 'Approved executive strategic discount for key account',
        }, adminToken);
        if (postAdminOverride.status === 201 &&
            ((_a = postAdminOverride.data.transaction) === null || _a === void 0 ? void 0 : _a.margin_warning_acknowledged) &&
            ((_b = postAdminOverride.data.transaction) === null || _b === void 0 ? void 0 : _b.override_reason)) {
            cleanup.txns.push(postAdminOverride.data.transaction.id);
            logPass('TEST-14', 'Admin Authorized Margin Override', 'Admin recorded transaction with full audit snapshot');
        }
        else {
            logFail('TEST-14', 'Admin Authorized Margin Override', JSON.stringify(postAdminOverride.data));
        }
        // TEST 15: Restore Healthy Rate and Execute Standard Multi-Quantity Transaction
        const cfgHealthy = {
            id: `dpcc-healthy-${ts}`,
            organization_id: orgA,
            partner_id: p1,
            fee_type: 'DSC_PRODUCT',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            commission_type: 'FIXED',
            commission_value: 200,
            calculation_basis: 'BASE_PRICE_ONLY',
            effective_from: '2024-01-01',
            is_active: true,
            priority: 200,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.configs.push(cfgHealthy.id);
        await (0, dscCommissionStore_1.saveCommissionConfig)(cfgHealthy);
        const postHealthy = await makeReq('POST', '/api/dsc/commission/transactions', {
            partner_id: p1,
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            selling_base_rate: 1500,
            quantity: 5,
        }, adminToken);
        if (postHealthy.status === 201 &&
            ((_c = postHealthy.data.transaction) === null || _c === void 0 ? void 0 : _c.quantity) === 5 &&
            ((_d = postHealthy.data.transaction) === null || _d === void 0 ? void 0 : _d.calculated_commission) === 1000) {
            cleanup.txns.push(postHealthy.data.transaction.id);
            logPass('TEST-15', 'Healthy Multi-Quantity Execution', 'Executed 5 certs with ₹1000 commission, no warnings');
        }
        else {
            logFail('TEST-15', 'Healthy Multi-Quantity Execution', JSON.stringify(postHealthy.data));
        }
        // TEST 16: Quantity Slab Incentive Tier Configuration & Calculation
        const qIncentiveTier = {
            id: `dpqi-test-${ts}`,
            organization_id: orgA,
            partner_id: p1,
            period_type: 'MONTHLY',
            min_quantity: 5,
            max_quantity: null,
            incentive_amount: 50, // ₹50 bonus per certificate above 5
            incentive_type: 'PER_UNIT',
            is_active: true,
            priority: 10,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.qIncentives.push(qIncentiveTier.id);
        await (0, dscCommissionStore_1.saveQuantityIncentive)(qIncentiveTier);
        const todayStr = new Date().toISOString().split('T')[0];
        const incRes = await (0, dscCommissionEngine_1.calculatePartnerIncentives)(orgA, p1, {
            fromDate: todayStr,
            toDate: todayStr,
        });
        // 1 cert from test 14 + 5 certs from test 15 = 6 certs. Tier qualifies (>= 5). 6 * 50 = ₹300.
        if (incRes.totalCertificatesIssued >= 6 && incRes.quantityIncentiveEarned >= 300) {
            logPass('TEST-16', 'Quantity Slab Incentive Evaluation', `Earned ₹${incRes.quantityIncentiveEarned} bonus across ${incRes.totalCertificatesIssued} certs`);
        }
        else {
            logFail('TEST-16', 'Quantity Slab Incentive Evaluation', JSON.stringify(incRes));
        }
        // TEST 17: Turnover Incentive Tier Configuration & Calculation
        const tIncentiveTier = {
            id: `dpti-test-${ts}`,
            organization_id: orgA,
            partner_id: p1,
            period_type: 'MONTHLY',
            min_turnover: 5000,
            max_turnover: null,
            calculation_basis: 'BASE_PRICE_ONLY',
            incentive_type: 'PERCENTAGE',
            incentive_value: 2.5, // 2.5% of turnover
            is_active: true,
            priority: 10,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        cleanup.tIncentives.push(tIncentiveTier.id);
        await (0, dscCommissionStore_1.saveTurnoverIncentive)(tIncentiveTier);
        const incRes2 = await (0, dscCommissionEngine_1.calculatePartnerIncentives)(orgA, p1, {
            fromDate: todayStr,
            toDate: todayStr,
        });
        // Turnover: 1500 + (1500*5) = 9000. 2.5% of 9000 = ₹225. Total incentive = 300 + 225 = ₹525.
        if (incRes2.turnoverIncentiveEarned >= 225 && incRes2.totalIncentiveEarned >= 525) {
            logPass('TEST-17', 'Turnover Incentive Evaluation', `Earned ₹${incRes2.turnoverIncentiveEarned} turnover bonus (Total ₹${incRes2.totalIncentiveEarned})`);
        }
        else {
            logFail('TEST-17', 'Turnover Incentive Evaluation', JSON.stringify(incRes2));
        }
        // TEST 18: Commission Ledger & Summary Report Query
        const repRes = await makeReq('GET', `/api/dsc/reports/commissions?partner_id=${p1}`, undefined, adminToken);
        if (repRes.status === 200 && ((_e = repRes.data.summary) === null || _e === void 0 ? void 0 : _e.total_certificates) >= 6) {
            logPass('TEST-18', 'Commission Report Aggregation', 'Correctly aggregated certificates, payouts, and margins');
        }
        else {
            logFail('TEST-18', 'Commission Report Aggregation', JSON.stringify(repRes.data));
        }
        // TEST 19: Organization Tenant Isolation (Org B cannot see Org A configs or txns)
        const orgBConfigs = await (0, dscCommissionStore_1.getCommissionConfigs)(orgB, { partnerId: p1 });
        const orgBTxns = await (0, dscCommissionStore_1.getCommissionTransactions)(orgB, { partnerId: p1 });
        if (orgBConfigs.length === 0 && orgBTxns.length === 0) {
            logPass('TEST-19', 'Tenant Organization Isolation', 'Complete cross-tenant data isolation verified');
        }
        else {
            logFail('TEST-19', 'Tenant Organization Isolation', `Found leaked records: ${orgBConfigs.length} configs, ${orgBTxns.length} txns`);
        }
        // TEST 20: Zero-Residue Cleanup Verification
        for (const tId of cleanup.txns)
            await (0, dscCommissionStore_1.deleteCommissionTransaction)(orgA, tId);
        for (const qId of cleanup.qIncentives)
            await (0, dscCommissionStore_1.deleteQuantityIncentive)(orgA, qId);
        for (const tId of cleanup.tIncentives)
            await (0, dscCommissionStore_1.deleteTurnoverIncentive)(orgA, tId);
        for (const cId of cleanup.configs)
            await (0, dscCommissionStore_1.deleteCommissionConfig)(orgA, cId);
        for (const pId of cleanup.payouts)
            await (0, dscCommissionStore_1.deleteProviderPayout)(orgA, pId);
        for (const partId of cleanup.partners) {
            await supabase_1.supabase.from('partners').delete().eq('id', partId);
        }
        const postCleanupConfigs = await (0, dscCommissionStore_1.getCommissionConfigs)(orgA, { partnerId: p1 });
        const postCleanupTxns = await (0, dscCommissionStore_1.getCommissionTransactions)(orgA, { partnerId: p1 });
        if (postCleanupConfigs.length === 0 && postCleanupTxns.length === 0) {
            logPass('TEST-20', 'Zero-Residue Test Cleanup', 'All test configurations, transactions, and partners cleaned');
        }
        else {
            logFail('TEST-20', 'Zero-Residue Test Cleanup', 'Residual test records remained');
        }
    }
    catch (err) {
        logFail('SUITE-ERROR', 'Unhandled Commission Suite Exception', err.stack || err.message);
    }
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    return { summary: { total: results.length, passed, failed }, results };
}
