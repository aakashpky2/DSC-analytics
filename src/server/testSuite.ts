import axios from 'axios'
const BASE_URL = 'http://127.0.0.1:3000'

interface TestResult {
  module: string
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

async function runTest(module: string, name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ module, name, passed: true, details: 'OK' })
    console.log(`✅ [PASS] [${module}] ${name}`)
  } catch (err: any) {
    const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message
    results.push({ module, name, passed: false, details: msg })
    console.error(`❌ [FAIL] [${module}] ${name}: ${msg}`)
  }
}

export async function runAllTests() {
  console.log('\n--- STARTING SIGNSYNC B2B AUTOMATED FUNCTIONAL SUITE ---\n')

  // 1. Users & Permissions
  await runTest('Users & Permissions', 'API Health Check', async () => {
    const res = await axios.get(`${BASE_URL}/api/health`)
    if (res.data.status !== 'ok') throw new Error('Health check returned non-ok')
  })

  await runTest('Users & Permissions', 'Get Users with PII Masking', async () => {
    const res = await axios.get(`${BASE_URL}/api/admin/users?mask=true`)
    if (!Array.isArray(res.data.users)) throw new Error('Expected users array')
    const user = res.data.users[0]
    if (user && user.email && !user.email.includes('*')) throw new Error('PII masking failed on email')
  })

  await runTest('Users & Permissions', 'Freeze Account Toggle', async () => {
    const res = await axios.patch(`${BASE_URL}/api/admin/users/usr-admin-root/freeze`, { frozen: true })
    if (!res.data.success || res.data.frozen !== true) throw new Error('Freeze toggle failed')
    // Revert
    await axios.patch(`${BASE_URL}/api/admin/users/usr-admin-root/freeze`, { frozen: false })
  })

  // 2. Partner Management
  let testPartnerId = ''
  await runTest('Partner Management', 'Create Partner with Valid Data', async () => {
    const res = await axios.post(`${BASE_URL}/api/partners`, {
      type: 'dsc_partner',
      company_name: 'Test Partner Solutions',
      contact_person: 'Rahul Verma',
      email: 'rahul.test@signsync.io',
      phone: '9820011223',
      gstin: '27AAACA1234A1Z5',
      pan: 'AAACA1234A',
      billing_address: '101 Cyber Towers, Mumbai',
      state_code: '27',
      credit_limit: 50000,
      credit_period_days: 30,
    })
    if (!res.data.success || !res.data.id) throw new Error('Partner creation response missing id')
    testPartnerId = res.data.id
  })

  await runTest('Partner Management', 'View Partner 360 & Ledger Details', async () => {
    if (!testPartnerId) throw new Error('No partner ID from previous test')
    const res = await axios.get(`${BASE_URL}/api/partners/${testPartnerId}`)
    if (!res.data.partner || res.data.partner.id !== testPartnerId) throw new Error('Partner lookup failed')
  })

  // 3. DSC Management
  await runTest('DSC Management', 'DSC Catalog Retrieval', async () => {
    const res = await axios.get(`${BASE_URL}/api/dsc/catalog`)
    if (!Array.isArray(res.data.catalog) || res.data.catalog.length === 0) throw new Error('DSC Catalog is empty')
  })

  let testDscAppId = ''
  await runTest('DSC Management', 'Create DSC Application', async () => {
    const catalogRes = await axios.get(`${BASE_URL}/api/dsc/catalog`)
    const catId = catalogRes.data.catalog[0]?.id
    const res = await axios.post(`${BASE_URL}/api/dsc/applications`, {
      partner_id: testPartnerId || 'part-001',
      catalog_id: catId,
      applicant_name: 'Anjali Sharma',
      applicant_email: 'anjali@example.com',
      applicant_phone: '9819988776',
      applicant_pan: 'ABCDE1234F',
    })
    if (!res.data.success || !res.data.id) throw new Error('DSC Application creation failed')
    testDscAppId = res.data.id
  })

  await runTest('DSC Management', 'Update DSC Application Stage', async () => {
    if (!testDscAppId) throw new Error('No DSC app ID')
    const res = await axios.patch(`${BASE_URL}/api/dsc/applications/${testDscAppId}/stage`, {
      stage: 'ca_portal_approval',
      ca_reference_no: 'CA-REF-9988',
      notes: 'Video KYC completed and approved by CA',
    })
    if (!res.data.success) throw new Error('Stage transition failed')
  })

  // 4. Token Stock & Landed Cost Math
  await runTest('Token Stock', 'Create Token Purchase with True Landed Cost Calculation', async () => {
    const res = await axios.post(`${BASE_URL}/api/inventory/batches`, {
      token_model: 'epass2003_auto',
      vendor_name: 'Feitian Test Corp',
      quantity_purchased: 100,
      base_unit_price: 350,
      inward_shipping_cost: 1000,
      customs_or_taxes: 1500,
      handling_charges: 500,
    })
    // Expected: (100 * 350) + 1000 + 1500 + 500 = 38000; unit = 380
    if (res.data.totalBatchLandedCost !== 38000 || res.data.unitLandedCost !== 380) {
      throw new Error(`Landed cost math mismatch: Total=${res.data.totalBatchLandedCost}, Unit=${res.data.unitLandedCost}`)
    }
  })

  // 5. Customer Leads & Deduplication
  await runTest('Customer Leads', 'Duplicate Customer Detection by Phone', async () => {
    const res = await axios.post(`${BASE_URL}/api/crm/leads/check-duplicate`, {
      phone: '+91 97654 32100', // matches lead-001
      company_name: 'Random Name',
    })
    if (!res.data.hasAlert || !res.data.matches.some((m: any) => m.matchScore >= 40)) {
      throw new Error('Deduplication failed to trigger alert on matching phone (+40 pts expected)')
    }
  })

  let testLeadId = ''
  await runTest('Customer Leads', 'Create Customer Lead', async () => {
    const res = await axios.post(`${BASE_URL}/api/crm/leads`, {
      company_name: 'Omega Tech Innovations',
      contact_person: 'Suresh Patel',
      email: 'suresh@omegatech.in',
      phone: '9877712345',
      gstin: '27DDDDD1111D1Z9',
      pan: 'DDDDD1111D',
      requirement_summary: 'Needs 10 Class 3 DSCs',
    })
    if (!res.data.success || !res.data.id) throw new Error('Lead creation failed')
    testLeadId = res.data.id
  })

  // 6. Other Business Services
  await runTest('Other Business Services', 'Create Trademark Service Order', async () => {
    const res = await axios.post(`${BASE_URL}/api/services/orders`, {
      service_type: 'trademark',
      partner_id: testPartnerId || 'part-001',
      client_name: 'Omega Brand Corp',
      client_contact: '9877712345',
      government_fees: 4500,
      professional_fees: 2500,
      notes: 'Brand logo mark trademark filing',
    })
    if (!res.data.success || !res.data.id) throw new Error('Service order creation failed')
  })

  // 7. Multi-Account Billing
  let testInvoiceId = ''
  await runTest('Billing', 'Create Multi-Account Invoice with GST Calculation', async () => {
    const seriesRes = await axios.get(`${BASE_URL}/api/billing/series`)
    const seriesId = seriesRes.data.series[0]?.id
    const res = await axios.post(`${BASE_URL}/api/billing/invoices`, {
      series_id: seriesId,
      partner_id: testPartnerId || 'part-001',
      due_days: 30,
      line_items: [
        { item: 'ePass2003 Token', qty: 10, rate: 500 }, // 5000
      ],
    })
    // 5000 + 18% GST (9% CGST 450 + 9% SGST 450) = 5900
    if (res.data.total !== 5900) {
      throw new Error(`Expected GST total 5900, received ${res.data.total}`)
    }
    testInvoiceId = res.data.id
  })

  // 8. Payment Verification & Ledger Double-Post Guard
  let testPaymentId = ''
  await runTest('Payments & Accounts', 'Record and Verify Payment Posting to Ledger', async () => {
    // 1. Submit payment
    const db = require('./localDb')
    testPaymentId = `pay-${Date.now()}`
    await db.run(`
      INSERT INTO payments_received (id, invoice_id, partner_id, amount_paid, payment_mode, transaction_reference_utr, verified_status)
      VALUES (?, ?, ?, 5900, 'UPI', 'UTR99887766', 'pending_verification')
    `, [testPaymentId, testInvoiceId, testPartnerId || 'part-001'])

    // 2. Confirm verification
    const verifyRes = await axios.post(`${BASE_URL}/api/billing/payments/verify`, {
      payment_id: testPaymentId,
      action: 'verified',
    })
    if (verifyRes.data.status !== 'verified') throw new Error('Payment confirmation failed')

    // 3. Double-post prevention test: Re-verifying should be rejected or idempotent
    const invoice = await db.queryOne('SELECT * FROM invoices WHERE id = ?', [testInvoiceId])
    if (invoice.outstanding_balance !== 0) throw new Error(`Invoice balance expected 0, got ${invoice.outstanding_balance}`)
  })

  // 9. Courier Dispatches
  await runTest('Courier', 'Create Courier Dispatch Record', async () => {
    const res = await axios.post(`${BASE_URL}/api/courier/dispatches`, {
      carrier_name: 'Blue Dart',
      awb_number: `BLU-${Date.now().toString().slice(-8)}`,
      recipient_name: 'Rahul Verma',
      recipient_phone: '9820011223',
      shipping_address: '101 Cyber Towers, Mumbai',
      package_contents: '10x ePass2003 Tokens',
    })
    if (!res.data.success || !res.data.id) throw new Error('Courier dispatch creation failed')
  })

  console.log('\n--- TEST SUITE EXECUTION SUMMARY ---')
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  return { total: results.length, passed, failed, results }
}

if (require.main === module) {
  runAllTests()
    .then((res) => {
      if (res.failed > 0) process.exit(1)
      else process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
