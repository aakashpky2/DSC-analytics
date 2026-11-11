import {
  DscProviderPayout,
  DscPartnerCommissionConfig,
  DscPartnerQuantityIncentive,
  DscPartnerTurnoverIncentive,
  DscCommissionTransaction,
  getProviderPayouts,
  getCommissionConfigs,
  getQuantityIncentives,
  getTurnoverIncentives,
  getCommissionTransactions,
  saveCommissionTransaction,
} from './dscCommissionStore'
import { queryOne, queryAll } from './supabase'

/**
 * DBIZ ERP / SIGNSYNC — DSC PARTNER COMMISSION ENGINE
 * Complete deterministic resolution, calculation basis logic, margin safeguards,
 * admin override verification, and volume/turnover incentive aggregation.
 */

export interface CommissionResolutionRequest {
  organizationId: string
  companyProfileId?: string | null
  partnerId: string
  companyId: string // e.g. 'dsc-co-1' (eMudhra)
  productId: string // e.g. 'prod-combo'
  classId?: string | null
  validityId?: string | null
  sellingBaseRate: number
  gstRate?: number // defaults to 18%
  date?: string // defaults to now (YYYY-MM-DD)
  supportFeeBaseAmount?: number // optional support fee charged to customer
  customQuantity?: number // defaults to 1
}

export interface CommissionResolutionResult {
  partnerId: string
  companyId: string
  productId: string
  date: string
  quantity: number

  // Price snapshots
  sellingBaseRate: number
  gstRate: number
  gstAmount: number
  totalSellingPrice: number

  // Provider Incoming Payout
  providerPayoutAmount: number
  hasProviderPayoutConfig: boolean

  // Partner DSC Commission
  appliedCommissionConfigId: string | null
  commissionHierarchyLevel:
    | 'PARTNER_PRODUCT'
    | 'PARTNER_PROVIDER'
    | 'PARTNER_DEFAULT'
    | 'GLOBAL_PRODUCT'
    | 'GLOBAL_PROVIDER'
    | 'GLOBAL_DEFAULT'
    | 'NONE'
  commissionType: 'FIXED' | 'PERCENTAGE'
  commissionValue: number
  calculationBasis: 'BASE_PRICE_ONLY' | 'BASE_PLUS_GST'
  calculatedCommission: number

  // Support Fee Commission
  supportFeeBaseAmount: number
  supportFeeCommission: number
  appliedSupportFeeConfigId: string | null

  // Total Partner Outgoing Payout & Remaining Margin
  totalPartnerPayout: number
  netRetainedMargin: number // Provider Payout - Partner Payout

  // Margin Warning
  marginWarning: boolean
  marginWarningAmount: number // Amount by which partner commission exceeds provider payout
  marginWarningMessage: string | null
  explanation: string
}

/**
 * 1. Resolve DSC Commission for a Partner transaction
 */
