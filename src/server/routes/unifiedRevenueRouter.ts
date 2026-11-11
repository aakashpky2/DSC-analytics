import { Router, Request, Response, NextFunction } from 'express'
import {
  getUserVisibilityScope,
  saveUserVisibilityScope,
  deleteUserVisibilityScope,
  resolveUserDataScope,
  filterRecordsByVisibilityScope,
  UserVisibilityScopeConfig,
} from '../userDataVisibilityControl'
import { getDscApplications } from '../dscDirectIssuanceStore'
import { getCommissionTransactions } from '../dscCommissionStore'
import { queryAll, queryOne } from '../supabase'
import { getDscCompanies, getDscProducts } from '../dscMasterStore'

export const unifiedRevenueRouter = Router()

function getSessionUser(req: Request) {
  return (req as any).user
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
  }
  next()
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Please sign in.' })
  }
  const isSuperAdmin =
    user.role_id === 'role-super-admin' ||
    user.hierarchy_level_id === 'tier-0' ||
    user.hierarchy_level_order === 0
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' })
  }
  next()
}

// ----------------------------------------------------------------------------
// 1. USER VISIBILITY SCOPES MANAGEMENT (Admin Only)
// ----------------------------------------------------------------------------

unifiedRevenueRouter.get('/admin/visibility-scopes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    const [users, profiles, states, categories, customers] = await Promise.all([
      queryAll<any>('SELECT id, full_name, email, role_id FROM user_profiles WHERE organization_id = ? ORDER BY full_name ASC', [orgId]),
      queryAll<any>('SELECT id, legal_name, is_default FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true ORDER BY legal_name ASC', [orgId]),
      queryAll<any>('SELECT DISTINCT state_code, state_name FROM billing_master_states WHERE state_code IS NOT NULL ORDER BY state_name ASC', []),
      queryAll<any>('SELECT id, category_name, category_code FROM customer_pricing_categories WHERE organization_id = ? ORDER BY category_name ASC', [orgId]),
      queryAll<any>('SELECT id, company_name, partner_code, state_code FROM partners WHERE organization_id = ? ORDER BY company_name ASC', [orgId]),
    ])

    return res.json({
      users,
      profiles,
      states,
      categories,
      customers,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

unifiedRevenueRouter.get('/admin/visibility-scopes/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const scope = await getUserVisibilityScope(orgId, req.params.userId as string as string)
    return res.json({ scope })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

unifiedRevenueRouter.post('/admin/visibility-scopes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      user_id,
      all_profiles_access = false,
      assigned_profile_ids = [],
      assigned_state_codes = [],
      assigned_customer_ids = [],
      assigned_category_ids = [],
      can_view_revenue = true,
      notes,
    } = req.body

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' })
    }

    const config: UserVisibilityScopeConfig = {
      id: `scope-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      user_id,
      all_profiles_access: Boolean(all_profiles_access),
      assigned_profile_ids: Array.isArray(assigned_profile_ids) ? assigned_profile_ids : [],
      assigned_state_codes: Array.isArray(assigned_state_codes) ? assigned_state_codes : [],
      assigned_customer_ids: Array.isArray(assigned_customer_ids) ? assigned_customer_ids : [],
      assigned_category_ids: Array.isArray(assigned_category_ids) ? assigned_category_ids : [],
      can_view_revenue: Boolean(can_view_revenue),
      notes: notes || '',
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveUserVisibilityScope(config)
    return res.json({ success: true, scope: config })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

unifiedRevenueRouter.delete('/admin/visibility-scopes/:userId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    await deleteUserVisibilityScope(orgId, req.params.userId as string)
    return res.json({ success: true, message: 'Visibility scope reset to default.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 2. UNIFIED REVENUE DASHBOARD API (/api/reports/revenue)
// ----------------------------------------------------------------------------

unifiedRevenueRouter.get('/reports/revenue', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const scope = await resolveUserDataScope(user)

    // Check revenue permission
    if (!scope.canViewRevenue) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to view revenue analytics.' })
    }

    const {
      period = 'current_month',
      from_date,
      to_date,
      company_profile_id,
      group_by = 'month',
    } = req.query

    // Determine authorized profiles for the dropdown
    const orgProfiles = await queryAll<any>(
      'SELECT id, legal_name, is_default FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true ORDER BY legal_name ASC',
      [scope.organizationId]
    )

    // Accessible profiles subset for this user
    const accessibleProfiles = orgProfiles.filter((p) => scope.allowedProfileIds.includes(p.id))

    // Profile security check: If client requested a specific profile, verify it is allowed
    let selectedProfileId: string | null = null
    if (company_profile_id && company_profile_id !== 'ALL' && company_profile_id !== 'all') {
      if (!scope.allowedProfileIds.includes(company_profile_id as string)) {
        return res.status(403).json({
          error: 'Access denied. You are not authorized to view revenue for the requested company profile.',
        })
      }
      selectedProfileId = company_profile_id as string
    }

    // Determine start and end dates
    const now = new Date()
    let startDate = from_date as string
    let endDate = to_date as string

    if (period === 'today') {
      const d = now.toISOString().split('T')[0]
      startDate = d
      endDate = d
    } else if (period === 'this_week') {
      const day = now.getDay() || 7 // Mon = 1, Sun = 7
      const mon = new Date(now)
      mon.setDate(now.getDate() - day + 1)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      startDate = mon.toISOString().split('T')[0]
      endDate = sun.toISOString().split('T')[0]
    } else if (period === 'current_month') {
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      startDate = `${y}-${m}-01`
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
      endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
    } else if (period === 'last_month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const y = prev.getFullYear()
      const m = String(prev.getMonth() + 1).padStart(2, '0')
      startDate = `${y}-${m}-01`
      const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate()
      endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
    } else if (period === 'fy' || period === 'current_fy') {
      const curYear = now.getFullYear()
      const curMonth = now.getMonth()
      const fyStart = curMonth >= 3 ? curYear : curYear - 1
      startDate = `${fyStart}-04-01`
      endDate = `${fyStart + 1}-03-31`
    } else if (period === 'prev_fy') {
      const curYear = now.getFullYear()
      const curMonth = now.getMonth()
      const fyStart = curMonth >= 3 ? curYear - 1 : curYear - 2
      startDate = `${fyStart}-04-01`
      endDate = `${fyStart + 1}-03-31`
    }

    // Fetch transactions and direct applications
    const [allDirectApps, allCommTxns, parties, companies, products] = await Promise.all([
      getDscApplications(scope.organizationId),
      getCommissionTransactions(scope.organizationId),
      queryAll<any>('SELECT id, company_name, partner_code, state_code, type FROM partners WHERE organization_id = ?', [scope.organizationId]),
      getDscCompanies(),
      getDscProducts(),
    ])

    const partyMap = new Map(parties.map((p) => [p.id, p]))
    const companyMap = new Map(companies.map((c) => [c.id, c.company_name || c.name]))
    const productMap = new Map(products.map((pr) => [pr.id, pr.product_name || pr.name]))

    // 1. Filter DSC Direct Applications by user visibility scope
    let scopedDirectApps = await filterRecordsByVisibilityScope(allDirectApps, scope)
    // 2. Filter DSC Commission Transactions by user visibility scope
    let scopedCommTxns = await filterRecordsByVisibilityScope(allCommTxns, scope)

    // Apply specific profile filter if selected
    if (selectedProfileId) {
      scopedDirectApps = scopedDirectApps.filter((a) => a.company_profile_id === selectedProfileId)
      scopedCommTxns = scopedCommTxns.filter((t) => t.company_profile_id === selectedProfileId)
    }

    // Date filtering
    if (startDate) {
      scopedDirectApps = scopedDirectApps.filter((a) => a.application_date >= startDate)
      scopedCommTxns = scopedCommTxns.filter((t) => (t.transaction_date || '').split('T')[0] >= startDate)
    }
    if (endDate) {
      scopedDirectApps = scopedDirectApps.filter((a) => a.application_date <= endDate)
      scopedCommTxns = scopedCommTxns.filter((t) => (t.transaction_date || '').split('T')[0] <= endDate)
    }

    // ------------------------------------------------------------------------
    // REVENUE AGGREGATION ENGINE
    // ------------------------------------------------------------------------
    let totalCertsIssued = 0
    let totalBaseRevenue = 0
    let totalGstRevenue = 0
    let totalGrossRevenue = 0
    let totalAssociateCommissions = 0
    let totalNormalPartnerCommissions = 0
    let totalProviderPayouts = 0
    let totalNetRevenue = 0

    let activeApplicationsCount = 0
    let pendingApplicationsCount = 0
    let completedApplicationsCount = 0

    // Direct Issuance applications processing
    for (const app of scopedDirectApps) {
      const q = app.quantity || 1
      if (app.status === 'ISSUED' || app.status === 'COMPLETED') {
        completedApplicationsCount += 1
        totalCertsIssued += q
        totalBaseRevenue += Number(app.base_amount || 0)
        totalGstRevenue += Number(app.gst_amount || 0)
        totalGrossRevenue += Number(app.total_amount || 0)

        // Fulfillment differentiation
        if (app.fulfillment_channel === 'ASSOCIATE_PARTNER') {
          if (app.fulfillment_model === 'COMMISSION') {
            const comm = Number(app.associate_commission_amount || 0)
            totalAssociateCommissions += comm
            totalNetRevenue += Number(app.base_amount || 0) - comm
          } else {
            // RESELLING_B2B: associate is billed directly, no commission payout
            totalNetRevenue += Number(app.base_amount || 0)
          }
        } else {
          // Direct Sale
          totalNetRevenue += Number(app.base_amount || 0)
        }
      } else if (app.status === 'CANCELLED') {
        // Ignored in active pipeline
      } else {
        // In Progress / Pending
        activeApplicationsCount += 1
        pendingApplicationsCount += 1
      }
    }

    // Normal Partner Commission Transactions processing
    for (const tx of scopedCommTxns) {
      const q = tx.quantity || 1
      totalCertsIssued += q
      const baseRev = Number(tx.selling_base_rate || 0) * q
      const gstRev = Number(tx.gst_amount || 0) * q
      const grossRev = Number(tx.total_selling_price || 0)
      const payout = Number(tx.provider_payout_amount || 0)
      const comm = Number(tx.total_partner_payout || 0)

      totalBaseRevenue += baseRev
      totalGstRevenue += gstRev
      totalGrossRevenue += grossRev
      totalProviderPayouts += payout
      totalNormalPartnerCommissions += comm
      totalNetRevenue += Number(tx.net_retained_margin || (baseRev - payout - comm))
    }

    const totalCommissions = totalAssociateCommissions + totalNormalPartnerCommissions
    const averageRevenuePerCert = totalCertsIssued > 0 ? Number((totalBaseRevenue / totalCertsIssued).toFixed(2)) : 0
    const averageSellingPrice = totalCertsIssued > 0 ? Number((totalGrossRevenue / totalCertsIssued).toFixed(2)) : 0

    const kpiSummary = {
      total_certificates_issued: totalCertsIssued,
      total_base_revenue: Number(totalBaseRevenue.toFixed(2)),
      total_gst: Number(totalGstRevenue.toFixed(2)),
      total_gross_revenue: Number(totalGrossRevenue.toFixed(2)),
      total_associate_commissions: Number(totalAssociateCommissions.toFixed(2)),
      total_normal_partner_commissions: Number(totalNormalPartnerCommissions.toFixed(2)),
      total_commissions: Number(totalCommissions.toFixed(2)),
      total_provider_payouts: Number(totalProviderPayouts.toFixed(2)),
      net_retained_revenue: Number(totalNetRevenue.toFixed(2)),
      average_revenue_per_cert: averageRevenuePerCert,
      average_selling_price: averageSellingPrice,
      active_applications_count: activeApplicationsCount,
      pending_applications_count: pendingApplicationsCount,
      completed_applications_count: completedApplicationsCount,
    }

    // ------------------------------------------------------------------------
    // REVENUE TREND (Monthly / Daily / FY)
    // ------------------------------------------------------------------------
    const trendMap = new Map<string, { label: string; dateSort: string; gross: number; net: number; certificates: number }>()

    const addToTrend = (dateStr: string, gross: number, net: number, qty: number) => {
      if (!dateStr) return
      const d = new Date(dateStr)
      let label = ''
      let dateSort = ''

      if (group_by === 'day') {
        label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        dateSort = dateStr.slice(0, 10)
      } else if (group_by === 'fy') {
        const m = d.getMonth()
        const y = d.getFullYear()
        const fy = m >= 3 ? y : y - 1
        label = `FY ${fy}-${String(fy + 1).slice(-2)}`
        dateSort = `${fy}-04-01`
      } else {
        // Month
        label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
        dateSort = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      }

      if (!trendMap.has(dateSort)) {
        trendMap.set(dateSort, { label, dateSort, gross: 0, net: 0, certificates: 0 })
      }
      const entry = trendMap.get(dateSort)!
      entry.gross += gross
      entry.net += net
      entry.certificates += qty
    }

    for (const app of scopedDirectApps) {
      if (app.status === 'ISSUED' || app.status === 'COMPLETED') {
        let net = Number(app.base_amount || 0)
        if (app.fulfillment_channel === 'ASSOCIATE_PARTNER' && app.fulfillment_model === 'COMMISSION') {
          net -= Number(app.associate_commission_amount || 0)
        }
        addToTrend(app.application_date, Number(app.total_amount || 0), net, app.quantity || 1)
      }
    }

    for (const tx of scopedCommTxns) {
      const q = tx.quantity || 1
      const gross = Number(tx.total_selling_price || 0)
      const net = Number(tx.net_retained_margin || 0)
      addToTrend((tx.transaction_date || '').split('T')[0], gross, net, q)
    }

    const revenueTrend = Array.from(trendMap.values())
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort))
      .map((t) => ({
        label: t.label,
        gross_revenue: Number(t.gross.toFixed(2)),
        net_revenue: Number(t.net.toFixed(2)),
        certificates: t.certificates,
      }))

    // ------------------------------------------------------------------------
    // PRODUCT BREAKDOWN
    // ------------------------------------------------------------------------
    const productBreakdownMap = new Map<string, any>()
    const addToProduct = (prodId: string, qty: number, base: number, gst: number, gross: number, net: number) => {
      const pName = productMap.get(prodId) || prodId
      if (!productBreakdownMap.has(prodId)) {
        productBreakdownMap.set(prodId, {
          product_id: prodId,
          product_name: pName,
          quantity: 0,
          base_revenue: 0,
          gst: 0,
          gross_revenue: 0,
          net_revenue: 0,
        })
      }
      const item = productBreakdownMap.get(prodId)
      item.quantity += qty
      item.base_revenue += base
      item.gst += gst
      item.gross_revenue += gross
      item.net_revenue += net
    }

    for (const a of scopedDirectApps) {
      if (a.status === 'ISSUED' || a.status === 'COMPLETED') {
        let net = Number(a.base_amount || 0)
        if (a.fulfillment_channel === 'ASSOCIATE_PARTNER' && a.fulfillment_model === 'COMMISSION') {
          net -= Number(a.associate_commission_amount || 0)
        }
        addToProduct(a.product_id, a.quantity || 1, Number(a.base_amount || 0), Number(a.gst_amount || 0), Number(a.total_amount || 0), net)
      }
    }

    for (const t of scopedCommTxns) {
      const q = t.quantity || 1
      const base = Number(t.selling_base_rate || 0) * q
      const gst = Number(t.gst_amount || 0) * q
      const gross = Number(t.total_selling_price || 0)
      const net = Number(t.net_retained_margin || 0)
      addToProduct(t.product_id, q, base, gst, gross, net)
    }

    // ------------------------------------------------------------------------
    // PROVIDER / CA BREAKDOWN
    // ------------------------------------------------------------------------
    const providerBreakdownMap = new Map<string, any>()
    const addToProvider = (
      compId: string,
      qty: number,
      base: number,
      gst: number,
      gross: number,
      payout: number,
      commission: number,
      net: number
    ) => {
      const cName = companyMap.get(compId) || compId
      if (!providerBreakdownMap.has(compId)) {
        providerBreakdownMap.set(compId, {
          company_id: compId,
          company_name: cName,
          certificates: 0,
          base_revenue: 0,
          gst: 0,
          gross_revenue: 0,
          provider_payout: 0,
          partner_commission: 0,
          net_revenue: 0,
        })
      }
      const item = providerBreakdownMap.get(compId)
      item.certificates += qty
      item.base_revenue += base
      item.gst += gst
      item.gross_revenue += gross
      item.provider_payout += payout
      item.partner_commission += commission
      item.net_revenue += net
    }

    for (const a of scopedDirectApps) {
      if (a.status === 'ISSUED' || a.status === 'COMPLETED') {
        let comm = 0
        if (a.fulfillment_channel === 'ASSOCIATE_PARTNER' && a.fulfillment_model === 'COMMISSION') {
          comm = Number(a.associate_commission_amount || 0)
        }
        const net = Number(a.base_amount || 0) - comm
        addToProvider(a.company_id, a.quantity || 1, Number(a.base_amount || 0), Number(a.gst_amount || 0), Number(a.total_amount || 0), 0, comm, net)
      }
    }

    for (const t of scopedCommTxns) {
      const q = t.quantity || 1
      const base = Number(t.selling_base_rate || 0) * q
      const gst = Number(t.gst_amount || 0) * q
      const gross = Number(t.total_selling_price || 0)
      const payout = Number(t.provider_payout_amount || 0)
      const comm = Number(t.total_partner_payout || 0)
      const net = Number(t.net_retained_margin || 0)
      addToProvider(t.company_id, q, base, gst, gross, payout, comm, net)
    }

    // ------------------------------------------------------------------------
    // CUSTOMER BREAKDOWN
    // ------------------------------------------------------------------------
    const customerBreakdownMap = new Map<string, any>()
    for (const a of scopedDirectApps) {
      if (a.status === 'ISSUED' || a.status === 'COMPLETED') {
        const cId = a.client_id
        if (!customerBreakdownMap.has(cId)) {
          const pt = partyMap.get(cId)
          customerBreakdownMap.set(cId, {
            customer_id: cId,
            customer_name: pt ? pt.company_name : cId,
            partner_code: pt ? pt.partner_code : '',
            state_code: pt ? pt.state_code : '',
            certificates: 0,
            revenue: 0,
          })
        }
        const item = customerBreakdownMap.get(cId)
        item.certificates += a.quantity || 1
        item.revenue += Number(a.total_amount || 0)
      }
    }

    const topCustomers = Array.from(customerBreakdownMap.values())
      .map((c) => ({
        ...c,
        revenue: Number(c.revenue.toFixed(2)),
        average_value: c.certificates > 0 ? Number((c.revenue / c.certificates).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // ------------------------------------------------------------------------
    // ASSOCIATE PARTNER BREAKDOWN
    // ------------------------------------------------------------------------
    const associateBreakdownMap = new Map<string, any>()
    for (const a of scopedDirectApps) {
      if (a.fulfillment_channel === 'ASSOCIATE_PARTNER' && a.associate_partner_id) {
        const id = a.associate_partner_id
        if (!associateBreakdownMap.has(id)) {
          const pt = partyMap.get(id)
          associateBreakdownMap.set(id, {
            associate_partner_id: id,
            associate_partner_name: pt ? pt.company_name : id,
            partner_code: pt ? pt.partner_code : '',
            certificates: 0,
            b2b_reselling_revenue: 0,
            commission_model_transactions: 0,
            commission_model_gross: 0,
            commission_paid: 0,
            net_retained_revenue: 0,
          })
        }
        const entry = associateBreakdownMap.get(id)
        const q = a.quantity || 1
        entry.certificates += q
        if (a.fulfillment_model === 'RESELLING_B2B') {
          entry.b2b_reselling_revenue += Number(a.total_amount || 0)
          entry.net_retained_revenue += Number(a.base_amount || 0)
        } else {
          entry.commission_model_transactions += 1
          entry.commission_model_gross += Number(a.total_amount || 0)
          const comm = Number(a.associate_commission_amount || 0)
          entry.commission_paid += comm
          entry.net_retained_revenue += Number(a.base_amount || 0) - comm
        }
      }
    }

    // ------------------------------------------------------------------------
    // NORMAL DSC PARTNER BREAKDOWN
    // ------------------------------------------------------------------------
    const normalPartnerBreakdownMap = new Map<string, any>()
    for (const t of scopedCommTxns) {
      const pId = t.partner_id
      if (!normalPartnerBreakdownMap.has(pId)) {
        const pt = partyMap.get(pId)
        normalPartnerBreakdownMap.set(pId, {
          partner_id: pId,
          partner_name: pt ? pt.company_name : pId,
          partner_code: pt ? pt.partner_code : '',
          certificates: 0,
          gross_sales: 0,
          commission_earned: 0,
          net_retained_margin: 0,
        })
      }
      const entry = normalPartnerBreakdownMap.get(pId)
      const q = t.quantity || 1
      entry.certificates += q
      entry.gross_sales += Number(t.total_selling_price || 0)
      entry.commission_earned += Number(t.total_partner_payout || 0)
      entry.net_retained_margin += Number(t.net_retained_margin || 0)
    }

    // ------------------------------------------------------------------------
    // APPLICATION PIPELINE SUMMARY
    // ------------------------------------------------------------------------
    const pipelineStages = [
      { key: 'APPLICATIONS_RECEIVED', name: 'Applications Received', count: 0 },
      { key: 'DOCS_PENDING', name: 'Documents Pending', count: 0 },
      { key: 'DOCS_VERIFIED', name: 'Documents Verified', count: 0 },
      { key: 'PAYMENT_PENDING', name: 'Payment Pending', count: 0 },
      { key: 'PROCESSING', name: 'Processing', count: 0 },
      { key: 'TOKEN_PENDING', name: 'Token Allocation Pending', count: 0 },
      { key: 'ISSUED', name: 'Issued', count: 0 },
      { key: 'COMPLETED', name: 'Completed', count: 0 },
    ]

    for (const a of scopedDirectApps) {
      if (a.status === 'ISSUED') {
        pipelineStages[6].count += 1
      } else if (a.status === 'COMPLETED') {
        pipelineStages[7].count += 1
      } else if (a.status === 'DOCS_PENDING') {
        pipelineStages[1].count += 1
      } else if (a.status === 'PAYMENT_PENDING') {
        pipelineStages[3].count += 1
      } else if (a.status === 'TOKEN_PENDING' || (!a.is_token_allocated && a.quantity > 0)) {
        pipelineStages[5].count += 1
      } else {
        pipelineStages[0].count += 1
      }
    }

    return res.json({
      success: true,
      filter: {
        period,
        startDate,
        endDate,
        company_profile_id: selectedProfileId || 'ALL',
      },
      accessibleProfiles: accessibleProfiles.map((p) => ({
        id: p.id,
        legal_name: p.legal_name,
        is_default: p.is_default,
      })),
      kpis: kpiSummary,
      revenueTrend,
      productBreakdown: Array.from(productBreakdownMap.values()).map((p) => ({
        ...p,
        base_revenue: Number(p.base_revenue.toFixed(2)),
        gst: Number(p.gst.toFixed(2)),
        gross_revenue: Number(p.gross_revenue.toFixed(2)),
        net_revenue: Number(p.net_revenue.toFixed(2)),
      })),
      providerBreakdown: Array.from(providerBreakdownMap.values()).map((p) => ({
        ...p,
        base_revenue: Number(p.base_revenue.toFixed(2)),
        gst: Number(p.gst.toFixed(2)),
        gross_revenue: Number(p.gross_revenue.toFixed(2)),
        provider_payout: Number(p.provider_payout.toFixed(2)),
        partner_commission: Number(p.partner_commission.toFixed(2)),
        net_revenue: Number(p.net_revenue.toFixed(2)),
      })),
      topCustomers,
      associatePartnerBreakdown: Array.from(associateBreakdownMap.values()).map((a) => ({
        ...a,
        b2b_reselling_revenue: Number(a.b2b_reselling_revenue.toFixed(2)),
        commission_model_gross: Number(a.commission_model_gross.toFixed(2)),
        commission_paid: Number(a.commission_paid.toFixed(2)),
        net_retained_revenue: Number(a.net_retained_revenue.toFixed(2)),
      })),
      normalPartnerBreakdown: Array.from(normalPartnerBreakdownMap.values()).map((p) => ({
        ...p,
        gross_sales: Number(p.gross_sales.toFixed(2)),
        commission_earned: Number(p.commission_earned.toFixed(2)),
        net_retained_margin: Number(p.net_retained_margin.toFixed(2)),
      })),
      pipelineStages,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 3. DRILL-DOWN TRANSACTIONS API (/api/reports/revenue/drilldown)
// ----------------------------------------------------------------------------

unifiedRevenueRouter.get('/reports/revenue/drilldown', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const scope = await resolveUserDataScope(user)

    if (!scope.canViewRevenue) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const {
      company_profile_id,
      product_id,
      provider_id,
      customer_id,
      partner_id,
      source_type, // 'DIRECT' | 'COMMISSION'
      from_date,
      to_date,
      limit = 50,
      offset = 0,
    } = req.query

    // Profile security
    if (company_profile_id && company_profile_id !== 'ALL' && company_profile_id !== 'all') {
      if (!scope.allowedProfileIds.includes(company_profile_id as string)) {
        return res.status(403).json({ error: 'Access denied to requested profile.' })
      }
    }

    let items: any[] = []

    if (!source_type || source_type === 'DIRECT') {
      let directApps = await getDscApplications(scope.organizationId)
      directApps = await filterRecordsByVisibilityScope(directApps, scope)
      if (company_profile_id && company_profile_id !== 'ALL') {
        directApps = directApps.filter((a) => a.company_profile_id === company_profile_id)
      }
      if (product_id) directApps = directApps.filter((a) => a.product_id === product_id)
      if (provider_id) directApps = directApps.filter((a) => a.company_id === provider_id)
      if (customer_id) directApps = directApps.filter((a) => a.client_id === customer_id || a.billing_party_id === customer_id)
      if (partner_id) directApps = directApps.filter((a) => a.associate_partner_id === partner_id)
      if (from_date) directApps = directApps.filter((a) => a.application_date >= (from_date as string))
      if (to_date) directApps = directApps.filter((a) => a.application_date <= (to_date as string))

      for (const a of directApps) {
        items.push({
          source_type: 'DIRECT_ISSUANCE',
          transaction_id: a.id,
          reference_number: a.application_number,
          date: a.application_date,
          company_profile_id: a.company_profile_id,
          party_id: a.client_id,
          billing_party_id: a.billing_party_id,
          fulfillment_channel: a.fulfillment_channel,
          fulfillment_model: a.fulfillment_model,
          company_id: a.company_id,
          product_id: a.product_id,
          quantity: a.quantity,
          base_amount: a.base_amount,
          gst_amount: a.gst_amount,
          total_amount: a.total_amount,
          commission_amount: a.associate_commission_amount || 0,
          status: a.status,
        })
      }
    }

    if (!source_type || source_type === 'COMMISSION') {
      let commTxns = await getCommissionTransactions(scope.organizationId)
      commTxns = await filterRecordsByVisibilityScope(commTxns, scope)
      if (company_profile_id && company_profile_id !== 'ALL') {
        commTxns = commTxns.filter((t) => t.company_profile_id === company_profile_id)
      }
      if (product_id) commTxns = commTxns.filter((t) => t.product_id === product_id)
      if (provider_id) commTxns = commTxns.filter((t) => t.company_id === provider_id)
      if (partner_id) commTxns = commTxns.filter((t) => t.partner_id === partner_id)
      if (customer_id) commTxns = commTxns.filter((t) => t.partner_id === customer_id)
      if (from_date) commTxns = commTxns.filter((t) => (t.transaction_date || '').split('T')[0] >= (from_date as string))
      if (to_date) commTxns = commTxns.filter((t) => (t.transaction_date || '').split('T')[0] <= (to_date as string))

      for (const t of commTxns) {
        items.push({
          source_type: 'NORMAL_COMMISSION',
          transaction_id: t.id,
          reference_number: t.transaction_number,
          date: (t.transaction_date || '').split('T')[0],
          company_profile_id: t.company_profile_id,
          party_id: t.partner_id,
          billing_party_id: t.partner_id,
          fulfillment_channel: 'NORMAL_DSC_PARTNER',
          fulfillment_model: 'COMMISSION',
          company_id: t.company_id,
          product_id: t.product_id,
          quantity: t.quantity,
          base_amount: Number(t.selling_base_rate || 0) * (t.quantity || 1),
          gst_amount: Number(t.gst_amount || 0) * (t.quantity || 1),
          total_amount: t.total_selling_price,
          commission_amount: t.total_partner_payout,
          status: 'COMPLETED',
        })
      }
    }

    // Sort by date descending
    items.sort((a, b) => b.date.localeCompare(a.date))
    const totalCount = items.length
    const paginated = items.slice(Number(offset), Number(offset) + Number(limit))

    return res.json({
      total: totalCount,
      limit: Number(limit),
      offset: Number(offset),
      records: paginated,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})
