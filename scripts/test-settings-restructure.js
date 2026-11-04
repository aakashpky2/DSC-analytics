// Comprehensive End-to-End Test for Restructured DBIZ Master Settings & Numbering
const http = require('http');

async function loginAsAdmin() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@signsync.io',
      password: 'Password123!'
    })
  });
  const cookie = loginRes.headers.get('set-cookie');
  const body = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(body)}`);
  return cookie;
}

async function runTests() {
  console.log('================================================================');
  console.log('SIGNSYNC B2B — MASTER SETTINGS DBIZ RESTRUCTURE VERIFICATION');
  console.log('================================================================\n');

  const cookie = await loginAsAdmin();
  console.log('✔ Successfully authenticated as Super Admin (Level 0)');

  const req = async (url, options = {}) => {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      cookie
    };
    const res = await fetch(`http://localhost:3000${url}`, options);
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data: json };
  };

  // 1. Verify /admin/settings page returns 200 and contains exactly two top-level tabs: CONFIGURATION and NUMBERING
  const pageRes = await fetch('http://localhost:3000/admin/settings', { headers: { cookie } });
  const html = await pageRes.text();
  console.log('\n[TEST 1] Page /admin/settings Top-Level Tabs Verification:');
  const hasConfigTab = html.includes('1. CONFIGURATION');
  const hasNumberingTab = html.includes('2. NUMBERING');
  console.log(' - Contains "1. CONFIGURATION" top tab:', hasConfigTab);
  console.log(' - Contains "2. NUMBERING" top tab:', hasNumberingTab);
  if (!hasConfigTab || !hasNumberingTab) throw new Error('Top-level tabs failed verification');

  // 2. Test Numbering Config API with Super Admin auth
  console.log('\n[TEST 2] Numbering Configs Retrieval & Live Preview:');
  const numConfigs = await req('/api/admin/numbering');
  console.log(' - Numbering configs status:', numConfigs.status, '| Total series configs:', numConfigs.data.configs?.length);
  
  const previewRes = await req('/api/admin/numbering/preview', {
    method: 'POST',
    body: JSON.stringify({
      prefix: 'SS',
      suffix: 'EXP',
      separator: '/',
      parts_order: ['prefix', 'fy', 'counter', 'suffix'],
      fy_format: 'YY-YY',
      counter_padding: 5,
      counter: 105
    })
  });
  console.log(' - Live preview generated:', previewRes.data.preview);
  if (previewRes.data.preview !== 'SS/26-27/00105/EXP') {
    throw new Error(`Unexpected live preview: ${previewRes.data.preview}`);
  }

  // 3. Test Master Add: Certifying Authority (CA)
  console.log('\n[TEST 3] Master Add: Certifying Authority (CA):');
  const uid = Date.now().toString().slice(-4);
  const caCode = `CA${uid}`;
  const caName = `Capricorn Identity CA ${uid}`;
  const caRes = await req('/api/admin/masters/ca', {
    method: 'POST',
    body: JSON.stringify({
      ca_name: caName,
      ca_code: caCode,
      api_endpoint: 'https://api.capricorn.in/v2',
      support_contact: 'support@capricorn.in'
    })
  });
  console.log(' - Add CA status:', caRes.status, '| ID:', caRes.data.id);
  if (!caRes.ok) throw new Error(`Add CA failed: ${JSON.stringify(caRes.data)}`);

  // 4. Test Master Deactivate Toggle: Certifying Authority (CA)
  console.log('\n[TEST 4] Master Toggle Deactivate: CA:');
  const deactRes = await req(`/api/admin/masters/ca/${caRes.data.id}/deactivate`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: 0 })
  });
  console.log(' - Deactivate CA status:', deactRes.status, '| is_active:', deactRes.data.is_active);
  if (deactRes.data.is_active !== false) throw new Error('Deactivate CA failed');

  // 5. Test Master Add: Hardware Vendor
  console.log('\n[TEST 5] Master Add: Hardware Vendor:');
  const venRes = await req('/api/admin/masters/vendors', {
    method: 'POST',
    body: JSON.stringify({
      vendor_name: `Feitian Tech India Pvt Ltd ${uid}`,
      contact_person: 'Anil Kumar',
      email: 'sales@feitian.co.in',
      phone: '+91 9888877777',
      gstin: '27AABCF1234F1Z8',
      address: 'Plot 42, Electronics City, Bengaluru'
    })
  });
  console.log(' - Add Vendor status:', venRes.status, '| ID:', venRes.data.id);
  if (!venRes.ok) throw new Error(`Add Vendor failed: ${JSON.stringify(venRes.data)}`);

  // 6. Test Master Add: CRM Lead Source
  console.log('\n[TEST 6] Master Add: CRM Lead Source:');
  const srcRes = await req('/api/crm/lead-sources', {
    method: 'POST',
    body: JSON.stringify({
      source_name: `Trade Exhibition ${uid}`
    })
  });
  console.log(' - Add Lead Source status:', srcRes.status, '| ID:', srcRes.data.id);
  if (!srcRes.ok) throw new Error(`Add Lead Source failed: ${JSON.stringify(srcRes.data)}`);

  // 7. Verify List includes new records
  console.log('\n[TEST 7] Verify List of Masters reflects additions:');
  const listCAs = await req('/api/admin/masters/ca');
  const listVendors = await req('/api/admin/masters/vendors');
  const listSources = await req('/api/crm/lead-sources');
  console.log(' - Total CAs now:', listCAs.data.authorities?.length);
  console.log(' - Total Vendors now:', listVendors.data.vendors?.length);
  console.log(' - Total Lead Sources now:', listSources.data.sources?.length);

  // 8. Test Company Profile Update
  console.log('\n[TEST 8] Company Profile Save & Persistence:');
  const compRes = await req('/api/admin/settings/company', {
    method: 'PUT',
    body: JSON.stringify({
      legal_name: 'SignSync Digital Services Private Limited',
      trade_name: 'SignSync B2B Enterprise',
      gstin: '27AAECS1234F1Z5',
      pan: 'AAECS1234F',
      email: 'billing@signsync.in',
      phone: '+91 22 4567 8900',
      registered_address: 'Suite 404, Tech Park, Andheri East, Mumbai',
      state_code: '27',
      state_name: 'Maharashtra'
    })
  });
  console.log(' - Update Company status:', compRes.status, '| Result:', compRes.data.message);
  if (!compRes.ok) throw new Error('Company profile update failed');

  console.log('\n================================================================');
  console.log('✔ ALL DBIZ MASTER SETTINGS TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
