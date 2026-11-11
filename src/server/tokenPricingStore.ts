import { supabase } from './supabase'
import { getRelationalStore, saveRelationalStore } from './dscMasterStore'

/**
 * DBIZ ERP / SIGNSYNC — Token Sales Pricing Masters, Customer Levels & Rule Engine Store
 * Dual-persistence engine:
 * 1. Synchronized with live Supabase PostgreSQL tables if present.
 * 2. High-performance JSON relational store in dscMasterStore for guaranteed multi-tenant & profile isolation.
 */

// ----------------------------------------------------------------------------
// DATA TYPES
// ----------------------------------------------------------------------------

export type SalesRateType = 'FIXED' | 'SLAB'

export interface QuantitySlab {
  min_quantity: number
  max_quantity?: number | null // null means unlimited (e.g. >10)
  unit_rate: number
}

export interface TokenSalesRate {
  id: string
  organization_id: string
  company_profile_id?: string | null // null or specific profile
  token_company?: string | null
  token_product?: string | null
  token_model_id: string
  model_name?: string
  customer_category_id?: string | null // null = GENERAL rate
  customer_id?: string | null // null or customer-specific rate override
  rate_type: SalesRateType
  rate: number // base rate or default
  quantity_slabs?: QuantitySlab[] // for SLAB type
  effective_from: string // YYYY-MM-DD
  effective_to?: string | null // YYYY-MM-DD or null
  is_active: boolean
  priority: number // higher priority wins
  notes?: string | null
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CustomerPricingCategory {
  id: string
  organization_id: string
  company_profile_id?: string | null
  category_name: string
  category_code: string
  description?: string | null
  priority: number // e.g. PREMIUM 100, HIGH VOLUME 80, KERALA 50, GENERAL 10
  is_active: boolean
  effective_from?: string | null
  effective_to?: string | null
  created_by?: string
  created_at: string
  updated_at: string
}

export type CategoryAssignmentType = 'PERMANENT' | 'DATE_BASED'

export interface CustomerCategoryAssignment {
  id: string
  organization_id: string
  company_profile_id?: string | null
  customer_id: string
  customer_category_id: string
  assignment_type: CategoryAssignmentType
  effective_from: string // YYYY-MM-DD
  effective_to?: string | null // YYYY-MM-DD or null
  is_active: boolean
  assigned_by?: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerLevel {
  id: string
  organization_id: string
  company_profile_id?: string | null
  level_name: string
  level_code: string
  description?: string | null
  priority: number // higher = more prestigious/important
  is_active: boolean
  assignment_mode: 'AUTOMATIC' | 'MANUAL'
  effective_from?: string | null
  effective_to?: string | null
  created_at: string
  updated_at: string
}

export type LevelRulePeriodType = 'MONTHLY' | 'ANNUAL' | 'CUSTOM'

export interface CustomerLevelRule {
  id: string
  organization_id: string
  company_profile_id?: string | null
  customer_level_id: string
  period_type: LevelRulePeriodType
  custom_period_from?: string | null
  custom_period_to?: string | null
  min_purchase_volume: number // e.g. 1000 tokens
  is_active: boolean
  priority: number
  description?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerLevelAssignment {
  id: string
  organization_id: string
  company_profile_id?: string | null
  customer_id: string
  current_level_id: string
  previous_level_id?: string | null
  assignment_type: 'AUTOMATIC' | 'MANUAL_OVERRIDE'
  qualification_volume?: number
  matched_rule_id?: string | null
  calculated_period?: string | null
  override_by?: string | null
  override_date?: string | null
  override_reason?: string | null
  effective_from?: string | null
  effective_to?: string | null
  calculated_at: string
  created_at: string
  updated_at: string
}

export interface PricingResolutionResult {
  token_model_id: string
  model_name?: string
  customer_id: string
  customer_name?: string
  quantity: number
  date: string
  profile_id?: string | null
  unit_rate: number
  taxable_value: number
  source: 'CUSTOMER_SPECIFIC' | 'CATEGORY_RATE' | 'GENERAL_RATE'
  matched_category_id?: string | null
  matched_category_name?: string | null
  matched_category_priority?: number | null
  customer_level_id?: string | null
  customer_level_name?: string | null
  rate_type: SalesRateType
  applicable_slab?: QuantitySlab | null
  effective_rate_id: string
  is_override?: boolean
  override_reason?: string | null
  explanation: string
}

// ----------------------------------------------------------------------------
// STORE KEYS
// ----------------------------------------------------------------------------

const STORE_SALES_RATES = 'token_sales_rates'
const STORE_PRICING_CATEGORIES = 'customer_pricing_categories'
const STORE_CATEGORY_ASSIGNMENTS = 'customer_category_assignments'
const STORE_CUSTOMER_LEVELS = 'customer_levels'
const STORE_CUSTOMER_LEVEL_RULES = 'customer_level_rules'
const STORE_CUSTOMER_LEVEL_ASSIGNMENTS = 'customer_level_assignments'

// ----------------------------------------------------------------------------
// SLAB VALIDATION HELPERS
// ----------------------------------------------------------------------------

export function validateQuantitySlabs(slabs: QuantitySlab[]): { valid: boolean; error?: string } {
  if (!slabs || slabs.length === 0) {
    return { valid: false, error: 'At least one quantity slab is required for slab pricing.' }
  }

  // Sort slabs by min_quantity
  const sorted = [...slabs].sort((a, b) => a.min_quantity - b.min_quantity)

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]
    if (s.min_quantity < 0) {
      return { valid: false, error: `Invalid minimum quantity ${s.min_quantity}. Must be 0 or greater.` }
    }
    if (s.unit_rate <= 0) {
      return { valid: false, error: `Invalid unit rate ${s.unit_rate}. Must be greater than 0.` }
    }
    if (s.max_quantity !== undefined && s.max_quantity !== null) {
      if (s.max_quantity <= s.min_quantity) {
        return { valid: false, error: `Inverted range: max quantity (${s.max_quantity}) must be greater than min quantity (${s.min_quantity}).` }
      }
    }

