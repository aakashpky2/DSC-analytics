import { getRelationalStore, saveRelationalStore } from './dscMasterStore'
import { queryAll, queryOne } from './supabase'

export const STORE_USER_VISIBILITY_SCOPES = 'user_data_visibility_scopes'

export interface UserVisibilityScopeConfig {
  id: string
  organization_id: string
  user_id: string
  // Profile Access: 'ALL' or specific profile ids
  all_profiles_access: boolean
  assigned_profile_ids: string[] // purchase_internal_profiles.id list
  // State / Regional Access: empty or null means unrestricted
  assigned_state_codes: string[] // State codes (e.g. ['27', '32', '33'])
  // Customer Specific Access: empty means no customer-specific restriction
  assigned_customer_ids: string[] // partners.id list
  // Customer Category Access: empty means no category-specific restriction
  assigned_category_ids: string[] // customer_pricing_categories.id list
  // Direct Dashboard Access Flag
  can_view_revenue: boolean
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ResolvedUserDataScope {
  isSuperAdmin: boolean
  organizationId: string
  userId: string
  canViewRevenue: boolean
  allProfilesAccess: boolean
  allowedProfileIds: string[] // Guaranteed non-empty for non-admins if restricted
  allowedStateCodes: string[] // If empty, unrestricted by state
  allowedCustomerIds: string[] // If empty, unrestricted by customer
  allowedCategoryIds: string[] // If empty, unrestricted by category
}

/**
 * Fetch raw scope configuration from relational persistence
 */
export async function getUserVisibilityScope(
  orgId: string,
  userId: string
): Promise<UserVisibilityScopeConfig | null> {
  const all = await getRelationalStore<UserVisibilityScopeConfig>(STORE_USER_VISIBILITY_SCOPES)
  return all.find((s) => s.organization_id === orgId && s.user_id === userId) || null
}

/**
 * Save user visibility scope
 */
export async function saveUserVisibilityScope(
  scope: UserVisibilityScopeConfig
): Promise<boolean> {
  const all = await getRelationalStore<UserVisibilityScopeConfig>(STORE_USER_VISIBILITY_SCOPES)
  const idx = all.findIndex((s) => s.organization_id === scope.organization_id && s.user_id === scope.user_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...scope, updated_at: new Date().toISOString() }
  } else {
    all.push(scope)
  }
  return await saveRelationalStore(STORE_USER_VISIBILITY_SCOPES, all)
}

/**
 * Delete user visibility scope
 */
export async function deleteUserVisibilityScope(
  orgId: string,
  userId: string
): Promise<boolean> {
  const all = await getRelationalStore<UserVisibilityScopeConfig>(STORE_USER_VISIBILITY_SCOPES)
  const filtered = all.filter((s) => !(s.organization_id === orgId && s.user_id === userId))
  return await saveRelationalStore(STORE_USER_VISIBILITY_SCOPES, filtered)
}

/**
 * Main Authorization & Visibility Scope Resolver
 * Enforces hierarchy:
 * 1. Super Admin (tier-0 / role-super-admin) -> unrestricted across org
 * 2. Staff / Other Roles -> derives configured scope
 */
export async function resolveUserDataScope(
  user: any
): Promise<ResolvedUserDataScope> {
  const orgId = user.organization_id || 'comp-default'
  const isSuperAdmin =
    user.role_id === 'role-super-admin' ||
    user.hierarchy_level_id === 'tier-0' ||
    user.hierarchy_level_order === 0

  // 1. If super admin, full organizational access
  if (isSuperAdmin) {
    const allProfiles = await queryAll<{ id: string }>(
      'SELECT id FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true',
      [orgId]
    )
    return {
      isSuperAdmin: true,
      organizationId: orgId,
      userId: user.id,
      canViewRevenue: true,
      allProfilesAccess: true,
      allowedProfileIds: allProfiles.map((p) => p.id),
      allowedStateCodes: [],
      allowedCustomerIds: [],
      allowedCategoryIds: [],
    }
  }

  // 2. Lookup configured user scope
  const config = await getUserVisibilityScope(orgId, user.id)

  // Get active internal profiles in organization
  const allProfiles = await queryAll<{ id: string }>(
    'SELECT id FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true',
    [orgId]
  )
  const allProfileIds = allProfiles.map((p) => p.id)

  if (!config) {
    // Default fallback for staff when no explicit override configured:
    // Defaults to all active profiles within their org, unrestricted customers, revenue allowed if tier <= 3
    const canView = (user.hierarchy_level_order ?? 99) <= 3
    return {
      isSuperAdmin: false,
      organizationId: orgId,
      userId: user.id,
      canViewRevenue: canView,
      allProfilesAccess: true,
      allowedProfileIds: allProfileIds,
      allowedStateCodes: [],
      allowedCustomerIds: [],
      allowedCategoryIds: [],
    }
  }

  let resolvedProfiles: string[] = []
  if (config.all_profiles_access) {
    resolvedProfiles = allProfileIds
  } else {
    // Intersect assigned profile IDs with existing active profile IDs
    const assignedSet = new Set(config.assigned_profile_ids || [])
    resolvedProfiles = allProfileIds.filter((id) => assignedSet.has(id))
  }

  return {
    isSuperAdmin: false,
    organizationId: orgId,
    userId: user.id,
    canViewRevenue: Boolean(config.can_view_revenue),
    allProfilesAccess: Boolean(config.all_profiles_access),
    allowedProfileIds: resolvedProfiles,
    allowedStateCodes: config.assigned_state_codes || [],
    allowedCustomerIds: config.assigned_customer_ids || [],
    allowedCategoryIds: config.assigned_category_ids || [],
  }
}

