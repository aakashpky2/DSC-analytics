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

async function testRbacRoles() {
  console.log('=== TESTING RESTRICTED ROLE ACCESS (ROHIT VERMA - TELECALLER) ===\n');

  // 1. Login as field telecaller
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'field.telecaller.1793787633573@signsync.io', password: 'Password123!' }
  });
  console.log('Login Status:', loginRes.status, 'User:', loginRes.body?.user?.full_name, 'Role:', loginRes.body?.user?.role_name);
  const staffCookie = loginRes.headers['set-cookie'][0].split(';')[0];

  // 2. Rohit tries to access /api/admin/roles (Requires admin hierarchy <= 1)
  const rolesRes = await request('/api/admin/roles', {
    headers: { 'Cookie': staffCookie }
  });
  console.log('Staff access to /api/admin/roles:', rolesRes.status === 403 ? 'PASS (Blocked 403 Forbidden)' : 'FAIL (' + rolesRes.status + ')', rolesRes.body);

  // 3. Rohit tries to access /api/admin/roles with forged x-user-role: role-super-admin header
  const forgedRolesRes = await request('/api/admin/roles', {
    headers: { 'Cookie': staffCookie, 'x-user-role': 'role-super-admin', 'x-user-id': 'usr-admin-root' }
  });
  console.log('Staff with forged headers to /api/admin/roles:', forgedRolesRes.status === 403 ? 'PASS (Blocked 403 Forbidden)' : 'FAIL (' + forgedRolesRes.status + ')', forgedRolesRes.body);

  // 4. Rohit tries to access /api/billing/accounts (Requires billing.can_view - Telecaller does NOT have it)
  const billingRes = await request('/api/billing/accounts', {
    headers: { 'Cookie': staffCookie }
  });
  console.log('Staff access to /api/billing/accounts:', billingRes.status === 403 ? 'PASS (Blocked 403 Forbidden)' : 'FAIL (' + billingRes.status + ')', billingRes.body);

  // 5. Rohit tries to access /api/crm/leads (Telecaller DOES have CRM permission)
  const crmRes = await request('/api/crm/leads', {
    headers: { 'Cookie': staffCookie }
  });
  console.log('Staff access to authorized /api/crm/leads:', crmRes.status === 200 ? 'PASS (200 OK)' : 'FAIL (' + crmRes.status + ')', 'Leads returned:', crmRes.body?.leads?.length);

  // 6. Rohit tries to modify partner credit limit (Requires Super/Partner Admin hierarchy <= 1)
  const creditRes = await request('/api/partners/part-001', {
    method: 'PUT',
    headers: { 'Cookie': staffCookie },
    body: { credit_limit: 500000 }
  });
  console.log('Staff modify credit limit:', creditRes.status === 403 ? 'PASS (Blocked 403 Forbidden)' : 'FAIL (' + creditRes.status + ')', creditRes.body);

  // 7. Rohit logs out
  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'Cookie': staffCookie }
  });
  console.log('Logout Status:', logoutRes.status, logoutRes.body);

  // 8. Revoked session test
  const postLogoutRes = await request('/api/auth/me', {
    headers: { 'Cookie': staffCookie }
  });
  console.log('Post-logout access with revoked session:', postLogoutRes.status === 401 ? 'PASS (Blocked 401 Unauthorized)' : 'FAIL (' + postLogoutRes.status + ')');
}

testRbacRoles().catch(console.error);
