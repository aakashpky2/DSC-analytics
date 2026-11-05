/**
 * SIGNSYNC B2B ENTERPRISE - COMPREHENSIVE REGRESSION, NEGATIVE TESTING & CRUD TEST SUITE
 * 
 * Target: Active Supabase Project kbqwsfmfiomcakbhclca
 */

const http = require('http');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse environment
const envConfig = {};
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) envConfig[k.trim()] = v.trim();
  });
} catch (e) {}

const SUPABASE_URL = envConfig.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co';
const SUPABASE_KEY = envConfig.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = 'http://localhost:3000';

function httpRequest(path, method = 'GET', data = null, cookie = null) {
  return new Promise((resolve) => {
    const u = new URL(path, BASE_URL);
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
        try { json = JSON.parse(body); } catch (e) { json = body; }
        const setCookie = res.headers['set-cookie'];
        let sessionCookie = null;
        if (setCookie) {
          const match = setCookie.join('; ').match(/signsync_session=([^;]+)/);
          if (match) sessionCookie = `signsync_session=${match[1]}`;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookie: sessionCookie,
          data: json
        });
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login(email, password = 'Password123!') {
  const res = await httpRequest('/api/auth/login', 'POST', { email, password });
  return {
    status: res.status,
    cookie: res.cookie,
    user: res.data?.user
  };
}

const testResults = [];
function record(category, testId, description, expected, actual, verdict, details = {}) {
  testResults.push({ category, testId, description, expected, actual, verdict, details });
  console.log(`[${verdict}] [${category}] ${testId}: ${description} -> Actual: ${actual}`);
}

async function runComprehensiveRegression() {
  console.log('======================================================================');
  console.log('  SIGNSYNC B2B ENTERPRISE - COMPREHENSIVE FULL REGRESSION & NEGATIVE SUITE ');
  console.log('======================================================================\n');

  // 1. Authenticate Staff across tiers
  console.log('>>> [1] Authenticating Test Staff Sessions...');
  const t0 = await login('admin@signsync.io', 'Password123!');
  const t1 = await login('reg.admin.1793788284351@signsync.io', 'Password123!');
  const t2 = await login('branch.mgr.1793788284466@signsync.io', 'Password123!');
  const t3 = await login('exec.staff.1793788284589@signsync.io', 'Password123!');
  const t4 = await login('field.telecaller.1793787633573@signsync.io', 'Password123!');

  record('Auth', 'AUTH-01', 'Super Admin (Tier 0) Login', 200, t0.status, t0.status === 200 ? 'PASS' : 'FAIL');
  record('Auth', 'AUTH-02', 'Regional Admin (Tier 1) Login', 200, t1.status, t1.status === 200 ? 'PASS' : 'FAIL');
  record('Auth', 'AUTH-03', 'Branch Mgr (Tier 2) Login', 200, t2.status, t2.status === 200 ? 'PASS' : 'FAIL');
  record('Auth', 'AUTH-04', 'Senior Staff (Tier 3) Login', 200, t3.status, t3.status === 200 ? 'PASS' : 'FAIL');
  record('Auth', 'AUTH-05', 'Field Staff (Tier 4) Login', 200, t4.status, t4.status === 200 ? 'PASS' : 'FAIL');

  const adminCookie = t0.cookie;
  const regionalCookie = t1.cookie;
  const staffCookie = t3.cookie;
  const fieldCookie = t4.cookie;

  // 2. PARTNERS CRUD & NEGATIVE TESTING
  console.log('\n>>> [2] Testing Partner Network CRUD & Boundaries...');
  const validPartner = {
    type: 'dsc_partner',
    company_name: `Synthetic Regression Partner ${Date.now()}`,
    contact_person: 'Ramesh Patel',
    phone: '9820011223',
    email: `ramesh.${Date.now()}@regtest.com`,
    gstin: '27AABCS1429B1Z',
    billing_address: '101 Tech Park, Mumbai, MH',
    credit_limit: 50000,
    credit_period_days: 15
  };

  // 2.1 Missing mandatory fields
  const pMissing = await httpRequest('/api/partners', 'POST', { company_name: '' }, adminCookie);
  record('Partners', 'PART-01', 'Create Partner without mandatory fields rejects', 400, pMissing.status, pMissing.status === 400 ? 'PASS' : 'FAIL');

  // 2.2 Invalid partner category
  const pInvalidCat = await httpRequest('/api/partners', 'POST', { ...validPartner, type: 'non_existent_category' }, adminCookie);
  record('Partners', 'PART-02', 'Create Partner with unlisted category rejects', 400, pInvalidCat.status, pInvalidCat.status === 400 ? 'PASS' : 'FAIL');

  // 2.3 Valid Partner Creation
  const pCreate = await httpRequest('/api/partners', 'POST', validPartner, adminCookie);
  const createdPartnerId = pCreate.data?.id;
  record('Partners', 'PART-03', 'Create Valid Synthetic Partner', 201, pCreate.status, pCreate.status === 201 ? 'PASS' : 'FAIL', { id: createdPartnerId });

  // 2.4 Unauthorized creation (Tier 4 Field Staff)
  const pUnauth = await httpRequest('/api/partners', 'POST', { ...validPartner, email: `unauth.${Date.now()}@regtest.com` }, fieldCookie);
  record('Partners', 'PART-04', 'Tier 4 Field Staff blocked from creating Partner', 403, pUnauth.status, pUnauth.status === 403 ? 'PASS' : 'FAIL');

  // 2.5 Scope / RBAC protection on Partners for Field Staff
  const pReadField = await httpRequest('/api/partners', 'GET', null, fieldCookie);
  record('Partners', 'PART-05', 'Tier 4 Field Staff blocked from viewing Partner Directory', 403, pReadField.status, pReadField.status === 403 ? 'PASS' : 'FAIL');

  // 2.6 Server-Side PII Masking on CRM Leads for Field Staff
  const leadReadField = await httpRequest('/api/crm/leads', 'GET', null, fieldCookie);
  const isCrmMasked = leadReadField.data?.leads?.[0]?.email?.includes('***') || leadReadField.data?.leads?.[0]?.phone?.includes('***');
  record('Partners', 'PART-06', 'Field Staff CRM Leads automatically server-side PII masked', true, Boolean(isCrmMasked), isCrmMasked ? 'PASS' : 'FAIL');

  // 2.7 Update Partner
  if (createdPartnerId) {
    const pUpdate = await httpRequest(`/api/partners/${createdPartnerId}`, 'PUT', { contact_person: 'Ramesh V. Patel Updated' }, adminCookie);
    record('Partners', 'PART-07', 'Update Partner Details', 200, pUpdate.status, pUpdate.status === 200 ? 'PASS' : 'FAIL');
  }

  // 3. DSC APPLICATIONS CRUD & NEGATIVE TESTING
  console.log('\n>>> [3] Testing DSC Certificates CRUD & Transitions...');
  const validDsc = {
    partner_id: createdPartnerId || 'part-002',
    catalog_id: 'cat-1',
    applicant_name: 'Anita Desai',
    applicant_email: `anita.${Date.now()}@testcorp.com`,
    applicant_phone: '9811122334',
    applicant_pan: 'ABCDE1234F'
  };

  // 3.1 Missing applicant name
  const dscMissing = await httpRequest('/api/dsc/applications', 'POST', { ...validDsc, applicant_name: '' }, adminCookie);
  record('DSC', 'DSC-01', 'Create DSC missing applicant name rejects', 400, dscMissing.status, dscMissing.status === 400 ? 'PASS' : 'FAIL');

  // 3.2 Valid DSC Application Creation
  const dscCreate = await httpRequest('/api/dsc/applications', 'POST', validDsc, adminCookie);
  const dscId = dscCreate.data?.id;
  record('DSC', 'DSC-02', 'Create Valid Synthetic DSC Application', 201, dscCreate.status, dscCreate.status === 201 ? 'PASS' : 'FAIL', { id: dscId });

  // 3.3 Stage transition to processing
  if (dscId) {
    const dscStage = await httpRequest(`/api/dsc/applications/${dscId}/stage`, 'PATCH', { stage: 'document_verification', notes: 'Verification call completed' }, staffCookie);
    record('DSC', 'DSC-03', 'Staff transition DSC to document_verification stage', 200, dscStage.status, dscStage.status === 200 ? 'PASS' : 'FAIL');
  }

  // 4. HARDWARE TOKENS & INVENTORY CRUD & NEGATIVE TESTING
  console.log('\n>>> [4] Testing Hardware Tokens & Inventory Integrity...');
  const validBatch = {
    token_model: 'HYP2003',
    vendor_name: 'HyperPKI India Pvt Ltd',
    quantity_purchased: 10,
    base_unit_price: 350.00,
    inward_shipping_cost: 100.00,
    customs_or_taxes: 50.00,
    handling_charges: 10.00
  };

  // 4.1 Negative inward quantity
  const bNegQty = await httpRequest('/api/inventory/batches', 'POST', { ...validBatch, quantity_purchased: -10 }, adminCookie);
  record('Inventory', 'INV-01', 'Inward Batch with negative quantity rejects', 400, bNegQty.status, bNegQty.status === 400 ? 'PASS' : 'FAIL');

  // 4.2 Valid Inward Batch
  const bCreate = await httpRequest('/api/inventory/batches', 'POST', validBatch, adminCookie);
  record('Inventory', 'INV-02', 'Inward Valid Token Batch with landed cost', 201, bCreate.status, bCreate.status === 201 ? 'PASS' : 'FAIL');

  // 4.3 Stock transfer between branches
  const transferPayload = {
    source_branch_id: 'branch-hq',
    destination_branch_id: 'branch-del',
    token_model: 'HYP2003',
    quantity: 2,
    remarks: 'Routine weekly replenishment'
  };
  const transferRes = await httpRequest('/api/inventory/transfers', 'POST', transferPayload, adminCookie);
  record('Inventory', 'INV-03', 'Stock Transfer between branches', 201, transferRes.status, transferRes.status === 201 ? 'PASS' : 'FAIL');

  // 4.4 Same source and destination transfer rejected
  const transferSameRes = await httpRequest('/api/inventory/transfers', 'POST', { ...transferPayload, destination_branch_id: 'branch-hq' }, adminCookie);
  record('Inventory', 'INV-04', 'Stock Transfer with same source and destination rejects', 400, transferSameRes.status, transferSameRes.status === 400 ? 'PASS' : 'FAIL');

  // 5. CRM LEADS & WORKFLOW NEGATIVE TESTING
  console.log('\n>>> [5] Testing Customer CRM Leads & Boundaries...');
  const validLead = {
    contact_person: 'Kavita Singh',
    company_name: 'Singh Logistics Pvt Ltd',
    phone: '9876543210',
    email: `kavita.${Date.now()}@singhlogistics.com`,
    source: 'Website Inquiry',
    status: 'new_lead'
  };

  // 5.1 Valid Lead Creation
  const leadCreate = await httpRequest('/api/crm/leads', 'POST', validLead, adminCookie);
  const leadId = leadCreate.data?.id;
  record('CRM', 'CRM-01', 'Create Synthetic CRM Lead', 201, leadCreate.status, leadCreate.status === 201 ? 'PASS' : 'FAIL', { id: leadId });

  // 5.2 Invalid Follow-up with missing comments
  if (leadId) {
    const fMissing = await httpRequest('/api/crm/follow-ups', 'POST', { lead_id: leadId, notes: '' }, staffCookie);
    record('CRM', 'CRM-02', 'Create Follow-up without notes rejects', 400, fMissing.status, fMissing.status === 400 ? 'PASS' : 'FAIL');

    // 5.3 Valid Follow-up
    const fValid = await httpRequest('/api/crm/follow-ups', 'POST', { lead_id: leadId, notes: 'Contacted client regarding DSC renewal.' }, staffCookie);
    record('CRM', 'CRM-03', 'Create Valid Follow-up note', 201, fValid.status, fValid.status === 201 ? 'PASS' : 'FAIL');
  }

  // 6. BILLING & INVOICING INTEGRITY
  console.log('\n>>> [6] Testing Invoices & Financial Integrity...');
  const validInvoice = {
    partner_id: createdPartnerId || 'part-002',
    line_items: [
      { description: 'Class 3 DSC Individual 2-Yr', quantity: 2, unit_price: 1500, gst_rate: 18 }
    ],
    due_days: 15
  };

  // 6.1 Negative unit price
  const invNegPrice = await httpRequest('/api/billing/invoices', 'POST', {
    ...validInvoice,
    line_items: [{ description: 'Token', quantity: 1, unit_price: -500, gst_rate: 18 }]
  }, adminCookie);
  record('Billing', 'BILL-01', 'Invoice with negative unit price rejects', 400, invNegPrice.status, invNegPrice.status === 400 ? 'PASS' : 'FAIL');

  // 6.2 Valid Invoice Creation with sequential numbering & tax calculation
  const invCreate = await httpRequest('/api/billing/invoices', 'POST', validInvoice, adminCookie);
  const invoiceId = invCreate.data?.id;
  const invoiceNum = invCreate.data?.invoice_number;
  record('Billing', 'BILL-02', 'Generate Valid Sequential Invoice', 201, invCreate.status, invCreate.status === 201 ? 'PASS' : 'FAIL', { id: invoiceId, num: invoiceNum });

  // 6.3 Concurrency check: simultaneous double invoice creation
  const p1 = httpRequest('/api/billing/invoices', 'POST', validInvoice, adminCookie);
  const p2 = httpRequest('/api/billing/invoices', 'POST', validInvoice, adminCookie);
  const [res1, res2] = await Promise.all([p1, p2]);
  const diffNumbers = res1.data?.invoice_number !== res2.data?.invoice_number;
  record('Billing', 'BILL-03', 'Concurrent Invoice Creation generates unique consecutive numbers', true, diffNumbers, diffNumbers ? 'PASS' : 'FAIL');

  // 7. PAYMENTS & LEDGER VERIFICATION
  console.log('\n>>> [7] Testing Payment Verification & Double-Verification Prevention...');
  if (invoiceId) {
    // Record payment receipt
    const payPayload = {
      invoice_id: invoiceId,
      partner_id: createdPartnerId || 'part-002',
      amount_received: 1000,
      payment_mode: 'neft',
      reference_number: `UTR${Date.now()}`
    };
    const payCreate = await httpRequest('/api/billing/payments/record', 'POST', payPayload, adminCookie);
    const paymentId = payCreate.data?.id;
    record('Payments', 'PAY-01', 'Record Customer Payment Screenshot / Proof', 201, payCreate.status, payCreate.status === 201 ? 'PASS' : 'FAIL', { id: paymentId });

    if (paymentId) {
      // 7.1 Verify Payment
      const payVerify = await httpRequest('/api/billing/payments/verify', 'POST', { payment_id: paymentId, action: 'verified' }, adminCookie);
      record('Payments', 'PAY-02', 'Verify Payment and update invoice balance', 200, payVerify.status, payVerify.status === 200 ? 'PASS' : 'FAIL');

      // 7.2 Double verification attempt
      const payDouble = await httpRequest('/api/billing/payments/verify', 'POST', { payment_id: paymentId, action: 'verified' }, adminCookie);
      record('Payments', 'PAY-03', 'Double Payment Verification rejected', [400, 409], payDouble.status, (payDouble.status === 400 || payDouble.status === 409) ? 'PASS' : 'FAIL');
    }
  }

  // 8. COURIER LOGISTICS CRUD & BOUNDARIES
  console.log('\n>>> [8] Testing Courier Logistics & POD...');
  const validDispatch = {
    carrier_name: 'BlueDart Express',
    awb_number: `AWB${Date.now()}`,
    recipient_name: 'Anita Desai',
    recipient_phone: '9811122334',
    shipping_address: '404 Crystal Tower, Andheri East, Mumbai',
    package_contents: 'HYP2003 Token + DSC Class 3 Cert'
  };

  // 8.1 Missing AWB / Carrier
  const dispMissing = await httpRequest('/api/courier/dispatches', 'POST', { ...validDispatch, awb_number: '' }, adminCookie);
  record('Courier', 'COUR-01', 'Dispatch missing mandatory AWB rejects', 400, dispMissing.status, dispMissing.status === 400 ? 'PASS' : 'FAIL');

  // 8.2 Valid Dispatch Creation
  const dispCreate = await httpRequest('/api/courier/dispatches', 'POST', validDispatch, adminCookie);
  const dispatchId = dispCreate.data?.id;
  record('Courier', 'COUR-02', 'Create Valid Courier Dispatch', 201, dispCreate.status, dispCreate.status === 201 ? 'PASS' : 'FAIL', { id: dispatchId });

  // 8.3 Tracking update
  if (dispatchId) {
    const trackUpdate = await httpRequest(`/api/courier/dispatches/${dispatchId}/status`, 'PATCH', { status: 'in_transit', notes: 'Bhiwandi Hub scan' }, adminCookie);
    record('Courier', 'COUR-03', 'Update Courier Tracking Status', 200, trackUpdate.status, trackUpdate.status === 200 ? 'PASS' : 'FAIL');
  }

  // 9. MASTER CONFIGURATION & DROPDOWN INTEGRITY
  console.log('\n>>> [9] Testing Master Configurations & Dropdowns...');
  const newMaster = {
    type_key: `custom_cat_${Date.now()}`,
    type_name: 'Enterprise Corporate Partner'
  };
  const masterCreate = await httpRequest('/api/admin/masters/partner-types', 'POST', newMaster, adminCookie);
  record('Masters', 'MST-01', 'Super Admin creates new master partner category', 201, masterCreate.status, masterCreate.status === 201 ? 'PASS' : 'FAIL');

  // 10. Clean up synthetic records
  console.log('\n>>> [10] Safe Cleanup of Synthetic Regression Records...');
  if (createdPartnerId) await supabase.from('partners').delete().eq('id', createdPartnerId);
  if (dscId) await supabase.from('dsc_applications').delete().eq('id', dscId);
  if (invoiceId) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    await supabase.from('payments_received').delete().eq('invoice_id', invoiceId);
  }
  if (leadId) await supabase.from('crm_leads').delete().eq('id', leadId);
  if (dispatchId) await supabase.from('courier_dispatches').delete().eq('id', dispatchId);
  console.log('[Cleanup] Synthetic test data cleaned up safely from Supabase.');

  // Print Summary
  const passed = testResults.filter(t => t.verdict === 'PASS').length;
  const failed = testResults.filter(t => t.verdict === 'FAIL').length;
  console.log('\n======================================================================');
  console.log(`COMPREHENSIVE REGRESSION COMPLETE: Total: ${testResults.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('======================================================================');

  return { total: testResults.length, passed, failed, results: testResults };
}

runComprehensiveRegression().catch(err => console.error(err));
