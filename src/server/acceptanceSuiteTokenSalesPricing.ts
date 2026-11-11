import {
  TokenSalesRate,
  QuantitySlab,
  CustomerPricingCategory,
  CustomerCategoryAssignment,
  CustomerLevel,
  CustomerLevelRule,
  CustomerLevelAssignment,
  PricingResolutionResult,
  getSalesRates,
  saveSalesRate,
  deleteSalesRate,
  getPricingCategories,
  savePricingCategory,
  deletePricingCategory,
  getCustomerCategoryAssignments,
  saveCustomerCategoryAssignment,
  deleteCustomerCategoryAssignment,
  getCustomerLevels,
  saveCustomerLevel,
  deleteCustomerLevel,
  getCustomerLevelRules,
  saveCustomerLevelRule,
  deleteCustomerLevelRule,
  getCustomerLevelAssignments,
  saveCustomerLevelAssignment,
  validateQuantitySlabs
} from './tokenPricingStore'
import { resolveSalesPrice, evaluateCustomerLevel } from './tokenPricingEngine'
import {
  TokenSalesEstimate,
  TokenSalesInvoice,
  saveSalesEstimate,
  saveSalesInvoice,
  getSalesEstimates,
  getSalesInvoices
} from './tokenSalesStore'
import { supabase } from './supabase'

export interface AcceptanceTestResult {
  id: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

export interface AcceptanceSuiteSummary {
  summary: { total: number; passed: number; failed: number }
  results: AcceptanceTestResult[]
}

export async function runTokenSalesPricingSuite(): Promise<AcceptanceSuiteSummary> {
  const results: AcceptanceTestResult[] = []
  const orgA = 'comp-default'
  const orgB = 'org-branch-del'
  const profileIdA = 'profile-dbiz-consultancy'
  const profileIdB = 'profile-dbiz-solutions'

  function logPass(id: string, name: string, details: string) {
    results.push({ id, name, status: 'PASS', details })
  }
  function logFail(id: string, name: string, details: string) {
    results.push({ id, name, status: 'FAIL', details })
  }

  // Cleanup trackers
  const cleanup = {
    rates: [] as string[],
    categories: [] as string[],
    assignments: [] as string[],
    levels: [] as string[],
    rules: [] as string[],
    levelAssignments: [] as string[],
    estimates: [] as string[],
    invoices: [] as string[],
    partners: [] as string[],
    models: [] as string[]
  }

  try {
    const ts = Date.now()

    // 0. Setup test token models and customers
    const modelA = `tm-price-a-${ts}`
    const modelB = `tm-price-b-${ts}`
    cleanup.models.push(modelA, modelB)

    await supabase.from('token_models').insert([
      { id: modelA, organization_id: orgA, model_name: `TEST MODEL ALPHA ${ts}`, manufacturer: 'Hypersecu', is_active: 1 },
      { id: modelB, organization_id: orgA, model_name: `TEST MODEL BETA ${ts}`, manufacturer: 'Watchdata', is_active: 1 }
    ])

    const custA = `part-price-a-${ts}`
    const custB = `part-price-b-${ts}`
    cleanup.partners.push(custA, custB)

    await supabase.from('partners').insert([
      {
        id: custA,
        organization_id: orgA,
        partner_code: `CUST-A-${ts.toString().slice(-4)}`,
        type: 'CUSTOMER',
        company_name: 'Apex Digital Signatures LLP',
        contact_person: 'Rahul Verma',
        email: `rahul-${ts}@apex.in`,
        phone: '9876543210',
        billing_address: 'Kochi, Kerala',
        state_code: '32',
        gstin: '32AAACA1234A1Z5'
      },
      {
        id: custB,
        organization_id: orgA,
        partner_code: `CUST-B-${ts.toString().slice(-4)}`,
        type: 'CUSTOMER',
        company_name: 'Northern Enterprises Ltd',
        contact_person: 'Amit Sharma',
        email: `amit-${ts}@northern.in`,
        phone: '9876543211',
        billing_address: 'Connaught Place, New Delhi',
        state_code: '07',
        gstin: '07AAACA9999A1Z1'
      }
    ])

    // ========================================================================
    // 1. SALES RATES (8 Tests)
    // ========================================================================

    // TEST-01: General fixed rate
    const rate1Id = `tsr-fix-${ts}`
    cleanup.rates.push(rate1Id)
    await saveSalesRate({
      id: rate1Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      rate_type: 'FIXED',
      rate: 100.00,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const r1 = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 50,
      date: '2026-11-09'
    })
    if (r1.unit_rate === 100 && r1.source === 'GENERAL_RATE') {
      logPass('TEST-01', 'General fixed rate', `Resolved general rate ₹${r1.unit_rate}/token for qty 50`)
    } else {
      logFail('TEST-01', 'General fixed rate', `Expected rate 100 and GENERAL_RATE, got ${r1.unit_rate} (${r1.source})`)
    }

    // TEST-02: Quantity slab rate
    const rate2Id = `tsr-slab-${ts}`
    cleanup.rates.push(rate2Id)
    const slabs2: QuantitySlab[] = [
      { min_quantity: 1, max_quantity: 10, unit_rate: 90 },
      { min_quantity: 11, max_quantity: 50, unit_rate: 80 },
      { min_quantity: 51, max_quantity: null, unit_rate: 70 }
    ]
    await saveSalesRate({
      id: rate2Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelB,
      rate_type: 'SLAB',
      rate: 90,
      quantity_slabs: slabs2,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const r2 = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelB,
      quantity: 25,
      date: '2026-11-09'
    })
    if (r2.unit_rate === 80 && r2.rate_type === 'SLAB') {
      logPass('TEST-02', 'Quantity slab rate', `Resolved slab rate ₹${r2.unit_rate}/token for qty 25 (slab 11-50)`)
    } else {
      logFail('TEST-02', 'Quantity slab rate', `Expected unit rate 80, got ${r2.unit_rate}`)
    }

    // TEST-03: Multiple quantity slabs verification (>50 quantity)
    const r3 = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelB,
      quantity: 100,
      date: '2026-11-09'
    })
    if (r3.unit_rate === 70) {
      logPass('TEST-03', 'Multiple quantity slabs (>50)', `Resolved top slab rate ₹${r3.unit_rate}/token for qty 100`)
    } else {
      logFail('TEST-03', 'Multiple quantity slabs (>50)', `Expected 70, got ${r3.unit_rate}`)
    }

