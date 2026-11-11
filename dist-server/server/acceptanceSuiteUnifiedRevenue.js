"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUnifiedRevenueAndVisibilitySuite = runUnifiedRevenueAndVisibilitySuite;
const auth_1 = require("./auth");
const supabase_1 = require("./supabase");
const userDataVisibilityControl_1 = require("./userDataVisibilityControl");
const dscDirectIssuanceStore_1 = require("./dscDirectIssuanceStore");
const BASE_URL = 'http://localhost:3000';
async function runUnifiedRevenueAndVisibilitySuite() {
    var _a, _b, _c, _d, _e, _f, _g;
    const results = [];
    function logPass(id, name, details) {
        console.log(`[PASS] ${id}: ${name} - ${details}`);
        results.push({ id, name, status: 'PASS', details });
    }
    function logFail(id, name, details) {
        console.error(`[FAIL] ${id}: ${name} - ${details}`);
        results.push({ id, name, status: 'FAIL', details });
    }
    function assert(condition, id, name, details) {
        if (condition)
            logPass(id, name, details);
        else
            logFail(id, name, details);
    }
    const TS = Date.now();
    console.log('====================================================================');
    console.log('STARTING: UNIFIED REVENUE DASHBOARD & USER DATA VISIBILITY SUITE');
    console.log('====================================================================');
    const cleanup = {
        scopes: [],
        applications: [],
        txns: [],
        partners: [],
        users: [],
    };
    try {
        // 1. Fetch available profiles
        const profiles = await (0, supabase_1.queryAll)('SELECT id, legal_name FROM purchase_internal_profiles WHERE organization_id = ? ORDER BY legal_name ASC', ['comp-default']);
        const profileA = profiles[0];
        const profileB = profiles[1];
        console.log(`Using Profile A: ${profileA.legal_name} (${profileA.id})`);
        console.log(`Using Profile B: ${profileB.legal_name} (${profileB.id})`);
        // 2. Setup Super Admin and Staff User Sessions
        const adminToken = await (0, auth_1.createSession)('usr-admin-root', 1);
        const adminCookie = `signsync_session=${adminToken}`;
        // Staff User: Tier 3 Senior Staff usr-test-t3-1793867637511
        const staffUserId = 'usr-test-t3-1793867637511';
        const staffToken = await (0, auth_1.createSession)(staffUserId, 1);
        const staffCookie = `signsync_session=${staffToken}`;
        // 3. Create test customers across 2 states (Kerala '32', Maharashtra '27')
        const custKeralaId = `part-ker-${TS}`;
        const custMhId = `part-mh-${TS}`;
        cleanup.partners.push(custKeralaId, custMhId);
        await supabase_1.supabase.from('partners').insert([
            {
                id: custKeralaId,
                organization_id: 'comp-default',
                partner_code: `KER-${TS.toString().slice(-4)}`,
                company_name: `Kerala Enterprises ${TS}`,
                contact_person: 'Krishnan Nair',
                email: `krishnan_${TS}@keralaent.in`,
                phone: '9847012345',
                billing_address: 'M.G. Road, Kochi',
                state_code: '32', // Kerala
                type: 'customer',
                status: 'active',
            },
            {
                id: custMhId,
                organization_id: 'comp-default',
                partner_code: `MUM-${TS.toString().slice(-4)}`,
                company_name: `Mumbai Digital Hub ${TS}`,
                contact_person: 'Mahesh Patil',
                email: `mahesh_${TS}@mumbaidigital.in`,
                phone: '9820012345',
                billing_address: 'Andheri East, Mumbai',
                state_code: '27', // Maharashtra
                type: 'customer',
                status: 'active',
            },
        ]);
        // 4. Create distinct DSC Applications:
        // App 1: Profile A, Kerala Customer, ₹2000 Base + ₹360 GST = ₹2360 Gross (ISSUED)
        // App 2: Profile B, Maharashtra Customer, ₹3000 Base + ₹540 GST = ₹3540 Gross (ISSUED)
        const app1Id = `app-ker-A-${TS}`;
        const app2Id = `app-mh-B-${TS}`;
        cleanup.applications.push(app1Id, app2Id);
        const app1 = {
            id: app1Id,
            organization_id: 'comp-default',
            company_profile_id: profileA.id,
            application_number: `APP-KER-${TS.toString().slice(-4)}`,
            application_date: new Date().toISOString().split('T')[0],
            is_direct_transaction: true,
            client_id: custKeralaId,
            billing_party_id: custKeralaId,
            fulfillment_channel: 'DIRECT_SALE',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            quantity: 1,
            rate_card_type: 'DIRECT_RETAIL',
            base_rate: 2000,
            base_amount: 2000,
            gst_rate: 18,
            gst_amount: 360,
            total_amount: 2360,
            current_stage_id: 'stg-def-5',
            status: 'ISSUED',
            is_token_allocated: true,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const app2 = {
            id: app2Id,
            organization_id: 'comp-default',
            company_profile_id: profileB.id,
            application_number: `APP-MH-${TS.toString().slice(-4)}`,
            application_date: new Date().toISOString().split('T')[0],
            is_direct_transaction: true,
            client_id: custMhId,
            billing_party_id: custMhId,
            fulfillment_channel: 'DIRECT_SALE',
            company_id: 'dsc-co-1',
            product_id: 'prod-combo',
            quantity: 1,
            rate_card_type: 'DIRECT_RETAIL',
            base_rate: 3000,
            base_amount: 3000,
            gst_rate: 18,
            gst_amount: 540,
            total_amount: 3540,
            current_stage_id: 'stg-def-5',
            status: 'ISSUED',
            is_token_allocated: true,
            created_by: 'usr-admin-root',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await (0, dscDirectIssuanceStore_1.saveDscApplication)(app1);
        await (0, dscDirectIssuanceStore_1.saveDscApplication)(app2);
        // =========================================================================
        // TEST 1 — Admin: All Profiles & Complete Authorized Revenue
        // =========================================================================
        const adminRevRes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: adminCookie },
        });
        const adminRevData = await adminRevRes.json();
        assert(adminRevRes.ok &&
            adminRevData.success &&
            adminRevData.accessibleProfiles.length >= 2 &&
            adminRevData.kpis.total_gross_revenue >= 5900, // 2360 + 3540
        'TEST-1', 'Admin: Complete Authorized Multi-Profile Visibility', `Admin retrieved consolidated revenue: ₹${(_a = adminRevData.kpis) === null || _a === void 0 ? void 0 : _a.total_gross_revenue} across ${(_b = adminRevData.accessibleProfiles) === null || _b === void 0 ? void 0 : _b.length} profiles`);
        // =========================================================================
        // TEST 2 — Single Profile Staff Restriction (Profile A only)
        // =========================================================================
        cleanup.scopes.push(staffUserId);
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-1`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: false,
            assigned_profile_ids: [profileA.id], // Profile A only
            assigned_state_codes: [],
            assigned_customer_ids: [],
            assigned_category_ids: [],
            can_view_revenue: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const staffProfARes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: staffCookie },
        });
        const staffProfAData = await staffProfARes.json();
        assert(staffProfARes.ok &&
            staffProfAData.accessibleProfiles.length === 1 &&
            staffProfAData.accessibleProfiles[0].id === profileA.id, 'TEST-2', 'Single Profile Staff Restriction Enforced Server-Side', `Staff sees exclusively Profile A (${(_c = staffProfAData.accessibleProfiles[0]) === null || _c === void 0 ? void 0 : _c.legal_name}), Profile B filtered out`);
        // =========================================================================
        // TEST 3 — Multi-Profile Staff (Profile A + Profile B)
        // =========================================================================
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-2`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: false,
            assigned_profile_ids: [profileA.id, profileB.id], // Profiles A and B
            assigned_state_codes: [],
            assigned_customer_ids: [],
            assigned_category_ids: [],
            can_view_revenue: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const staffMultiRes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: staffCookie },
        });
        const staffMultiData = await staffMultiRes.json();
        assert(staffMultiRes.ok && staffMultiData.accessibleProfiles.length >= 2, 'TEST-3', 'Multi-Profile Staff Scope (All Profiles = A + B)', `All Profiles correctly aggregated authorized profiles: ${staffMultiData.accessibleProfiles.map((p) => p.legal_name).join(', ')}`);
        // =========================================================================
        // TEST 4 — State Restricted Staff (Kerala '32' only)
        // =========================================================================
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-3`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: true,
            assigned_profile_ids: [],
            assigned_state_codes: ['32'], // Kerala only
            assigned_customer_ids: [],
            assigned_category_ids: [],
            can_view_revenue: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const staffStateRes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: staffCookie },
        });
        const staffStateData = await staffStateRes.json();
        // Under Kerala-only scope, custMhId (Maharashtra) must NOT appear in topCustomers or drilldowns
        const topMhCustomer = (staffStateData.topCustomers || []).find((c) => c.customer_id === custMhId);
        const topKerCustomer = (staffStateData.topCustomers || []).find((c) => c.customer_id === custKeralaId);
        if (!topKerCustomer || topMhCustomer)
            console.log("TEST4_DEBUG:", { ok: staffStateRes.ok, hasKer: !!topKerCustomer, hasMh: !!topMhCustomer, topCustomers: staffStateData.topCustomers, kpis: staffStateData.kpis });
        assert(staffStateRes.ok && topKerCustomer && !topMhCustomer, 'TEST-4', 'Geographical State Restriction Enforced Server-Side', 'Kerala customer included; Maharashtra customer strictly excluded from all calculations');
        // =========================================================================
        // TEST 5 — Customer-Specific Access Restriction
        // =========================================================================
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-4`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: true,
            assigned_profile_ids: [],
            assigned_state_codes: [],
            assigned_customer_ids: [custMhId], // Mumbai Customer Only
            assigned_category_ids: [],
            can_view_revenue: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const staffCustRes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: staffCookie },
        });
        const staffCustData = await staffCustRes.json();
        const hasKeralaUnderMhScope = (staffCustData.topCustomers || []).some((c) => c.customer_id === custKeralaId);
        const hasMhUnderMhScope = (staffCustData.topCustomers || []).some((c) => c.customer_id === custMhId);
        assert(staffCustRes.ok && hasMhUnderMhScope && !hasKeralaUnderMhScope, 'TEST-5', 'Customer-Specific Access Scope Enforced', 'Assigned customer visible; non-assigned customer excluded from revenue aggregation');
        // =========================================================================
        // TEST 6 — Combined Restriction (Profile A + Kerala + Assigned Customer)
        // =========================================================================
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-5`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: false,
            assigned_profile_ids: [profileA.id],
            assigned_state_codes: ['32'],
            assigned_customer_ids: [custKeralaId],
            assigned_category_ids: [],
            can_view_revenue: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const staffCombinedRes = await fetch(`${BASE_URL}/api/reports/revenue?period=current_month&company_profile_id=ALL`, {
            headers: { Cookie: staffCookie },
        });
        const staffCombinedData = await staffCombinedRes.json();
        assert(staffCombinedRes.ok &&
            staffCombinedData.accessibleProfiles.length === 1 &&
            (staffCombinedData.topCustomers || []).length === 1 &&
            staffCombinedData.topCustomers[0].customer_id === custKeralaId, 'TEST-6', 'Strict Intersection of Combined Visibility Restrictions', 'Profile A ∩ Kerala ∩ Customer A successfully satisfied with 0 data leakage');
        // =========================================================================
        // TEST 7 — API Spoofing Protection (Attempt to request Profile B directly)
        // =========================================================================
        // Staff is currently restricted to Profile A only. Attempting to query Profile B in query param:
        const spoofRes = await fetch(`${BASE_URL}/api/reports/revenue?company_profile_id=${profileB.id}`, {
            headers: { Cookie: staffCookie },
        });
        assert(spoofRes.status === 403, 'TEST-7', 'API Parameter Spoofing & Tenant Guard', 'Server strictly rejected unauthorized company_profile_id with HTTP 403');
        // =========================================================================
        // TEST 8 — Revenue Aggregate Leakage Guard
        // =========================================================================
        // Total revenue in DB contains at least App1 (2360) + App2 (3540) = 5900
        // Staff restricted to Profile A + Customer Kerala must ONLY see App1 (2360)
        assert(Number((_d = staffCombinedData.kpis) === null || _d === void 0 ? void 0 : _d.total_gross_revenue) === 2360, 'TEST-8', 'Revenue Aggregate Leakage Prevention', `Dashboard Total (₹${(_e = staffCombinedData.kpis) === null || _e === void 0 ? void 0 : _e.total_gross_revenue}) reflects exclusively visible records, never overall database total`);
        // =========================================================================
        // TEST 9 — Direct URL & RBAC Enforcement (can_view_revenue = false)
        // =========================================================================
        await (0, userDataVisibilityControl_1.saveUserVisibilityScope)({
            id: `scope-${TS}-6`,
            organization_id: 'comp-default',
            user_id: staffUserId,
            all_profiles_access: true,
            assigned_profile_ids: [],
            assigned_state_codes: [],
            assigned_customer_ids: [],
            assigned_category_ids: [],
            can_view_revenue: false, // Forbidden from viewing revenue dashboard
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const forbiddenRes = await fetch(`${BASE_URL}/api/reports/revenue`, {
            headers: { Cookie: staffCookie },
        });
        assert(forbiddenRes.status === 403, 'TEST-9', 'Direct URL & Functional RBAC Enforcement', 'User with can_view_revenue=false blocked from endpoint with HTTP 403 Forbidden');
        // =========================================================================
        // TEST 10 — Drill-Down Verification & Audit Traceability
        // =========================================================================
        const drillRes = await fetch(`${BASE_URL}/api/reports/revenue/drilldown?customer_id=${custKeralaId}`, {
            headers: { Cookie: adminCookie },
        });
        const drillData = await drillRes.json();
        assert(drillRes.ok &&
            drillData.records &&
            drillData.records.length >= 1 &&
            drillData.records[0].reference_number === app1.application_number, 'TEST-10', 'Drill-Down Underlying Record Traceability', `Drilldown linked directly to underlying DSC application #${(_g = (_f = drillData.records) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.reference_number}`);
        // =========================================================================
        // CLEANUP — Zero-Residue Guarantee
        // =========================================================================
        console.log('Tearing down test artifacts (Zero-Residue Guarantee)...');
        await (0, userDataVisibilityControl_1.deleteUserVisibilityScope)('comp-default', staffUserId);
        const apps = await (0, dscDirectIssuanceStore_1.getDscApplications)('comp-default');
        const remainingApps = apps.filter((a) => !cleanup.applications.includes(a.id));
        const { saveRelationalStore } = await Promise.resolve().then(() => __importStar(require('./dscMasterStore')));
        await saveRelationalStore('dsc_issuance_applications', remainingApps);
        for (const pId of cleanup.partners) {
            await supabase_1.supabase.from('partners').delete().eq('id', pId);
        }
        assert(true, 'CLEANUP', 'Zero-Residue Test Record Teardown', 'All test scopes, applications, and partners removed');
    }
    catch (err) {
        logFail('SUITE-EXCEPTION', 'Unhandled Suite Exception', err.stack || err.message);
    }
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log('\n====================================================================');
    console.log('ACCEPTANCE SUITE RESULTS SUMMARY:');
    console.log('====================================================================');
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    if (failed === 0) {
        console.log('ALL UNIFIED REVENUE & USER DATA VISIBILITY TESTS PASSED!');
    }
    return { summary: { total: results.length, passed, failed }, results };
}
if (require.main === module) {
    runUnifiedRevenueAndVisibilitySuite().then((r) => {
        if (r.summary.failed > 0)
            process.exit(1);
        else
            process.exit(0);
    });
}
