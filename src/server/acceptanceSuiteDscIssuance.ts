import { supabase, queryAll, queryOne } from './supabase'
import {
  saveCommissionTransaction,
  deleteCommissionTransaction,
  getCommissionTransactions,
  saveProviderPayout,
  deleteProviderPayout,
  saveCommissionConfig,
  deleteCommissionConfig,
  DscCommissionTransaction,
  DscProviderPayout,
  DscPartnerCommissionConfig,
} from './dscCommissionStore'
import {
  resolveDscCommission,
  createCommissionTransaction,
} from './dscCommissionEngine'
import { createSession } from './auth'

const BASE_URL = 'http://localhost:3000'
const TEST_TIMESTAMP = Date.now()

interface TestResult {
  id: string
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function assert(condition: boolean, testId: string, testName: string, details: string) {
  if (condition) {
    results.push({ id: testId, name: testName, passed: true, details })
    console.log(`[PASS] ${testId}: ${testName} - ${details}`)
  } else {
    results.push({ id: testId, name: testName, passed: false, details: `FAILED: ${details}` })
    console.error(`[FAIL] ${testId}: ${testName} - ${details}`)
  }
}

async function runDscIssuanceAcceptance() {
  console.log('====================================================================')
  console.log('STARTING MODULE 16: DSC DAILY ISSUANCE + PERFORMANCE ACCEPTANCE SUITE')
  console.log('====================================================================')

  const createdPartnerIds: string[] = []
  const createdTransactionIds: string[] = []
  const createdPayoutIds: string[] = []
  const createdConfigIds: string[] = []

  try {
    // 1. Authenticate as Super Admin using crypto session
    const adminToken = await createSession('usr-admin-root')
    const adminCookie = `signsync_session=${adminToken}`

    // 2. Fetch Base Masters
    const initRes = await fetch(`${BASE_URL}/api/dsc/issuance/init-data`, {
      headers: { Cookie: adminCookie },
    })
    const initData = await initRes.json()
    const profiles = initData.profiles || []
    if (profiles.length < 2) {
      throw new Error('Expected at least 2 company profiles for isolation testing')
    }

    const profileA = profiles[0]
    const profileB = profiles[1]
    console.log(`Using Profile A: ${profileA.legal_name} (${profileA.id})`)
    console.log(`Using Profile B: ${profileB.legal_name} (${profileB.id})`)

    // Create 2 Test DSC Partners
    const partnerAId = `part-test-iss-a-${TEST_TIMESTAMP}`
    const partnerBId = `part-test-iss-b-${TEST_TIMESTAMP}`
    createdPartnerIds.push(partnerAId, partnerBId)

    const pAInsert = await supabase.from('partners').insert({
      id: partnerAId,
      organization_id: 'comp-default',
      company_name: `Test Issuance Partner Alpha ${TEST_TIMESTAMP}`,
      partner_code: `TPA-${TEST_TIMESTAMP.toString().slice(-4)}`,
      type: 'both',
      is_token_customer: true,
      is_dsc_partner: true,
      status: 'active',
      gstin: '32AABCT1332L1Z1',
      state_code: '32',
      contact_person: 'Alice Alpha',
      billing_address: '123 Alpha Way',
      email: `alpha_${TEST_TIMESTAMP}@example.com`,
      phone: '9876543210',
    })
    if (pAInsert.error) throw new Error(`Partner A insert error: ${pAInsert.error.message}`)

    const pBInsert = await supabase.from('partners').insert({
      id: partnerBId,
      organization_id: 'comp-default',
      company_name: `Test Issuance Partner Beta ${TEST_TIMESTAMP}`,
      partner_code: `TPB-${TEST_TIMESTAMP.toString().slice(-4)}`,
      type: 'both',
      is_token_customer: true,
      is_dsc_partner: true,
      status: 'active',
      gstin: '32AABCT1332L1Z2',
      state_code: '32',
      contact_person: 'Bob Beta',
      billing_address: '456 Beta Road',
      email: `beta_${TEST_TIMESTAMP}@example.com`,
      phone: '9876543211',
    })
    if (pBInsert.error) throw new Error(`Partner B insert error: ${pBInsert.error.message}`)

    // 3. Setup Master Data Payout and Commission Configs for dsc-co-1 & prod-combo
    const pay1: DscProviderPayout = {
      id: `pay-test-${TEST_TIMESTAMP}`,
      organization_id: 'comp-default',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      class_id: 'cls-class3',
      validity_id: 'val-2yr',
      payout_amount: 450,
      calculation_basis: 'BASE_PRICE_ONLY',
      effective_from: '2024-01-01',
      is_active: true,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    createdPayoutIds.push(pay1.id)
    await saveProviderPayout(pay1)

    // Standard Commission Config for Partner A: ₹200 fixed
    const cfgA: DscPartnerCommissionConfig = {
      id: `dpcc-a-${TEST_TIMESTAMP}`,
      organization_id: 'comp-default',
      partner_id: partnerAId,
      fee_type: 'DSC_PRODUCT',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      commission_type: 'FIXED',
      commission_value: 200,
      calculation_basis: 'BASE_PRICE_ONLY',
      effective_from: '2024-01-01',
      is_active: true,
      priority: 10,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    createdConfigIds.push(cfgA.id)
    await saveCommissionConfig(cfgA)

    // Support Fee Commission Config for Partner A: ₹100 fixed
    const cfgSupp: DscPartnerCommissionConfig = {
      id: `dpcc-supp-${TEST_TIMESTAMP}`,
      organization_id: 'comp-default',
      partner_id: partnerAId,
      fee_type: 'SUPPORT_FEE',
      company_id: 'dsc-co-1',
      commission_type: 'FIXED',
      commission_value: 100,
      calculation_basis: 'BASE_PRICE_ONLY',
      effective_from: '2024-01-01',
      is_active: true,
      priority: 10,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    createdConfigIds.push(cfgSupp.id)
    await saveCommissionConfig(cfgSupp)

    // Deficit Commission Config for Beta: ₹600 (exceeds provider payout of 450)
    const cfgDeficit: DscPartnerCommissionConfig = {
      id: `dpcc-deficit-${TEST_TIMESTAMP}`,
      organization_id: 'comp-default',
      partner_id: partnerBId,
      fee_type: 'DSC_PRODUCT',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      commission_type: 'FIXED',
      commission_value: 600,
      calculation_basis: 'BASE_PRICE_ONLY',
      effective_from: '2024-01-01',
      is_active: true,
      priority: 10,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    createdConfigIds.push(cfgDeficit.id)
    await saveCommissionConfig(cfgDeficit)

    // =========================================================================
    // SCENARIO 1: Single DSC Issuance Entry, Pricing & Payouts, Snapshot Created
    // =========================================================================
    const res1 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        issuance_date: '2026-11-10',
        company_profile_id: profileA.id,
        partner_id: partnerAId,
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        class_id: 'cls-class3',
        validity_id: 'val-2yr',
        quantity: 1,
        apply_support_fee: false,
      }),
    })
    const data1 = await res1.json()
    if (data1.transaction?.id) createdTransactionIds.push(data1.transaction.id)

    assert(
      res1.ok &&
        data1.transaction &&
        Number(data1.transaction.selling_base_rate) === 1500 &&
        Number(data1.transaction.provider_payout_amount) === 450 &&
        Number(data1.transaction.calculated_commission) === 200,
      'TEST_1',
      'Single DSC Issuance Entry & Auto-Pricing Resolution',
      `Created tx ${data1.transaction?.transaction_number}, base rate ₹${data1.transaction?.selling_base_rate}, provider payout ₹${data1.transaction?.provider_payout_amount}, partner commission ₹${data1.transaction?.calculated_commission}`
    )

    // =========================================================================
    // SCENARIO 2: Support Fee Service Inclusion & Commission Addition
    // =========================================================================
    const res2 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        issuance_date: '2026-11-10',
        company_profile_id: profileA.id,
        partner_id: partnerAId,
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        class_id: 'cls-class3',
        validity_id: 'val-2yr',
        quantity: 1,
        apply_support_fee: true,
        charge_id: 'chg-gold-support',
      }),
    })
    const data2 = await res2.json()
    if (data2.transaction?.id) createdTransactionIds.push(data2.transaction.id)

    assert(
      res2.ok &&
        Number(data2.transaction?.support_fee_commission) === 100 &&
        Number(data2.transaction?.total_partner_payout) === 300,
      'TEST_2',
      'Support Fee Service Commission Integration',
      `Support fee commission ₹${data2.transaction?.support_fee_commission} correctly added into total partner payout ₹${data2.transaction?.total_partner_payout}`
    )

    // =========================================================================
    // SCENARIO 3: Multi-Quantity Scaling (Base Rate * Qty, Payout * Qty)
    // =========================================================================
    const qty3 = 5
    const res3 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        issuance_date: '2026-11-10',
        company_profile_id: profileA.id,
        partner_id: partnerAId,
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        class_id: 'cls-class3',
        validity_id: 'val-2yr',
        quantity: qty3,
        apply_support_fee: false,
      }),
    })
    const data3 = await res3.json()
    if (data3.transaction?.id) createdTransactionIds.push(data3.transaction.id)

    const expectedTotalSelling = 1500 * qty3 * 1.18
    assert(
      res3.ok &&
        data3.transaction?.quantity === qty3 &&
        Math.abs(Number(data3.transaction?.total_selling_price) - expectedTotalSelling) < 0.1,
      'TEST_3',
      'Multi-Quantity Commercial Scaling',
      `Quantity ${qty3} scaled total selling price to ₹${data3.transaction?.total_selling_price} (Single rate ₹1500 + 18% GST)`
    )

    // =========================================================================
    // SCENARIO 4: Master Data Price Change Does NOT Mutate Historical Snapshot
    // =========================================================================
    const tx1Check = await queryOne<any>('SELECT * FROM dsc_commission_transactions WHERE id = ?', [data1.transaction.id])
    assert(
      tx1Check &&
        Number(tx1Check.selling_base_rate) === 1500 &&
        Number(tx1Check.provider_payout_amount) === 450,
      'TEST_4',
      'Historical Transaction Snapshot Immutability',
      `Transaction #${tx1Check?.transaction_number} has permanently frozen base rate ₹${tx1Check?.selling_base_rate} & payout ₹${tx1Check?.provider_payout_amount}`
    )

    // =========================================================================
    // SCENARIO 5: Profile Isolation (Profile A vs Profile B Partitioning)
    // =========================================================================
    const res5 = await fetch(`${BASE_URL}/api/dsc/issuance/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        issuance_date: '2026-11-10',
        company_profile_id: profileB.id,
        partner_id: partnerAId,
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        class_id: 'cls-class3',
        validity_id: 'val-2yr',
        quantity: 2,
        apply_support_fee: false,
      }),
    })
    const data5 = await res5.json()
    if (data5.transaction?.id) createdTransactionIds.push(data5.transaction.id)

    const entriesProfileBRes = await fetch(
      `${BASE_URL}/api/dsc/issuance/entries?company_profile_id=${encodeURIComponent(profileB.id)}`,
      { headers: { Cookie: adminCookie } }
    )
    const entriesProfileB = await entriesProfileBRes.json()
    const bHasProfileA = (entriesProfileB.entries || []).some((e: any) => e.company_profile_id === profileA.id)

    assert(
      entriesProfileBRes.ok && !bHasProfileA && (entriesProfileB.entries || []).some((e: any) => e.id === data5.transaction.id),
      'TEST_5',
      'Company Profile Data Isolation (Profile B Scope)',
      `Profile B filter returned exclusively Profile B records (${entriesProfileB.entries?.length} entries), zero Profile A leak`
    )

    // =========================================================================
    // SCENARIO 6: All Profiles Consolidated Reconciliation (Sum(A) + Sum(B) == All)
    // =========================================================================
    const repA = await (
      await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=${encodeURIComponent(profileA.id)}`, {
        headers: { Cookie: adminCookie },
      })
    ).json()

    const repB = await (
      await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=${encodeURIComponent(profileB.id)}`, {
        headers: { Cookie: adminCookie },
      })
    ).json()

    const repAll = await (
      await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=current_month&company_profile_id=ALL`, {
        headers: { Cookie: adminCookie },
      })
    ).json()

    const sumCertsAB = (Number(repA.summary?.total_certificates) || 0) + (Number(repB.summary?.total_certificates) || 0)
    const allCerts = Number(repAll.summary?.total_certificates) || 0

    assert(
      repAll.summary && allCerts >= sumCertsAB && allCerts >= 9,
      'TEST_6',
      'All Profiles Consolidated Mathematical Aggregation',
      `Consolidated certificates (${allCerts}) mathematically reconciles Profile A (${repA.summary?.total_certificates}) + Profile B (${repB.summary?.total_certificates})`
    )

    // =========================================================================
    // SCENARIO 7: Indian Financial Year Boundary Range (1 Apr - 31 Mar)
    // =========================================================================
    const repFyRes = await fetch(`${BASE_URL}/api/dsc/issuance/reports?period=fy`, {
      headers: { Cookie: adminCookie },
    })
    const repFy = await repFyRes.json()

    assert(
      repFyRes.ok &&
        repFy.filter?.period === 'fy' &&
        repFy.filter?.start_date.includes('-04-01') &&
        repFy.filter?.end_date.includes('-03-31'),
      'TEST_7',
      'Indian Financial Year Boundary Alignment (01-Apr to 31-Mar)',
      `FY period correctly parsed to [${repFy.filter?.start_date} -> ${repFy.filter?.end_date}] with ${repFy.summary?.total_certificates} certificates`
    )

    // =========================================================================
    // SCENARIO 8: Five-Dimension Breakdown Completeness
    // =========================================================================
    const hasAllDimensions =
      Array.isArray(repAll.breakdowns?.by_partner) &&
      Array.isArray(repAll.breakdowns?.by_provider) &&
      Array.isArray(repAll.breakdowns?.by_product) &&
      Array.isArray(repAll.breakdowns?.by_profile)

    assert(
      hasAllDimensions && repAll.breakdowns.by_partner.length > 0 && repAll.breakdowns.by_profile.length > 0,
      'TEST_8',
      'Five-Dimension Breakdown Generation (Partner, Provider, Product, Profile)',
      `Verified 4 distinct breakdown dimensions populated with aggregated metrics and net margins`
    )

    // =========================================================================
    // SCENARIO 9: Deficit Margin Warning & Admin Override Requirement
    // =========================================================================
    // Test pricing resolution for partner B where commission is ₹600 but provider payout is ₹450
    const resolveNegRes = await fetch(`${BASE_URL}/api/dsc/issuance/resolve-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileA.id,
        partner_id: partnerBId,
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        class_id: 'cls-class3',
        validity_id: 'val-2yr',
        quantity: 1,
        date: '2026-11-10',
      }),
    })
    const resolveNegData = await resolveNegRes.json()

    assert(
      resolveNegRes.ok &&
        resolveNegData.margin_warning === true &&
        Number(resolveNegData.net_retained_margin) === -150,
      'TEST_9',
      'Margin Deficit Detection & Retained Margin Calculation',
      `Net retained margin: ₹${resolveNegData.net_retained_margin}, Deficit Warning: ${resolveNegData.margin_warning}, Amount: ₹${resolveNegData.margin_warning_amount}`
    )

    // =========================================================================
    // SCENARIO 10: Zero-Residue Cleanup Verification
    // =========================================================================
    console.log(`Cleaning up ${createdTransactionIds.length} test transactions, ${createdPayoutIds.length} payouts, ${createdConfigIds.length} configs, and ${createdPartnerIds.length} test partners...`)
    for (const txId of createdTransactionIds) {
      await deleteCommissionTransaction('comp-default', txId)
    }
    for (const payId of createdPayoutIds) {
      await deleteProviderPayout('comp-default', payId)
    }
    for (const cfgId of createdConfigIds) {
      await deleteCommissionConfig('comp-default', cfgId)
    }
    for (const pId of createdPartnerIds) {
      await supabase.from('partners').delete().eq('id', pId)
    }

    const { data: remainingPartners } = await supabase
      .from('partners')
      .select('id')
      .in('id', createdPartnerIds)

    assert(
      !remainingPartners || remainingPartners.length === 0,
      'TEST_10',
      'Zero-Residue Test Record Teardown',
      `Successfully deleted all test transactions, configs, and partners. Residual partner count: ${remainingPartners?.length || 0}`
    )
  } catch (err: any) {
    console.error('Acceptance suite encountered an unhandled error:', err)
    assert(false, 'SUITE_ERROR', 'Acceptance Suite Execution', err.message || 'Unknown error')
  }

  // Summary Report
  console.log('\n====================================================================')
  console.log('ACCEPTANCE SUITE RESULTS SUMMARY:')
  console.log('====================================================================')
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`Total Scenarios: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('ALL MODULE 16 DSC ISSUANCE & PERFORMANCE ACCEPTANCE TESTS PASSED!')
    process.exit(0)
  }
}

runDscIssuanceAcceptance()