    // TEST-04: Overlap rejection
    const invalidOverlapSlabs: QuantitySlab[] = [
      { min_quantity: 1, max_quantity: 10, unit_rate: 90 },
      { min_quantity: 8, max_quantity: 20, unit_rate: 85 } // Overlaps with 1-10
    ]
    const vOverlap = validateQuantitySlabs(invalidOverlapSlabs)
    if (!vOverlap.valid && vOverlap.error?.includes('Overlapping slabs detected')) {
      logPass('TEST-04', 'Overlap rejection', `Correctly rejected overlapping slabs: ${vOverlap.error}`)
    } else {
      logFail('TEST-04', 'Overlap rejection', `Failed to reject overlapping slabs`)
    }

    // TEST-05: Invalid slab rejection (inverted range)
    const invalidInvertedSlabs: QuantitySlab[] = [
      { min_quantity: 10, max_quantity: 5, unit_rate: 90 }
    ]
    const vInverted = validateQuantitySlabs(invalidInvertedSlabs)
    if (!vInverted.valid && vInverted.error?.includes('Inverted range')) {
      logPass('TEST-05', 'Invalid slab rejection', `Correctly rejected inverted range: ${vInverted.error}`)
    } else {
      logFail('TEST-05', 'Invalid slab rejection', `Failed to reject inverted slab range`)
    }