export async function resolveDscCommission(
  req: CommissionResolutionRequest
): Promise<CommissionResolutionResult> {
  const orgId = req.organizationId
  const profileId = req.companyProfileId || null
  const dateStr = req.date || new Date().toISOString().split('T')[0]
  const qty = req.customQuantity && req.customQuantity > 0 ? req.customQuantity : 1
  const sellingBase = Number(req.sellingBaseRate || 0)
  const gstPct = req.gstRate !== undefined ? Number(req.gstRate) : 18
  const gstAmount = Number(((sellingBase * gstPct) / 100).toFixed(2))
  const totalSelling = Number((sellingBase + gstAmount).toFixed(2))

  // 1. Fetch Provider Incoming Payout (What CA pays us)
  const providerPayouts = await getProviderPayouts(orgId, {
    companyId: req.companyId,
    productId: req.productId,
    profileId,
    activeOnly: true,
    date: dateStr,
  })

  // Match provider payout: specific class/validity first, then product fallback
  let matchedProviderPayout = providerPayouts.find(
    (p) =>
      (!p.class_id || p.class_id === req.classId) &&
      (!p.validity_id || p.validity_id === req.validityId)
  )
  if (!matchedProviderPayout && providerPayouts.length > 0) {
    matchedProviderPayout = providerPayouts[0]
  }

  let providerPayoutUnit = 0
  let hasProviderPayoutConfig = false
  if (matchedProviderPayout) {
    hasProviderPayoutConfig = true
    if (matchedProviderPayout.calculation_basis === 'BASE_PLUS_GST') {
      providerPayoutUnit = Number(matchedProviderPayout.payout_amount)
    } else {
      providerPayoutUnit = Number(matchedProviderPayout.payout_amount)
    }
  }

  // 2. Resolve DSC Product Commission Configuration
  // Priority hierarchy:
  // 1. Partner + Provider + Product
  // 2. Partner + Provider
  // 3. Partner Default (global across providers)
  // 4. Global Provider + Product
  // 5. Global Provider
  // 6. Global Default
  const allConfigs = await getCommissionConfigs(orgId, {
    feeType: 'DSC_PRODUCT',
    companyId: req.companyId,
    profileId,
    activeOnly: true,
    date: dateStr,
  })

  // Filter partner-specific vs global (sort higher priority configs first)
  const partnerConfigs = allConfigs
    .filter((c) => c.partner_id === req.partnerId)
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
  const globalConfigs = allConfigs
    .filter((c) => !c.partner_id)
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))

  let matchedConfig: DscPartnerCommissionConfig | null = null
  let hierarchyLevel: CommissionResolutionResult['commissionHierarchyLevel'] = 'NONE'

  // Step 1: Partner + Provider + Product
  const pProd = partnerConfigs.find((c) => c.product_id === req.productId)
  if (pProd) {
    matchedConfig = pProd
    hierarchyLevel = 'PARTNER_PRODUCT'
  }

  // Step 2: Partner + Provider (no product specified)
  if (!matchedConfig) {
    const pProv = partnerConfigs.find((c) => !c.product_id)
    if (pProv) {
      matchedConfig = pProv
      hierarchyLevel = 'PARTNER_PROVIDER'
    }
  }

  // Step 3: Partner Default across any provider
  if (!matchedConfig) {
    const anyPartnerConfigs = await getCommissionConfigs(orgId, {
      partnerId: req.partnerId,
      feeType: 'DSC_PRODUCT',
      profileId,
      activeOnly: true,
      date: dateStr,
    })
    const pDef = anyPartnerConfigs.find((c) => !c.company_id && !c.product_id)
    if (pDef) {
      matchedConfig = pDef
      hierarchyLevel = 'PARTNER_DEFAULT'
    }
  }

  // Step 4: Global Provider + Product
  if (!matchedConfig) {
    const gProd = globalConfigs.find((c) => c.product_id === req.productId)
    if (gProd) {
      matchedConfig = gProd
      hierarchyLevel = 'GLOBAL_PRODUCT'
    }
  }

  // Step 5: Global Provider
  if (!matchedConfig) {
    const gProv = globalConfigs.find((c) => !c.product_id)
    if (gProv) {
      matchedConfig = gProv
      hierarchyLevel = 'GLOBAL_PROVIDER'
    }
  }

  // Step 6: Global Default
  if (!matchedConfig) {
    const anyGlobalConfigs = await getCommissionConfigs(orgId, {
      feeType: 'DSC_PRODUCT',
      profileId,
      activeOnly: true,
      date: dateStr,
    })
    const gDef = anyGlobalConfigs.find((c) => !c.partner_id && !c.company_id && !c.product_id)
    if (gDef) {
      matchedConfig = gDef
      hierarchyLevel = 'GLOBAL_DEFAULT'
    }
  }

  // Calculate Product Commission
  let commissionType: 'FIXED' | 'PERCENTAGE' = 'FIXED'
  let commissionValue = 0
  let calculationBasis: 'BASE_PRICE_ONLY' | 'BASE_PLUS_GST' = 'BASE_PRICE_ONLY'
  let calculatedCommissionUnit = 0

  if (matchedConfig) {
    commissionType = matchedConfig.commission_type
    commissionValue = Number(matchedConfig.commission_value || 0)
    calculationBasis = matchedConfig.calculation_basis || 'BASE_PRICE_ONLY'

    if (commissionType === 'FIXED') {
      calculatedCommissionUnit = commissionValue
    } else {
      // Percentage
      const baseForCalc = calculationBasis === 'BASE_PLUS_GST' ? totalSelling : sellingBase
      calculatedCommissionUnit = Number(((baseForCalc * commissionValue) / 100).toFixed(2))
    }
  }

  // 3. Resolve Support Fee Commission (if applicable)
  const supportFeeBase = Number(req.supportFeeBaseAmount || 0)
  let supportFeeCommUnit = 0
  let appliedSupportFeeConfigId: string | null = null

  if (supportFeeBase > 0) {
    const supportConfigs = await getCommissionConfigs(orgId, {
      feeType: 'SUPPORT_FEE',
      companyId: req.companyId,
      profileId,
      activeOnly: true,
      date: dateStr,
    })
    const matchedSupp =
      supportConfigs.find((c) => c.partner_id === req.partnerId) ||
      supportConfigs.find((c) => !c.partner_id)

    if (matchedSupp) {
      appliedSupportFeeConfigId = matchedSupp.id
      if (matchedSupp.commission_type === 'FIXED') {
        supportFeeCommUnit = Number(matchedSupp.commission_value)
      } else {
        const suppBaseForCalc =
          matchedSupp.calculation_basis === 'BASE_PLUS_GST'
            ? Number((supportFeeBase * (1 + gstPct / 100)).toFixed(2))
            : supportFeeBase
        supportFeeCommUnit = Number(((suppBaseForCalc * Number(matchedSupp.commission_value)) / 100).toFixed(2))
      }
    }
  }

  // 4. Totals for the requested quantity
  const totalProviderPayout = Number((providerPayoutUnit * qty).toFixed(2))
  const totalProductCommission = Number((calculatedCommissionUnit * qty).toFixed(2))
  const totalSupportFeeCommission = Number((supportFeeCommUnit * qty).toFixed(2))
  const totalPartnerPayout = Number((totalProductCommission + totalSupportFeeCommission).toFixed(2))
  const netRetainedMargin = Number((totalProviderPayout - totalPartnerPayout).toFixed(2))

  // 5. Margin Safeguard Check
  // Partner commission must not silently exceed provider payout
  let marginWarning = false
  let marginWarningAmount = 0
  let marginWarningMessage: string | null = null

  if (totalPartnerPayout > totalProviderPayout) {
    marginWarning = true
    marginWarningAmount = Number((totalPartnerPayout - totalProviderPayout).toFixed(2))
    marginWarningMessage = `Margin Warning: Partner outgoing commission (₹${totalPartnerPayout.toFixed(
      2
    )}) exceeds CA incoming provider payout (₹${totalProviderPayout.toFixed(
      2
    )}) by ₹${marginWarningAmount.toFixed(
      2
    )}. An authorized administrator override is required to finalize this transaction.`
  }

  const explanation = [
    `Resolved hierarchy: ${hierarchyLevel}.`,
    matchedConfig
      ? `Rate: ${commissionType === 'PERCENTAGE' ? `${commissionValue}%` : `₹${commissionValue}`} on ${calculationBasis}.`
      : 'No specific commission rate configured.',
    `CA incoming payout: ₹${totalProviderPayout.toFixed(2)}.`,
    `Partner total commission: ₹${totalPartnerPayout.toFixed(2)}.`,
    `Our net retained margin: ₹${netRetainedMargin.toFixed(2)}.`,
    marginWarning ? `⚠️ MARGIN DEFICIT: ₹${marginWarningAmount.toFixed(2)}.` : 'Margin healthy.',
  ].join(' ')

  const baseAmount = Number((sellingBase * qty).toFixed(2))
  const totalGstAmount = Number(((baseAmount * gstPct) / 100).toFixed(2))
  const totalSellingPrice = Number((baseAmount + totalGstAmount).toFixed(2))

  return {
    partnerId: req.partnerId,
    companyId: req.companyId,
    productId: req.productId,
    date: dateStr,
    quantity: qty,
    sellingBaseRate: sellingBase,
    gstRate: gstPct,
    gstAmount: totalGstAmount,
    totalSellingPrice,
    providerPayoutAmount: totalProviderPayout,
    hasProviderPayoutConfig,
    appliedCommissionConfigId: matchedConfig ? matchedConfig.id : null,
    commissionHierarchyLevel: hierarchyLevel,
    commissionType,
    commissionValue,
    calculationBasis,
    calculatedCommission: totalProductCommission,
    supportFeeBaseAmount: supportFeeBase,
    supportFeeCommission: totalSupportFeeCommission,
    appliedSupportFeeConfigId,
    totalPartnerPayout,
    netRetainedMargin,
    marginWarning,
    marginWarningAmount,
    marginWarningMessage,
    explanation,
  }
}

