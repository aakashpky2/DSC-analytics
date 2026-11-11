import { Router, Request, Response } from 'express'
import {
  DscCommissionTransaction,
  getCommissionTransactions,
  saveCommissionTransaction,
} from '../dscCommissionStore'
import {
  resolveDscCommission,
  createCommissionTransaction,
  CommissionResolutionRequest,
} from '../dscCommissionEngine'
import { getDscRates, getCategoryAdditionalCharges } from '../dscMasterStore'
import { queryAll, queryOne } from '../supabase'

export const dscIssuanceRouter = Router()

function getSessionUser(req: Request) {
  return (req as any).user
}

function requireAuth(req: Request, res: Response, next: any) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
  }
  next()
}

// ----------------------------------------------------------------------------
// 1. GET INITIAL ISSUANCE LOOKUP DATA
// ----------------------------------------------------------------------------
// Returns active company profiles, partners where is_dsc_partner=true, and available support fee charges
dscIssuanceRouter.get('/dsc/issuance/init-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    // 1. Company internal profiles
    const profiles = await queryAll<any>(
      'SELECT id, legal_name, trade_name, is_default, is_active FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true ORDER BY is_default DESC, legal_name ASC',
      [orgId]
    )

    // 2. DSC Partners (is_dsc_partner = true or type in ('dsc_partner', 'both', 'associate_partner', 'master_distributor'))
    const allPartners = await queryAll<any>(
      "SELECT id, partner_code, company_name, contact_person, email, phone, type, is_token_customer, is_dsc_partner FROM partners WHERE organization_id = ? AND status = 'active' ORDER BY company_name ASC",
      [orgId]
    )
    const dscPartners = allPartners.filter(
      (p) =>
        p.is_dsc_partner === true ||
        p.type === 'dsc_partner' ||
        p.type === 'both' ||
        p.type === 'associate_partner' ||
        p.type === 'master_distributor'
    )

    // 3. Configured support fee options from additional charges master
    const allCharges = await getCategoryAdditionalCharges()
    const supportFees = allCharges
      .filter((c: any) => c.is_active !== 0 && c.charge_name?.toLowerCase().includes('support'))
      .map((c: any) => ({
        id: c.id,
        name: c.charge_name,
        base_rate: Number(c.base_rate || 0),
        gst_value: Number(c.gst_value || 18),
        gst_type: c.gst_type || 'PERCENTAGE',
        description: c.description,
      }))

    return res.json({
      profiles,
      partners: dscPartners,
      supportFees,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 2. AUTO-RESOLVE PRICING & COMMISSION FOR ISSUANCE SELECTIONS
// ----------------------------------------------------------------------------
dscIssuanceRouter.post('/dsc/issuance/resolve-pricing', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      partner_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      quantity = 1,
      apply_support_fee = false,
      support_fee_applicable,
      support_fee_id,
      charge_id,
      custom_support_fee_base,
      issuance_date,
      date,
    } = req.body

    if (!partner_id || !company_id || !product_id) {
      return res.status(400).json({
        error: 'partner_id, company_id, and product_id are required to resolve pricing.',
      })
    }

    const isSupportFeeOn = Boolean(apply_support_fee || support_fee_applicable)
    const effectiveChargeId = charge_id || support_fee_id
    const targetDate = issuance_date || date || new Date().toISOString().split('T')[0]
    const qty = Number(quantity) > 0 ? Number(quantity) : 1

    // 1. Resolve Base Selling Rate from DSC Master Rates
    const rates = await getDscRates({
      company_id,
      product_id,
      class_id,
      validity_id,
      date: targetDate,
    })

    const primaryRate = rates.length > 0 ? rates[0] : null
    const baseSellingPrice = primaryRate ? Number(primaryRate.base_rate) : 0
    const gstPct = primaryRate
      ? primaryRate.gst_type === 'PERCENTAGE'
        ? Number(primaryRate.gst_value)
        : 18
      : 18

    // 2. Resolve Support Fee base amount if applicable
    let supportFeeBase = 0
    if (isSupportFeeOn) {
      if (custom_support_fee_base !== undefined && custom_support_fee_base !== null) {
        supportFeeBase = Number(custom_support_fee_base)
      } else if (effectiveChargeId) {
        const allCharges = await getCategoryAdditionalCharges()
        const matchedCharge = allCharges.find((c: any) => c.id === effectiveChargeId)
        if (matchedCharge) {
          supportFeeBase = Number(matchedCharge.base_rate || 0)
        }
      }
    }

    // 3. Resolve DSC Commission & Payout using DSC Commission Engine
    const resolution = await resolveDscCommission({
      organizationId: orgId,
      companyProfileId: company_profile_id || null,
      partnerId: partner_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id || null,
      validityId: validity_id || null,
      sellingBaseRate: baseSellingPrice,
      gstRate: gstPct,
      date: targetDate,
      supportFeeBaseAmount: supportFeeBase,
      customQuantity: qty,
    })

    const baseAmount = Number((baseSellingPrice * qty).toFixed(2))
    const gstAmount = Number(((baseAmount * gstPct) / 100).toFixed(2))
    const grossAmount = Number((baseAmount + gstAmount).toFixed(2))

    return res.json({
      success: true,
      master_rate_found: primaryRate !== null,
      rate_id: primaryRate ? primaryRate.id : null,
      selling_base_rate: baseSellingPrice,
      base_amount: baseAmount,
      gst_rate: gstPct,
      gst_amount: gstAmount,
      gross_amount: grossAmount,
      provider_payout_amount: resolution.providerPayoutAmount,
      calculated_commission: resolution.calculatedCommission,
      support_fee_commission: resolution.supportFeeCommission,
      total_partner_payout: resolution.totalPartnerPayout,
      net_retained_margin: resolution.netRetainedMargin,
      pricing: {
        unit_base_price: baseSellingPrice,
        gst_rate: gstPct,
        unit_gst_amount: Number(((baseSellingPrice * gstPct) / 100).toFixed(2)),
        unit_gross_price: Number((baseSellingPrice * (1 + gstPct / 100)).toFixed(2)),
        total_base_price: baseAmount,
        total_gross_price: Number(resolution.totalSellingPrice.toFixed(2)),
        quantity: qty,
      },
      support_fee: {
        applicable: isSupportFeeOn,
        unit_support_fee_base: supportFeeBase,
        total_support_fee_base: Number((supportFeeBase * qty).toFixed(2)),
        support_fee_commission: resolution.supportFeeCommission,
      },
      commission: {
        provider_payout_amount: resolution.providerPayoutAmount,
        partner_commission: resolution.calculatedCommission,
        support_fee_commission: resolution.supportFeeCommission,
        total_partner_payout: resolution.totalPartnerPayout,
        net_retained_margin: resolution.netRetainedMargin,
        hierarchy_level: resolution.commissionHierarchyLevel,
        commission_type: resolution.commissionType,
        commission_value: resolution.commissionValue,
        calculation_basis: resolution.calculationBasis,
        applied_config_id: resolution.appliedCommissionConfigId,
      },
      margin_warning: resolution.marginWarning,
      margin_warning_amount: resolution.marginWarningAmount,
      margin_warning_message: resolution.marginWarningMessage,
      explanation: resolution.explanation,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 3. POST DAILY ISSUANCE ENTRY (Record & Freeze Commercial Snapshot)
// ----------------------------------------------------------------------------
dscIssuanceRouter.post('/dsc/issuance/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      partner_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      quantity = 1,
      apply_support_fee = false,
      support_fee_applicable,
      support_fee_id,
      charge_id,
      custom_support_fee_base,
      issuance_date,
      override_warning = false,
      override_reason,
    } = req.body

    // Mandatory validation
    if (!company_profile_id) {
      return res.status(400).json({ error: 'Company Profile selection is mandatory.' })
    }
    if (!partner_id) {
      return res.status(400).json({ error: 'Partner selection is mandatory.' })
    }
    if (!company_id || !product_id) {
      return res.status(400).json({ error: 'DSC Provider and DSC Product are mandatory.' })
    }

    const qty = parseInt(String(quantity), 10)
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' })
    }

    const isSupportFeeOn = Boolean(apply_support_fee || support_fee_applicable)
    const effectiveChargeId = charge_id || support_fee_id
    const targetDate = issuance_date || new Date().toISOString().split('T')[0]

    // Verify profile belongs to current organization
    const profile = await queryOne<any>(
      'SELECT id, legal_name, organization_id FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?',
      [company_profile_id, orgId]
    )
    if (!profile) {
      return res.status(400).json({ error: 'Invalid or inaccessible Company Profile selected.' })
    }

    // Verify partner is active and is a DSC partner
    const partner = await queryOne<any>(
      'SELECT id, partner_code, company_name, type, is_dsc_partner, organization_id FROM partners WHERE id = ? AND organization_id = ?',
      [partner_id, orgId]
    )
    if (!partner) {
      return res.status(400).json({ error: 'Selected partner does not exist in this organization.' })
    }

    // 1. Resolve master selling price
    const rates = await getDscRates({
      company_id,
      product_id,
      class_id,
      validity_id,
      date: targetDate,
    })
    const primaryRate = rates.length > 0 ? rates[0] : null
    const baseSellingPrice = primaryRate ? Number(primaryRate.base_rate) : 0
    const gstPct = primaryRate
      ? primaryRate.gst_type === 'PERCENTAGE'
        ? Number(primaryRate.gst_value)
        : 18
      : 18

    // 2. Resolve Support Fee base
    let supportFeeBase = 0
    if (isSupportFeeOn) {
      if (custom_support_fee_base !== undefined && custom_support_fee_base !== null) {
        supportFeeBase = Number(custom_support_fee_base)
      } else if (effectiveChargeId) {
        const allCharges = await getCategoryAdditionalCharges()
        const matchedCharge = allCharges.find((c: any) => c.id === effectiveChargeId)
        if (matchedCharge) {
          supportFeeBase = Number(matchedCharge.base_rate || 0)
        }
      }
    }

    // 3. Resolve Commission Mechanics
    const resolution = await resolveDscCommission({
      organizationId: orgId,
      companyProfileId: company_profile_id,
      partnerId: partner_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id || null,
      validityId: validity_id || null,
      sellingBaseRate: baseSellingPrice,
      gstRate: gstPct,
      date: targetDate,
      supportFeeBaseAmount: supportFeeBase,
      customQuantity: qty,
    })

    // 4. Create Frozen Commission Transaction Snapshot with Override Guard
    const userContext = {
      ...user,
      organization_id: orgId,
      company_profile_id,
    }

    const creationResult = await createCommissionTransaction(resolution, userContext, {
      isOverrideRequested: Boolean(override_warning),
      overrideReason: override_reason,
    })

    if (!creationResult.success) {
      const isRbac = creationResult.error?.includes('Security restriction')
      return res.status(isRbac ? 403 : 400).json({
        error: creationResult.error,
        margin_warning: resolution.marginWarning,
        margin_warning_amount: resolution.marginWarningAmount,
        provider_payout: resolution.providerPayoutAmount,
        partner_payout: resolution.totalPartnerPayout,
        requires_override: resolution.marginWarning,
      })
    }

    return res.status(201).json({
      success: true,
      message: 'Daily DSC issuance entry recorded and commercial snapshot frozen.',
      transaction: creationResult.transaction,
      resolution,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 4. OPERATIONAL DAILY ISSUANCE LIST (/api/dsc/issuance/entries)
// ----------------------------------------------------------------------------
dscIssuanceRouter.get('/dsc/issuance/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      partner_id,
      company_id,
      from_date,
      to_date,
      status,
      search,
    } = req.query

    // Query immutable commission transactions
    const txns = await getCommissionTransactions(orgId, {
      partnerId: partner_id as string,
      companyId: company_id as string,
      profileId: company_profile_id && company_profile_id !== 'all' ? (company_profile_id as string) : undefined,
      fromDate: from_date as string,
      toDate: to_date as string,
      status: status as any,
    })

    // Fetch partners and internal profiles for rich join display
    const [partnersList, profilesList] = await Promise.all([
      queryAll<any>('SELECT id, partner_code, company_name FROM partners WHERE organization_id = ?', [orgId]),
      queryAll<any>('SELECT id, legal_name, trade_name FROM purchase_internal_profiles WHERE organization_id = ?', [orgId]),
    ])

    const partnerMap = new Map(partnersList.map((p) => [p.id, p]))
    const profileMap = new Map(profilesList.map((pr) => [pr.id, pr]))

    let enriched = txns.map((t) => {
      const p = partnerMap.get(t.partner_id)
      const prof = t.company_profile_id ? profileMap.get(t.company_profile_id) : null
      return {
        ...t,
        partner_name: p ? p.company_name : t.partner_id,
        partner_code: p ? p.partner_code : null,
        profile_legal_name: prof ? prof.legal_name : 'Default Profile',
      }
    })

    // Search filter across partner name, provider, transaction number
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim()
      enriched = enriched.filter(
        (t) =>
          t.transaction_number?.toLowerCase().includes(q) ||
          t.partner_name?.toLowerCase().includes(q) ||
          t.company_id?.toLowerCase().includes(q) ||
          t.product_id?.toLowerCase().includes(q)
      )
    }

    // Sort newest first
    enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return res.json({
      entries: enriched,
      totalCount: enriched.length,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 5. COMPREHENSIVE ISSUANCE & PERFORMANCE REPORTING (/api/dsc/issuance/reports)
// ----------------------------------------------------------------------------
dscIssuanceRouter.get('/dsc/issuance/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      partner_id,
      from_date,
      to_date,
      start_date,
      end_date,
      period,
      group_by = 'monthly', // 'monthly' | 'quarterly' | 'fy'
    } = req.query

    // Normalize dates based on period helper
    let filterFrom = (from_date || start_date) as string | undefined
    let filterTo = (to_date || end_date) as string | undefined
    let effectiveGroupBy = group_by

    const now = new Date()
    if (period === 'current_month') {
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      filterFrom = `${year}-${month}-01`
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
      filterTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    } else if (period === 'last_month') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const year = lastMonthDate.getFullYear()
      const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0')
      filterFrom = `${year}-${month}-01`
      const lastDay = new Date(year, lastMonthDate.getMonth() + 1, 0).getDate()
      filterTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    } else if (period === 'fy') {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-11
      const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1
      filterFrom = `${fyStartYear}-04-01`
      filterTo = `${fyStartYear + 1}-03-31`
      effectiveGroupBy = 'fy'
    }

    // Fetch valid (non-void, non-cancelled) transactions strictly for this organization
    const txns = await getCommissionTransactions(orgId, {
      partnerId: partner_id as string,
      profileId: company_profile_id && company_profile_id !== 'all' && company_profile_id !== 'ALL' ? (company_profile_id as string) : undefined,
      fromDate: filterFrom,
      toDate: filterTo,
      status: 'APPROVED', // Only completed/approved transactions count toward volume and performance
    })

    // Fetch partners and internal profiles for lookup
    const [partnersList, profilesList] = await Promise.all([
      queryAll<any>('SELECT id, partner_code, company_name FROM partners WHERE organization_id = ?', [orgId]),
      queryAll<any>('SELECT id, legal_name, trade_name FROM purchase_internal_profiles WHERE organization_id = ?', [orgId]),
    ])

    const partnerMap = new Map(partnersList.map((p) => [p.id, p]))
    const profileMap = new Map(profilesList.map((pr) => [pr.id, pr]))

    // 1. Overall Aggregates
    let totalCerts = 0
    let totalBaseSales = 0
    let totalGst = 0
    let totalGrossSales = 0
    let totalProviderPayout = 0
    let totalPartnerCommission = 0
    let totalSupportFeeCommission = 0
    let totalNetMargin = 0

    for (const t of txns) {
      const q = t.quantity || 1
      totalCerts += q
      totalBaseSales += Number(t.selling_base_rate || 0) * q
      totalGst += Number(t.gst_amount || 0) * q
      totalGrossSales += Number(t.total_selling_price || 0)
      totalProviderPayout += Number(t.provider_payout_amount || 0)
      totalPartnerCommission += Number(t.calculated_commission || 0)
      totalSupportFeeCommission += Number(t.support_fee_commission || 0)
      totalNetMargin += Number(t.net_retained_margin || 0)
    }

    const overallSummary = {
      total_certificates: totalCerts,
      total_base_sales: Number(totalBaseSales.toFixed(2)),
      total_gst: Number(totalGst.toFixed(2)),
      total_gross_sales: Number(totalGrossSales.toFixed(2)),
      total_provider_payout: Number(totalProviderPayout.toFixed(2)),
      total_partner_commission: Number(totalPartnerCommission.toFixed(2)),
      total_support_fee_commission: Number(totalSupportFeeCommission.toFixed(2)),
      total_net_margin: Number(totalNetMargin.toFixed(2)),
      average_commission_per_cert: totalCerts > 0 ? Number(((totalPartnerCommission + totalSupportFeeCommission) / totalCerts).toFixed(2)) : 0,
      average_sales_per_cert: totalCerts > 0 ? Number((totalGrossSales / totalCerts).toFixed(2)) : 0,
    }

    // 2. Periodic Aggregation (Monthly / Indian FY)
    const periodicMap = new Map<string, any>()
    for (const t of txns) {
      const d = new Date(t.transaction_date)
      let periodKey = ''
      if (group_by === 'fy') {
        // Indian FY: 1 April - 31 March
        const m = d.getMonth() // 0-11
        const y = d.getFullYear()
        const fyStart = m >= 3 ? y : y - 1
        periodKey = `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`
      } else {
        // Month-Year (e.g. "Apr 2026")
        periodKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      }

      if (!periodicMap.has(periodKey)) {
        periodicMap.set(periodKey, {
          period: periodKey,
          certificates: 0,
          base_sales: 0,
          gst: 0,
          gross_sales: 0,
          provider_payout: 0,
          partner_commission: 0,
          net_margin: 0,
        })
      }

      const pEntry = periodicMap.get(periodKey)
      const q = t.quantity || 1
      pEntry.certificates += q
      pEntry.base_sales += Number(t.selling_base_rate || 0) * q
      pEntry.gst += Number(t.gst_amount || 0) * q
      pEntry.gross_sales += Number(t.total_selling_price || 0)
      pEntry.provider_payout += Number(t.provider_payout_amount || 0)
      pEntry.partner_commission += Number(t.total_partner_payout || 0)
      pEntry.net_margin += Number(t.net_retained_margin || 0)
    }

    // 3. Partner-wise Breakdown
    const partnerSummaryMap = new Map<string, any>()
    for (const t of txns) {
      const pId = t.partner_id
      const pInfo = partnerMap.get(pId)
      const pName = pInfo ? pInfo.company_name : pId

      if (!partnerSummaryMap.has(pId)) {
        partnerSummaryMap.set(pId, {
          partner_id: pId,
          partner_name: pName,
          certificates: 0,
          sales: 0,
          commission: 0,
          margin: 0,
        })
      }
      const entry = partnerSummaryMap.get(pId)
      entry.certificates += t.quantity || 1
      entry.sales += Number(t.total_selling_price || 0)
      entry.commission += Number(t.total_partner_payout || 0)
      entry.margin += Number(t.net_retained_margin || 0)
    }

    // 4. Provider-wise Breakdown
    const providerSummaryMap = new Map<string, any>()
    for (const t of txns) {
      const coId = t.company_id
      if (!providerSummaryMap.has(coId)) {
        providerSummaryMap.set(coId, {
          company_id: coId,
          certificates: 0,
          sales: 0,
          provider_payout: 0,
          partner_commission: 0,
          margin: 0,
        })
      }
      const entry = providerSummaryMap.get(coId)
      entry.certificates += t.quantity || 1
      entry.sales += Number(t.total_selling_price || 0)
      entry.provider_payout += Number(t.provider_payout_amount || 0)
      entry.partner_commission += Number(t.total_partner_payout || 0)
      entry.margin += Number(t.net_retained_margin || 0)
    }

    // 5. Product-wise Breakdown
    const productSummaryMap = new Map<string, any>()
    for (const t of txns) {
      const prodId = t.product_id
      if (!productSummaryMap.has(prodId)) {
        productSummaryMap.set(prodId, {
          product_id: prodId,
          certificates: 0,
          sales: 0,
          commission: 0,
          margin: 0,
        })
      }
      const entry = productSummaryMap.get(prodId)
      entry.certificates += t.quantity || 1
      entry.sales += Number(t.total_selling_price || 0)
      entry.commission += Number(t.total_partner_payout || 0)
      entry.margin += Number(t.net_retained_margin || 0)
    }

    // 6. Profile-wise Breakdown
    const profileSummaryMap = new Map<string, any>()
    for (const t of txns) {
      const profId = t.company_profile_id || 'default'
      const profInfo = profileMap.get(profId)
      const profName = profInfo ? profInfo.legal_name : 'Default Profile'

      if (!profileSummaryMap.has(profId)) {
        profileSummaryMap.set(profId, {
          profile_id: profId,
          profile_name: profName,
          certificates: 0,
          sales: 0,
          commission: 0,
          margin: 0,
        })
      }
      const entry = profileSummaryMap.get(profId)
      entry.certificates += t.quantity || 1
      entry.sales += Number(t.total_selling_price || 0)
      entry.commission += Number(t.total_partner_payout || 0)
      entry.margin += Number(t.net_retained_margin || 0)
    }

    return res.json({
      overall: overallSummary,
      summary: {
        total_certificates: overallSummary.total_certificates,
        total_transactions: txns.length,
        total_base_amount: overallSummary.total_base_sales,
        total_gst_amount: overallSummary.total_gst,
        total_gross_amount: overallSummary.total_gross_sales,
        total_provider_payout: overallSummary.total_provider_payout,
        total_calculated_commission: overallSummary.total_partner_commission,
        total_support_fee_commission: overallSummary.total_support_fee_commission,
        total_partner_payout: overallSummary.total_partner_commission + overallSummary.total_support_fee_commission,
        net_retained_margin: overallSummary.total_net_margin,
      },
      filter: {
        period: period || 'custom',
        start_date: filterFrom,
        end_date: filterTo,
        company_profile_id: company_profile_id || 'ALL',
      },
      periodic_trends: Array.from(periodicMap.values()),
      partner_summary: Array.from(partnerSummaryMap.values()),
      provider_summary: Array.from(providerSummaryMap.values()),
      product_summary: Array.from(productSummaryMap.values()),
      profile_summary: Array.from(profileSummaryMap.values()),
      breakdowns: {
        by_partner: Array.from(partnerSummaryMap.values()).map((p) => ({
          ...p,
          base_amount: p.sales,
          gross_amount: p.sales,
          partner_payout: p.commission,
          net_margin: p.margin,
        })),
        by_provider: Array.from(providerSummaryMap.values()).map((p) => ({
          ...p,
          base_amount: p.sales,
          gross_amount: p.sales,
          partner_payout: p.partner_commission,
          net_margin: p.margin,
        })),
        by_product: Array.from(productSummaryMap.values()).map((p) => ({
          ...p,
          base_amount: p.sales,
          gross_amount: p.sales,
          partner_payout: p.commission,
          net_margin: p.margin,
        })),
        by_profile: Array.from(profileSummaryMap.values()).map((p) => ({
          ...p,
          legal_name: p.profile_name,
          base_amount: p.sales,
          gross_amount: p.sales,
          partner_payout: p.commission,
          net_margin: p.margin,
        })),
      },
      total_transactions_evaluated: txns.length,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})
