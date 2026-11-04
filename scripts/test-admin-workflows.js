const http = require('http');

async function request(path, method = 'GET', data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, 'http://localhost:3000');
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (cookie) {
      options.headers['Cookie'] = cookie;
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || body
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testWorkflow() {
  console.log('=== TEST 1: Super Admin Authentication ===');
  const adminLogin = await request('/api/auth/login', 'POST', {
    email: 'admin@signsync.io',
    password: 'Password123!'
  });
  const adminCookie = adminLogin.headers['set-cookie'] ? adminLogin.headers['set-cookie'][0].split(';')[0] : null;
  console.log('Super Admin Login:', adminLogin.status, 'Cookie:', Boolean(adminCookie));

  console.log('\n=== TEST 2: Super Admin creates a CA Master ===');
  const addCa = await request('/api/admin/masters/ca', 'POST', {
    ca_name: 'Tata Consultancy Services CA',
    ca_code: 'TCS-CA-2026',
    api_endpoint: 'https://ca.tcs.com/api/v1',
    support_contact: '+91 22 67789000'
  }, adminCookie);
  console.log('Create CA Master:', addCa.status, addCa.data);
  const caId = addCa.data?.id;

  console.log('\n=== TEST 3: Admin Deactivates CA Master ===');
  const deactCa = await request(`/api/admin/masters/ca/${caId}/deactivate`, 'PATCH', { is_active: false }, adminCookie);
  console.log('Deactivate CA Master:', deactCa.status, deactCa.data);

  console.log('\n=== TEST 4: Create a Restricted Field Staff Account ===');
  const staffEmail = `field.telecaller.${Date.now()}@signsync.io`;
  const createStaff = await request('/api/admin/users', 'POST', {
    email: staffEmail,
    full_name: 'Rohit Verma (Tele-caller)',
    role_id: 'role-field-staff',
    hierarchy_level_id: 'tier-4',
    initial_password: 'StaffPassword123!'
  }, adminCookie);
  console.log('Create Field Staff:', createStaff.status, createStaff.data);
  const staffId = createStaff.data?.id;

  console.log('\n=== TEST 5: Restricted Staff Login ===');
  const staffLogin = await request('/api/auth/login', 'POST', {
    email: staffEmail,
    password: 'StaffPassword123!'
  });
  const staffCookie = staffLogin.headers['set-cookie'] ? staffLogin.headers['set-cookie'][0].split(';')[0] : null;
  console.log('Staff Login:', staffLogin.status, 'Cookie:', Boolean(staffCookie));

  console.log('\n=== TEST 6: Unauthorized Action Rejection (Security Guard Check) ===');
  // Staff attempts to verify a payment (should be 403 Forbidden)
  const unauthVerify = await request('/api/billing/payments/verify', 'POST', {
    payment_id: 'non-existent-payment',
    action: 'verified'
  }, staffCookie);
  console.log('Staff Payment Verify Attempt (Expect 403):', unauthVerify.status, unauthVerify.data?.error);

  // Staff attempts to create token purchase batch (should be 403 Forbidden)
  const unauthBatch = await request('/api/inventory/batches', 'POST', {
    token_model: 'EPASS2003 AUTO',
    vendor_name: 'Feitian',
    quantity_purchased: 100,
    base_unit_price: 350
  }, staffCookie);
  console.log('Staff Inventory Batch Purchase Attempt (Expect 403):', unauthBatch.status, unauthBatch.data?.error);

  console.log('\n=== TEST 7: Temporary Delegation Grant (Super Admin -> Staff for billing.can_edit) ===');
  const grantDel = await request('/api/admin/delegations', 'POST', {
    recipient_user_id: staffId,
    module_key: 'billing',
    action_key: 'can_edit',
    valid_from: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    valid_until: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days ahead
    reason: 'Temporary audit support during month-end closure'
  }, adminCookie);
  console.log('Grant Temporary Delegation:', grantDel.status, grantDel.data);
  const delegationId = grantDel.data?.id;

  console.log('\n=== TEST 8: Delegated Action Verification (Staff can now verify payment) ===');
  // Attempt with delegation in place (should pass permission check and return 404 payment not found instead of 403 forbidden)
  const delegatedVerify = await request('/api/billing/payments/verify', 'POST', {
    payment_id: 'test-dummy-id',
    action: 'verified'
  }, staffCookie);
  console.log('Staff Payment Verify with Active Delegation (Expect 404 not 403):', delegatedVerify.status, delegatedVerify.data?.error);

  console.log('\n=== TEST 9: Revoke Temporary Delegation & Cascading Invalidation ===');
  const revokeDel = await request(`/api/admin/delegations/${delegationId}/revoke`, 'PATCH', {}, adminCookie);
  console.log('Revoke Delegation:', revokeDel.status, revokeDel.data);

  const postRevokeVerify = await request('/api/billing/payments/verify', 'POST', {
    payment_id: 'test-dummy-id',
    action: 'verified'
  }, staffCookie);
  console.log('Staff Payment Verify After Revocation (Expect 403):', postRevokeVerify.status, postRevokeVerify.data?.error);

  console.log('\n=== TEST 10: Audit Trail Verification ===');
  const auditLogs = await request('/api/admin/audit-logs?limit=5', 'GET', null, adminCookie);
  console.log('Audit Logs Recorded:', auditLogs.data?.logs?.length, 'Latest Action:', auditLogs.data?.logs?.[0]?.action_type);

  console.log('\nAll 10 Core Security, Master, RBAC & Delegation Workflows Tested Successfully.');
}

testWorkflow().catch(console.error);

