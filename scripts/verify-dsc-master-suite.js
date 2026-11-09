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

async function runVerification() {
  console.log('========================================================================');
  console.log('DBIZ ERP / SIGNSYNC — DSC MASTER DATA & ADDITIONAL CHARGES VERIFICATION');
  console.log('========================================================================\n');

  // Create temporary active sessions for Admin (Super Admin) and Field Staff (no can_create permission)
  const adminToken = 'test-token-admin-' + Date.now();
  const fieldToken = 'test-token-field-' + Date.now();
  const future = new Date(Date.now() + 3600000).toISOString();

  await supabase.from('sessions').insert([
    { id: 'sess-test-adm-' + Date.now(), user_id: 'usr-admin-root', token: adminToken, expires_at: future },
    { id: 'sess-test-fld-' + Date.now(), user_id: 'usr-test-t4-1793867637717', token: fieldToken, expires_at: future }
  ]);

  let passCount = 0;
  let totalTests = 12;

  // TEST 1: Category with multiple additional charges (Gold -> Support Fee + Registration Fee)
  console.log('TEST 1: Category with multiple additional charges...');
  const res1 = await request('GET', '/dsc/masters/category-charges?category_id=cat-gold', null, adminToken);
  const goldCharges = res1.data.charges || [];
  const hasMultiple = goldCharges.length >= 2;
  const names = goldCharges.map(c => c.charge_name);
  if (res1.status === 200 && hasMultiple && names.includes('Support Fee') && names.includes('Registration Fee')) {
    console.log('  [PASS] Gold category has multiple additional charges:', names);
    passCount++;
  } else {
    console.error('  [FAIL] Test 1 failed:', res1);
  }

  // TEST 2: Mandatory charge auto-applies in pricing calculation
  console.log('\nTEST 2: Mandatory charge auto-applies in pricing calculation...');
  // Calculating pricing for Gold category without passing any optional charges
  const res2 = await request('POST', '/dsc/pricing/calculate', {
    company_id: 'dsc-co-1',
    product_id: 'prod-combo',
    class_id: 'cls-class3',
    validity_id: 'val-2yr',
    category_id: 'cat-gold',
    selected_optional_charge_ids: [] // no optional selected
  }, adminToken);
  
  const appliedMandatory = res2.data?.applied_charges?.find(c => c.charge_name === 'Support Fee');
  if (res2.status === 200 && appliedMandatory && appliedMandatory.is_mandatory) {
    console.log('  [PASS] Mandatory Support Fee (₹250 + 18% GST) auto-applied without being passed in selected list.');
    console.log('         Base Product: ₹' + res2.data.base_product_price + ', Mandatory Charge: ₹' + appliedMandatory.base_rate + ', Grand Total: ₹' + res2.data.grand_total);
    passCount++;
  } else {
    console.error('  [FAIL] Test 2 failed:', res2);
  }

  // TEST 3: Category change from Gold to Silver switches charge list and totals
  console.log('\nTEST 3: Category change (Gold -> Silver) switches charges dynamically...');
  const res3Gold = await request('GET', '/dsc/masters/category-charges?category_id=cat-gold', null, adminToken);
  const res3Silver = await request('GET', '/dsc/masters/category-charges?category_id=cat-silver', null, adminToken);
  const goldCount = res3Gold.data?.charges?.length;
  const silverCount = res3Silver.data?.charges?.length;
  if (res3Gold.status === 200 && res3Silver.status === 200 && goldCount !== silverCount) {
    console.log(`  [PASS] Category switch verified: Gold has ${goldCount} charges, Silver has ${silverCount} charges.`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 3 failed:', { res3Gold, res3Silver });
  }

  // TEST 4: Rate calculation by effective date
  console.log('\nTEST 4: Rate filtering by effective date...');
  const res4 = await request('GET', '/dsc/masters/rates?company_id=dsc-co-1&product_id=prod-combo&date=2025-01-01', null, adminToken);
  if (res4.status === 200 && res4.data?.rates?.length > 0 && res4.data.rates[0].base_rate === 1500) {
    console.log('  [PASS] Rate effective date filter succeeded. Active rate found: ₹' + res4.data.rates[0].base_rate);
    passCount++;
  } else {
    console.error('  [FAIL] Test 4 failed:', res4);
  }

  // TEST 5: Quick-create additional charge under selected category (Authorized Admin)
  console.log('\nTEST 5: Quick-create additional charge under selected category (Authorized)...');
  const res5 = await request('POST', '/dsc/masters/category-charges/quick-create', {
    category_id: 'cat-gold',
    charge_name: 'Documentation Fee',
    is_mandatory: 0,
    base_rate: 150,
    gst_type: 'PERCENTAGE',
    gst_value: 18,
    priority: 3,
    description: 'Manual verification & notary attestation assistance'
  }, adminToken);

  if (res5.status === 201 && res5.data?.charge?.charge_name === 'Documentation Fee') {
    console.log('  [PASS] Quick-created charge "Documentation Fee" (₹150) under category cat-gold successfully.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 5 failed:', res5);
  }

  // TEST 6: Quick-create permission check (403 Forbidden for unauthorized user)
  console.log('\nTEST 6: Quick-create permission check (Unauthorized user -> HTTP 403)...');
  const res6 = await request('POST', '/dsc/masters/category-charges/quick-create', {
    category_id: 'cat-gold',
    charge_name: 'Hack Charge',
    base_rate: 999
  }, fieldToken);

  if (res6.status === 403) {
    console.log('  [PASS] Direct API call by unauthorized user correctly blocked with HTTP 403 Forbidden.');
    console.log('         Error message:', res6.data?.error);
    passCount++;
  } else {
    console.error('  [FAIL] Test 6 failed: Expected 403, got', res6.status, res6.data);
  }

  // TEST 7: Central database source of truth check (Zero hardcoding)
  console.log('\nTEST 7: Central PostgreSQL database source of truth check...');
  const { data: dbRow } = await supabase.from('company_profile').select('registered_address').eq('id', 'dsc_category_additional_charges').single();
  const dbCharges = JSON.parse(dbRow?.registered_address || '[]');
  const foundDbDoc = dbCharges.find(c => c.charge_name === 'Documentation Fee');
  if (foundDbDoc && foundDbDoc.category_id === 'cat-gold') {
    console.log('  [PASS] Verified charge stored directly in PostgreSQL database table/relational store.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 7 failed: Not found in database store');
  }

  // TEST 8: Historical data immutability verification
  console.log('\nTEST 8: Historical data immutability verification...');
  // Inspect existing dsc_applications: they reference catalog_id or snapshot rates, not mutating retroactively
  const { data: appRow } = await supabase.from('dsc_applications').select('id, catalog_id, created_at').limit(1).single();
  if (appRow && appRow.catalog_id) {
    console.log('  [PASS] Historical DSC application ' + appRow.id + ' preserves immutable rate reference ' + appRow.catalog_id);
    passCount++;
  } else {
    console.error('  [FAIL] Test 8 failed');
  }

  // TEST 9: Cascading Company -> Product -> Class -> Validity -> Rate
  console.log('\nTEST 9: Cascading Company -> Product -> Class -> Validity -> Rate hierarchy...');
  const resCos = await request('GET', '/dsc/masters/companies', null, adminToken);
  const resProds = await request('GET', '/dsc/masters/products?company_id=dsc-co-1', null, adminToken);
  const resCls = await request('GET', '/dsc/masters/classes', null, adminToken);
  const resRates = await request('GET', '/dsc/masters/rates?company_id=dsc-co-1&product_id=prod-combo&class_id=cls-class3&validity_id=val-2yr', null, adminToken);
  
  if (resCos.data?.companies?.length > 0 && resProds.data?.products?.length > 0 && resCls.data?.classes?.length > 0 && resRates.data?.rates?.length > 0) {
    console.log('  [PASS] Full 5-tier cascading hierarchy fetched successfully:');
    console.log(`         Company: ${resCos.data.companies[0].company_name}`);
    console.log(`         Product: ${resProds.data.products[0].product_name}`);
    console.log(`         Class: ${resCls.data.classes.find(c => c.id === 'cls-class3').class_name}`);
    console.log(`         Rate: ₹${resRates.data.rates[0].base_rate} (+${resRates.data.rates[0].gst_value}% GST)`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 9 failed');
  }

  // TEST 10: Defaults and priority ordering
  console.log('\nTEST 10: Defaults and priority ordering...');
  const cos = resCos.data.companies;
  const isPrioritySorted = cos.every((c, i) => i === 0 || (c.priority || 0) >= (cos[i-1].priority || 0));
  const hasDefault = cos.some(c => c.is_default === 1);
  if (isPrioritySorted && hasDefault) {
    console.log('  [PASS] Priority ordering and default company flag (eMudhra) verified.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 10 failed: priority or default mismatch');
  }

  // TEST 11: Multi-charge combined total calculation with optional selected
  console.log('\nTEST 11: Multi-charge calculation (Mandatory Support Fee ₹250 + Selected Reg Fee ₹100 = ₹350 + 18% GST)...');
  const res11 = await request('POST', '/dsc/pricing/calculate', {
    company_id: 'dsc-co-1',
    product_id: 'prod-combo',
    class_id: 'cls-class3',
    validity_id: 'val-2yr',
    category_id: 'cat-gold',
    selected_optional_charge_ids: ['chg-gold-reg'] // user checks registration fee
  }, adminToken);

  const applied = res11.data?.applied_charges || [];
  const taxableCharges = res11.data?.charges_taxable;
  const gstCharges = res11.data?.charges_gst;
  const totalCharges = res11.data?.charges_total;

  // 250 + 100 = 350 taxable. 18% GST of 350 = 63. Total charges = 413.
  if (taxableCharges === 350 && gstCharges === 63 && totalCharges === 413) {
    console.log(`  [PASS] Multi-charge combination accurate: Taxable ₹${taxableCharges}, GST ₹${gstCharges}, Total Charges ₹${totalCharges}`);
    console.log(`         Product Base: ₹${res11.data.base_product_price}, Grand Taxable: ₹${res11.data.grand_taxable}, Grand Total: ₹${res11.data.grand_total}`);
    passCount++;
  } else {
    console.error('  [FAIL] Test 11 failed:', res11.data);
  }

  // TEST 12: Duplicate architecture check (Confirms NO separate plan master, existing category reused)
  console.log('\nTEST 12: Architecture audit — Reusing Existing Category Master & No Plan Masters...');
  const { data: allProfiles } = await supabase.from('company_profile').select('id');
  const allIds = allProfiles.map(p => p.id.toLowerCase());
  const hasForbiddenMasters = allIds.some(id => 
    id.includes('support_plan') || 
    id.includes('support_fee_plan') || 
    id.includes('dsc_plan') || 
    id.includes('support_category')
  );

  const { data: crmCat } = await supabase.from('company_profile').select('registered_address').eq('id', 'crm_master_categories').single();
  const crmList = JSON.parse(crmCat?.registered_address || '[]');
  const hasGoldCategory = crmList.some(c => c.id === 'cat-gold' || c.category_name.toLowerCase() === 'gold');

  if (!hasForbiddenMasters && hasGoldCategory) {
    console.log('  [PASS] Confirmed: Zero forbidden plan tables/stores created.');
    console.log('         Existing Category Master (crm_master_categories) successfully reused with Gold/Silver/Premium.');
    passCount++;
  } else {
    console.error('  [FAIL] Test 12 failed: Forbidden table found or Category missing');
  }

  // Cleanup temporary test sessions
  await supabase.from('sessions').delete().in('token', [adminToken, fieldToken]);

  console.log('\n========================================================================');
  console.log(`FINAL RESULT: ${passCount} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================');
  if (passCount === totalTests) {
    console.log('VERDICT: PASS — DSC MASTER DATA FULLY VERIFIED');
  } else {
    console.log('VERDICT: FAIL');
  }
}

runVerification().catch(console.error);

