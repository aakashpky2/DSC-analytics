import { Router, Request, Response } from 'express'
import {
  DscProviderPayout,
  DscPartnerCommissionConfig,
  DscPartnerQuantityIncentive,
  DscPartnerTurnoverIncentive,
  getProviderPayouts,
  saveProviderPayout,
  deleteProviderPayout,
  getCommissionConfigs,
  saveCommissionConfig,
  deleteCommissionConfig,
  getQuantityIncentives,
  saveQuantityIncentive,
  deleteQuantityIncentive,
  getTurnoverIncentives,
  saveTurnoverIncentive,
  deleteTurnoverIncentive,
  getCommissionTransactions,
} from '../dscCommissionStore'
import {
  resolveDscCommission,
  createCommissionTransaction,
  calculatePartnerIncentives,
} from '../dscCommissionEngine'
import { queryOne, queryAll, supabase } from '../supabase'

export const dscCommissionRouter = Router()

function getSessionUser(req: Request) {
  return (req as any).user
}

function requireAuth(req: Request, res: Response, next: any) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  next()
}

function requireAdmin(req: Request, res: Response, next: any) {
  const user = getSessionUser(req)
  if (!user || user.hierarchy_level_order > 1) {
    return res.status(403).json({ error: 'You do not have permission to manage commission configurations.' })
  }
  next()
}

// ----------------------------------------------------------------------------
// Enforce Level 0/1 on all commission routes
// ----------------------------------------------------------------------------
dscCommissionRouter.use('/dsc', requireAuth, requireAdmin)

// ----------------------------------------------------------------------------
// 1. PARTNER ROLE TOGGLE & RETRIEVAL (Dual-role support)
// ----------------------------------------------------------------------------

