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

async function runTests() {
  const loginRes = await request('/api/auth/login', 'POST', {
    email: 'admin@signsync.io',
    password: 'Password123!'
  });
  const cookieHeader = loginRes.headers['set-cookie'];
  const sessionCookie = cookieHeader ? cookieHeader[0].split(';')[0] : null;

  // 1. DSC Product Add/Edit/Deactivate and Price Management
  const addProd = await request('/api/dsc/catalog', 'POST', {
    class_type: 'class_3_combo',
    certificate_type: 'combo_signing_encryption',
    validity_years: '3_years',
    vendor_base_price: 1200,
    partner_price: 1800,
    mrp: 3200
  }, sessionCookie);
  console.log('Add DSC Product:', addProd.status, addProd.data);
  const prodId = addProd.data?.id;

  const deactProd = await request(`/api/dsc/catalog/${prodId}/deactivate`, 'PATCH', { is_active: false }, sessionCookie);
  console.log('Deactivate DSC Product:', deactProd.status, deactProd.data);

  // 2. Stock Adjustments & Damaged Token Handling on branch-hq
  const stockAdj = await request('/api/inventory/adjust', 'POST', {
    branch_id: 'branch-hq',
    token_model: 'epass2003_auto',
    adjustment_type: 'quarantine_damaged',
    quantity: 2,
    reason: 'Chip malfunction detected during audit'
  }, sessionCookie);
  console.log('Stock Adjustment (Quarantine):', stockAdj.status, stockAdj.data);
}

runTests().catch(console.error);
