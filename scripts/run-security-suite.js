const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runSecuritySuite() {
  console.log('===============================================================');
  console.log('       SIGNSYNC B2B ENTERPRISE AUTHENTICATION & RBAC SUITE      ');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // SUITE 1: LOGIN AUTHENTICATION
  // -------------------------------------------------------------
  console.log('--- TEST 1: Login Verification ---');

  // 1.1 Invalid Password
  const badPassRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@signsync.io', password: 'WrongPassword999!' }
  });
  console.log('1.1 Bad password rejection:', badPassRes.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL', badPassRes.body);

  // 1.2 Invalid User
  const badUserRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'nonexistent@signsync.io', password: 'Password123!' }
  });
  console.log('1.2 Unknown email rejection:', badUserRes.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL', badUserRes.body);

  // 1.3 Case-Insensitive Email Login (Super Admin)
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'Admin@SignSync.IO', password: 'Password123!' }
  });
  console.log('1.3 Case-insensitive Admin Login:', loginRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', loginRes.body?.user?.full_name);
  
  const rawCookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : '';
  const adminCookie = rawCookie ? rawCookie.split(';')[0] : '';
  const isHttpOnly = rawCookie.toLowerCase().includes('httponly');
  console.log('    Cookie set:', adminCookie ? 'YES' : 'NO', '| HttpOnly:', isHttpOnly ? 'YES (Secure)' : 'NO (VULNERABLE)');

  // 1.4 Frozen / Inactive account rejection
  const frozenUserRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'ops_1793775786700@signsync.io', password: 'password123' }
  });
  console.log('1.4 Frozen account rejection:', frozenUserRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL', frozenUserRes.body);

  // -------------------------------------------------------------
  // SUITE 2: HEADER SPOOFING & FORGERY TESTS
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Header-Based Spoofing & Forgery (No Session Cookie) ---');

  // 2.1 Anonymous with x-user-role: role-super-admin
  const spoofRoleRes = await request('/api/admin/roles', {
    headers: { 'x-user-role': 'role-super-admin' }
  });
  console.log('2.1 Anonymous + spoofed x-user-role to /api/admin/roles:', spoofRoleRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + spoofRoleRes.status + ')');

  // 2.2 Anonymous with x-user-id: usr-admin-root
  const spoofIdRes = await request('/api/admin/roles', {
    headers: { 'x-user-id': 'usr-admin-root' }
  });
  console.log('2.2 Anonymous + spoofed x-user-id to /api/admin/roles:', spoofIdRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + spoofIdRes.status + ')');

  // 2.3 Anonymous request to protected business modules with spoofed header
  const spoofPartnerRes = await request('/api/partners', {
    headers: { 'x-user-id': 'usr-admin-root' }
  });
  console.log('2.3 Anonymous + spoofed x-user-id to /api/partners:', spoofPartnerRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + spoofPartnerRes.status + ')');

  const spoofInvoiceRes = await request('/api/billing/invoices', {
    headers: { 'x-user-id': 'usr-admin-root' }
  });
  console.log('2.3 Anonymous + spoofed x-user-id to /api/billing/invoices:', spoofInvoiceRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + spoofInvoiceRes.status + ')');

  // 2.4 Spoofing on /auth/me
  const spoofMeRes = await request('/api/auth/me', {
    headers: { 'x-user-id': 'usr-admin-root' }
  });
  console.log('2.4 Anonymous + spoofed x-user-id to /api/auth/me:', spoofMeRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + spoofMeRes.status + ')');

  // 2.5 Expired / Invalid Session Cookie
  const badCookieRes = await request('/api/auth/me', {
    headers: { 'Cookie': 'signsync_session=invalid-fake-token-99999' }
  });
  console.log('2.5 Forged session token cookie to /api/auth/me:', badCookieRes.status === 401 ? 'PASS (Blocked 401)' : 'FAIL (' + badCookieRes.status + ')');

  // -------------------------------------------------------------
  // SUITE 3: VALID SUPER ADMIN AUTHENTICATED ACCESS
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Valid Authenticated Admin Session Access ---');

  const meRes = await request('/api/auth/me', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.1 /api/auth/me with Admin Session:', meRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', meRes.body?.user?.full_name);

  const rolesRes = await request('/api/admin/roles', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.2 /api/admin/roles with Admin Session:', rolesRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Roles count: ' + rolesRes.body?.roles?.length);

  const partnersRes = await request('/api/partners', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.3 /api/partners with Admin Session:', partnersRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Partners count: ' + partnersRes.body?.partners?.length);

  const dscRes = await request('/api/dsc/applications', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.4 /api/dsc/applications with Admin Session:', dscRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Apps count: ' + dscRes.body?.applications?.length);

  const invRes = await request('/api/inventory/branches', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.5 /api/inventory/branches with Admin Session:', invRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Branches count: ' + invRes.body?.branchStocks?.length);

  const crmRes = await request('/api/crm/leads', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.6 /api/crm/leads with Admin Session:', crmRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Leads count: ' + crmRes.body?.leads?.length);

  const followUpsRes = await request('/api/crm/follow-ups', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.7 /api/crm/follow-ups with Admin Session:', followUpsRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Follow-ups count: ' + followUpsRes.body?.followUps?.length);

  const billRes = await request('/api/billing/invoices', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.8 /api/billing/invoices with Admin Session:', billRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Invoices count: ' + billRes.body?.invoices?.length);

  const payQueueRes = await request('/api/billing/payments/queue', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.9 /api/billing/payments/queue with Admin Session:', payQueueRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Queue count: ' + payQueueRes.body?.queue?.length);

  const courierRes = await request('/api/courier/dispatches', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.10 /api/courier/dispatches with Admin Session:', courierRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Dispatches count: ' + courierRes.body?.dispatches?.length);

  const auditRes = await request('/api/admin/audit-logs', {
    headers: { 'Cookie': adminCookie }
  });
  console.log('3.11 /api/admin/audit-logs with Admin Session:', auditRes.status === 200 ? 'PASS (200 OK)' : 'FAIL', 'Logs count: ' + auditRes.body?.logs?.length);

  console.log('\n===============================================================');
  console.log('                     ALL TESTS COMPLETED                      ');
  console.log('===============================================================');
}

runSecuritySuite().catch(console.error);

