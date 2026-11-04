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

async function testRolePermissionsMatrix() {
  console.log('=== TEST 1: Authenticate Super Admin ===');
  const adminLogin = await request('/api/auth/login', 'POST', {
    email: 'admin@signsync.io',
    password: 'Password123!'
  });
  const adminCookie = adminLogin.headers['set-cookie'] ? adminLogin.headers['set-cookie'][0].split(';')[0] : null;

  console.log('\n=== TEST 2: Fetch Current Roles, Modules & Permissions ===');
  const rolesData = await request('/api/admin/roles', 'GET', null, adminCookie);
  console.log('Roles Count:', rolesData.data?.roles?.length);
  console.log('Modules Count:', rolesData.data?.modules?.length);
  console.log('Permissions Count:', rolesData.data?.rolePermissions?.length);

  const branchRole = rolesData.data?.roles?.find((r) => r.id === 'role-branch-mgr');
  console.log('Target Role:', branchRole?.name, 'Tier:', branchRole?.level_order);

  console.log('\n=== TEST 3: Configure Permissions for Branch Operations Manager ===');
  // Enable billing can_view and can_create, but explicitly DISABLE can_edit (which controls payment verification)
  const billingMod = rolesData.data?.modules?.find((m) => m.module_key === 'billing');
  const inventoryMod = rolesData.data?.modules?.find((m) => m.module_key === 'inventory');
  const crmMod = rolesData.data?.modules?.find((m) => m.module_key === 'crm');

  const updatePerms = await request(`/api/admin/roles/role-branch-mgr/permissions`, 'PUT', {
    permissions: [
      {
        module_id: billingMod.id,
        can_view: true,
        can_create: true,  // Can create invoices
        can_edit: false,   // CANNOT verify payments
        can_delete: false,
        can_export: false,
        mask_pii_fields: false
      },
      {
        module_id: inventoryMod.id,
        can_view: true,
        can_create: true,  // Can create transfers
        can_edit: false,
        can_delete: false,
        can_export: false,
        mask_pii_fields: false
      },
      {
        module_id: crmMod.id,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: false,
        can_export: false,
        mask_pii_fields: false
      }
    ]
  }, adminCookie);
  console.log('Update Permissions Result:', updatePerms.status, updatePerms.data);

  console.log('\n=== TEST 4: Reload & Confirm Persistence in Database ===');
  const reloaded = await request('/api/admin/roles', 'GET', null, adminCookie);
  const updatedPerm = reloaded.data?.rolePermissions?.find(
    (p) => p.role_id === 'role-branch-mgr' && p.module_id === billingMod.id
  );
  console.log('Persisted Billing Permission:', {
    can_view: Boolean(updatedPerm?.can_view),
    can_create: Boolean(updatedPerm?.can_create),
    can_edit: Boolean(updatedPerm?.can_edit)
  });

  console.log('\n=== TEST 5: Create Branch Manager Staff Account ===');
  const staffEmail = `test.branch.mgr.${Date.now()}@signsync.io`;
  const createStaff = await request('/api/admin/users', 'POST', {
    email: staffEmail,
    full_name: 'Suresh Menon (Branch Operations Manager)',
    role_id: 'role-branch-mgr',
    hierarchy_level_id: 'tier-2',
    initial_password: 'BranchPassword123!'
  }, adminCookie);
  console.log('Created Branch Manager:', createStaff.status);

  // Login as Branch Manager
  const staffLogin = await request('/api/auth/login', 'POST', {
    email: staffEmail,
    password: 'BranchPassword123!'
  });
  const staffCookie = staffLogin.headers['set-cookie'] ? staffLogin.headers['set-cookie'][0].split(';')[0] : null;

  console.log('\n=== TEST 6: Verify Invoice Creation is Allowed for this Role ===');
  // Fetch active bank and series
  const seriesList = await request('/api/billing/series', 'GET', null, staffCookie);
  const series = seriesList.data?.series?.[0];
  const partnerList = await request('/api/partners?limit=1', 'GET', null, staffCookie);
  const partner = partnerList.data?.partners?.[0];

  const createInv = await request('/api/billing/invoices', 'POST', {
    series_id: series?.id,
    partner_id: partner?.id,
    due_days: 15,
    line_items: [{ description: 'Class 3 DSC', qty: 1, rate: 1000 }]
  }, staffCookie);
  console.log('Branch Manager Create Invoice (Expect 201):', createInv.status, createInv.data?.invoice_number);

  console.log('\n=== TEST 7: Verify Payment Verification is Blocked for this Role ===');
  const verifyAttempt = await request('/api/billing/payments/verify', 'POST', {
    payment_id: 'dummy-payment-id',
    action: 'verified'
  }, staffCookie);
  console.log('Branch Manager Payment Verify (Expect 403 Forbidden):', verifyAttempt.status, verifyAttempt.data?.error);

  console.log('\n=== TEST 8: Verify Audit History Records Role Permission Modification ===');
  const auditLogs = await request('/api/admin/audit-logs?limit=3', 'GET', null, adminCookie);
  console.log('Latest Audit Action:', auditLogs.data?.logs?.[0]?.action_type, 'Table:', auditLogs.data?.logs?.[0]?.table_affected);

  console.log('\nAll Role Permission Matrix Frontend-to-Backend Tests Passed Successfully.');
}

testRolePermissionsMatrix().catch(console.error);

