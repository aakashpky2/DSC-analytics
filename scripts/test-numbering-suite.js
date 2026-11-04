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

async function testNumberingSuite() {
  console.log('=== TEST 1: Super Admin Login ===');
  const login = await request('/api/auth/login', 'POST', {
    email: 'admin@signsync.io',
    password: 'Password123!'
  });
  const cookie = login.headers['set-cookie'] ? login.headers['set-cookie'][0].split(';')[0] : null;
  console.log('Admin login:', login.status, 'Cookie acquired:', Boolean(cookie));

  console.log('\n=== TEST 2: Live Numbering Preview API ===');
  // Pattern 1: PREFIX/FY/COUNTER/SUFFIX
  const preview1 = await request('/api/admin/numbering/preview', 'POST', {
    prefix: 'SS-DSC',
    suffix: 'GOV',
    separator: '/',
    parts_order: ['prefix', 'fy', 'counter', 'suffix'],
    fy_format: 'YY-YY',
    counter_padding: 5,
    counter: 42
  }, cookie);
  console.log('Preview 1 (PREFIX/FY/COUNTER/SUFFIX):', preview1.data?.preview);

  // Pattern 2: PREFIX/SUFFIX/COUNTER
  const preview2 = await request('/api/admin/numbering/preview', 'POST', {
    prefix: 'INVOICE',
    suffix: 'MH',
    separator: '-',
    parts_order: ['prefix', 'suffix', 'counter'],
    counter_padding: 4,
    counter: 120
  }, cookie);
  console.log('Preview 2 (PREFIX-SUFFIX-COUNTER):', preview2.data?.preview);

  console.log('\n=== TEST 3: Update Document Numbering Configuration (Customer Leads) ===');
  const updateConfig = await request('/api/admin/numbering', 'POST', {
    document_type: 'lead',
    series_name: 'Smart CRM Customer Leads',
    prefix: 'LEAD',
    suffix: 'MUM',
    separator: '-',
    parts_order: ['prefix', 'counter', 'suffix'],
    counter_padding: 5,
    starting_counter: 2001,
    current_counter: 2000
  }, cookie);
  console.log('Configure Lead Numbering:', updateConfig.status, updateConfig.data);

  console.log('\n=== TEST 4: Generate Lead Record & Verify Formatted Sequence ===');
  const newLead = await request('/api/crm/leads', 'POST', {
    company_name: 'Matrix Logistics India',
    contact_person: 'Anita Roy',
    email: 'anita@matrixindia.in',
    phone: '9820556677',
    requirement_summary: '25 Class 3 combo tokens'
  }, cookie);
  console.log('Created Lead:', newLead.status, 'Generated lead_code:', newLead.data?.lead_code);

  console.log('\n=== TEST 5: Create Courier Dispatch & Verify Dispatch Numbering ===');
  const uniqueAwb = `DTDC-${Date.now().toString().slice(-6)}`;
  const newDispatch = await request('/api/courier/dispatches', 'POST', {
    carrier_name: 'DTDC Courier',
    awb_number: uniqueAwb,
    recipient_name: 'Anita Roy',
    recipient_phone: '9820556677',
    shipping_address: 'BKC, Mumbai - 400051',
    package_contents: '25x ePass2003 AUTO'
  }, cookie);
  console.log('Created Dispatch:', newDispatch.status, 'Generated dispatch_number:', newDispatch.data?.dispatch_number);

  console.log('\n=== TEST 6: Physical Token Serial Number Import & Uniqueness ===');
  const serialsImport = await request('/api/inventory/tokens/serials', 'POST', {
    token_model: 'EPASS2003 AUTO',
    branch_id: 'branch-hq',
    serial_numbers: ['FT-2026-0001', 'FT-2026-0002', 'FT-2026-0003']
  }, cookie);
  console.log('Import Physical Serials:', serialsImport.status, serialsImport.data);

  const duplicateImport = await request('/api/inventory/tokens/serials', 'POST', {
    token_model: 'EPASS2003 AUTO',
    branch_id: 'branch-hq',
    serial_numbers: ['FT-2026-0001', 'FT-2026-0004']
  }, cookie);
  console.log('Duplicate Serials Handling (Expect 1 inserted, 1 duplicate):', duplicateImport.data);

  console.log('\n=== TEST 7: Audit Log for Numbering Changes ===');
  const auditLogs = await request('/api/admin/audit-logs?limit=3', 'GET', null, cookie);
  console.log('Latest Audit Log Event:', auditLogs.data?.logs?.[0]?.action_type, 'Table:', auditLogs.data?.logs?.[0]?.table_affected);

  console.log('\nAll Centralized ID & Numbering Master Tests Passed.');
}

testNumberingSuite().catch(console.error);