    if (i > 0) {
      const prev = sorted[i - 1]
      if (prev.max_quantity === undefined || prev.max_quantity === null) {
        return { valid: false, error: `Unbounded slab (min ${prev.min_quantity} to infinity) cannot be followed by another slab.` }
      }
      if (s.min_quantity < prev.max_quantity) {
        return { valid: false, error: `Overlapping slabs detected: slab [${prev.min_quantity}–${prev.max_quantity}] overlaps with [${s.min_quantity}–${s.max_quantity ?? 'unlimited'}].` }
      }
      if (s.min_quantity === prev.min_quantity) {
        return { valid: false, error: `Duplicate range minimum ${s.min_quantity} detected.` }
      }
    }
  }

  return { valid: true }
}

// ----------------------------------------------------------------------------
// SALES RATES REPOSITORY
// ----------------------------------------------------------------------------

export async function getSalesRates(
  orgId: string,
  filter?: { profileId?: string | null; tokenModelId?: string; customerCategoryId?: string | null; activeOnly?: boolean }
): Promise<TokenSalesRate[]> {
  // Try Supabase first
  try {
    let query = supabase.from('token_sales_rates').select('*').eq('organization_id', orgId)
    if (filter?.tokenModelId) {
      query = query.eq('token_model_id', filter.tokenModelId)
    }
    if (filter?.activeOnly) {
      query = query.eq('is_active', true)
    }
    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return data.filter(r => {
        if (filter?.profileId !== undefined) {
          if (filter.profileId && r.company_profile_id && r.company_profile_id !== filter.profileId) return false
        }
        if (filter?.customerCategoryId !== undefined) {
          if (filter.customerCategoryId === null && r.customer_category_id !== null) return false
          if (filter.customerCategoryId && r.customer_category_id !== filter.customerCategoryId) return false
        }
        return true
      })
    }
  } catch (_) {}

  // Fallback to relational store
  const all = await getRelationalStore<TokenSalesRate>(STORE_SALES_RATES)
  return all.filter(r => {
    if (r.organization_id !== orgId) return false
    if (filter?.tokenModelId && r.token_model_id !== filter.tokenModelId) return false
    if (filter?.activeOnly && !r.is_active) return false
    if (filter?.profileId !== undefined) {
      if (filter.profileId && r.company_profile_id && r.company_profile_id !== filter.profileId) return false
    }
    if (filter?.customerCategoryId !== undefined) {
      if (filter.customerCategoryId === null && r.customer_category_id !== null) return false
      if (filter.customerCategoryId && r.customer_category_id !== filter.customerCategoryId) return false
    }
    return true
  })
}