/**
 * Filter an array of records according to resolved visibility scope.
 * Works seamlessly across DSC Applications, Commission Transactions, Estimates, and Invoices.
 */
export async function filterRecordsByVisibilityScope<T extends {
  id?: string
  company_profile_id?: string | null
  client_id?: string | null
  partner_id?: string | null
  billing_party_id?: string | null
}>(
  records: T[],
  scope: ResolvedUserDataScope
): Promise<T[]> {
  if (scope.isSuperAdmin) {
    return records
  }

  // 1. Profile Scope: Record's company_profile_id MUST be in allowedProfileIds
  const allowedProfilesSet = new Set(scope.allowedProfileIds)
  let filtered = records.filter((r) => {
    if (!r.company_profile_id) return true
    return allowedProfilesSet.has(r.company_profile_id)
  })

  // 2. Fetch customer details for state, individual customer, and category checking
  const checkState = scope.allowedStateCodes && scope.allowedStateCodes.length > 0
  const checkCustomer = scope.allowedCustomerIds && scope.allowedCustomerIds.length > 0
  const checkCategory = scope.allowedCategoryIds && scope.allowedCategoryIds.length > 0

  if (!checkState && !checkCustomer && !checkCategory) {
    return filtered
  }

  // Collect all unique party IDs present in filtered records (or if records themselves are partners)
  const partyIds = new Set<string>()
  for (const r of filtered) {
    if (r.client_id) partyIds.add(r.client_id)
    if (r.partner_id) partyIds.add(r.partner_id)
    if (r.billing_party_id) partyIds.add(r.billing_party_id)
    if (r.id) partyIds.add(r.id)
  }

  if (partyIds.size === 0) {
    return filtered
  }

  // Fetch partners info
  const parties = await queryAll<{
    id: string
    state_code: string | null
  }>('SELECT id, state_code FROM partners WHERE organization_id = ?', [scope.organizationId])
  const partyStateMap = new Map(parties.map((p) => [p.id, p.state_code || '']))

  // Fetch customer category assignments if checkCategory is active
  let customerCategoryMap = new Map<string, Set<string>>()
  if (checkCategory) {
    const assignments = await queryAll<{
      customer_id: string
      customer_category_id: string
    }>('SELECT customer_id, customer_category_id FROM customer_category_assignments WHERE organization_id = ? AND is_active = true', [
      scope.organizationId,
    ])
    for (const a of assignments) {
      if (!customerCategoryMap.has(a.customer_id)) {
        customerCategoryMap.set(a.customer_id, new Set())
      }
      customerCategoryMap.get(a.customer_id)!.add(a.customer_category_id)
    }
  }

  const allowedStatesSet = new Set(scope.allowedStateCodes)
  const allowedCustomersSet = new Set(scope.allowedCustomerIds)
  const allowedCategoriesSet = new Set(scope.allowedCategoryIds)

  return filtered.filter((r) => {
    // If the record itself is a partner, r.id is the partner id
    const pId = r.client_id || r.billing_party_id || r.partner_id || (partyStateMap.has(r.id || '') ? r.id : undefined)
    if (!pId) return true

    // State / Region Check
    if (checkState) {
      const stateCode = partyStateMap.get(pId) || ''
      if (!allowedStatesSet.has(stateCode)) {
        return false
      }
    }

    // Individual Customer Check
    if (checkCustomer) {
      if (!allowedCustomersSet.has(pId)) {
        return false
      }
    }

    // Customer Category Check
    if (checkCategory) {
      const catSet = customerCategoryMap.get(pId)
      if (!catSet) return false
      let hasMatchingCat = false
      for (const catId of catSet) {
        if (allowedCategoriesSet.has(catId)) {
          hasMatchingCat = true
          break
        }
      }
      if (!hasMatchingCat) return false
    }

    return true
  })
}

