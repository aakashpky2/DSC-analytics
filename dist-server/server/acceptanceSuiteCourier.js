"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCourierSuite = runCourierSuite;
const http_1 = __importDefault(require("http"));
const auth_1 = require("./auth");
const BASE_HOST = '127.0.0.1';
const BASE_PORT = 3000;
let sessionCookie = '';
function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : '';
        const req = http_1.default.request({
            hostname: BASE_HOST,
            port: BASE_PORT,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                Cookie: sessionCookie,
            },
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => (raw += chunk));
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
const results = [];
function assert(ref, name, condition, details) {
    const status = condition ? 'PASS' : 'FAIL';
    results.push({ ref, name, status, details });
    console.log(`[${status}] ${ref} - ${name}: ${details}`);
}
async function runCourierSuite() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const token = await (0, auth_1.createSession)('usr-admin-root');
    sessionCookie = `signsync_session=${token}`;
    console.log('======================================================================');
    console.log('STARTING DBIZ ERP COURIER & LOGISTICS MODULE ACCEPTANCE SUITE');
    console.log('======================================================================\n');
    // SECTION 1: MASTER DATA SOURCE OF TRUTH
    console.log('>>> Auditing Logistics Master Data Architecture (Database Single Source of Truth)...');
    const mastersRes = await request('GET', '/api/courier/masters/all');
    assert('LOG-01', 'Logistics Master Data API', mastersRes.status === 200, `Returned master keys: ${Object.keys(mastersRes.data).join(', ')}`);
    const { couriers, statuses, rtoReasons, dispatchMethods, packagingTypes, slaSettings } = mastersRes.data;
    assert('LOG-02', 'Authoritative Courier Partners from PostgreSQL', Array.isArray(couriers) && couriers.length >= 4, `Found ${couriers === null || couriers === void 0 ? void 0 : couriers.length} courier partners in DB`);
    assert('LOG-03', 'Configurable Shipment Statuses from PostgreSQL', Array.isArray(statuses) && statuses.length >= 7, `Found ${statuses === null || statuses === void 0 ? void 0 : statuses.length} statuses (MANIFESTED, HANDED_TO_COURIER, IN_TRANSIT, DELIVERED, etc.)`);
    assert('LOG-04', 'Configurable RTO Return Reasons from PostgreSQL', Array.isArray(rtoReasons) && rtoReasons.length >= 5, `Found ${rtoReasons === null || rtoReasons === void 0 ? void 0 : rtoReasons.length} RTO reasons in DB`);
    assert('LOG-05', 'Configurable Dispatch Methods from PostgreSQL', Array.isArray(dispatchMethods) && dispatchMethods.length >= 3, `Found ${dispatchMethods === null || dispatchMethods === void 0 ? void 0 : dispatchMethods.length} dispatch methods (Surface, Hand Delivery, Counter)`);
    assert('LOG-06', 'Configurable Packaging Types from PostgreSQL', Array.isArray(packagingTypes) && packagingTypes.length >= 3, `Found ${packagingTypes === null || packagingTypes === void 0 ? void 0 : packagingTypes.length} security packaging types`);
    assert('LOG-07', 'Configurable SLA Settings from PostgreSQL', Array.isArray(slaSettings) && slaSettings.length >= 2, `Found ${slaSettings === null || slaSettings === void 0 ? void 0 : slaSettings.length} delivery SLA tiers`);
    // SECTION 2: DYNAMIC MASTER ADDITION & DYNAMIC TRACKING URL
    console.log('\n>>> Auditing Dynamic Master Addition & Tracking URL Resolution...');
    const newCarrierName = `Express Logistics ${Date.now().toString().slice(-4)}`;
    const addCourierRes = await request('POST', '/api/admin/settings/couriers', {
        company_name: newCarrierName,
        tracking_url_template: 'https://expresslogistics.example/track?awb={TRACKING_NO}',
        support_phone: '+91 1800 200 9999',
    });
    assert('LOG-08', 'Dynamic Courier Partner Addition via API', addCourierRes.status === 201, `Added courier: ${newCarrierName}`);
    const dynamicTrackRes = await request('GET', `/api/courier/track-url?courier_id=${addCourierRes.data.id}&awb=EXP998877`);
    assert('LOG-09', 'Dynamic Tracking URL Parameter Substitution ({TRACKING_NO})', dynamicTrackRes.data.tracking_url === 'https://expresslogistics.example/track?awb=EXP998877', `Resolved URL: ${dynamicTrackRes.data.tracking_url}`);
    // SECTION 3: PACKAGE VERIFICATION & TOKEN CONSISTENCY
    console.log('\n>>> Auditing Token Package Verification & Concurrency Checks...');
    const testSerial = `FT-LOG-${Date.now()}`;
    await request('POST', '/api/inventory/tokens/serials', {
        serial_numbers: [testSerial],
        token_model: 'EPASS2003 AUTO',
        branch_id: 'branch-hq',
    });
    // Token is newly created ('in_stock'), verify-package must require RESERVED or CONFIGURED
    const unconfiguredVerify = await request('POST', '/api/courier/verify-package', { serial_number: testSerial });
    assert('LOG-10', 'Package Verification Blocks Unconfigured Tokens', unconfiguredVerify.status === 400, `Blocked unconfigured token: ${unconfiguredVerify.data.error}`);
    // Reserve token
    await request('POST', '/api/inventory/tokens/reserve', { serial_number: testSerial, partner_id: 'part-001' });
    const configuredVerify = await request('POST', '/api/courier/verify-package', { serial_number: testSerial });
    assert('LOG-11', 'Package Verification Passes Configured/Reserved Tokens', configuredVerify.status === 200, `Verified token: ${(_a = configuredVerify.data.token) === null || _a === void 0 ? void 0 : _a.serial_number}`);
    // SECTION 4: SHIPMENT CREATION & DISPATCH SNAPSHOT
    console.log('\n>>> Auditing Shipment Creation, AWB Uniqueness & Dispatch Snapshots...');
    const testAwb = `BLU-LOG-${Date.now()}`;
    const shipmentRes = await request('POST', '/api/courier/shipments', {
        courier_id: addCourierRes.data.id,
        awb_number: testAwb,
        serial_number: testSerial,
        recipient_name: 'Priya Sundaram',
        recipient_phone: '9845012345',
        shipping_address: 'Plot 14, Electronic City Phase 1, Bangalore',
        district: 'Bangalore Urban',
        state: 'Karnataka',
        pin_code: '560100',
    });
    assert('LOG-12', 'Shipment Creation with Token Linkage', shipmentRes.status === 201, `Created shipment: ${shipmentRes.data.dispatch_number}`);
    // Duplicate AWB rejection test
    const dupAwbRes = await request('POST', '/api/courier/shipments', {
        courier_id: addCourierRes.data.id,
        awb_number: testAwb,
        recipient_name: 'Other Person',
        shipping_address: 'Bangalore',
    });
    assert('LOG-13', 'Duplicate Tracking/AWB Number Conflict Prevention', dupAwbRes.status === 409, `Duplicate AWB rejected: ${dupAwbRes.data.error}`);
    // SECTION 5: DAILY MANIFEST GENERATION & COURIER HANDOVER
    console.log('\n>>> Auditing Daily Manifest Generation & Courier Handover...');
    const manifestRes = await request('POST', '/api/courier/manifests', {
        courier_id: addCourierRes.data.id,
        shipment_ids: [shipmentRes.data.shipment_id],
        remarks: 'Daily outbound pickup',
    });
    assert('LOG-14', 'Daily Dispatch Manifest Generation', manifestRes.status === 201 && Boolean((_b = manifestRes.data.manifest) === null || _b === void 0 ? void 0 : _b.manifest_number), `Manifest Number: ${(_c = manifestRes.data.manifest) === null || _c === void 0 ? void 0 : _c.manifest_number}`);
    // Verify status moved to HANDED_TO_COURIER
    const shipDetail1 = await request('GET', `/api/courier/shipments/${shipmentRes.data.shipment_id}`);
    assert('LOG-15', 'Shipment Status Transition to HANDED_TO_COURIER', ((_d = shipDetail1.data.shipment) === null || _d === void 0 ? void 0 : _d.status) === 'HANDED_TO_COURIER', `Status after manifest: ${(_e = shipDetail1.data.shipment) === null || _e === void 0 ? void 0 : _e.status}`);
    // SECTION 6: TRACKING MILESTONES & HISTORY
    console.log('\n>>> Auditing Tracking Milestones & Multi-Event History...');
    const ms1 = await request('POST', '/api/courier/milestones', {
        shipment_id: shipmentRes.data.shipment_id,
        status: 'IN_TRANSIT',
        location: 'Bangalore Airport Logistics Hub',
        remarks: 'Departed sorting facility on vehicle KA-01-AB-1234',
    });
    assert('LOG-16', 'Tracking Milestone In-Transit Event', ms1.status === 201, `Milestone logged: ${(_f = ms1.data.milestone) === null || _f === void 0 ? void 0 : _f.status}`);
    const ms2 = await request('POST', '/api/courier/milestones', {
        shipment_id: shipmentRes.data.shipment_id,
        status: 'OUT_FOR_DELIVERY',
        location: 'Electronic City Delivery Center',
        remarks: 'Out for delivery with rider Ramesh',
    });
    assert('LOG-17', 'Tracking Milestone Out-For-Delivery Event', ms2.status === 201, `Milestone logged: ${(_g = ms2.data.milestone) === null || _g === void 0 ? void 0 : _g.status}`);
    // SECTION 7: DELIVERY CONFIRMATION & ACKNOWLEDGMENT
    console.log('\n>>> Auditing Delivery Confirmation & Token Consistency...');
    const delivConfirm = await request('POST', '/api/courier/confirm-delivery', {
        shipment_id: shipmentRes.data.shipment_id,
        received_by: 'Priya Sundaram',
        remarks: 'Confirmed delivered with physical signature',
    });
    assert('LOG-18', 'Delivery Confirmation & Order Completion', delivConfirm.status === 200, `Confirmed: ${delivConfirm.data.message}`);
    // Verify token status in inventory is also DELIVERED
    const auditToken = await request('GET', `/api/reports/token-serials/${testSerial}/audit`);
    assert('LOG-19', 'Token Inventory Synchronized to DELIVERED', ((_h = auditToken.data.serial) === null || _h === void 0 ? void 0 : _h.status) === 'DELIVERED', `Token status in DB: ${(_j = auditToken.data.serial) === null || _j === void 0 ? void 0 : _j.status}`);
    // SECTION 8: RTO HANDLING & OPERATIONAL TASK CREATION
    console.log('\n>>> Auditing Delivery Exception (RTO) & Operational Remediation...');
    const rtoSerial = `FT-RTO-${Date.now()}`;
    await request('POST', '/api/inventory/tokens/serials', {
        serial_numbers: [rtoSerial],
        token_model: 'EPASS2003 AUTO',
        branch_id: 'branch-hq',
    });
    await request('POST', '/api/inventory/tokens/reserve', { serial_number: rtoSerial, partner_id: 'part-001' });
    const rtoShipment = await request('POST', '/api/courier/shipments', {
        courier_id: addCourierRes.data.id,
        awb_number: `BLU-RTO-${Date.now()}`,
        serial_number: rtoSerial,
        recipient_name: 'Unavailable Customer',
        shipping_address: 'Remote Village, Thane',
    });
    const rtoRes = await request('POST', '/api/courier/rto', {
        shipment_id: rtoShipment.data.shipment_id,
        rto_reason_code: 'CUSTOMER_UNAVAILABLE',
        remarks: 'Consignee phone switched off after 3 delivery attempts',
    });
    assert('LOG-20', 'RTO Marking & Operational Remediation Task Creation', rtoRes.status === 201 && Boolean((_k = rtoRes.data.task) === null || _k === void 0 ? void 0 : _k.id), `Task ID: ${(_l = rtoRes.data.task) === null || _l === void 0 ? void 0 : _l.id}`);
    // SECTION 9: PHYSICAL RETURN VERIFICATION & INVENTORY RESTOCKING
    console.log('\n>>> Auditing Physical Return Verification & Inventory Restocking...');
    // Attempt restocking with mismatched serial (must fail)
    const mismatchRestock = await request('POST', '/api/courier/return-to-inventory', {
        shipment_id: rtoShipment.data.shipment_id,
        verified_serial_number: 'FT-FAKE-MISMATCH',
        physical_condition: 'INTACT',
    });
    assert('LOG-21', 'Physical Serial Mismatch Blocks Restocking', mismatchRestock.status === 400, `Mismatch blocked: ${mismatchRestock.data.error || mismatchRestock.data.message || JSON.stringify(mismatchRestock.data)}`);
    // Restock with exact physical verification
    const exactRestock = await request('POST', '/api/courier/return-to-inventory', {
        shipment_id: rtoShipment.data.shipment_id,
        verified_serial_number: rtoSerial,
        physical_condition: 'INTACT',
    });
    assert('LOG-22', 'Physical Verification Restocks Token to AVAILABLE', exactRestock.status === 200 && exactRestock.data.restocked_status === 'AVAILABLE', `Token restocked: ${exactRestock.data.restocked_status}`);
    // SECTION 10: LOGISTICS REPORTS
    console.log('\n>>> Auditing Logistics Reports & Performance Metrics...');
    const agingRes = await request('GET', '/api/courier/reports/in-transit-aging');
    assert('LOG-23', 'In-Transit Aging Report with Configured SLA Thresholds', agingRes.status === 200 && Array.isArray(agingRes.data.aging_report), `Aging items count: ${(_m = agingRes.data.aging_report) === null || _m === void 0 ? void 0 : _m.length}`);
    const perfRes = await request('GET', '/api/courier/reports/delivery-performance');
    assert('LOG-24', 'Delivery Performance & Carrier Success Rates', perfRes.status === 200 && Boolean(perfRes.data.metrics), `Overall success rate: ${(_o = perfRes.data.metrics) === null || _o === void 0 ? void 0 : _o.overall_success_rate}`);
    const rtoAuditRes = await request('GET', '/api/courier/reports/rto-audit');
    assert('LOG-25', 'RTO & Remediation Audit Log Report', rtoAuditRes.status === 200 && Array.isArray(rtoAuditRes.data.rto_tasks), `RTO tasks count: ${(_p = rtoAuditRes.data.rto_tasks) === null || _p === void 0 ? void 0 : _p.length}`);
    // Summary
    console.log('\n======================================================================');
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`TOTAL AUDIT CHECKS: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
    console.log('======================================================================');
    return { total: results.length, passed, failed };
}
if (require.main === module) {
    runCourierSuite().catch((err) => {
        console.error('Fatal courier acceptance suite error:', err);
        process.exit(1);
    });
}