export async function saveSalesRate(rate: TokenSalesRate): Promise<void> {
  // Validate slab if SLAB
  if (rate.rate_type === 'SLAB') {
    const val = validateQuantitySlabs(rate.quantity_slabs || [])
    if (!val.valid) {
      throw new Error(`Slab validation error: ${val.error}`)
    }
  }

  // Update in relational store
  const all = await getRelationalStore<TokenSalesRate>(STORE_SALES_RATES)
  const idx = all.findIndex(r => r.id === rate.id)
  if (idx >= 0) {
    all[idx] = rate
  } else {
    all.unshift(rate)
  }
  await saveRelationalStore(STORE_SALES_RATES, all)

  // Try sync to Supabase
  try {
    await supabase.from('token_sales_rates').upsert(rate)
  } catch (_) {}
}

export async function deleteSalesRate(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<TokenSalesRate>(STORE_SALES_RATES)
  const filtered = all.filter(r => !(r.id === id && r.organization_id === orgId))
  await saveRelationalStore(STORE_SALES_RATES, filtered)
  try {
    await supabase.from('token_sales_rates').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// CUSTOMER PRICING CATEGORIES REPOSITORY
// ----------------------------------------------------------------------------

export async function getPricingCategories(orgId: string, profileId?: string | null): Promise<CustomerPricingCategory[]> {
  try {
    const { data, error } = await supabase.from('customer_pricing_categories').select('*').eq('organization_id', orgId)
    if (!error && data && data.length > 0) {
      return data.filter(c => !profileId || !c.company_profile_id || c.company_profile_id === profileId)
    }
  } catch (_) {}

  const all = await getRelationalStore<CustomerPricingCategory>(STORE_PRICING_CATEGORIES)
  return all.filter(c => c.organization_id === orgId && (!profileId || !c.company_profile_id || c.company_profile_id === profileId))
}

export async function savePricingCategory(category: CustomerPricingCategory): Promise<void> {
  const all = await getRelationalStore<CustomerPricingCategory>(STORE_PRICING_CATEGORIES)
  const idx = all.findIndex(c => c.id === category.id)
  if (idx >= 0) {
    all[idx] = category
  } else {
    all.push(category)
  }
  await saveRelationalStore(STORE_PRICING_CATEGORIES, all)
  try {
    await supabase.from('customer_pricing_categories').upsert(category)
  } catch (_) {}
}

export async function deletePricingCategory(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<CustomerPricingCategory>(STORE_PRICING_CATEGORIES)
  await saveRelationalStore(STORE_PRICING_CATEGORIES, all.filter(c => !(c.id === id && c.organization_id === orgId)))
  try {
    await supabase.from('customer_pricing_categories').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// CUSTOMER CATEGORY ASSIGNMENTS REPOSITORY
// ----------------------------------------------------------------------------

export async function getCustomerCategoryAssignments(orgId: string, customerId?: string): Promise<CustomerCategoryAssignment[]> {
  try {
    let q = supabase.from('customer_category_assignments').select('*').eq('organization_id', orgId)
    if (customerId) q = q.eq('customer_id', customerId)
    const { data, error } = await q
    if (!error && data && data.length > 0) return data
  } catch (_) {}

  const all = await getRelationalStore<CustomerCategoryAssignment>(STORE_CATEGORY_ASSIGNMENTS)
  return all.filter(a => a.organization_id === orgId && (!customerId || a.customer_id === customerId))
}

export async function saveCustomerCategoryAssignment(assignment: CustomerCategoryAssignment): Promise<void> {
  const all = await getRelationalStore<CustomerCategoryAssignment>(STORE_CATEGORY_ASSIGNMENTS)
  const idx = all.findIndex(a => a.id === assignment.id)
  if (idx >= 0) {
    all[idx] = assignment
  } else {
    all.unshift(assignment)
  }
  await saveRelationalStore(STORE_CATEGORY_ASSIGNMENTS, all)
  try {
    await supabase.from('customer_category_assignments').upsert(assignment)
  } catch (_) {}
}

export async function deleteCustomerCategoryAssignment(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<CustomerCategoryAssignment>(STORE_CATEGORY_ASSIGNMENTS)
  await saveRelationalStore(STORE_CATEGORY_ASSIGNMENTS, all.filter(a => !(a.id === id && a.organization_id === orgId)))
  try {
    await supabase.from('customer_category_assignments').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// CUSTOMER LEVELS REPOSITORY
// ----------------------------------------------------------------------------

export async function getCustomerLevels(orgId: string): Promise<CustomerLevel[]> {
  try {
    const { data, error } = await supabase.from('customer_levels').select('*').eq('organization_id', orgId)
    if (!error && data && data.length > 0) return data
  } catch (_) {}

  const all = await getRelationalStore<CustomerLevel>(STORE_CUSTOMER_LEVELS)
  return all.filter(l => l.organization_id === orgId)
}

export async function saveCustomerLevel(level: CustomerLevel): Promise<void> {
  const all = await getRelationalStore<CustomerLevel>(STORE_CUSTOMER_LEVELS)
  const idx = all.findIndex(l => l.id === level.id)
  if (idx >= 0) {
    all[idx] = level
  } else {
    all.push(level)
  }
  await saveRelationalStore(STORE_CUSTOMER_LEVELS, all)
  try {
    await supabase.from('customer_levels').upsert(level)
  } catch (_) {}
}

export async function deleteCustomerLevel(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<CustomerLevel>(STORE_CUSTOMER_LEVELS)
  await saveRelationalStore(STORE_CUSTOMER_LEVELS, all.filter(l => !(l.id === id && l.organization_id === orgId)))
  try {
    await supabase.from('customer_levels').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// CUSTOMER LEVEL RULES REPOSITORY
// ----------------------------------------------------------------------------

export async function getCustomerLevelRules(orgId: string): Promise<CustomerLevelRule[]> {
  try {
    const { data, error } = await supabase.from('customer_level_rules').select('*').eq('organization_id', orgId)
    if (!error && data && data.length > 0) return data
  } catch (_) {}

  const all = await getRelationalStore<CustomerLevelRule>(STORE_CUSTOMER_LEVEL_RULES)
  return all.filter(r => r.organization_id === orgId)
}

export async function saveCustomerLevelRule(rule: CustomerLevelRule): Promise<void> {
  const all = await getRelationalStore<CustomerLevelRule>(STORE_CUSTOMER_LEVEL_RULES)
  const idx = all.findIndex(r => r.id === rule.id)
  if (idx >= 0) {
    all[idx] = rule
  } else {
    all.push(rule)
  }
  await saveRelationalStore(STORE_CUSTOMER_LEVEL_RULES, all)
  try {
    await supabase.from('customer_level_rules').upsert(rule)
  } catch (_) {}
}

export async function deleteCustomerLevelRule(orgId: string, id: string): Promise<void> {
  const all = await getRelationalStore<CustomerLevelRule>(STORE_CUSTOMER_LEVEL_RULES)
  await saveRelationalStore(STORE_CUSTOMER_LEVEL_RULES, all.filter(r => !(r.id === id && r.organization_id === orgId)))
  try {
    await supabase.from('customer_level_rules').delete().eq('id', id).eq('organization_id', orgId)
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// CUSTOMER LEVEL ASSIGNMENTS & OVERRIDES REPOSITORY
// ----------------------------------------------------------------------------

export async function getCustomerLevelAssignments(orgId: string, customerId?: string): Promise<CustomerLevelAssignment[]> {
  try {
    let q = supabase.from('customer_level_assignments').select('*').eq('organization_id', orgId).order('updated_at', { ascending: false })
    if (customerId) q = q.eq('customer_id', customerId)
    const { data, error } = await q
    if (!error && data && data.length > 0) return data
  } catch (_) {}

  const all = await getRelationalStore<CustomerLevelAssignment>(STORE_CUSTOMER_LEVEL_ASSIGNMENTS)
  return all
    .filter(a => a.organization_id === orgId && (!customerId || a.customer_id === customerId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export async function saveCustomerLevelAssignment(assignment: CustomerLevelAssignment): Promise<void> {
  const all = await getRelationalStore<CustomerLevelAssignment>(STORE_CUSTOMER_LEVEL_ASSIGNMENTS)
  const idx = all.findIndex(a => a.id === assignment.id || a.customer_id === assignment.customer_id)
  if (idx >= 0) {
    all[idx] = assignment
  } else {
    all.unshift(assignment)
  }
  await saveRelationalStore(STORE_CUSTOMER_LEVEL_ASSIGNMENTS, all)
  try {
    await supabase.from('customer_level_assignments').upsert(assignment)
  } catch (_) {}
}