/**
 * 2. Finalize & Record a Commission Transaction with Strict Override Guard
 */
export async function createCommissionTransaction(
  resolution: CommissionResolutionResult,
  user: any,
  overrideOptions?: {
    isOverrideRequested?: boolean
    overrideReason?: string
  }
): Promise<{ success: boolean; transaction?: DscCommissionTransaction; error?: string }> {
  // Check margin warning override requirement
  if (resolution.marginWarning) {
    const isOverrideReq = overrideOptions?.isOverrideRequested
    if (!isOverrideReq) {
      return {
        success: false,
        error:
          resolution.marginWarningMessage ||
          'Margin warning triggered: Partner commission exceeds CA provider payout. Confirmation override required.',
      }
    }

    // Check RBAC permission for override
    const hasRootAuthority = user.hierarchy_level_order === 0
    const hasOverrideRole = user.hierarchy_level_order <= 1

    if (!hasRootAuthority && !hasOverrideRole) {
      return {
        success: false,
        error:
          'Security restriction: Only authorized administrators (Level 0/1) can override negative or deficit commission margins.',
      }
    }

    if (!overrideOptions?.overrideReason || !overrideOptions.overrideReason.trim()) {
      return {
        success: false,
        error: 'An explicit override reason is mandatory when acknowledging a margin warning.',
      }
    }
  }

  const ts = Date.now()
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const txnId = `comm-txn-${ts}-${randomSuffix}`
  const txnNumber = `COMM-${new Date().getFullYear()}-${ts.toString().slice(-4)}${randomSuffix}`

  const txn: DscCommissionTransaction = {
    id: txnId,
    organization_id: user.organization_id || 'comp-default',
    company_profile_id: user.company_profile_id || null,
    transaction_number: txnNumber,
    partner_id: resolution.partnerId,
    company_id: resolution.companyId,
    product_id: resolution.productId,
    transaction_date: resolution.date,
    quantity: resolution.quantity,
    selling_base_rate: resolution.sellingBaseRate,
    gst_rate: resolution.gstRate,
    gst_amount: resolution.gstAmount,
    total_selling_price: resolution.totalSellingPrice,
    provider_payout_amount: resolution.providerPayoutAmount,
    commission_type: resolution.commissionType,
    commission_value: resolution.commissionValue,
    calculation_basis: resolution.calculationBasis,
    applied_config_id: resolution.appliedCommissionConfigId,
    calculated_commission: resolution.calculatedCommission,
    has_support_fee: resolution.supportFeeBaseAmount > 0,
    support_fee_base_amount: resolution.supportFeeBaseAmount,
    support_fee_commission: resolution.supportFeeCommission,
    total_partner_payout: resolution.totalPartnerPayout,
    net_retained_margin: resolution.netRetainedMargin,
    margin_warning: resolution.marginWarning,
    margin_warning_amount: resolution.marginWarningAmount,
    margin_warning_acknowledged: resolution.marginWarning ? true : false,
    override_by_user_id: resolution.marginWarning ? user.id : null,
    override_user_name: resolution.marginWarning ? user.full_name || user.email : null,
    override_reason: resolution.marginWarning ? overrideOptions?.overrideReason : null,
    override_at: resolution.marginWarning ? new Date().toISOString() : null,
    status: 'APPROVED',
    settlement_status: 'UNPAID',
    created_by: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await saveCommissionTransaction(txn)
  return { success: true, transaction: txn }
}

/**
 * 3. Calculate Quantity and Turnover Incentives over a Date Range
 */
export async function calculatePartnerIncentives(
  orgId: string,
  partnerId: string,
  options: {
    companyId?: string
    fromDate: string
    toDate: string
    profileId?: string | null
  }
): Promise<{
  partnerId: string
  period: { from: string; to: string }
  totalCertificatesIssued: number
  totalTurnoverBase: number
  totalTurnoverWithGst: number
  quantityIncentiveEarned: number
  matchedQuantityTier: DscPartnerQuantityIncentive | null
  turnoverIncentiveEarned: number
  matchedTurnoverTier: DscPartnerTurnoverIncentive | null
  totalIncentiveEarned: number
  transactionsEvaluated: number
}> {
  // 1. Fetch completed commission transactions in date range
  const txns = await getCommissionTransactions(orgId, {
    partnerId,
    companyId: options.companyId,
    profileId: options.profileId,
    fromDate: options.fromDate,
    toDate: options.toDate,
    status: 'APPROVED',
  })

  let totalQty = 0
  let totalBase = 0
  let totalWithGst = 0

  for (const t of txns) {
    const q = t.quantity || 1
    totalQty += q
    totalBase += Number(t.selling_base_rate || 0) * q
    totalWithGst += Number(t.total_selling_price || 0) * q
  }

  // 2. Evaluate Quantity Incentives
  const qIncentives = await getQuantityIncentives(orgId, {
    partnerId,
    companyId: options.companyId,
    profileId: options.profileId,
    activeOnly: true,
  })

  // Sort tiers by min_quantity descending so highest matching slab wins
  qIncentives.sort((a, b) => b.min_quantity - a.min_quantity)

  let matchedQTier: DscPartnerQuantityIncentive | null = null
  for (const tier of qIncentives) {
    if (totalQty >= tier.min_quantity) {
      if (tier.max_quantity === null || tier.max_quantity === undefined || totalQty <= tier.max_quantity) {
        matchedQTier = tier
        break
      }
    }
  }

  let quantityIncentiveEarned = 0
  if (matchedQTier) {
    if (matchedQTier.incentive_type === 'FLAT') {
      quantityIncentiveEarned = Number(matchedQTier.incentive_amount)
    } else {
      // PER_UNIT
      quantityIncentiveEarned = Number((totalQty * Number(matchedQTier.incentive_amount)).toFixed(2))
    }
  }

  // 3. Evaluate Turnover Incentives
  const tIncentives = await getTurnoverIncentives(orgId, {
    partnerId,
    companyId: options.companyId,
    profileId: options.profileId,
    activeOnly: true,
  })

  tIncentives.sort((a, b) => Number(b.min_turnover) - Number(a.min_turnover))

  let matchedTTier: DscPartnerTurnoverIncentive | null = null
  for (const tier of tIncentives) {
    const applicableTurnover =
      tier.calculation_basis === 'BASE_PLUS_GST' ? totalWithGst : totalBase
    if (applicableTurnover >= Number(tier.min_turnover)) {
      if (
        tier.max_turnover === null ||
        tier.max_turnover === undefined ||
        applicableTurnover <= Number(tier.max_turnover)
      ) {
        matchedTTier = tier
        break
      }
    }
  }

  let turnoverIncentiveEarned = 0
  if (matchedTTier) {
    const turnoverForCalc =
      matchedTTier.calculation_basis === 'BASE_PLUS_GST' ? totalWithGst : totalBase
    if (matchedTTier.incentive_type === 'FIXED') {
      turnoverIncentiveEarned = Number(matchedTTier.incentive_value)
    } else {
      // PERCENTAGE
      turnoverIncentiveEarned = Number(
        ((turnoverForCalc * Number(matchedTTier.incentive_value)) / 100).toFixed(2)
      )
    }
  }

  return {
    partnerId,
    period: { from: options.fromDate, to: options.toDate },
    totalCertificatesIssued: totalQty,
    totalTurnoverBase: Number(totalBase.toFixed(2)),
    totalTurnoverWithGst: Number(totalWithGst.toFixed(2)),
    quantityIncentiveEarned,
    matchedQuantityTier: matchedQTier,
    turnoverIncentiveEarned,
    matchedTurnoverTier: matchedTTier,
    totalIncentiveEarned: Number((quantityIncentiveEarned + turnoverIncentiveEarned).toFixed(2)),
    transactionsEvaluated: txns.length,
  }
}
