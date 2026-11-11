import { supabase } from './supabase'
import { getRelationalStore, saveRelationalStore } from './dscMasterStore'

/**
 * DBIZ ERP / SIGNSYNC — DSC Partner Commission, Provider Payout & Incentives Store
 * Dual-persistence engine:
 * 1. PostgreSQL table synchronization if Supabase table is live.
 * 2. High-performance JSON relational store in dscMasterStore for guaranteed multi-tenant & profile isolation.
 */

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type CommissionFeeType = 'DSC_PRODUCT' | 'SUPPORT_FEE'
export type CommissionValueType = 'FIXED' | 'PERCENTAGE'
export type CommissionCalculationBasis = 'BASE_PRICE_ONLY' | 'BASE_PLUS_GST'
export type IncentivePeriodType = 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'
export type QuantityIncentiveType = 'PER_UNIT' | 'FLAT'
export type TurnoverIncentiveType = 'PERCENTAGE' | 'FIXED'
export type CommissionTxnStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SETTLED' | 'VOID'
export type CommissionSettlementStatus = 'UNPAID' | 'PAID'

export interface DscProviderPayout {
  id: string
  organization_id: string
  company_profile_id?: string | null
  company_id: string // e.g. 'dsc-co-1' (eMudhra)
  product_id: string // e.g. 'prod-combo'
  class_id?: string | null
  validity_id?: string | null
  payout_amount: number // incoming commission from provider
  calculation_basis: CommissionCalculationBasis
  effective_from: string // YYYY-MM-DD
  effective_to?: string | null
  is_active: boolean
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DscPartnerCommissionConfig {
  id: string
  organization_id: string
  company_profile_id?: string | null
  partner_id?: string | null // null = default for provider/product
  fee_type: CommissionFeeType
  company_id: string // e.g. 'dsc-co-1'
  product_id?: string | null // null = provider-wide default
  class_id?: string | null
  validity_id?: string | null
  commission_type: CommissionValueType
  commission_value: number
  calculation_basis: CommissionCalculationBasis
  effective_from: string // YYYY-MM-DD
  effective_to?: string | null
  is_active: boolean
  priority: number // higher priority wins
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DscPartnerQuantityIncentive {
  id: string
  organization_id: string
  company_profile_id?: string | null
  partner_id?: string | null // null = global
  company_id?: string | null // null = CA-agnostic
  period_type: IncentivePeriodType
  min_quantity: number
  max_quantity?: number | null
  incentive_amount: number
  incentive_type: QuantityIncentiveType
  custom_period_from?: string | null
  custom_period_to?: string | null
  is_active: boolean
  priority: number
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DscPartnerTurnoverIncentive {
  id: string
  organization_id: string
  company_profile_id?: string | null
  partner_id?: string | null
  company_id?: string | null
  period_type: IncentivePeriodType
  min_turnover: number
  max_turnover?: number | null
  calculation_basis: CommissionCalculationBasis
  incentive_type: TurnoverIncentiveType
  incentive_value: number
  custom_period_from?: string | null
  custom_period_to?: string | null
  is_active: boolean
  priority: number
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DscCommissionTransaction {
  id: string
  organization_id: string
  company_profile_id?: string | null
  transaction_number: string
  dsc_application_id?: string | null
  partner_id: string
  company_id: string
  product_id: string
  class_id?: string | null
  validity_id?: string | null
  transaction_date: string // YYYY-MM-DD
  quantity: number

  // Price & Payout snapshots
  selling_base_rate: number
  gst_rate: number
  gst_amount: number
  total_selling_price: number
  provider_payout_amount: number

  // Partner Commission snapshots
  commission_type: CommissionValueType
  commission_value: number
  calculation_basis: CommissionCalculationBasis
  applied_config_id?: string | null
  calculated_commission: number

  // Support fee snapshots
  has_support_fee: boolean
  support_fee_base_amount: number
  support_fee_commission: number

  // Net margin snapshot
  total_partner_payout: number
  net_retained_margin: number // provider_payout_amount - total_partner_payout

  // Margin Warning & Override Audit
  margin_warning: boolean
  margin_warning_amount: number // partner payout exceeding provider payout
  margin_warning_acknowledged: boolean
  override_by_user_id?: string | null
  override_user_name?: string | null
  override_reason?: string | null
  override_at?: string | null

  // Status & Settlement
  status: CommissionTxnStatus
  settlement_status: CommissionSettlementStatus
  settlement_reference?: string | null
  settled_at?: string | null

  created_by?: string | null
  created_at: string
  updated_at: string
}

// ----------------------------------------------------------------------------
// STORE KEYS
// ----------------------------------------------------------------------------
export const STORE_DSC_PROVIDER_PAYOUTS = 'dsc_provider_payouts'
export const STORE_DSC_COMMISSION_CONFIGS = 'dsc_partner_commission_configs'
export const STORE_DSC_QUANTITY_INCENTIVES = 'dsc_partner_quantity_incentives'
export const STORE_DSC_TURNOVER_INCENTIVES = 'dsc_partner_turnover_incentives'
export const STORE_DSC_COMMISSION_TRANSACTIONS = 'dsc_commission_transactions'

// ----------------------------------------------------------------------------
// PROVIDER PAYOUTS REPOSITORY
// ----------------------------------------------------------------------------

export async function getProviderPayouts(
  orgId: string,
  filter?: {
    companyId?: string
    productId?: string
    profileId?: string | null
    activeOnly?: boolean
    date?: string
  }
): Promise<DscProviderPayout[]> {
  try {
    let q = supabase.from('dsc_provider_payouts').select('*').eq('organization_id', orgId)
    if (filter?.companyId) q = q.eq('company_id', filter.companyId)
    if (filter?.productId) q = q.eq('product_id', filter.productId)
    if (filter?.activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (!error && data && data.length > 0) {
      return data.filter((item: any) => {
        if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
        if (filter?.date) {
          const d = new Date(filter.date)
          if (item.effective_from && new Date(item.effective_from) > d) return false
          if (item.effective_to && new Date(item.effective_to) < d) return false
        }
        return true
      })
    }
  } catch (_) {}

  const all = await getRelationalStore<DscProviderPayout>(STORE_DSC_PROVIDER_PAYOUTS)
  return all.filter((item) => {
    if (item.organization_id !== orgId) return false
    if (filter?.companyId && item.company_id !== filter.companyId) return false
    if (filter?.productId && item.product_id !== filter.productId) return false
    if (filter?.activeOnly && !item.is_active) return false
    if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
    if (filter?.date) {
      const d = new Date(filter.date)
      if (item.effective_from && new Date(item.effective_from) > d) return false
      if (item.effective_to && new Date(item.effective_to) < d) return false
    }
    return true
  })
}

export async function saveProviderPayout(item: DscProviderPayout): Promise<void> {
  const all = await getRelationalStore<DscProviderPayout>(STORE_DSC_PROVIDER_PAYOUTS)
  const idx = all.findIndex((r) => r.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.unshift(item)
  }
  await saveRelationalStore(STORE_DSC_PROVIDER_PAYOUTS, all)

  try {
    await supabase.from('dsc_provider_payouts').upsert(item)
  } catch (_) {}
}

export async function deleteProviderPayout(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<DscProviderPayout>(STORE_DSC_PROVIDER_PAYOUTS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_DSC_PROVIDER_PAYOUTS, filtered)

  try {
    await supabase.from('dsc_provider_payouts').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// PARTNER COMMISSION CONFIGURATIONS REPOSITORY
// ----------------------------------------------------------------------------

export async function getCommissionConfigs(
  orgId: string,
  filter?: {
    partnerId?: string | null
    feeType?: CommissionFeeType
    companyId?: string
    productId?: string
    profileId?: string | null
    activeOnly?: boolean
    date?: string
  }
): Promise<DscPartnerCommissionConfig[]> {
  try {
    let q = supabase.from('dsc_partner_commission_configs').select('*').eq('organization_id', orgId)
    if (filter?.feeType) q = q.eq('fee_type', filter.feeType)
    if (filter?.companyId) q = q.eq('company_id', filter.companyId)
    if (filter?.activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (!error && data && data.length > 0) {
      return data.filter((item: any) => {
        if (filter?.partnerId !== undefined && item.partner_id !== filter.partnerId) return false
        if (filter?.productId && item.product_id && item.product_id !== filter.productId) return false
        if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
        if (filter?.date) {
          const d = new Date(filter.date)
          if (item.effective_from && new Date(item.effective_from) > d) return false
          if (item.effective_to && new Date(item.effective_to) < d) return false
        }
        return true
      })
    }
  } catch (_) {}

  const all = await getRelationalStore<DscPartnerCommissionConfig>(STORE_DSC_COMMISSION_CONFIGS)
  return all.filter((item) => {
    if (item.organization_id !== orgId) return false
    if (filter?.feeType && item.fee_type !== filter.feeType) return false
    if (filter?.companyId && item.company_id !== filter.companyId) return false
    if (filter?.productId && item.product_id && item.product_id !== filter.productId) return false
    if (filter?.partnerId !== undefined && item.partner_id !== filter.partnerId) return false
    if (filter?.activeOnly && !item.is_active) return false
    if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
    if (filter?.date) {
      const d = new Date(filter.date)
      if (item.effective_from && new Date(item.effective_from) > d) return false
      if (item.effective_to && new Date(item.effective_to) < d) return false
    }
    return true
  })
}

export async function saveCommissionConfig(item: DscPartnerCommissionConfig): Promise<void> {
  const all = await getRelationalStore<DscPartnerCommissionConfig>(STORE_DSC_COMMISSION_CONFIGS)
  const idx = all.findIndex((r) => r.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.unshift(item)
  }
  await saveRelationalStore(STORE_DSC_COMMISSION_CONFIGS, all)

  try {
    await supabase.from('dsc_partner_commission_configs').upsert(item)
  } catch (_) {}
}

export async function deleteCommissionConfig(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<DscPartnerCommissionConfig>(STORE_DSC_COMMISSION_CONFIGS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_DSC_COMMISSION_CONFIGS, filtered)

  try {
    await supabase.from('dsc_partner_commission_configs').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// QUANTITY INCENTIVES REPOSITORY
// ----------------------------------------------------------------------------

export async function getQuantityIncentives(
  orgId: string,
  filter?: {
    partnerId?: string | null
    companyId?: string
    profileId?: string | null
    periodType?: IncentivePeriodType
    activeOnly?: boolean
  }
): Promise<DscPartnerQuantityIncentive[]> {
  try {
    let q = supabase.from('dsc_partner_quantity_incentives').select('*').eq('organization_id', orgId)
    if (filter?.periodType) q = q.eq('period_type', filter.periodType)
    if (filter?.activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (!error && data && data.length > 0) {
      return data.filter((item: any) => {
        if (filter?.partnerId !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId) return false
        if (filter?.companyId && item.company_id && item.company_id !== filter.companyId) return false
        if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
        return true
      })
    }
  } catch (_) {}

  const all = await getRelationalStore<DscPartnerQuantityIncentive>(STORE_DSC_QUANTITY_INCENTIVES)
  return all.filter((item) => {
    if (item.organization_id !== orgId) return false
    if (filter?.periodType && item.period_type !== filter.periodType) return false
    if (filter?.activeOnly && !item.is_active) return false
    if (filter?.partnerId !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId) return false
    if (filter?.companyId && item.company_id && item.company_id !== filter.companyId) return false
    if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
    return true
  })
}

export async function saveQuantityIncentive(item: DscPartnerQuantityIncentive): Promise<void> {
  const all = await getRelationalStore<DscPartnerQuantityIncentive>(STORE_DSC_QUANTITY_INCENTIVES)
  const idx = all.findIndex((r) => r.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.push(item)
  }
  await saveRelationalStore(STORE_DSC_QUANTITY_INCENTIVES, all)

  try {
    await supabase.from('dsc_partner_quantity_incentives').upsert(item)
  } catch (_) {}
}

export async function deleteQuantityIncentive(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<DscPartnerQuantityIncentive>(STORE_DSC_QUANTITY_INCENTIVES)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_DSC_QUANTITY_INCENTIVES, filtered)

  try {
    await supabase.from('dsc_partner_quantity_incentives').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// TURNOVER INCENTIVES REPOSITORY
// ----------------------------------------------------------------------------

export async function getTurnoverIncentives(
  orgId: string,
  filter?: {
    partnerId?: string | null
    companyId?: string
    profileId?: string | null
    periodType?: IncentivePeriodType
    activeOnly?: boolean
  }
): Promise<DscPartnerTurnoverIncentive[]> {
  try {
    let q = supabase.from('dsc_partner_turnover_incentives').select('*').eq('organization_id', orgId)
    if (filter?.periodType) q = q.eq('period_type', filter.periodType)
    if (filter?.activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (!error && data && data.length > 0) {
      return data.filter((item: any) => {
        if (filter?.partnerId !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId) return false
        if (filter?.companyId && item.company_id && item.company_id !== filter.companyId) return false
        if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
        return true
      })
    }
  } catch (_) {}

  const all = await getRelationalStore<DscPartnerTurnoverIncentive>(STORE_DSC_TURNOVER_INCENTIVES)
  return all.filter((item) => {
    if (item.organization_id !== orgId) return false
    if (filter?.periodType && item.period_type !== filter.periodType) return false
    if (filter?.activeOnly && !item.is_active) return false
    if (filter?.partnerId !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId) return false
    if (filter?.companyId && item.company_id && item.company_id !== filter.companyId) return false
    if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
    return true
  })
}

export async function saveTurnoverIncentive(item: DscPartnerTurnoverIncentive): Promise<void> {
  const all = await getRelationalStore<DscPartnerTurnoverIncentive>(STORE_DSC_TURNOVER_INCENTIVES)
  const idx = all.findIndex((r) => r.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.push(item)
  }
  await saveRelationalStore(STORE_DSC_TURNOVER_INCENTIVES, all)

  try {
    await supabase.from('dsc_partner_turnover_incentives').upsert(item)
  } catch (_) {}
}

export async function deleteTurnoverIncentive(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<DscPartnerTurnoverIncentive>(STORE_DSC_TURNOVER_INCENTIVES)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_DSC_TURNOVER_INCENTIVES, filtered)

  try {
    await supabase.from('dsc_partner_turnover_incentives').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// COMMISSION TRANSACTIONS REPOSITORY
// ----------------------------------------------------------------------------

export async function getCommissionTransactions(
  orgId: string,
  filter?: {
    partnerId?: string
    companyId?: string
    profileId?: string | null
    fromDate?: string
    toDate?: string
    marginWarningOnly?: boolean
    status?: CommissionTxnStatus
    settlementStatus?: CommissionSettlementStatus
  }
): Promise<DscCommissionTransaction[]> {
  try {
    let q = supabase.from('dsc_commission_transactions').select('*').eq('organization_id', orgId)
    if (filter?.partnerId) q = q.eq('partner_id', filter.partnerId)
    if (filter?.companyId) q = q.eq('company_id', filter.companyId)
    if (filter?.status) q = q.eq('status', filter.status)
    if (filter?.settlementStatus) q = q.eq('settlement_status', filter.settlementStatus)
    if (filter?.marginWarningOnly) q = q.eq('margin_warning', true)
    const { data, error } = await q
    if (!error && data && data.length > 0) {
      return data.filter((item: any) => {
        if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
        if (filter?.fromDate && new Date(item.transaction_date) < new Date(filter.fromDate)) return false
        if (filter?.toDate && new Date(item.transaction_date) > new Date(filter.toDate)) return false
        return true
      })
    }
  } catch (_) {}

  const all = await getRelationalStore<DscCommissionTransaction>(STORE_DSC_COMMISSION_TRANSACTIONS)
  return all.filter((item) => {
    if (item.organization_id !== orgId) return false
    if (filter?.partnerId && item.partner_id !== filter.partnerId) return false
    if (filter?.companyId && item.company_id !== filter.companyId) return false
    if (filter?.profileId && item.company_profile_id && item.company_profile_id !== filter.profileId) return false
    if (filter?.status && item.status !== filter.status) return false
    if (filter?.settlementStatus && item.settlement_status !== filter.settlementStatus) return false
    if (filter?.marginWarningOnly && !item.margin_warning) return false
    if (filter?.fromDate && new Date(item.transaction_date) < new Date(filter.fromDate)) return false
    if (filter?.toDate && new Date(item.transaction_date) > new Date(filter.toDate)) return false
    return true
  })
}

export async function saveCommissionTransaction(item: DscCommissionTransaction): Promise<void> {
  const all = await getRelationalStore<DscCommissionTransaction>(STORE_DSC_COMMISSION_TRANSACTIONS)
  const idx = all.findIndex((r) => r.id === item.id)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.unshift(item)
  }
  await saveRelationalStore(STORE_DSC_COMMISSION_TRANSACTIONS, all)

  try {
    await supabase.from('dsc_commission_transactions').upsert(item)
  } catch (_) {}
}

export async function deleteCommissionTransaction(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<DscCommissionTransaction>(STORE_DSC_COMMISSION_TRANSACTIONS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_DSC_COMMISSION_TRANSACTIONS, filtered)

  try {
    await supabase.from('dsc_commission_transactions').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

