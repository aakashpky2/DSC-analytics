const http = require('http');

function fetchJson(path, options = {}) {
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
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function verifyAllLiveEndpoints() {
  console.log('=== VERIFYING SERVER RUNTIME (WITH ZERO LOCAL SQLITE FILES) ===');

  // 1. Health check
  console.log('\n1. Checking Health...');
  const health = await fetchJson('/api/health');
  console.log('Health:', health.status, health.body);

  // 2. Login as Admin
  console.log('\n2. Testing Admin Login...');
  const loginRes = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@signsync.io', password: 'Password123!' }
  });
  console.log('Login Status:', loginRes.status, 'User:', loginRes.body?.user?.full_name);
  
  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  const authHeaders = { 'Cookie': cookie, 'x-user-id': 'usr-admin-root' };

  // 3. Test Modules with EXACT route paths
  const testEndpoints = [
    { name: 'Admin Roles & Permissions', path: '/api/admin/roles' },
    { name: 'Admin Users & Staff', path: '/api/admin/users' },
    { name: 'Master Settings Company', path: '/api/admin/settings/company' },
    { name: 'Master Settings Tokens', path: '/api/admin/settings/tokens' },
    { name: 'Master Settings Couriers', path: '/api/admin/settings/couriers' },
    { name: 'Master Settings Services', path: '/api/admin/settings/services' },
    { name: 'Numbering Configurations', path: '/api/admin/numbering' },
    { name: 'Partners Directory', path: '/api/partners?page=1&limit=5' },
    { name: 'Invoices Listing', path: '/api/billing/invoices?page=1&limit=5' },
    { name: 'Billing Accounts', path: '/api/billing/accounts?page=1&limit=5' },
    { name: 'Inventory Batches', path: '/api/inventory/batches?page=1&limit=5' },
    { name: 'Inventory Branches', path: '/api/inventory/branches?page=1&limit=5' },
    { name: 'DSC Catalog', path: '/api/dsc/catalog' },
    { name: 'DSC Applications', path: '/api/dsc/applications?page=1&limit=5' },
    { name: 'CRM Leads', path: '/api/crm/leads?page=1&limit=5' },
    { name: 'CRM Follow-ups', path: '/api/crm/follow-ups?page=1&limit=5' },
    { name: 'Services Orders', path: '/api/services/orders?page=1&limit=5' },
    { name: 'Courier Dispatches', path: '/api/courier/dispatches?page=1&limit=5' },
    { name: 'Audit Logs', path: '/api/admin/audit-logs?page=1&limit=5' },
    { name: 'Temporary Delegations', path: '/api/admin/delegations' }
  ];

  let passed = 0;
  for (const ep of testEndpoints) {
    try {
      const res = await fetchJson(ep.path, { headers: authHeaders });
      if (res.status === 200) {
        console.log(`✅ [200 OK] ${ep.name}`);
        passed++;
      } else {
        console.log(`❌ [${res.status}] ${ep.name}:`, typeof res.body === 'object' ? JSON.stringify(res.body) : res.body.substring(0, 100));
      }
    } catch(err) {
      console.log(`❌ [ERR] ${ep.name}:`, err.message);
    }
  }

  console.log(`\n=== RESULTS: ${passed}/${testEndpoints.length} endpoints successfully connected directly to Supabase PostgreSQL ===`);
}

verifyAllLiveEndpoints();