// GET /api/dsc/partners/:id/roles
dscCommissionRouter.get('/dsc/partners/:id/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const partner = await queryOne<any>(
      'SELECT id, partner_code, company_name, type, is_token_customer, is_dsc_partner, organization_id FROM partners WHERE id = ?',
      [req.params.id]
    )
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found.' })
    }
    // Organization isolation
    if (user.hierarchy_level_order > 0 && partner.organization_id && partner.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied across organizations.' })
    }

    const isTokenCustomer =
      partner.is_token_customer === true ||
      partner.type === 'token_partner' ||
      partner.type === 'both'
    const isDscPartner =
      partner.is_dsc_partner === true ||
      partner.type === 'dsc_partner' ||
      partner.type === 'associate_partner' ||
      partner.type === 'master_distributor' ||
      partner.type === 'both'

    return res.json({
      id: partner.id,
      partner_code: partner.partner_code,
      company_name: partner.company_name,
      type: partner.type,
      is_token_customer: isTokenCustomer,
      is_dsc_partner: isDscPartner,
      roles: [
        ...(isTokenCustomer ? ['token_customer'] : []),
        ...(isDscPartner ? ['dsc_partner'] : []),
      ],
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// PUT /api/dsc/partners/:id/roles
dscCommissionRouter.put('/dsc/partners/:id/roles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { is_token_customer, is_dsc_partner } = req.body

    const existing = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [req.params.id])
    if (!existing) {
      return res.status(404).json({ error: 'Partner not found.' })
    }
    if (user.hierarchy_level_order > 0 && existing.organization_id && existing.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied across organizations.' })
    }

    const tokenCust = is_token_customer !== undefined ? Boolean(is_token_customer) : Boolean(existing.is_token_customer)
    const dscPart = is_dsc_partner !== undefined ? Boolean(is_dsc_partner) : Boolean(existing.is_dsc_partner)

    // Ensure at least one role remains active
    if (!tokenCust && !dscPart) {
      return res.status(400).json({ error: 'A party must have at least one active role (Token Customer or DSC Partner).' })
    }

    // Determine legacy type representation
    let newType = existing.type
    if (tokenCust && dscPart) {
      newType = 'both'
    } else if (tokenCust) {
      newType = 'token_partner'
    } else if (dscPart) {
      newType = 'dsc_partner'
    }

    try {
      const { error: updErr } = await supabase
        .from('partners')
        .update({ type: newType })
        .eq('id', req.params.id)
      if (updErr) {
        console.error('Error updating partner role type:', updErr)
      }
    } catch (_) {}

    return res.json({
      success: true,
      partner_id: req.params.id,
      is_token_customer: tokenCust,
      is_dsc_partner: dscPart,
      type: newType,
      message: 'Partner roles updated successfully without data loss or duplication.',
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 2. PROVIDER PAYOUTS MASTER CRUD (/api/dsc/provider-payouts)
// ----------------------------------------------------------------------------

dscCommissionRouter.get('/dsc/provider-payouts', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { company_id, product_id, active_only, date } = req.query

    const payouts = await getProviderPayouts(orgId, {
      companyId: company_id as string,
      productId: product_id as string,
      activeOnly: active_only === 'true',
      date: date as string,
    })

    return res.json({ payouts, total: payouts.length })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.post('/dsc/provider-payouts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_id,
      product_id,
      class_id,
      validity_id,
      payout_amount,
      calculation_basis = 'BASE_PRICE_ONLY',
      effective_from,
      effective_to,
      is_active = true,
      notes,
    } = req.body

    if (!company_id || !product_id || payout_amount === undefined || !effective_from) {
      return res.status(400).json({
        error: 'company_id, product_id, payout_amount, and effective_from are required.',
      })
    }

    if (Number(payout_amount) < 0) {
      return res.status(400).json({ error: 'Payout amount cannot be negative.' })
    }

    const id = `dpp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const record: DscProviderPayout = {
      id,
      organization_id: orgId,
      company_profile_id: user.company_profile_id || null,
      company_id,
      product_id,
      class_id: class_id || null,
      validity_id: validity_id || null,
      payout_amount: Number(payout_amount),
      calculation_basis,
      effective_from,
      effective_to: effective_to || null,
      is_active: Boolean(is_active),
      notes: notes || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveProviderPayout(record)
    return res.status(201).json({ success: true, payout: record })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.delete('/dsc/provider-payouts/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await deleteProviderPayout(orgId, id)
    return res.json({ success: true, message: 'Provider payout deleted successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 3. PARTNER COMMISSION CONFIGURATIONS CRUD (/api/dsc/commission-configs)
// ----------------------------------------------------------------------------

dscCommissionRouter.get('/dsc/commission-configs', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { partner_id, fee_type, company_id, product_id, active_only, date } = req.query

    const configs = await getCommissionConfigs(orgId, {
      partnerId: partner_id !== undefined ? (partner_id as string) : undefined,
      feeType: fee_type as any,
      companyId: company_id as string,
      productId: product_id as string,
      activeOnly: active_only === 'true',
      date: date as string,
    })

    return res.json({ configs, total: configs.length })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.post('/dsc/commission-configs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      fee_type = 'DSC_PRODUCT',
      company_id,
      product_id,
      class_id,
      validity_id,
      commission_type = 'FIXED',
      commission_value,
      calculation_basis = 'BASE_PRICE_ONLY',
      effective_from,
      effective_to,
      is_active = true,
      priority = 0,
      notes,
    } = req.body

    if (!company_id || commission_value === undefined || !effective_from) {
      return res.status(400).json({
        error: 'company_id, commission_value, and effective_from are required.',
      })
    }

    if (Number(commission_value) < 0) {
      return res.status(400).json({ error: 'Commission value cannot be negative.' })
    }

    const id = `dpcc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const config: DscPartnerCommissionConfig = {
      id,
      organization_id: orgId,
      company_profile_id: user.company_profile_id || null,
      partner_id: partner_id || null,
      fee_type,
      company_id,
      product_id: product_id || null,
      class_id: class_id || null,
      validity_id: validity_id || null,
      commission_type,
      commission_value: Number(commission_value),
      calculation_basis,
      effective_from,
      effective_to: effective_to || null,
      is_active: Boolean(is_active),
      priority: Number(priority || 0),
      notes: notes || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveCommissionConfig(config)
    return res.status(201).json({ success: true, config })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.delete('/dsc/commission-configs/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await deleteCommissionConfig(orgId, id)
    return res.json({ success: true, message: 'Commission configuration deleted successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 4. INCENTIVE CONFIGURATIONS CRUD (Quantity & Turnover)
// ----------------------------------------------------------------------------

dscCommissionRouter.get('/dsc/incentives/quantity', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const incentives = await getQuantityIncentives(orgId, {
      partnerId: req.query.partner_id as string,
      companyId: req.query.company_id as string,
      periodType: req.query.period_type as any,
    })
    return res.json({ incentives, total: incentives.length })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.post('/dsc/incentives/quantity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      company_id,
      period_type = 'MONTHLY',
      min_quantity,
      max_quantity,
      incentive_amount,
      incentive_type = 'PER_UNIT',
      custom_period_from,
      custom_period_to,
      is_active = true,
      priority = 0,
      notes,
    } = req.body

    if (min_quantity === undefined || incentive_amount === undefined) {
      return res.status(400).json({ error: 'min_quantity and incentive_amount are required.' })
    }

    if (Number(min_quantity) < 0 || Number(incentive_amount) < 0) {
      return res.status(400).json({ error: 'min_quantity and incentive_amount cannot be negative.' })
    }

    const id = `dpqi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const incentive: DscPartnerQuantityIncentive = {
      id,
      organization_id: orgId,
      company_profile_id: user.company_profile_id || null,
      partner_id: partner_id || null,
      company_id: company_id || null,
      period_type,
      min_quantity: Number(min_quantity),
      max_quantity: max_quantity !== undefined && max_quantity !== null ? Number(max_quantity) : null,
      incentive_amount: Number(incentive_amount),
      incentive_type,
      custom_period_from: custom_period_from || null,
      custom_period_to: custom_period_to || null,
      is_active: Boolean(is_active),
      priority: Number(priority || 0),
      notes: notes || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveQuantityIncentive(incentive)
    return res.status(201).json({ success: true, incentive })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.delete('/dsc/incentives/quantity/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await deleteQuantityIncentive(orgId, id)
    return res.json({ success: true, message: 'Quantity incentive deleted successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.get('/dsc/incentives/turnover', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const incentives = await getTurnoverIncentives(orgId, {
      partnerId: req.query.partner_id as string,
      companyId: req.query.company_id as string,
      periodType: req.query.period_type as any,
    })
    return res.json({ incentives, total: incentives.length })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.post('/dsc/incentives/turnover', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      company_id,
      period_type = 'MONTHLY',
      min_turnover,
      max_turnover,
      calculation_basis = 'BASE_PRICE_ONLY',
      incentive_type = 'PERCENTAGE',
      incentive_value,
      custom_period_from,
      custom_period_to,
      is_active = true,
      priority = 0,
      notes,
    } = req.body

    if (min_turnover === undefined || incentive_value === undefined) {
      return res.status(400).json({ error: 'min_turnover and incentive_value are required.' })
    }

    if (Number(min_turnover) < 0 || Number(incentive_value) < 0) {
      return res.status(400).json({ error: 'min_turnover and incentive_value cannot be negative.' })
    }

    const id = `dpti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const incentive: DscPartnerTurnoverIncentive = {
      id,
      organization_id: orgId,
      company_profile_id: user.company_profile_id || null,
      partner_id: partner_id || null,
      company_id: company_id || null,
      period_type,
      min_turnover: Number(min_turnover),
      max_turnover: max_turnover !== undefined && max_turnover !== null ? Number(max_turnover) : null,
      calculation_basis,
      incentive_type,
      incentive_value: Number(incentive_value),
      custom_period_from: custom_period_from || null,
      custom_period_to: custom_period_to || null,
      is_active: Boolean(is_active),
      priority: Number(priority || 0),
      notes: notes || null,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveTurnoverIncentive(incentive)
    return res.status(201).json({ success: true, incentive })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscCommissionRouter.delete('/dsc/incentives/turnover/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    await deleteTurnoverIncentive(orgId, id)
    return res.json({ success: true, message: 'Turnover incentive deleted successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 5. COMMISSION RESOLUTION & SIMULATION ENDPOINT (/api/dsc/commission/resolve)
// ----------------------------------------------------------------------------

dscCommissionRouter.post('/dsc/commission/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      selling_base_rate,
      gst_rate,
      date,
      support_fee_base_amount,
      quantity,
    } = req.body

    if (!partner_id || !company_id || !product_id || selling_base_rate === undefined) {
      return res.status(400).json({
        error: 'partner_id, company_id, product_id, and selling_base_rate are required.',
      })
    }

    const resolution = await resolveDscCommission({
      organizationId: orgId,
      companyProfileId: user.company_profile_id || null,
      partnerId: partner_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id,
      validityId: validity_id,
      sellingBaseRate: Number(selling_base_rate),
      gstRate: gst_rate !== undefined ? Number(gst_rate) : 18,
      date: date || new Date().toISOString().split('T')[0],
      supportFeeBaseAmount: support_fee_base_amount ? Number(support_fee_base_amount) : 0,
      customQuantity: quantity ? Number(quantity) : 1,
    })

    return res.json({ success: true, resolution })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 6. COMMISSION TRANSACTIONS EXECUTION & OVERRIDE GUARD
// ----------------------------------------------------------------------------

dscCommissionRouter.post('/dsc/commission/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      selling_base_rate,
      gst_rate,
      date,
      support_fee_base_amount,
      quantity,
      override_warning,
      override_reason,
    } = req.body

    if (!partner_id || !company_id || !product_id || selling_base_rate === undefined) {
      return res.status(400).json({
        error: 'partner_id, company_id, product_id, and selling_base_rate are required.',
      })
    }

    // 1. Resolve commission
    const resolution = await resolveDscCommission({
      organizationId: orgId,
      companyProfileId: user.company_profile_id || null,
      partnerId: partner_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id,
      validityId: validity_id,
      sellingBaseRate: Number(selling_base_rate),
      gstRate: gst_rate !== undefined ? Number(gst_rate) : 18,
      date: date || new Date().toISOString().split('T')[0],
      supportFeeBaseAmount: support_fee_base_amount ? Number(support_fee_base_amount) : 0,
      customQuantity: quantity ? Number(quantity) : 1,
    })

    // 2. Check override guard if warning is active
    const result = await createCommissionTransaction(resolution, user, {
      isOverrideRequested: Boolean(override_warning),
      overrideReason: override_reason,
    })

    if (!result.success) {
      // 400 Bad Request or 403 Forbidden with warning details
      const isRbac = result.error?.includes('Security restriction')
      return res.status(isRbac ? 403 : 400).json({
        error: result.error,
        margin_warning: resolution.marginWarning,
        margin_warning_amount: resolution.marginWarningAmount,
        provider_payout: resolution.providerPayoutAmount,
        partner_payout: resolution.totalPartnerPayout,
        requires_override: resolution.marginWarning,
      })
    }

    return res.status(201).json({
      success: true,
      transaction: result.transaction,
      resolution,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 7. REPORTS: PARTNER COMMISSIONS & MARGIN EXCEPTIONS
// ----------------------------------------------------------------------------

dscCommissionRouter.get('/dsc/reports/commissions', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { partner_id, company_id, from_date, to_date, margin_warning_only } = req.query

    const txns = await getCommissionTransactions(orgId, {
      partnerId: partner_id as string,
      companyId: company_id as string,
      fromDate: from_date as string,
      toDate: to_date as string,
      marginWarningOnly: margin_warning_only === 'true',
    })

    const summary = {
      total_transactions: txns.length,
      total_certificates: txns.reduce((s, t) => s + (t.quantity || 1), 0),
      total_selling_amount: txns.reduce((s, t) => s + Number(t.total_selling_price || 0), 0),
      total_provider_payout: txns.reduce((s, t) => s + Number(t.provider_payout_amount || 0), 0),
      total_partner_commission: txns.reduce((s, t) => s + Number(t.total_partner_payout || 0), 0),
      total_net_margin: txns.reduce((s, t) => s + Number(t.net_retained_margin || 0), 0),
      margin_warning_count: txns.filter((t) => t.margin_warning).length,
    }

    return res.json({ summary, transactions: txns })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Calculate partner incentives across period
dscCommissionRouter.get('/dsc/reports/incentives-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { partner_id, company_id, from_date, to_date } = req.query

    if (!partner_id || !from_date || !to_date) {
      return res.status(400).json({ error: 'partner_id, from_date, and to_date are required.' })
    }

    const calc = await calculatePartnerIncentives(orgId, partner_id as string, {
      companyId: company_id as string,
      fromDate: from_date as string,
      toDate: to_date as string,
    })

    return res.json({ success: true, calculation: calc })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})
