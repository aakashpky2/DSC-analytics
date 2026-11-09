import { supabase } from './supabase'

/**
 * Universal Master Store interface for dynamic, database-only masters
 * stored inside central PostgreSQL via dedicated tables or company_profile relational stores.
 */

export interface MasterRecord {
  id: string
  is_active?: number
  [key: string]: any
}

// Memory cache with 2-second TTL for microsecond-level query speed while ensuring database freshness
const CACHE_TTL_MS = 2000
const memoryCache = new Map<string, { data: any; expiry: number }>()

export async function getRelationalStore<T = any>(storeId: string): Promise<T[]> {
  const cached = memoryCache.get(storeId)
  const now = Date.now()
  if (cached && cached.expiry > now) {
    return cached.data as T[]
  }

  const { data, error } = await supabase
    .from('company_profile')
    .select('registered_address')
    .eq('id', storeId)
    .maybeSingle()

  if (error || !data || !data.registered_address) {
    return []
  }

  try {
    const parsed = JSON.parse(data.registered_address)
    const list = Array.isArray(parsed) ? parsed : []
    memoryCache.set(storeId, { data: list, expiry: now + CACHE_TTL_MS })
    return list as T[]
  } catch (err) {
    console.error(`Error parsing JSON payload for ${storeId}:`, err)
    return []
  }
}

export async function saveRelationalStore<T = any>(storeId: string, items: T[]): Promise<boolean> {
  const payload = JSON.stringify(items)
  const { error } = await supabase
    .from('company_profile')
    .update({ registered_address: payload, updated_at: new Date().toISOString() })
    .eq('id', storeId)

  if (error) {
    console.error(`Error saving store ${storeId}:`, error)
    return false
  }

  memoryCache.set(storeId, { data: items, expiry: Date.now() + CACHE_TTL_MS })
  return true
}

export async function appendRelationalStore<T = any>(storeId: string, item: T): Promise<boolean> {
  const current = await getRelationalStore<T>(storeId)
  current.push(item)
  return await saveRelationalStore(storeId, current)
}

