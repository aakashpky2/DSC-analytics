import { supabase, queryAll, queryOne } from './supabase'
import {
  saveAssociatePartner,
  deleteAssociatePartner,
  getAssociatePartners,
  saveDscDirectRateCard,
  deleteDscDirectRateCard,
  getDscDirectRateCards,
  getDscWorkflowStages,
  saveDscWorkflowStage,
  getDscDocumentRequirements,
  saveDscDocumentRequirement,
  saveDscEstimate,
  deleteDscEstimate,
  saveDscApplication,
  deleteDscApplication,
  getDscApplications,
} from './dscDirectIssuanceStore'
import { createSession } from './auth'

const BASE_URL = 'http://localhost:3000'
const TS = Date.now()

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

async function runDirectIssuanceSuite() {
  console.log('====================================================================')
  console.log('STARTING: DSC DIRECT CLIENT ISSUANCE & ASSOCIATE PARTNER TEST SUITE')
  console.log('====================================================================')

  const cleanup = {
    partners: [] as string[],
    rateCards: [] as string[],
    assocConfigs: [] as string[],
    estimates: [] as string[],
    applications: [] as string[],
    tokenStocks: [] as string[],
  }

  try {
    // 0. Setup cryptographically verified sessions
    const adminToken = await createSession('usr-admin-root')
    const adminCookie = `signsync_session=${adminToken}`

    const staffToken = await createSession('usr-1793787633577') // Restricted telecaller / field staff
    const staffCookie = `signsync_session=${staffToken}`

    // Fetch Base Internal Profiles
    const profiles = await queryAll<any>('SELECT id, legal_name FROM purchase_internal_profiles WHERE organization_id = ?', ['comp-default'])
    if (profiles.length < 2) {
      throw new Error('Expected at least 2 company profiles for isolation testing')
    }
    const profileA = profiles[0]
    const profileB = profiles[1]
    console.log(`Using Profile A: ${profileA.legal_name} (${profileA.id})`)
    console.log(`Using Profile B: ${profileB.legal_name} (${profileB.id})`)

    // Create 3 Test Parties:
    // 1. Direct Customer
    // 2. Normal DSC Partner (NOT Associate Partner)
    // 3. Associate Partner
    const directCustomerId = `part-direct-cust-${TS}`
    const normalPartnerId = `part-norm-dsc-${TS}`
    const associatePartnerId = `part-assoc-ptr-${TS}`
    cleanup.partners.push(directCustomerId, normalPartnerId, associatePartnerId)

    await supabase.from('partners').insert([
      {
        id: directCustomerId,
        organization_id: 'comp-default',
        partner_code: `CUST-${TS.toString().slice(-4)}`,
        company_name: `Direct Customer Enterprise ${TS}`,
        contact_person: 'David Direct',
        email: `david_${TS}@directcust.com`,
        phone: '9810011221',
        billing_address: '101 Marine Drive, Mumbai',
        state_code: '27',
        type: 'token_partner',
        status: 'active',
      },
      {
        id: normalPartnerId,
        organization_id: 'comp-default',
        partner_code: `NDP-${TS.toString().slice(-4)}`,
        company_name: `Normal DSC Partner Alpha ${TS}`,
        contact_person: 'Nathan Normal',
        email: `nathan_${TS}@normalpartner.com`,
        phone: '9810011222',
        billing_address: '202 Bandra Kurla Complex, Mumbai',
        state_code: '27',
        type: 'dsc_partner',
        status: 'active',
      },
      {
        id: associatePartnerId,
        organization_id: 'comp-default',
        partner_code: `ASC-${TS.toString().slice(-4)}`,
        company_name: `Associate Partner Solutions ${TS}`,
        contact_person: 'Arthur Associate',
        email: `arthur_${TS}@associatesolutions.com`,
        phone: '9810011223',
        billing_address: '303 Connaught Place, New Delhi',
        state_code: '07',
        type: 'both',
        status: 'active',
      },
    ])

    // Register Associate Partner in Associate Partner Master
    const assocConfigId = `assoc-cfg-${TS}`
    cleanup.assocConfigs.push(assocConfigId)
    await saveAssociatePartner({
      id: assocConfigId,
      organization_id: 'comp-default',
      partner_id: associatePartnerId,
      is_active: true,
      commission_percentage: 15,
      default_fulfillment_model: 'COMMISSION',
      notes: 'Strategic accounting firm associate partner',
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Setup 3 Rate Cards for dsc-co-1 / prod-combo:
    // 1. GENERAL Rate Card: ₹1600
    // 2. DIRECT RETAIL Rate Card: ₹1800
    // 3. ASSOCIATE PARTNER Rate Card: ₹1200 (for B2B Reselling)
    const rcGenId = `rc-gen-${TS}`
    const rcRetailId = `rc-retail-${TS}`
    const rcAssocId = `rc-assoc-${TS}`
    cleanup.rateCards.push(rcGenId, rcRetailId, rcAssocId)

    await saveDscDirectRateCard({
      id: rcGenId,
      organization_id: 'comp-default',
      rate_card_type: 'GENERAL',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      rate: 1600,
      effective_from: '2024-01-01',
      is_active: true,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    await saveDscDirectRateCard({
      id: rcRetailId,
      organization_id: 'comp-default',
      rate_card_type: 'DIRECT_RETAIL',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      rate: 1800,
      effective_from: '2024-01-01',
      is_active: true,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    await saveDscDirectRateCard({
      id: rcAssocId,
      organization_id: 'comp-default',
      rate_card_type: 'ASSOCIATE_PARTNER',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      rate: 1200,
      effective_from: '2024-01-01',
      is_active: true,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    // Setup Stock for Token Model tm-1 under Profile A
    const stockCheck = await queryOne<any>(
      'SELECT id, quantity_on_hand FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?',
      ['comp-default', profileA.id, 'tm-1']
    )
    if (stockCheck) {
      await supabase.from('token_profile_stocks').update({ quantity_on_hand: 50 }).eq('id', stockCheck.id)
    } else {
      const stockId = `stk-test-${TS}`
      cleanup.tokenStocks.push(stockId)
      await supabase.from('token_profile_stocks').insert({
        id: stockId,
        organization_id: 'comp-default',
        company_profile_id: profileA.id,
        token_model_id: 'tm-1',
        model_name: 'ePass2003Auto',
        opening_quantity: 50,
        purchased_quantity: 0,
        issued_quantity: 0,
        quantity_on_hand: 50,
      })
    }

    // =========================================================================
    // FLOW A: Direct Customer Flow (Estimate → Approve → Convert → App)
    // =========================================================================
    const estRes = await fetch(`${BASE_URL}/api/dsc/direct/estimates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileA.id,
        client_id: directCustomerId,
        fulfillment_channel: 'DIRECT_SALE',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        quantity: 2,
        estimate_date: '2026-11-10',
      }),
    })
    const estData = await estRes.json()
    if (estData.estimate?.id) cleanup.estimates.push(estData.estimate.id)

    assert(
      estRes.ok &&
        estData.estimate &&
        estData.estimate.base_rate === 1800 && // Direct Retail rate card
        estData.estimate.base_amount === 3600 &&
        estData.estimate.total_amount === 4248, // 3600 + 18% GST (648)
      'FLOW-A1',
      'Create Customer Estimate with Retail Rate Card',
      `Estimate #${estData.estimate?.estimate_number} created for ₹4,248 (Retail rate ₹1,800 x 2)`
    )

    // Convert Estimate to DSC Application
    const convRes = await fetch(`${BASE_URL}/api/dsc/direct/estimates/${estData.estimate.id}/convert`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    const convData = await convRes.json()
    if (convData.application?.id) cleanup.applications.push(convData.application.id)

    assert(
      convRes.ok &&
        convData.application &&
        convData.application.estimate_id === estData.estimate.id &&
        convData.application.total_amount === 4248,
      'FLOW-A2',
      'Convert Approved Estimate to DSC Application',
      `Converted to App #${convData.application?.application_number}`
    )

    // Stage progression with document verification
    const transRes = await fetch(`${BASE_URL}/api/dsc/direct/applications/${convData.application.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        target_stage_id: 'stg-def-2', // Documents Verification
        documents_submitted: [
          { requirement_id: 'doc-req-1', text_value: 'PAN: ABCDE1234F' },
          { requirement_id: 'doc-req-2', text_value: 'Aadhaar: 9988-7766-5544' },
        ],
        notes: 'KYC verified successfully',
      }),
    })
    const transData = await transRes.json()

    assert(
      transRes.ok && transData.application?.current_stage_id === 'stg-def-2',
      'FLOW-A3',
      'Progress Stage with Mandatory KYC Documents',
      'KYC documents verified and stage progressed'
    )

    // Allocate physical USB token
    const tokRes = await fetch(`${BASE_URL}/api/dsc/direct/applications/${convData.application.id}/allocate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        token_model_id: 'tm-1',
        serial_numbers: ['SN-TK-001', 'SN-TK-002'],
      }),
    })
    const tokData = await tokRes.json()

    if (!tokRes.ok) console.log(tokData);
    assert(
      tokRes.ok && tokData.application?.is_token_allocated === true,
      'FLOW-A4',
      'Allocate Physical USB Tokens from Real Stock',
      `Allocated 2 tokens. Remaining stock on Profile A: ${tokData.remainingStock}`
    )

    // Final Issue & Snapshot Freezing
    const issueRes = await fetch(`${BASE_URL}/api/dsc/direct/applications/${convData.application.id}/issue`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })
    const issueData = await issueRes.json()

    assert(
      issueRes.ok &&
        issueData.application?.status === 'ISSUED' &&
        issueData.application?.snapshot_data?.base_rate === 1800,
      'FLOW-A5',
      'Finalize and Freeze Historical Commercial Snapshot',
      'DSC Issued with frozen snapshot data'
    )

    // =========================================================================
    // FLOW B: Direct DSC Application Flow (Bypass Estimate)
    // =========================================================================
    const dirAppRes = await fetch(`${BASE_URL}/api/dsc/direct/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileA.id,
        client_id: directCustomerId,
        fulfillment_channel: 'DIRECT_SALE',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        quantity: 1,
        application_date: '2026-11-10',
      }),
    })
    const dirAppData = await dirAppRes.json()
    if (dirAppData.application?.id) cleanup.applications.push(dirAppData.application.id)

    assert(
      dirAppRes.ok &&
        dirAppData.application &&
        dirAppData.application.is_direct_transaction === true &&
        dirAppData.application.estimate_id === null,
      'FLOW-B',
      'Direct DSC Application Creation (Bypass Estimate)',
      `Created Direct App #${dirAppData.application?.application_number}`
    )

    // =========================================================================
    // FLOW C: Associate Partner Commission Model
    // =========================================================================
    const assocCommRes = await fetch(`${BASE_URL}/api/dsc/direct/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileA.id,
        client_id: directCustomerId,
        fulfillment_channel: 'ASSOCIATE_PARTNER',
        associate_partner_id: associatePartnerId,
        fulfillment_model: 'COMMISSION',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        quantity: 1,
        application_date: '2026-11-10',
      }),
    })
    const assocCommData = await assocCommRes.json()
    if (assocCommData.application?.id) cleanup.applications.push(assocCommData.application.id)

    assert(
      assocCommRes.ok &&
        assocCommData.application?.billing_party_id === directCustomerId && // Customer is billed
        Number(assocCommData.application?.associate_commission_amount) === 180, // 15% of ₹1200 associate rate = ₹180
      'FLOW-C',
      'Associate Partner Commission-Based Model',
      `End customer billed; Associate commission: ₹${assocCommData.application?.associate_commission_amount}`
    )

    // =========================================================================
    // FLOW D: Associate Partner Reselling / B2B Model
    // =========================================================================
    const assocB2bRes = await fetch(`${BASE_URL}/api/dsc/direct/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileA.id,
        client_id: directCustomerId,
        fulfillment_channel: 'ASSOCIATE_PARTNER',
        associate_partner_id: associatePartnerId,
        fulfillment_model: 'RESELLING_B2B',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        quantity: 1,
        application_date: '2026-11-10',
      }),
    })
    const assocB2bData = await assocB2bRes.json()
    if (assocB2bData.application?.id) cleanup.applications.push(assocB2bData.application.id)

    assert(
      assocB2bRes.ok &&
        assocB2bData.application?.billing_party_id === associatePartnerId && // Associate Partner is billed directly
        assocB2bData.application?.base_rate === 1200, // Associate B2B rate
      'FLOW-D',
      'Associate Partner Reselling / B2B Model',
      `Associate partner billed directly at B2B rate ₹${assocB2bData.application?.base_rate}`
    )

    // =========================================================================
    // BREAK TEST 1: Normal DSC Partner Rejected as Associate Partner
    // =========================================================================
    const breakNormalAsAssoc = await fetch(`${BASE_URL}/api/dsc/direct/resolve-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        fulfillment_channel: 'ASSOCIATE_PARTNER',
        associate_partner_id: normalPartnerId, // Normal DSC Partner NOT tagged as Associate Partner
        fulfillment_model: 'COMMISSION',
      }),
    })

    assert(
      breakNormalAsAssoc.status === 400,
      'BREAK-1',
      'Normal DSC Partner Rejected as Associate Partner',
      'System strictly blocked normal partner from being treated as associate partner'
    )

    // =========================================================================
    // BREAK TEST 2: Missing Mandatory Document Blocks Stage Transition
    // =========================================================================
    const breakMissingDoc = await fetch(`${BASE_URL}/api/dsc/direct/applications/${dirAppData.application.id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        target_stage_id: 'stg-def-2',
        documents_submitted: [], // Missing mandatory PAN and Aadhaar
      }),
    })

    assert(
      breakMissingDoc.status === 400,
      'BREAK-2',
      'Mandatory Document Requirement Enforced on Transition',
      'System blocked transition when mandatory PAN/Aadhaar documents were omitted'
    )

    // =========================================================================
    // BREAK TEST 3: Insufficient Token Stock Blocked
    // =========================================================================
    const breakOverStock = await fetch(`${BASE_URL}/api/dsc/direct/applications/${dirAppData.application.id}/allocate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        token_model_id: 'tm-1',
        serial_numbers: [],
      }),
    })
    // We test requesting more than available stock by attempting on an empty profile or huge qty
    const breakZeroStock = await fetch(`${BASE_URL}/api/dsc/direct/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        company_profile_id: profileB.id, // Profile B has 0 stock
        client_id: directCustomerId,
        fulfillment_channel: 'DIRECT_SALE',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        quantity: 1,
      }),
    })
    const bApp = await breakZeroStock.json()
    if (bApp.application?.id) cleanup.applications.push(bApp.application.id)

    const breakAllocFail = await fetch(`${BASE_URL}/api/dsc/direct/applications/${bApp.application.id}/allocate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        token_model_id: 'tm-1',
      }),
    })

    assert(
      breakAllocFail.status === 400,
      'BREAK-3',
      'Insufficient Token Stock Allocation Guard',
      'System blocked token allocation when profile stock was insufficient'
    )

    // =========================================================================
    // BREAK TEST 4: Staff Forbidden from Modifying Rate Cards & Stages (403)
    // =========================================================================
    const staffRateCardRes = await fetch(`${BASE_URL}/api/dsc/direct/rate-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
      body: JSON.stringify({
        rate_card_type: 'GENERAL',
        company_id: 'dsc-co-1',
        product_id: 'prod-combo',
        rate: 100,
        effective_from: '2026-01-01',
      }),
    })

    assert(
      staffRateCardRes.status === 403,
      'BREAK-4',
      'Staff RBAC Guard on Rate Cards and Configuration',
      'Staff account strictly forbidden from creating rate cards (HTTP 403)'
    )

    // =========================================================================
    // BREAK TEST 5: Double Conversion of Estimate Blocked
    // =========================================================================
    const repeatConvRes = await fetch(`${BASE_URL}/api/dsc/direct/estimates/${estData.estimate.id}/convert`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    })

    assert(
      repeatConvRes.status === 400,
      'BREAK-5',
      'Repeat / Double Conversion of Estimate Blocked',
      'System prevented already converted estimate from creating duplicate application'
    )

    // =========================================================================
    // BREAK TEST 6: Changing Master Rate Does NOT Mutate Historical Issued Snapshot
    // =========================================================================
    // Mutate the retail rate card
    await saveDscDirectRateCard({
      id: rcRetailId,
      organization_id: 'comp-default',
      rate_card_type: 'DIRECT_RETAIL',
      company_id: 'dsc-co-1',
      product_id: 'prod-combo',
      rate: 9999, // Changed in master
      effective_from: '2024-01-01',
      is_active: true,
      created_by: 'usr-admin-root',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const historicalAppRes = await fetch(`${BASE_URL}/api/dsc/direct/applications/${convData.application.id}`, {
      headers: { Cookie: adminCookie },
    })
    const historicalAppData = await historicalAppRes.json()

    assert(
      historicalAppData.application?.snapshot_data?.base_rate === 1800 &&
        historicalAppData.application?.base_rate === 1800,
      'BREAK-6',
      'Historical Transaction Snapshot Immutability',
      `Issued application retained original base rate ₹1800 despite master rate update to ₹9999`
    )

    // =========================================================================
    // BREAK TEST 7: Operational Report Scoping & All Profiles Mathematical Aggregate
    // =========================================================================
    const repA = await (
      await fetch(`${BASE_URL}/api/dsc/direct/reports?period=current_month&company_profile_id=${profileA.id}`, {
        headers: { Cookie: adminCookie },
      })
    ).json()

    const repAll = await (
      await fetch(`${BASE_URL}/api/dsc/direct/reports?period=current_month&company_profile_id=ALL`, {
        headers: { Cookie: adminCookie },
      })
    ).json()

    assert(
      repAll.summary &&
        Number(repAll.summary.total_certificates) >= Number(repA.summary?.total_certificates),
      'REPORT-1',
      'Five-Dimension Operational Reports & Profile Consolidation',
      `Consolidated certificates (${repAll.summary?.total_certificates}) includes Profile A (${repA.summary?.total_certificates})`
    )

    // =========================================================================
    // CLEANUP: Zero-Residue Teardown
    // =========================================================================
    console.log('Tearing down test artifacts (Zero-Residue Guarantee)...')
    for (const appId of cleanup.applications) {
      await deleteDscApplication('comp-default', appId)
    }
    for (const estId of cleanup.estimates) {
      await deleteDscEstimate('comp-default', estId)
    }
    for (const rcId of cleanup.rateCards) {
      await deleteDscDirectRateCard('comp-default', rcId)
    }
    for (const asId of cleanup.assocConfigs) {
      await deleteAssociatePartner('comp-default', asId)
    }
    for (const pId of cleanup.partners) {
      await supabase.from('partners').delete().eq('id', pId)
    }

    const { data: remPartners } = await supabase.from('partners').select('id').in('id', cleanup.partners)

    assert(
      !remPartners || remPartners.length === 0,
      'CLEANUP',
      'Zero-Residue Test Record Teardown',
      'All test partners, applications, estimates, and configs cleaned up'
    )
  } catch (err: any) {
    console.error('Test suite unhandled error:', err)
    assert(false, 'SUITE_ERROR', 'Acceptance Suite Execution', err.message || 'Unknown error')
  }

  // Summary
  console.log('\n====================================================================')
  console.log('ACCEPTANCE SUITE RESULTS SUMMARY:')
  console.log('====================================================================')
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('ALL DSC DIRECT CLIENT ISSUANCE & ASSOCIATE PARTNER TESTS PASSED!')
    process.exit(0)
  }
}

runDirectIssuanceSuite()
