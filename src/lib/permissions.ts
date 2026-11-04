/**
 * Section 4: Hierarchical RBAC Resolution Engine
 * Enforces:
 * - Numerical tiers 0 (Super Admin) to 4 (Field Staff)
 * - Strict downward delegation (User at Level N cannot grant to Level <= N)
 * - Sub-permission cap (Cannot grant permissions you do not hold)
 * - Super Admin Freeze Guard (permissions_frozen = 1)
 * - Effective Permission = User Override ?? Role Matrix ?? FALSE
 */

export interface HierarchyLevel {
  id: string
  level_order: number // 0, 1, 2, 3, 4
  level_name: string
  can_delegate_default: number
}

export interface PermissionSet {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  mask_pii_fields: boolean
}

export interface UserProfileWithPermissions {
  id: string
  email: string
  full_name: string
  hierarchy_level_order: number
  role_id: string
  can_grant_permissions: boolean
  permissions_frozen: boolean
  effective_permissions: Record<string, PermissionSet>
}

/**
 * Validates whether user A can delegate or modify permissions of user B.
 */
export function validateDelegationAuthority(
  granter: { hierarchy_level_order: number; permissions_frozen: boolean; can_grant_permissions: boolean },
  target: { hierarchy_level_order: number; permissions_frozen: boolean }
): { allowed: boolean; reason?: string } {
  // 1. Frozen Guard
  if (granter.permissions_frozen) {
    return { allowed: false, reason: 'Your permissions are frozen by the Super Admin' }
  }
  if (target.permissions_frozen) {
    return { allowed: false, reason: 'Target user permissions are frozen by the Super Admin' }
  }

  // 2. Granting Authority
  if (!granter.can_grant_permissions && granter.hierarchy_level_order > 0) {
    return { allowed: false, reason: 'You do not have delegation authority' }
  }

  // 3. Strict Downward Delegation Rule: Level N cannot grant to Level <= N
  if (granter.hierarchy_level_order >= target.hierarchy_level_order && granter.hierarchy_level_order !== 0) {
    return {
      allowed: false,
      reason: `Strict Downward Delegation: Level ${granter.hierarchy_level_order} cannot grant permissions to Level ${target.hierarchy_level_order}`,
    }
  }

  return { allowed: true }
}

/**
 * Checks if granter has the right to grant specific privileges (Sub-permission cap).
 */
export function validateSubPermissionCap(
  granterPermissions: PermissionSet,
  requestedGrant: Partial<PermissionSet>,
  isSuperAdmin: boolean = false
): { allowed: boolean; deniedKeys?: string[] } {
  if (isSuperAdmin) return { allowed: true }

  const denied: string[] = []
  const keys: (keyof PermissionSet)[] = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export']

  for (const k of keys) {
    if (requestedGrant[k] === true && !granterPermissions[k]) {
      denied.push(k)
    }
  }

  if (denied.length > 0) {
    return { allowed: false, deniedKeys: denied }
  }

  return { allowed: true }
}

/**
 * Resolve effective permissions given role permissions and optional user override.
 */
export function resolveEffectivePermission(
  rolePerm?: Partial<PermissionSet> | null,
  userOverride?: Partial<PermissionSet> | null
): PermissionSet {
  const getVal = (key: keyof PermissionSet, defaultVal: boolean = false): boolean => {
    if (userOverride && userOverride[key] !== undefined && userOverride[key] !== null) {
      return Boolean(userOverride[key])
    }
    if (rolePerm && rolePerm[key] !== undefined && rolePerm[key] !== null) {
      return Boolean(rolePerm[key])
    }
    return defaultVal
  }

  return {
    can_view: getVal('can_view', false),
    can_create: getVal('can_create', false),
    can_edit: getVal('can_edit', false),
    can_delete: getVal('can_delete', false),
    can_export: getVal('can_export', false),
    mask_pii_fields: getVal('mask_pii_fields', true),
  }
}

