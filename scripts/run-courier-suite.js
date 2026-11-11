const http = require('http');
const { createSession } = require('../dist-server/server/auth.js');
const { supabase } = require('../dist-server/server/supabase.js');

function apiRequest(path, method = 'GET', body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Cookie: cookie ? `signsync_session=${cookie}` : ''
      }
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 200, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode || 200, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runCourierSuite() {
  const token = await createSession('usr-admin-root');
  console.log('Admin session created for courier suite.');

  const results = [];
  function assert(ref, name, condition, details) {
    const status = condition ? 'PASS' : 'FAIL';
    results.push({ ref, name, status, details });
    console.log(`[${status}] ${ref} - ${name}: ${details}`);
  }

  // 1. Masters
  const mastersRes = await apiRequest('/api/courier/masters', 'GET', null, token);
  assert('LOG-01', 'Logistics Master Data API', mastersRes.status === 200 && Boolean(mastersRes.data.courier_partners), `Returned master keys: ${Object.keys(mastersRes.data || {}).join(', ')}`);
  assert('LOG-02', 'Authoritative Courier Partners from PostgreSQL', Array.isArray(mastersRes.data.courier_partners) && mastersRes.data.courier_partners.length >= 3, `Found ${mastersRes.data.courier_partners?.length} courier partners in DB`);
  assert('LOG-03', 'Configurable Shipment Statuses from PostgreSQL', Array.isArray(mastersRes.data.shipment_statuses) && mastersRes.data.shipment_statuses.length >= 5, `Found ${mastersRes.data.shipment_statuses?.length} statuses`);
  assert('LOG-04', 'Configurable RTO Return Reasons from PostgreSQL', Array.isArray(mastersRes.data.rto_reasons) && mastersRes.data.rto_reasons.length >= 3, `Found ${mastersRes.data.rto_reasons?.length} RTO reasons`);
  assert('LOG-05', 'Configurable Dispatch Methods from PostgreSQL', Array.isArray(mastersRes.data.dispatch_methods) && mastersRes.data.dispatch_methods.length >= 3, `Found ${mastersRes.data.dispatch_methods?.length} dispatch methods`);
  assert('LOG-06', 'Configurable Packaging Types from PostgreSQL', Array.isArray(mastersRes.data.packaging_types) && mastersRes.data.packaging_types.length >= 3, `Found ${mastersRes.data.packaging_types?.length} packaging types`);
  assert('LOG-07', 'Configurable SLA Settings from PostgreSQL', Array.isArray(mastersRes.data.sla_settings) && mastersRes.data.sla_settings.length >= 2, `Found ${mastersRes.data.sla_settings?.length} SLA settings`);

  // 2. Add Partner & Tracking URL
  const uniqueCode = `EXP-${Date.now().toString().slice(-4)}`;
  const addPartnerRes = await apiRequest('/api/courier/masters/courier-partners', 'POST', {
    partner_name: `Express Logistics ${uniqueCode}`,
    partner_code: uniqueCode,
    tracking_url_template: 'https://track.expresslogistics.in/shipment?awb={TRACKING_NO}',
    is_active: true
  }, token);
  assert('LOG-08', 'Dynamic Courier Partner Addition via API', addPartnerRes.status === 200 && addPartnerRes.data.partner_code === uniqueCode, `Added courier: ${addPartnerRes.data.partner_name}`);

  const testAwb = `EXP-AWB-${Date.now()}`;
  const trackUrlRes = await apiRequest('/api/courier/resolve-tracking-url', 'POST', {
    carrier_code: uniqueCode,
    tracking_number: testAwb
  }, token);
  assert('LOG-09', 'Dynamic Tracking URL Parameter Substitution ({TRACKING_NO})', trackUrlRes.status === 200 && trackUrlRes.data.resolved_url === `https://track.expresslogistics.in/shipment?awb=${testAwb}`, `Resolved URL: ${trackUrlRes.data.resolved_url}`);

  // 3. Token Package Verification
  const badTokenVerify = await apiRequest('/api/courier/verify-token-package', 'POST', {
    order_id: 'ord-test-dummy',
    token_serial_number: `FT-NONEXISTENT-${Date.now()}`
  }, token);
  assert('LOG-10', 'Package Verification Blocks Unconfigured Tokens', badTokenVerify.status === 400 || badTokenVerify.status === 404, `Blocked unconfigured token: ${badTokenVerify.data.error || 'blocked'}`);

  // Setup valid token serial in DB
  const validSerial = `FT-ACCEPT-${Date.now()}`;
  await supabase.from('token_inventory').insert({
    organization_id: 'comp-default',
    serial_number: validSerial,
    status: 'ASSIGNED',
    created_at: new Date().toISOString()
  });

  const goodTokenVerify = await apiRequest('/api/courier/verify-token-package', 'POST', {
    order_id: 'ord-test-good',
    token_serial_number: validSerial
  }, token);
  assert('LOG-11', 'Package Verification Passes Configured/Reserved Tokens', goodTokenVerify.status === 200 && goodTokenVerify.data.verified === true, `Verified token: ${goodTokenVerify.data.serial_number}`);

  // 4. Shipment Creation
  const newShipment = await apiRequest('/api/courier/shipments', 'POST', {
    order_id: 'ord-courier-acceptance',
    customer_id: 'part-001',
    carrier_code: uniqueCode,
    tracking_number: testAwb,
    recipient_name: 'Test Customer Acceptance',
    recipient_address: '123 Business Lane, Delhi, 110001',
    recipient_phone: '9876543210',
    destination_pincode: '110001',
    dispatch_method: 'SURFACE_COURIER',
    packaging_type: 'TAMPER_EVIDENT_ENVELOPE',
    token_serial_numbers: [validSerial]
  }, token);
  assert('LOG-12', 'Shipment Creation with Token Linkage', newShipment.status === 200 && Boolean(newShipment.data.id), `Created shipment: ${newShipment.data.id}`);

  // Duplicate AWB check
  const duplicateAwb = await apiRequest('/api/courier/shipments', 'POST', {
    order_id: 'ord-courier-duplicate',
    customer_id: 'part-001',
    carrier_code: uniqueCode,
    tracking_number: testAwb,
    recipient_name: 'Test Duplicate',
    recipient_address: '123 Test',
    recipient_phone: '9876543210',
    destination_pincode: '110001',
    token_serial_numbers: []
  }, token);
  assert('LOG-13', 'Duplicate Tracking/AWB Number Conflict Prevention', duplicateAwb.status === 400 || duplicateAwb.status === 409, `Duplicate AWB rejected: ${duplicateAwb.data.error || 'rejected'}`);

  // 5. Daily Manifest
  const shipmentId = newShipment.data.id;
  const manifestRes = await apiRequest('/api/courier/manifests', 'POST', {
    carrier_code: uniqueCode,
    shipment_ids: [shipmentId]
  }, token);
  assert('LOG-14', 'Daily Dispatch Manifest Generation', manifestRes.status === 200 && Boolean(manifestRes.data.manifest_number), `Manifest Number: ${manifestRes.data.manifest_number}`);

  // 6. Tracking Milestones
  const inTransitMilestone = await apiRequest(`/api/courier/shipments/${shipmentId}/milestones`, 'POST', {
    status: 'IN_TRANSIT',
    location: 'Delhi Central Hub',
    description: 'Bag connected to outstation surface vehicle',
    timestamp: new Date().toISOString()
  }, token);
  assert('LOG-16', 'Tracking Milestone In-Transit Event', inTransitMilestone.status === 200, `Milestone logged: ${inTransitMilestone.data.status}`);

  const ofdMilestone = await apiRequest(`/api/courier/shipments/${shipmentId}/milestones`, 'POST', {
    status: 'OUT_FOR_DELIVERY',
    location: 'Connaught Place Delivery Hub',
    description: 'Out with delivery agent',
    timestamp: new Date().toISOString()
  }, token);
  assert('LOG-17', 'Tracking Milestone Out-For-Delivery Event', ofdMilestone.status === 200, `Milestone logged: ${ofdMilestone.data.status}`);

  // 7. Delivery Confirmation
  const deliveryRes = await apiRequest(`/api/courier/shipments/${shipmentId}/deliver`, 'POST', {
    delivery_date: new Date().toISOString(),
    received_by: 'Rahul S.',
    signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }, token);
  assert('LOG-18', 'Delivery Confirmation & Order Completion', deliveryRes.status === 200 && deliveryRes.data.status === 'DELIVERED', `Confirmed: ${deliveryRes.data.status}`);

  // 8. RTO Workflow with Second Shipment
  const rtoSerial = `FT-RTO-${Date.now()}`;
  await supabase.from('token_inventory').insert({
    organization_id: 'comp-default',
    serial_number: rtoSerial,
    status: 'ASSIGNED',
    created_at: new Date().toISOString()
  });
  const rtoAwb = `EXP-RTO-${Date.now()}`;
  const rtoShipment = await apiRequest('/api/courier/shipments', 'POST', {
    order_id: 'ord-rto-test',
    customer_id: 'part-002',
    carrier_code: uniqueCode,
    tracking_number: rtoAwb,
    recipient_name: 'RTO Customer',
    recipient_address: '404 Unknown Street',
    recipient_phone: '9999999999',
    destination_pincode: '110002',
    token_serial_numbers: [rtoSerial]
  }, token);

  const rtoMarkRes = await apiRequest(`/api/courier/shipments/${rtoShipment.data.id}/rto`, 'POST', {
    reason_code: 'DOOR_LOCKED',
    notes: 'Attempted 3 times, premises permanently locked'
  }, token);
  assert('LOG-20', 'RTO Marking & Operational Remediation Task Creation', rtoMarkRes.status === 200 && Boolean(rtoMarkRes.data.task_id || rtoMarkRes.data.rto_record), `RTO processed: ${rtoMarkRes.data.status || 'RTO_INITIATED'}`);

  // Physical serial mismatch restock test
  const mismatchRestock = await apiRequest('/api/courier/return-to-inventory', 'POST', {
    shipment_id: rtoShipment.data.id,
    verified_serial_number: 'WRONG-SERIAL-1234',
    physical_condition: 'INTACT'
  }, token);
  assert('LOG-21', 'Physical Serial Mismatch Blocks Restocking', mismatchRestock.status === 400, `Mismatch blocked: ${mismatchRestock.data.error || 'mismatch blocked'}`);

  // Restock with exact physical verification
  const exactRestock = await apiRequest('/api/courier/return-to-inventory', 'POST', {
    shipment_id: rtoShipment.data.id,
    verified_serial_number: rtoSerial,
    physical_condition: 'INTACT'
  }, token);
  assert('LOG-22', 'Physical Verification Restocks Token to AVAILABLE', exactRestock.status === 200 && (exactRestock.data.restocked_status === 'AVAILABLE' || exactRestock.data.status === 'RESTOCKED'), `Token restocked: ${exactRestock.data.restocked_status || 'AVAILABLE'}`);

  // 9. Logistics Reports
  const agingRes = await apiRequest('/api/courier/reports/in-transit-aging', 'GET', null, token);
  assert('LOG-23', 'In-Transit Aging Report with Configured SLA Thresholds', agingRes.status === 200 && Array.isArray(agingRes.data.aging_report), `Aging items count: ${agingRes.data.aging_report?.length}`);

  const perfRes = await apiRequest('/api/courier/reports/delivery-performance', 'GET', null, token);
  assert('LOG-24', 'Delivery Performance & Carrier Success Rates', perfRes.status === 200 && Boolean(perfRes.data.metrics), `Overall success rate: ${perfRes.data.metrics?.overall_success_rate}`);

  const rtoAuditRes = await apiRequest('/api/courier/reports/rto-audit', 'GET', null, token);
  assert('LOG-25', 'RTO & Remediation Audit Log Report', rtoAuditRes.status === 200 && Array.isArray(rtoAuditRes.data.rto_tasks), `RTO tasks count: ${rtoAuditRes.data.rto_tasks?.length}`);

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log('======================================================================');
  console.log(`COURIER SUITE: TOTAL ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('======================================================================');

  // Controlled cleanup
  await supabase.from('token_inventory').delete().eq('serial_number', validSerial);
  await supabase.from('token_inventory').delete().eq('serial_number', rtoSerial);
  await supabase.from('courier_shipments').delete().eq('id', shipmentId);
  if (rtoShipment.data?.id) await supabase.from('courier_shipments').delete().eq('id', rtoShipment.data.id);
  await supabase.from('courier_partners').delete().eq('partner_code', uniqueCode);

  return { passed, failed, total: results.length };
}

runCourierSuite().then(r => {
  if (r.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal courier acceptance suite error:', err);
  process.exit(1);
});

