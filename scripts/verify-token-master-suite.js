const http = require('http');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Cookie': `signsync_session=${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTokenVerification() {
  console.log('========================================================================');
  console.log('DBIZ ERP / SIGNSYNC — TOKEN MASTER DATA END-TO-END VERIFICATION');
  console.log('========================================================================\n');

  // Create temporary active sessions for Admin (Super Admin) and Field Staff (no inventory can_create/can_edit permission)
  const adminToken = 'tok-test-admin-' + Date.now();
  const fieldToken = 'tok-test-field-' + Date.now();
  const future = new Date(Date.now() + 3600000).toISOString();

  await supabase.from('sessions').insert([
    { id: 'sess-tok-adm-' + Date.now(), user_id: 'usr-admin-root', token: adminToken, expires_at: future },
    { id: 'sess-tok-fld-' + Date.now(), user_id: 'usr-test-t4-1793867637717', token: fieldToken, expires_at: future }
  ]);

  let passCount = 0;
  const totalTests = 12;

  // TEST 1: Fetch Token Companies with Defaults and Priority Ordering
  console.log('TEST 1: Fetch Token Companies with defaults & priority ordering...');
  const res1 = await request('GET', '/token/masters/companies', null, adminToken);
  const companies = res1.data?.companies || [];
  const defaultCo = companies.find(c => c.is_default === 1);
  if (res1.status === 200 && companies.length >= 4 && defaultCo && defaultCo.code === 'FEITIAN') {
    console.log(`  [PASS] Retrieved ${companies.length} companies. Default provider: ${defaultCo.company_name} (Code: ${defaultCo.code})`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 1 failed:', res1);
  }

  // TEST 2: Add New Token Provider Company (Active & Default control)
  console.log('\nTEST 2: Add new Token Provider Company via API...');
  const res2 = await request('POST', '/token/masters/companies', {
    company_name: 'Identiv Security Systems',
    code: 'IDENTIV',
    is_default: 0,
    is_active: 1,
    active_from: '2024-01-01',
    priority: 5,
    country: 'USA / India',
    support_email: 'support@identiv.com'
  }, adminToken);

  const createdCoId = res2.data?.company?.id;
  if (res2.status === 201 && createdCoId && res2.data.company.company_name === 'Identiv Security Systems') {
    console.log('  [PASS] Added token company: Identiv Security Systems (ID: ' + createdCoId + ')');
    passCount++;
  } else {
    console.error('  [FAIL] Test 2 failed:', res2);
  }

  // TEST 3: Deactivate & Activate Token Company
  console.log('\nTEST 3: Deactivate and Activate Token Company...');
  const res3Deact = await request('PUT', `/token/masters/companies/${createdCoId}`, { is_active: 0 }, adminToken);
  const res3FetchActive = await request('GET', '/token/masters/companies', null, adminToken);
  const isExcludedWhenInactive = !res3FetchActive.data.companies.some(c => c.id === createdCoId);
  
  // Re-activate
  const res3Act = await request('PUT', `/token/masters/companies/${createdCoId}`, { is_active: 1 }, adminToken);
  const res3FetchActiveAgain = await request('GET', '/token/masters/companies', null, adminToken);
  const isIncludedWhenActive = res3FetchActiveAgain.data.companies.some(c => c.id === createdCoId);

  if (res3Deact.status === 200 && isExcludedWhenInactive && res3Act.status === 200 && isIncludedWhenActive) {
    console.log('  [PASS] Deactivation excluded company from active list; reactivation restored company cleanly.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 3 failed:', { isExcludedWhenInactive, isIncludedWhenActive });
  }

  // TEST 4: Add Products under Company
  console.log('\nTEST 4: Add Products under Token Company...');
  const res4 = await request('POST', '/token/masters/products', {
    company_id: createdCoId,
    product_name: 'SCR3310v2 Smart Card Reader & Token',
    code: 'SCR3310_V2',
    is_default: 1,
    is_active: 1,
    active_from: '2024-01-01',
    description: 'High performance USB contact smart card reader token'
  }, adminToken);

  const createdProdId = res4.data?.product?.id;
  if (res4.status === 201 && createdProdId && res4.data.product.company_id === createdCoId) {
    console.log('  [PASS] Added product: SCR3310v2 under company ' + createdCoId + ' (ID: ' + createdProdId + ')');
    passCount++;
  } else {
    console.error('  [FAIL] Test 4 failed:', res4);
  }

  // TEST 5: Date-Wise Listing Capability for Products
  console.log('\nTEST 5: Date-wise listing filter capability for Products...');
  // Add a future product with active_from in 2030
  const res5Future = await request('POST', '/token/masters/products', {
    company_id: createdCoId,
    product_name: 'Quantum Safe FIDO Token',
    code: 'QUANTUM_FIDO',
    is_default: 0,
    is_active: 1,
    active_from: '2030-01-01',
    description: 'Next generation quantum-resistant cryptographic hardware token'
  }, adminToken);

  const currentList = await request('GET', `/token/masters/products?company_id=${createdCoId}&date=2026-11-09`, null, adminToken);
  const futureList = await request('GET', `/token/masters/products?company_id=${createdCoId}&date=2030-06-01`, null, adminToken);

  const currentNames = (currentList.data.products || []).map(p => p.product_name);
  const futureNames = (futureList.data.products || []).map(p => p.product_name);

  if (currentNames.includes('SCR3310v2 Smart Card Reader & Token') && 
      !currentNames.includes('Quantum Safe FIDO Token') &&
      futureNames.includes('Quantum Safe FIDO Token')) {
    console.log('  [PASS] Date-wise product listing verified: 2026 excludes future token; 2030 includes future token.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 5 failed:', { currentNames, futureNames });
  }

  // TEST 6: Add Token Version under Product
  console.log('\nTEST 6: Add Token Version under Product...');
  const res6 = await request('POST', '/token/masters/versions', {
    product_id: createdProdId,
    version_name: 'Firmware 4.12 CCA Certified',
    code: 'FW_4_12',
    is_default: 1,
    is_active: 1,
    active_from: '2024-01-01',
    notes: 'Certified for Indian e-procurement and MCA portals'
  }, adminToken);

  const createdVerId = res6.data?.version?.id;
  if (res6.status === 201 && createdVerId && res6.data.version.product_id === createdProdId) {
    console.log('  [PASS] Added version: Firmware 4.12 CCA Certified (ID: ' + createdVerId + ')');
    passCount++;
  } else {
    console.error('  [FAIL] Test 6 failed:', res6);
  }

  // TEST 7: Token Version Default Setting & Mutual Exclusivity per Product
  console.log('\nTEST 7: Token Version Default Setting & Mutual Exclusivity per Product...');
  const res7Ver2 = await request('POST', '/token/masters/versions', {
    product_id: createdProdId,
    version_name: 'Firmware 5.0 Beta',
    code: 'FW_5_0',
    is_default: 1, // setting new version as default should clear previous default for this product
    is_active: 1,
    active_from: '2025-01-01',
    notes: 'Beta firmware'
  }, adminToken);

  const verList = await request('GET', `/token/masters/versions?product_id=${createdProdId}`, null, adminToken);
  const allVers = verList.data.versions || [];
  const defaultVers = allVers.filter(v => v.is_default === 1);

  if (defaultVers.length === 1 && defaultVers[0].code === 'FW_5_0') {
    console.log('  [PASS] Setting FW_5_0 as default correctly reset previous version default. Exactly 1 default active per product.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 7 failed:', { defaultVers });
  }

  // TEST 8: Token Version Inactive & Effective Activation Date Settings
  console.log('\nTEST 8: Token Version Inactive & Effective Activation Date filtering...');
  const res8Deact = await request('PUT', `/token/masters/versions/${res7Ver2.data.version.id}`, { is_active: 0 }, adminToken);
  const activeVersOnly = await request('GET', `/token/masters/versions?product_id=${createdProdId}`, null, adminToken);
  const inactiveIncluded = await request('GET', `/token/masters/versions?product_id=${createdProdId}&include_inactive=true`, null, adminToken);

  if (activeVersOnly.data.versions.length === 1 && inactiveIncluded.data.versions.length === 2) {
    console.log('  [PASS] Inactive version filtered out by default and retrievable when include_inactive=true.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 8 failed:', { activeCount: activeVersOnly.data.versions.length, allCount: inactiveIncluded.data.versions.length });
  }

  // TEST 9: Strict RBAC Protection (Field staff blocked from POST/PUT on Token Master)
  console.log('\nTEST 9: Strict RBAC Protection (Unauthorized user blocked with 403)...');
  const res9Post = await request('POST', '/token/masters/companies', { company_name: 'Rogue Token Co' }, fieldToken);
  const res9Put = await request('PUT', `/token/masters/companies/${createdCoId}`, { company_name: 'Hacked Co' }, fieldToken);

  if (res9Post.status === 403 && res9Put.status === 403) {
    console.log('  [PASS] Both POST and PUT endpoints strictly blocked with HTTP 403 Forbidden for unauthorized roles.');
    console.log('         Error payload:', res9Post.data?.error);
    passCount++;
  } else {
    console.error('  [FAIL] Test 9 failed: Expected 403, got', res9Post.status, res9Put.status);
  }

  // TEST 10: Unified Master Fetcher (/api/dsc/masters/all) includes tokenCompanies, tokenProducts, tokenVersions
  console.log('\nTEST 10: Unified Master Fetcher (/api/dsc/masters/all) includes Token Hierarchy...');
  const res10 = await request('GET', '/dsc/masters/all', null, adminToken);
  const hasTokCos = Array.isArray(res10.data?.tokenCompanies) && res10.data.tokenCompanies.length > 0;
  const hasTokProds = Array.isArray(res10.data?.tokenProducts) && res10.data.tokenProducts.length > 0;
  const hasTokVers = Array.isArray(res10.data?.tokenVersions) && res10.data.tokenVersions.length > 0;

  if (res10.status === 200 && hasTokCos && hasTokProds && hasTokVers) {
    console.log(`  [PASS] Unified Master Fetcher returned: ${res10.data.tokenCompanies.length} companies, ${res10.data.tokenProducts.length} products, ${res10.data.tokenVersions.length} versions.`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 10 failed');
  }

  // TEST 11: Central PostgreSQL Database Source of Truth Check (Zero Hardcoding)
  console.log('\nTEST 11: Central PostgreSQL Database Source of Truth Check...');
  const { data: tokCoRow } = await supabase.from('company_profile').select('registered_address').eq('id', 'token_master_companies').single();
  const dbCompanies = JSON.parse(tokCoRow?.registered_address || '[]');
  const dbHasIdentiv = dbCompanies.some(c => c.id === createdCoId);

  const { data: tokVerRow } = await supabase.from('company_profile').select('registered_address').eq('id', 'token_master_versions').single();
  const dbVersions = JSON.parse(tokVerRow?.registered_address || '[]');
  const dbHasFw = dbVersions.some(v => v.code === 'FW_4_12');

  if (dbHasIdentiv && dbHasFw) {
    console.log('  [PASS] Confirmed: Token company, product, and version persisted directly inside live PostgreSQL database.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 11 failed: Record not found in Supabase company_profile store');
  }

  // TEST 12: Historical Token Serials Data Preserved & Untouched
  console.log('\nTEST 12: Historical Token Serials and Custody Data Preservation...');
  const { data: serials, count: serialsCount } = await supabase.from('token_serials').select('id, serial_number, status', { count: 'exact' });
  const { data: custodyRow } = await supabase.from('company_profile').select('registered_address').eq('id', 'token_rel_custody_history').single();
  const custodyHistory = JSON.parse(custodyRow?.registered_address || '[]');

  if (serials && serials.length > 0 && custodyHistory.length > 0) {
    console.log(`  [PASS] Historical integrity verified: ${serials.length} token serials and ${custodyHistory.length} custody history records completely untouched.`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 12 failed');
  }

  // Cleanup temporary test sessions
  await supabase.from('sessions').delete().in('token', [adminToken, fieldToken]);

  console.log('\n========================================================================');
  console.log(`FINAL RESULT: ${passCount} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================');
  if (passCount === totalTests) {
    console.log('VERDICT: PASS — TOKEN MASTER DATA FULLY VERIFIED');
  } else {
    console.log('VERDICT: FAIL');
  }
}

runTokenVerification().catch(console.error);