    // TEST-06: Effective date
    const rateFutureId = `tsr-future-${ts}`
    cleanup.rates.push(rateFutureId)
    await saveSalesRate({
      id: rateFutureId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      rate_type: 'FIXED',
      rate: 150.00,
      effective_from: '2026-12-01',
      effective_to: '2026-12-31', // Active only in December 2026
      is_active: true,
      priority: 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rDatePast = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09' // Before future rate
    })
    const rDateFuture = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-12-05' // Active in future
    })
    if (rDatePast.unit_rate === 100 && rDateFuture.unit_rate === 150) {
      logPass('TEST-06', 'Effective date pricing', `Past date resolved ₹100, future date resolved ₹150`)
    } else {
      logFail('TEST-06', 'Effective date pricing', `Past: ${rDatePast.unit_rate}, Future: ${rDateFuture.unit_rate}`)
    }

    // TEST-07: Historical rate preservation
    // Verify resolved price snapshot contains exact historical timestamp date
    if (rDatePast.date === '2026-11-09' && rDatePast.effective_rate_id === rate1Id) {
      logPass('TEST-07', 'Historical rate preservation', `Transaction locks effective rate ID ${rate1Id}`)
    } else {
      logFail('TEST-07', 'Historical rate preservation', `Failed to preserve historical rate metadata`)
    }

    // TEST-08: Profile-specific rate
    const rateProfB = `tsr-profb-${ts}`
    cleanup.rates.push(rateProfB)
    await saveSalesRate({
      id: rateProfB,
      organization_id: orgA,
      company_profile_id: profileIdB,
      token_model_id: modelA,
      rate_type: 'FIXED',
      rate: 115.00,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rProfA = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    const rProfB = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdB,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    if (rProfA.unit_rate === 100 && rProfB.unit_rate === 115) {
      logPass('TEST-08', 'Profile-specific rate', `Profile A resolved ₹100, Profile B resolved ₹115`)
    } else {
      logFail('TEST-08', 'Profile-specific rate', `Profile A: ${rProfA.unit_rate}, Profile B: ${rProfB.unit_rate}`)
    }

    // ========================================================================
    // 2. CATEGORIES & ASSIGNMENTS (9 Tests)
    // ========================================================================

    // TEST-09: Category creation
    const catKeralaId = `cpc-kerala-${ts}`
    const catHighVolId = `cpc-highvol-${ts}`
    cleanup.categories.push(catKeralaId, catHighVolId)

    await savePricingCategory({
      id: catKeralaId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      category_name: 'Kerala Region',
      category_code: 'KERALA',
      description: 'Regional category for Kerala partners',
      priority: 50,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await savePricingCategory({
      id: catHighVolId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      category_name: 'High Volume Wholesalers',
      category_code: 'HIGH_VOL',
      description: 'High volume wholesale partners',
      priority: 80,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const allCats = await getPricingCategories(orgA, profileIdA)
    if (allCats.some(c => c.id === catKeralaId) && allCats.some(c => c.id === catHighVolId)) {
      logPass('TEST-09', 'Category creation', `Created Kerala (Priority 50) and High Vol (Priority 80)`)
    } else {
      logFail('TEST-09', 'Category creation', `Categories not found in list`)
    }

    // TEST-10: Customer assignment
    const assign1Id = `cca-1-${ts}`
    cleanup.assignments.push(assign1Id)
    await saveCustomerCategoryAssignment({
      id: assign1Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      customer_category_id: catKeralaId,
      assignment_type: 'PERMANENT',
      effective_from: '2026-04-01',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const custAssignments = await getCustomerCategoryAssignments(orgA, custA)
    if (custAssignments.some(a => a.customer_category_id === catKeralaId)) {
      logPass('TEST-10', 'Customer assignment', `Assigned customer ${custA} to Kerala category`)
    } else {
      logFail('TEST-10', 'Customer assignment', `Customer assignment not found`)
    }

    // TEST-11: Permanent assignment
    const a1 = custAssignments.find(a => a.id === assign1Id)
    if (a1 && a1.assignment_type === 'PERMANENT' && !a1.effective_to) {
      logPass('TEST-11', 'Permanent assignment', `Verified permanent assignment has no expiry date`)
    } else {
      logFail('TEST-11', 'Permanent assignment', `Assignment is not permanent`)
    }

    // TEST-12: Date-based assignment
    const assignDateId = `cca-date-${ts}`
    cleanup.assignments.push(assignDateId)
    await saveCustomerCategoryAssignment({
      id: assignDateId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      customer_category_id: catKeralaId,
      assignment_type: 'DATE_BASED',
      effective_from: '2026-11-01',
      effective_to: '2026-11-30',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const bAssignments = await getCustomerCategoryAssignments(orgA, custB)
    if (bAssignments.some(a => a.id === assignDateId && a.effective_to === '2026-11-30')) {
      logPass('TEST-12', 'Date-based assignment', `Configured date-based assignment 2026-11-01 to 2026-11-30`)
    } else {
      logFail('TEST-12', 'Date-based assignment', `Failed to save date-based assignment`)
    }

    // TEST-13: Category expiry
    // Rate for Kerala category = ₹92
    const rateKeralaId = `tsr-cat-ker-${ts}`
    cleanup.rates.push(rateKeralaId)
    await saveSalesRate({
      id: rateKeralaId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      customer_category_id: catKeralaId,
      rate_type: 'FIXED',
      rate: 92.00,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    const rActiveDate = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-15' // Within 01-11 to 30-11
    })
    const rExpiredDate = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      token_model_id: modelA,
      quantity: 10,
      date: '2027-01-15' // Expired! Outside Dec future window
    })
    if (rActiveDate.unit_rate === 92 && rExpiredDate.unit_rate === 100) {
      logPass('TEST-13', 'Category expiry', `Active date got Kerala rate ₹92, expired date fell back to General rate ₹100`)
    } else {
      logFail('TEST-13', 'Category expiry', `Active: ${rActiveDate.unit_rate}, Expired: ${rExpiredDate.unit_rate}`)
    }

    // TEST-14: Customer filtering by state
    // CustA has state_code 32 (Kerala), CustB has 07 (Delhi)
    const { data: keralaCusts } = await supabase.from('partners').select('id, company_name, state_code').eq('state_code', '32')
    if (keralaCusts && keralaCusts.some(c => c.id === custA)) {
      logPass('TEST-14', 'Customer filtering by state', `Filtered customers by state_code '32' returned customer ${custA}`)
    } else {
      logFail('TEST-14', 'Customer filtering by state', `State filtering failed`)
    }

    // TEST-15: Customer filtering by GST status
    const { data: gstCusts } = await supabase.from('partners').select('id, company_name, gstin').not('gstin', 'is', null)
    if (gstCusts && gstCusts.some(c => c.id === custA)) {
      logPass('TEST-15', 'Customer filtering by GST status', `Filtered customers with registered GSTIN successfully`)
    } else {
      logFail('TEST-15', 'Customer filtering by GST status', `GST filtering failed`)
    }

    // TEST-16: Multiple categories assignment
    const assign2Id = `cca-2-${ts}`
    cleanup.assignments.push(assign2Id)
    await saveCustomerCategoryAssignment({
      id: assign2Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      customer_category_id: catHighVolId,
      assignment_type: 'PERMANENT',
      effective_from: '2026-04-01',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const custAMulti = await getCustomerCategoryAssignments(orgA, custA)
    if (custAMulti.filter(a => a.is_active).length >= 2) {
      logPass('TEST-16', 'Multiple categories assignment', `Customer ${custA} simultaneously belongs to Kerala & High Vol`)
    } else {
      logFail('TEST-16', 'Multiple categories assignment', `Expected >= 2 categories, found ${custAMulti.length}`)
    }

    // TEST-17: Priority resolution (High Vol Priority 80 > Kerala Priority 50)
    const rateHighVolId = `tsr-cat-hv-${ts}`
    cleanup.rates.push(rateHighVolId)
    await saveSalesRate({
      id: rateHighVolId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      customer_category_id: catHighVolId,
      rate_type: 'FIXED',
      rate: 75.00,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 80,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rPriority = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    if (rPriority.unit_rate === 75 && rPriority.matched_category_id === catHighVolId) {
      logPass('TEST-17', 'Priority resolution', `High Volume (Priority 80, ₹75) won over Kerala (Priority 50, ₹92)`)
    } else {
      logFail('TEST-17', 'Priority resolution', `Expected 75 from High Vol, got ${rPriority.unit_rate} (${rPriority.matched_category_name})`)
    }

    // ========================================================================
    // 3. CUSTOMER LEVELS & AUTOMATIC RULES (7 Tests)
    // ========================================================================

    // TEST-18: Manual level creation
    const lvlVipId = `cl-vip-${ts}`
    const lvlHighVolId = `cl-hv-${ts}`
    cleanup.levels.push(lvlVipId, lvlHighVolId)

    await saveCustomerLevel({
      id: lvlVipId,
      organization_id: orgA,
      level_name: 'VIP PREMIUM',
      level_code: 'VIP',
      description: 'Exclusive tier VIP clients',
      priority: 100,
      is_active: true,
      assignment_mode: 'MANUAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveCustomerLevel({
      id: lvlHighVolId,
      organization_id: orgA,
      level_name: 'HIGH VOLUME',
      level_code: 'HV',
      description: 'Monthly purchases >= 1,000 tokens',
      priority: 80,
      is_active: true,
      assignment_mode: 'AUTOMATIC',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const allLevels = await getCustomerLevels(orgA)
    if (allLevels.some(l => l.id === lvlVipId) && allLevels.some(l => l.id === lvlHighVolId)) {
      logPass('TEST-18', 'Manual and automatic level creation', `Created VIP (Manual) and HIGH VOLUME (Automatic)`)
    } else {
      logFail('TEST-18', 'Manual level creation', `Failed to list created levels`)
    }

    // TEST-19: Automatic level rules creation
    const ruleMonthlyId = `clr-m-${ts}`
    const ruleAnnualId = `clr-a-${ts}`
    cleanup.rules.push(ruleMonthlyId, ruleAnnualId)

    await saveCustomerLevelRule({
      id: ruleMonthlyId,
      organization_id: orgA,
      customer_level_id: lvlHighVolId,
      period_type: 'MONTHLY',
      min_purchase_volume: 1000,
      is_active: true,
      priority: 50,
      description: 'Monthly token purchases >= 1,000 tokens',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveCustomerLevelRule({
      id: ruleAnnualId,
      organization_id: orgA,
      customer_level_id: lvlVipId,
      period_type: 'ANNUAL',
      min_purchase_volume: 10000,
      is_active: true,
      priority: 90,
      description: 'Annual FY token purchases >= 10,000 tokens',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const allRules = await getCustomerLevelRules(orgA)
    if (allRules.some(r => r.id === ruleMonthlyId) && allRules.some(r => r.id === ruleAnnualId)) {
      logPass('TEST-19', 'Automatic level rule creation', `Created monthly rule (>= 1,000) and annual rule (>= 10,000)`)
    } else {
      logFail('TEST-19', 'Automatic level rule creation', `Failed to create level rules`)
    }

    // TEST-20: Monthly volume rule evaluation with valid POSTED sales
    // Create 3 POSTED invoices: 400, 300, 400 = 1,100 tokens
    const inv1Id = `inv-eval-1-${ts}`
    const inv2Id = `inv-eval-2-${ts}`
    const inv3Id = `inv-eval-3-${ts}`
    const invDraftId = `inv-eval-draft-${ts}`
    cleanup.invoices.push(inv1Id, inv2Id, inv3Id, invDraftId)

    await saveSalesInvoice({
      id: inv1Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      series_id: 'ser-1',
      invoice_number: `INV-E1-${ts}`,
      invoice_date: '2026-11-05',
      subtotal: 32000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: 32000,
      paid_amount: 32000,
      outstanding_balance: 0,
      total_landed_cost: 20000,
      total_profit: 12000,
      status: 'POSTED',
      items: [{ token_model_id: modelA, model_name: 'TEST', quantity: 400, unit_price: 80, taxable_amount: 32000, gst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax: 0, line_total: 32000, historical_landed_cost: 50, total_landed_cost: 20000, gross_profit: 12000 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveSalesInvoice({
      id: inv2Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      series_id: 'ser-1',
      invoice_number: `INV-E2-${ts}`,
      invoice_date: '2026-11-06',
      subtotal: 24000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: 24000,
      paid_amount: 24000,
      outstanding_balance: 0,
      total_landed_cost: 15000,
      total_profit: 9000,
      status: 'POSTED',
      items: [{ token_model_id: modelA, model_name: 'TEST', quantity: 300, unit_price: 80, taxable_amount: 24000, gst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax: 0, line_total: 24000, historical_landed_cost: 50, total_landed_cost: 15000, gross_profit: 9000 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveSalesInvoice({
      id: inv3Id,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      series_id: 'ser-1',
      invoice_number: `INV-E3-${ts}`,
      invoice_date: '2026-11-07',
      subtotal: 32000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: 32000,
      paid_amount: 32000,
      outstanding_balance: 0,
      total_landed_cost: 20000,
      total_profit: 12000,
      status: 'POSTED',
      items: [{ token_model_id: modelA, model_name: 'TEST', quantity: 400, unit_price: 80, taxable_amount: 32000, gst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax: 0, line_total: 32000, historical_landed_cost: 50, total_landed_cost: 20000, gross_profit: 12000 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    // Also create a DRAFT invoice with 5,000 tokens — should NOT be counted!
    await saveSalesInvoice({
      id: invDraftId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      series_id: 'ser-1',
      invoice_number: `INV-DRAFT-${ts}`,
      invoice_date: '2026-11-08',
      subtotal: 400000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: 400000,
      paid_amount: 0,
      outstanding_balance: 400000,
      total_landed_cost: 250000,
      total_profit: 150000,
      status: 'DRAFT',
      items: [{ token_model_id: modelA, model_name: 'TEST', quantity: 5000, unit_price: 80, taxable_amount: 400000, gst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax: 0, line_total: 400000, historical_landed_cost: 50, total_landed_cost: 250000, gross_profit: 150000 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    const evalResult = await evaluateCustomerLevel(orgA, custB, '2026-11-09')
    if (evalResult.new_level_id === lvlHighVolId && evalResult.qualification_volume === 1100) {
      logPass('TEST-20', 'Monthly volume rule', `Customer qualified for HIGH VOLUME (1,100 tokens from posted sales, draft excluded)`)
    } else {
      logFail('TEST-20', 'Monthly volume rule', `Expected HIGH VOLUME and 1,100 qty, got ${evalResult.new_level_id} and ${evalResult.qualification_volume}`)
    }

    // TEST-21: Annual FY volume rule
    // Customer with 12,000 tokens in current FY
    const invAnnualId = `inv-eval-ann-${ts}`
    cleanup.invoices.push(invAnnualId)
    await saveSalesInvoice({
      id: invAnnualId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custB,
      series_id: 'ser-1',
      invoice_number: `INV-ANN-${ts}`,
      invoice_date: '2026-05-15', // Earlier in FY 2026-27
      subtotal: 960000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: 960000,
      paid_amount: 960000,
      outstanding_balance: 0,
      total_landed_cost: 600000,
      total_profit: 360000,
      status: 'POSTED',
      items: [{ token_model_id: modelA, model_name: 'TEST', quantity: 12000, unit_price: 80, taxable_amount: 960000, gst_rate: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax: 0, line_total: 960000, historical_landed_cost: 50, total_landed_cost: 600000, gross_profit: 360000 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const evalAnnual = await evaluateCustomerLevel(orgA, custB, '2026-11-09')
    if (evalAnnual.new_level_id === lvlVipId && evalAnnual.qualification_volume >= 13100) {
      logPass('TEST-21', 'Annual FY volume rule', `Customer qualified for VIP PREMIUM with FY volume ${evalAnnual.qualification_volume} tokens`)
    } else {
      logFail('TEST-21', 'Annual FY volume rule', `Expected VIP PREMIUM, got ${evalAnnual.new_level_id}`)
    }

    // TEST-22: Manual override
    const overrideLvlId = `cla-ovr-${custB}`
    cleanup.levelAssignments.push(overrideLvlId)
    await saveCustomerLevelAssignment({
      id: overrideLvlId,
      organization_id: orgA,
      company_profile_id: null,
      customer_id: custB,
      current_level_id: lvlVipId,
      previous_level_id: lvlHighVolId,
      assignment_type: 'MANUAL_OVERRIDE',
      override_by: 'director@dbiz.in',
      override_date: new Date().toISOString(),
      override_reason: 'Key enterprise account relationship',
      effective_from: '2026-04-01',
      effective_to: null,
      calculated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const evalAfterOverride = await evaluateCustomerLevel(orgA, custB, '2026-11-09')
    if (evalAfterOverride.assignment_type === 'MANUAL_OVERRIDE' && evalAfterOverride.new_level_id === lvlVipId) {
      logPass('TEST-22', 'Manual override takes precedence', `Manual override preserved VIP level despite automatic calculation`)
    } else {
      logFail('TEST-22', 'Manual override', `Manual override was overwritten`)
    }

    // TEST-23: Override audit trail
    const assignmentsB = await getCustomerLevelAssignments(orgA, custB)
    const activeOvr = assignmentsB.find(a => a.assignment_type === 'MANUAL_OVERRIDE')
    if (activeOvr && activeOvr.override_by === 'director@dbiz.in' && activeOvr.override_reason?.includes('Key enterprise')) {
      logPass('TEST-23', 'Override audit trail', `Stored override_by, override_date, and override_reason`)
    } else {
      logFail('TEST-23', 'Override audit trail', `Missing override audit attributes`)
    }

    // TEST-24: Level recalculation
    // Expire the manual override and re-evaluate
    await saveCustomerLevelAssignment({
      ...activeOvr!,
      effective_to: '2026-10-31' // Expired in October
    })
    const evalRecalc = await evaluateCustomerLevel(orgA, custB, '2026-11-09')
    if (evalRecalc.assignment_type === 'AUTOMATIC') {
      logPass('TEST-24', 'Level recalculation', `Recalculation correctly resumed automatic rules after override expiry`)
    } else {
      logFail('TEST-24', 'Level recalculation', `Expected AUTOMATIC, got ${evalRecalc.assignment_type}`)
    }

    // ========================================================================
    // 4. SMART RATE RESOLUTION & PREVIEW (9 Tests)
    // ========================================================================

    // TEST-25: General fallback (no category assigned to customer)
    const custFresh = `part-fresh-${ts}`
    cleanup.partners.push(custFresh)
    await supabase.from('partners').insert({
      id: custFresh,
      organization_id: orgA,
      company_name: 'Fresh Customer Pvt Ltd'
    })
    const rFallback = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custFresh,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    if (rFallback.source === 'GENERAL_RATE' && rFallback.unit_rate === 100) {
      logPass('TEST-25', 'General fallback', `Fresh customer without category fell back to General rate ₹100`)
    } else {
      logFail('TEST-25', 'General fallback', `Expected GENERAL_RATE 100, got ${rFallback.source} ${rFallback.unit_rate}`)
    }

    // TEST-26: Category rate resolution
    const rCat = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA, // CustA has High Vol and Kerala
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    if (rCat.source === 'CATEGORY_RATE' && rCat.unit_rate === 75) {
      logPass('TEST-26', 'Category rate resolution', `Resolved category rate ₹75 for High Volume category`)
    } else {
      logFail('TEST-26', 'Category rate resolution', `Expected 75 CATEGORY_RATE, got ${rCat.unit_rate} ${rCat.source}`)
    }

    // TEST-27: Quantity slab inside category
    const catSlabId = `cpc-slab-cat-${ts}`
    cleanup.categories.push(catSlabId)
    await savePricingCategory({
      id: catSlabId,
      organization_id: orgA,
      category_name: 'Tiered Wholesale',
      category_code: 'TIER_WS',
      priority: 95, // Higher than 80
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rateSlabCatId = `tsr-slab-cat-${ts}`
    cleanup.rates.push(rateSlabCatId)
    await saveSalesRate({
      id: rateSlabCatId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      customer_category_id: catSlabId,
      rate_type: 'SLAB',
      rate: 90,
      quantity_slabs: [
        { min_quantity: 1, max_quantity: 100, unit_rate: 90 },
        { min_quantity: 101, max_quantity: 500, unit_rate: 80 },
        { min_quantity: 501, max_quantity: 1000, unit_rate: 70 },
        { min_quantity: 1001, max_quantity: null, unit_rate: 65 }
      ],
      effective_from: '2026-04-01',
      is_active: true,
      priority: 95,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    // Assign custA to Tiered Wholesale
    const assignSlabId = `cca-slab-${ts}`
    cleanup.assignments.push(assignSlabId)
    await saveCustomerCategoryAssignment({
      id: assignSlabId,
      organization_id: orgA,
      customer_id: custA,
      customer_category_id: catSlabId,
      assignment_type: 'PERMANENT',
      effective_from: '2026-04-01',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rSlabCat750 = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      token_model_id: modelA,
      quantity: 750, // Falls in 501–1000 slab
      date: '2026-11-09'
    })
    if (rSlabCat750.unit_rate === 70 && rSlabCat750.applicable_slab?.unit_rate === 70) {
      logPass('TEST-27', 'Quantity slab inside category', `Category Tiered Wholesale resolved ₹70 for qty 750 (501–1000 slab)`)
    } else {
      logFail('TEST-27', 'Quantity slab inside category', `Expected 70, got ${rSlabCat750.unit_rate}`)
    }

    // TEST-28: Category priority resolution
    if (rSlabCat750.matched_category_id === catSlabId && rSlabCat750.matched_category_priority === 95) {
      logPass('TEST-28', 'Category priority resolution', `Priority 95 (Tiered Wholesale) cleanly won over Priority 80 (High Vol)`)
    } else {
      logFail('TEST-28', 'Category priority resolution', `Expected Priority 95 to win`)
    }

    // TEST-29: New customer category
    const catNewCustId = `cpc-new-cust-${ts}`
    cleanup.categories.push(catNewCustId)
    await savePricingCategory({
      id: catNewCustId,
      organization_id: orgA,
      category_name: 'NEW CUSTOMER',
      category_code: 'NEW_CUST',
      priority: 60,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rateNewCustId = `tsr-new-cust-${ts}`
    cleanup.rates.push(rateNewCustId)
    await saveSalesRate({
      id: rateNewCustId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelA,
      customer_category_id: catNewCustId,
      rate_type: 'FIXED',
      rate: 85.00,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 60,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const custNew = `part-new-client-${ts}`
    cleanup.partners.push(custNew)
    await supabase.from('partners').insert({
      id: custNew,
      organization_id: orgA,
      company_name: 'XYZ Solutions Ltd'
    })
    const assignNewCustId = `cca-new-${ts}`
    cleanup.assignments.push(assignNewCustId)
    await saveCustomerCategoryAssignment({
      id: assignNewCustId,
      organization_id: orgA,
      customer_id: custNew,
      customer_category_id: catNewCustId,
      assignment_type: 'DATE_BASED',
      effective_from: '2026-11-01',
      effective_to: '2026-11-30',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const rNewCust = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custNew,
      token_model_id: modelA,
      quantity: 10,
      date: '2026-11-09'
    })
    if (rNewCust.unit_rate === 85 && rNewCust.matched_category_id === catNewCustId) {
      logPass('TEST-29', 'New customer category', `XYZ Solutions received special NEW CUSTOMER rate ₹85/token`)
    } else {
      logFail('TEST-29', 'New customer category', `Expected 85, got ${rNewCust.unit_rate}`)
    }

    // TEST-30: Rate explanation
    if (rSlabCat750.explanation && rSlabCat750.explanation.includes('Category rate resolved')) {
      logPass('TEST-30', 'Rate explanation', `Pricing resolution provides audit explanation: "${rSlabCat750.explanation}"`)
    } else {
      logFail('TEST-30', 'Rate explanation', `Missing or empty explanation`)
    }

    // TEST-31: Rate preview tool
    const previewResult = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      token_model_id: modelA,
      quantity: 200,
      date: '2026-11-09'
    })
    if (previewResult.taxable_value === 16000 && previewResult.unit_rate === 80) {
      logPass('TEST-31', 'Rate preview tool', `Preview tool returned rate ₹80, taxable value ₹16,000 for qty 200`)
    } else {
      logFail('TEST-31', 'Rate preview tool', `Expected taxable value 16000, got ${previewResult.taxable_value}`)
    }

    // TEST-32: Manual price override
    const rOverride = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      token_model_id: modelA,
      quantity: 100,
      date: '2026-11-09',
      override_rate: 68.00,
      override_reason: 'Director special pricing approval'
    })
    if (rOverride.unit_rate === 68 && rOverride.is_override && rOverride.override_reason?.includes('Director special')) {
      logPass('TEST-32', 'Manual price override', `Successfully accepted authorized override ₹68/token with reason audit`)
    } else {
      logFail('TEST-32', 'Manual price override', `Failed to apply override`)
    }

    // TEST-33: Rate missing block validation
    const modelUnconfigured = `tm-no-rate-${ts}`
    cleanup.models.push(modelUnconfigured)
    await supabase.from('token_models').insert({
      id: modelUnconfigured,
      organization_id: orgA,
      model_name: 'UNCONFIGURED TOKEN'
    })
    let blockedError = ''
    try {
      await resolveSalesPrice({
        organization_id: orgA,
        company_profile_id: profileIdA,
        customer_id: custFresh,
        token_model_id: modelUnconfigured,
        quantity: 10,
        date: '2026-11-09'
      })
    } catch (e: any) {
      blockedError = e.message
    }
    if (blockedError.includes('No active sales rate configured')) {
      logPass('TEST-33', 'Rate missing block validation', `Strictly blocked unconfigured token: "${blockedError}"`)
    } else {
      logFail('TEST-33', 'Rate missing block validation', `Expected block error, got: ${blockedError}`)
    }

    // ========================================================================
    // 5. SALES ESTIMATE & SALES INVOICE INTEGRATION (5 Tests)
    // ========================================================================

    // TEST-34: Estimate receives automatic rate
    const estId = `est-auto-${ts}`
    cleanup.estimates.push(estId)
    const autoPrice = await resolveSalesPrice({
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      token_model_id: modelA,
      quantity: 100,
      date: '2026-11-09'
    })
    await saveSalesEstimate({
      id: estId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      estimate_number: `EST-AUTO-${ts}`,
      estimate_date: '2026-11-09',
      subtotal: autoPrice.taxable_value,
      tax_amount: 0,
      grand_total: autoPrice.taxable_value,
      status: 'APPROVED',
      items: [{
        token_model_id: modelA,
        model_name: 'TEST ALPHA',
        quantity: 100,
        unit_price: autoPrice.unit_rate,
        taxable_amount: autoPrice.taxable_value,
        gst_rate: 0,
        tax_amount: 0,
        total_amount: autoPrice.taxable_value,
        estimated_landed_cost: 5000
      }],
      notes: autoPrice.explanation,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const loadedEst = (await getSalesEstimates(orgA, profileIdA)).find(e => e.id === estId)
    if (loadedEst && loadedEst.items[0].unit_price === 90) {
      logPass('TEST-34', 'Estimate receives automatic rate', `Sales Estimate auto-populated rate ₹${loadedEst.items[0].unit_price}/token`)
    } else {
      logFail('TEST-34', 'Estimate receives automatic rate', `Expected 90, got ${loadedEst?.items[0]?.unit_price}`)
    }

    // TEST-35: Estimate stores rate snapshot
    if (loadedEst?.notes?.includes('Tiered Wholesale')) {
      logPass('TEST-35', 'Estimate stores rate snapshot', `Stored resolution snapshot and explanation inside document`)
    } else {
      logFail('TEST-35', 'Estimate stores rate snapshot', `Rate snapshot explanation not stored`)
    }

    // TEST-36: Estimate approval does not alter rate
    await saveSalesEstimate({
      ...loadedEst!,
      status: 'APPROVED',
      updated_at: new Date().toISOString()
    })
    const approvedEst = (await getSalesEstimates(orgA, profileIdA)).find(e => e.id === estId)
    if (approvedEst?.items[0].unit_price === 90) {
      logPass('TEST-36', 'Estimate approval rate immutability', `Rate remains ₹90 after estimate approval`)
    } else {
      logFail('TEST-36', 'Estimate approval rate immutability', `Rate changed on approval`)
    }

    // TEST-37: Invoice conversion retains approved rate
    const invConvertedId = `inv-conv-${ts}`
    cleanup.invoices.push(invConvertedId)
    await saveSalesInvoice({
      id: invConvertedId,
      organization_id: orgA,
      company_profile_id: profileIdA,
      customer_id: custA,
      estimate_id: estId,
      series_id: 'ser-1',
      invoice_number: `INV-CONV-${ts}`,
      invoice_date: '2026-11-10',
      subtotal: approvedEst!.subtotal,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax: 0,
      grand_total: approvedEst!.grand_total,
      paid_amount: approvedEst!.grand_total,
      outstanding_balance: 0,
      total_landed_cost: 5000,
      total_profit: 4000,
      status: 'POSTED',
      items: [{
        token_model_id: modelA,
        model_name: 'TEST ALPHA',
        quantity: approvedEst!.items[0].quantity,
        unit_price: approvedEst!.items[0].unit_price, // Carried forward exactly!
        taxable_amount: approvedEst!.items[0].taxable_amount,
        gst_rate: 0,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        total_tax: 0,
        line_total: approvedEst!.items[0].total_amount,
        historical_landed_cost: 50,
        total_landed_cost: 5000,
        gross_profit: 4000
      }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    const loadedInv = (await getSalesInvoices(orgA, profileIdA)).find(i => i.id === invConvertedId)
    if (loadedInv && loadedInv.items[0].unit_price === 90) {
      logPass('TEST-37', 'Invoice conversion retains approved rate', `Converted invoice locked rate ₹${loadedInv.items[0].unit_price} from estimate`)
    } else {
      logFail('TEST-37', 'Invoice conversion retains approved rate', `Rate changed on conversion`)
    }

    // TEST-38: Current rate change does not alter historical invoice
    // Update rate in rate master to ₹150 today
    await saveSalesRate({
      ...rate1Id ? (await getSalesRates(orgA)).find(r => r.id === rate1Id)! : null as any,
      rate: 150.00
    })
    const reloadedInv = (await getSalesInvoices(orgA, profileIdA)).find(i => i.id === invConvertedId)
    if (reloadedInv && reloadedInv.items[0].unit_price === 90) {
      logPass('TEST-38', 'Historical rate immutability', `Historical invoice unit rate firmly remained ₹90 despite master rate update`)
    } else {
      logFail('TEST-38', 'Historical rate immutability', `Historical invoice rate corrupted: ${reloadedInv?.items[0]?.unit_price}`)
    }

    // ========================================================================
    // 6. SECURITY, ISOLATION & TENANCY (4 Tests)
    // ========================================================================

    // TEST-39: Organization isolation
    const ratesOrgB = await getSalesRates(orgB)
    if (!ratesOrgB.some(r => r.organization_id === orgA)) {
      logPass('TEST-39', 'Organization isolation', `Org B query returned 0 records belonging to Org A`)
    } else {
      logFail('TEST-39', 'Organization isolation', `Cross-organization data leak detected`)
    }

    // TEST-40: Profile isolation
    const ratesProfA = await getSalesRates(orgA, { profileId: profileIdA })
    const ratesProfB = await getSalesRates(orgA, { profileId: profileIdB })
    if (ratesProfA.every(r => !r.company_profile_id || r.company_profile_id === profileIdA) &&
        ratesProfB.every(r => !r.company_profile_id || r.company_profile_id === profileIdB)) {
      logPass('TEST-40', 'Profile isolation', `Profile A and Profile B rates strictly isolated`)
    } else {
      logFail('TEST-40', 'Profile isolation', `Profile leak detected`)
    }

    // TEST-41: Customer data isolation
    const assignsOrgB = await getCustomerCategoryAssignments(orgB)
    if (!assignsOrgB.some(a => a.organization_id === orgA)) {
      logPass('TEST-41', 'Customer data isolation', `Customer category assignments isolated by tenant boundary`)
    } else {
      logFail('TEST-41', 'Customer data isolation', `Customer assignment leaked across tenants`)
    }

    // TEST-42: Ambiguous priority collision detection
    const catCollision1 = `cpc-col-1-${ts}`
    const catCollision2 = `cpc-col-2-${ts}`
    cleanup.categories.push(catCollision1, catCollision2)
    await savePricingCategory({
      id: catCollision1,
      organization_id: orgA,
      category_name: 'Collision Group Alpha',
      category_code: 'COL_A',
      priority: 99,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await savePricingCategory({
      id: catCollision2,
      organization_id: orgA,
      category_name: 'Collision Group Beta',
      category_code: 'COL_B',
      priority: 99, // Same priority!
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveSalesRate({
      id: `tsr-col-1-${ts}`,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelB,
      customer_category_id: catCollision1,
      rate_type: 'FIXED',
      rate: 80,
      effective_from: '2026-04-01',
      is_active: true,
      priority: 99,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveSalesRate({
      id: `tsr-col-2-${ts}`,
      organization_id: orgA,
      company_profile_id: profileIdA,
      token_model_id: modelB,
      customer_category_id: catCollision2,
      rate_type: 'FIXED',
      rate: 70, // Conflicting rates!
      effective_from: '2026-04-01',
      is_active: true,
      priority: 99,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    cleanup.rates.push(`tsr-col-1-${ts}`, `tsr-col-2-${ts}`)
    const custColl = `part-col-${ts}`
    cleanup.partners.push(custColl)
    await supabase.from('partners').insert({ id: custColl, organization_id: orgA, company_name: 'Conflict Test Partner' })
    await saveCustomerCategoryAssignment({
      id: `cca-col-1-${ts}`,
      organization_id: orgA,
      customer_id: custColl,
      customer_category_id: catCollision1,
      assignment_type: 'PERMANENT',
      effective_from: '2026-04-01',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    await saveCustomerCategoryAssignment({
      id: `cca-col-2-${ts}`,
      organization_id: orgA,
      customer_id: custColl,
      customer_category_id: catCollision2,
      assignment_type: 'PERMANENT',
      effective_from: '2026-04-01',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    cleanup.assignments.push(`cca-col-1-${ts}`, `cca-col-2-${ts}`)

    let collError = ''
    try {
      await resolveSalesPrice({
        organization_id: orgA,
        company_profile_id: profileIdA,
        customer_id: custColl,
        token_model_id: modelB,
        quantity: 10,
        date: '2026-11-09'
      })
    } catch (e: any) {
      collError = e.message
    }
    if (collError.includes('have the same priority')) {
      logPass('TEST-42', 'Ambiguous priority collision detection', `Successfully blocked ambiguous same-priority categories: "${collError}"`)
    } else {
      logFail('TEST-42', 'Ambiguous priority collision detection', `Expected collision error, got: ${collError}`)
    }

  } catch (err: any) {
    console.error('CAUGHT IN SUITE:', err.stack || err)
    logFail('SUITE-UNHANDLED', 'Unhandled exception during suite', err.message)
  } finally {
    // Zero residual test data cleanup
    try {
      for (const rId of cleanup.rates) {
        await deleteSalesRate(orgA, rId)
      }
      for (const cId of cleanup.categories) {
        await deletePricingCategory(orgA, cId)
      }
      for (const aId of cleanup.assignments) {
        await deleteCustomerCategoryAssignment(orgA, aId)
      }
      for (const lId of cleanup.levels) {
        await deleteCustomerLevel(orgA, lId)
      }
      for (const rlId of cleanup.rules) {
        await deleteCustomerLevelRule(orgA, rlId)
      }
      for (const claId of cleanup.levelAssignments) {
        await supabase.from('customer_level_assignments').delete().eq('id', claId)
      }
      for (const eId of cleanup.estimates) {
        await supabase.from('token_sales_estimates').delete().eq('id', eId)
      }
      for (const iId of cleanup.invoices) {
        await supabase.from('token_sales_invoices').delete().eq('id', iId)
      }
      for (const pId of cleanup.partners) {
        await supabase.from('partners').delete().eq('id', pId)
      }
      for (const mId of cleanup.models) {
        await supabase.from('token_models').delete().eq('id', mId)
      }
    } catch (cleanErr: any) {
      console.error('Cleanup error:', cleanErr.message)
    }
  }

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length

  return {
    summary: { total: results.length, passed, failed },
    results
  }
}
