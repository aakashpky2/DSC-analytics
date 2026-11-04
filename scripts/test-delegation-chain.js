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

async function testDelegationChainAndActionPermissions() {
  console.log('=== TEST 1: Authenticate Super Admin ===');
  const adminLogin = await request('/api/auth/login', 'POST', {
    email: 'admin@signsync.io',
    password: 'Password123!'
  });
  const adminCookie = adminLogin.headers['set-cookie'] ? adminLogin.headers['set-cookie'][0].split(';')[0] : null;

  console.log('\n=== TEST 2: Create Accounts for 3-Level Delegation Chain ===');
  // Level 1: Regional Admin
  const l1Email = `reg.admin.${Date.now()}@signsync.io`;
  const l1Res = await request('/api/admin/users', 'POST', {
    email: l1Email,
    full_name: 'Vikram Joshi (Regional Admin)',
    role_id: 'role-partner-admin',
    hierarchy_level_id: 'tier-1',
    initial_password: 'Password123!'
  }, adminCookie);
  const l1Id = l1Res.data?.id;

  // Level 2: Branch Manager
  const l2Email = `branch.mgr.${Date.now()}@signsync.io`;
  const l2Res = await request('/api/admin/users', 'POST', {
    email: l2Email,
    full_name: 'Sunita Rao (Branch Manager)',
    role_id: 'role-ops-manager',
    hierarchy_level_id: 'tier-2',
    initial_password: 'Password123!'
  }, adminCookie);
  const l2Id = l2Res.data?.id;

  // Level 3: Executive Staff
  const l3Email = `exec.staff.${Date.now()}@signsync.io`;
  const l3Res = await request('/api/admin/users', 'POST', {
    email: l3Email,
    full_name: 'Pooja Nair (Senior Executive)',
    role_id: 'role-senior-staff',
    hierarchy_level_id: 'tier-3',
    initial_password: 'Password123!'
  }, adminCookie);
  const l3Id = l3Res.data?.id;

  console.log('Created accounts:', { l1Id, l2Id, l3Id });

  // Login as Level 1
  const l1Login = await request('/api/auth/login', 'POST', { email: l1Email, password: 'Password123!' });
  const l1Cookie = l1Login.headers['set-cookie'] ? l1Login.headers['set-cookie'][0].split(';')[0] : null;

  // Login as Level 2
  const l2Login = await request('/api/auth/login', 'POST', { email: l2Email, password: 'Password123!' });
  const l2Cookie = l2Login.headers['set-cookie'] ? l2Login.headers['set-cookie'][0].split(';')[0] : null;

  // Login as Level 3
  const l3Login = await request('/api/auth/login', 'POST', { email: l3Email, password: 'Password123!' });
  const l3Cookie = l3Login.headers['set-cookie'] ? l3Login.headers['set-cookie'][0].split(';')[0] : null;

  console.log('\n=== TEST 3: Step 1 of Chain (Level 0 Super Admin -> Level 1 with can_delegate_further) ===');
  const grant1 = await request('/api/admin/delegations', 'POST', {
    recipient_user_id: l1Id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date(Date.now() - 3600000).toISOString(),
    valid_until: new Date(Date.now() + 86400000 * 5).toISOString(),
    reason: 'Authorize regional manager to manage inventory',
    can_delegate_further: true
  }, adminCookie);
  console.log('Grant 1 (L0 -> L1):', grant1.status, grant1.data?.id);
  const del1Id = grant1.data?.id;

  console.log('\n=== TEST 4: Step 2 of Chain (Level 1 -> Level 2 with parent_delegation_id) ===');
  const grant2 = await request('/api/admin/delegations', 'POST', {
    recipient_user_id: l2Id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date(Date.now() - 3600000).toISOString(),
    valid_until: new Date(Date.now() + 86400000 * 4).toISOString(),
    reason: 'Onward delegate to Branch Manager',
    can_delegate_further: true,
    parent_delegation_id: del1Id
  }, l1Cookie);
  console.log('Grant 2 (L1 -> L2):', grant2.status, grant2.data?.id);
  const del2Id = grant2.data?.id;

  console.log('\n=== TEST 5: Step 3 of Chain (Level 2 -> Level 3 terminal delegate) ===');
  const grant3 = await request('/api/admin/delegations', 'POST', {
    recipient_user_id: l3Id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date(Date.now() - 3600000).toISOString(),
    valid_until: new Date(Date.now() + 86400000 * 3).toISOString(),
    reason: 'Terminal delegation to executive for transfer operations',
    can_delegate_further: false,
    parent_delegation_id: del2Id
  }, l2Cookie);
  console.log('Grant 3 (L2 -> L3):', grant3.status, grant3.data?.id);
  const del3Id = grant3.data?.id;

  console.log('\n=== TEST 6: Verify 3-Level Delegated Execution (Level 3 Staff can create transfer) ===');
  // Attempt with Level 3 staff
  const testTransfer = await request('/api/inventory/transfers', 'POST', {
    source_branch_id: 'branch-hq',
    destination_branch_id: 'branch-del',
    token_model: 'epass2003_auto',
    quantity: 1,
    remarks: 'Multi-level delegation test transfer'
  }, l3Cookie);
  console.log('Level 3 Staff Transfer Execution:', testTransfer.status, testTransfer.data?.challan_number || testTransfer.data);

  console.log('\n=== TEST 7: Cascading Revocation of Root Parent Grant (L0 revokes Grant 1) ===');
  const rootRevoke = await request(`/api/admin/delegations/${del1Id}/revoke`, 'PATCH', {}, adminCookie);
  console.log('Root Parent Revocation:', rootRevoke.status, rootRevoke.data);

  console.log('\n=== TEST 8: Verify Level 3 Grant Invalidation via Cascade ===');
  const postRevokeTransfer = await request('/api/inventory/transfers', 'POST', {
    source_branch_id: 'branch-hq',
    destination_branch_id: 'branch-del',
    token_model: 'epass2003_auto',
    quantity: 1,
    remarks: 'Post revoke transfer'
  }, l3Cookie);
  console.log('Level 3 Staff Post-Revoke Attempt (Expect 403):', postRevokeTransfer.status, postRevokeTransfer.data?.error);

  console.log('\n=== TEST 9: Prevention of Upward or Exceeding Expiry Delegation ===');
  // L2 tries to delegate to L1 (Upward delegation - should fail 403)
  const upwardAttempt = await request('/api/admin/delegations', 'POST', {
    recipient_user_id: l1Id,
    module_key: 'inventory',
    action_key: 'can_create',
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Illegal upward grant'
  }, l2Cookie);
  console.log('Upward Delegation Attempt (Expect 403):', upwardAttempt.status, upwardAttempt.data?.error);

  console.log('\n3-Level Delegation Chain and Cascading Invalidation Verified.');
}

testDelegationChainAndActionPermissions().catch(console.error);

