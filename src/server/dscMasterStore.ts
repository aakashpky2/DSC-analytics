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