// Master Fetchers
export async function getWorkflowStages(): Promise<any[]> {
  const stages = await getRelationalStore('dsc_master_workflow_stages')
  return stages.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getCertificateTypes(): Promise<any[]> {
  const types = await getRelationalStore('dsc_master_certificate_types')
  return types.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getApplicantCategories(): Promise<any[]> {
  const cats = await getRelationalStore('dsc_master_applicant_categories')
  return cats.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getValidities(): Promise<any[]> {
  const vals = await getRelationalStore('dsc_master_validities')
  return vals.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getTokenStatuses(): Promise<any[]> {
  const statuses = await getRelationalStore('token_master_statuses')
  return statuses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
}

export async function getRmaReasons(): Promise<any[]> {
  return await getRelationalStore('token_master_rma_reasons')
}

export async function getTokenManufacturers(): Promise<any[]> {
  return await getRelationalStore('token_master_manufacturers')
}

// DSC Hierarchy Master Fetchers
export async function getDscCompanies(): Promise<any[]> {
  const companies = await getRelationalStore('dsc_master_companies')
  return companies.sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getDscProducts(companyId?: string): Promise<any[]> {
  const products = await getRelationalStore('dsc_master_products')
  const filtered = companyId ? products.filter((p: any) => p.company_id === companyId) : products
  return filtered.sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getDscClasses(): Promise<any[]> {
  const classes = await getRelationalStore('dsc_master_classes')
  return classes.sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getDscRates(filter?: {
  company_id?: string
  product_id?: string
  class_id?: string
  validity_id?: string
  date?: string
}): Promise<any[]> {
  const rates = await getRelationalStore('dsc_master_rates')
  const targetDate = filter?.date ? new Date(filter.date) : new Date()

  return rates.filter((r: any) => {
    if (r.is_active === 0) return false
    if (filter?.company_id && r.company_id !== filter.company_id) return false
    if (filter?.product_id && r.product_id !== filter.product_id) return false
    if (filter?.class_id && r.class_id !== filter.class_id) return false
    if (filter?.validity_id && r.validity_id !== filter.validity_id) return false
    if (r.effective_from && new Date(r.effective_from) > targetDate) return false
    if (r.effective_to && new Date(r.effective_to) < targetDate) return false
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getCategoryAdditionalCharges(categoryId?: string, activeOnly = true): Promise<any[]> {
  const charges = await getRelationalStore('dsc_category_additional_charges')
  const now = new Date()
  return charges.filter((c: any) => {
    if (categoryId && c.category_id !== categoryId) return false
    if (activeOnly) {
      if (c.is_active === 0) return false
      if (c.effective_from && new Date(c.effective_from) > now) return false
      if (c.effective_to && new Date(c.effective_to) < now) return false
    }
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

// Token Master Hierarchy Fetchers (Company -> Product -> Version)
export async function getTokenCompanies(activeOnly = true): Promise<any[]> {
  const companies = await getRelationalStore('token_master_companies')
  return companies
    .filter((c: any) => !activeOnly || c.is_active !== 0)
    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getTokenProducts(filter?: {
  company_id?: string
  date?: string
  activeOnly?: boolean
}): Promise<any[]> {
  const products = await getRelationalStore('token_master_products')
  const targetDate = filter?.date ? new Date(filter.date) : new Date()

  return products.filter((p: any) => {
    if (filter?.activeOnly !== false && p.is_active === 0) return false
    if (filter?.company_id && p.company_id !== filter.company_id) return false
    if (filter?.date) {
      if (p.active_from && new Date(p.active_from) > targetDate) return false
      if (p.active_to && new Date(p.active_to) < targetDate) return false
    }
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getTokenVersions(filter?: {
  product_id?: string
  date?: string
  activeOnly?: boolean
}): Promise<any[]> {
  const versions = await getRelationalStore('token_master_versions')
  const targetDate = filter?.date ? new Date(filter.date) : new Date()

  return versions.filter((v: any) => {
    if (filter?.activeOnly !== false && v.is_active === 0) return false
    if (filter?.product_id && v.product_id !== filter.product_id) return false
    if (filter?.date) {
      if (v.active_from && new Date(v.active_from) > targetDate) return false
      if (v.active_to && new Date(v.active_to) < targetDate) return false
    }
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

// Country & State Master Fetchers with Organization Isolation
export async function getCountries(organizationId?: string, activeOnly = true): Promise<any[]> {
  const countries = await getRelationalStore('app_master_countries')
  const targetOrg = organizationId || 'org-default'
  const now = new Date()

  return countries.filter((c: any) => {
    if (c.organization_id && c.organization_id !== targetOrg) return false
    if (activeOnly) {
      if (c.is_active === 0) return false
      if (c.active_from && new Date(c.active_from) > now) return false
      if (c.active_to && new Date(c.active_to) < now) return false
    }
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}

export async function getStates(filter?: {
  country_id?: string
  organization_id?: string
  activeOnly?: boolean
  date?: string
}): Promise<any[]> {
  const states = await getRelationalStore('app_master_states')
  const targetOrg = filter?.organization_id || 'org-default'
  const targetDate = filter?.date ? new Date(filter.date) : new Date()

  return states.filter((s: any) => {
    if (s.organization_id && s.organization_id !== targetOrg) return false
    if (filter?.country_id && s.country_id !== filter.country_id) return false
    if (filter?.activeOnly !== false) {
      if (s.is_active === 0) return false
      if (s.active_from && new Date(s.active_from) > targetDate) return false
      if (s.active_to && new Date(s.active_to) < targetDate) return false
    }
    return true
  }).sort((a, b) => (a.priority || 0) - (b.priority || 0))
}




