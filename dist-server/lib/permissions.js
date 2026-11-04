"use strict";
/**
 * Section 4: Hierarchical RBAC Resolution Engine
 * Enforces:
 * - Numerical tiers 0 (Super Admin) to 4 (Field Staff)
 * - Strict downward delegation (User at Level N cannot grant to Level <= N)
 * - Sub-permission cap (Cannot grant permissions you do not hold)
 * - Super Admin Freeze Guard (permissions_frozen = 1)
 * - Effective Permission = User Override ?? Role Matrix ?? FALSE
 * - Temporary Delegations resolution (active time window, cascading validity)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDelegationAuthority = validateDelegationAuthority;
exports.validateSubPermissionCap = validateSubPermissionCap;
exports.isDelegationValid = isDelegationValid;
exports.resolveEffectivePermission = resolveEffectivePermission;
/**
 * Validates whether user A can delegate or modify permissions of user B.
 */
function validateDelegationAuthority(granter, target) {
    // 1. Frozen Guard
    if (granter.permissions_frozen) {
        return { allowed: false, reason: 'Your permissions are frozen by the Super Admin' };
    }
    if (target.permissions_frozen) {
        return { allowed: false, reason: 'Target user permissions are frozen by the Super Admin' };
    }
    // 2. Granting Authority
    if (!granter.can_grant_permissions && granter.hierarchy_level_order > 0) {
        return { allowed: false, reason: 'You do not have delegation authority' };
    }
    // 3. Strict Downward Delegation Rule: Level N cannot grant to Level <= N
    if (granter.hierarchy_level_order >= target.hierarchy_level_order && granter.hierarchy_level_order !== 0) {
        return {
            allowed: false,
            reason: `Strict Downward Delegation: Level ${granter.hierarchy_level_order} cannot grant permissions to Level ${target.hierarchy_level_order}`,
        };
    }
    return { allowed: true };
}
/**
 * Checks if granter has the right to grant specific privileges (Sub-permission cap).
 */
function validateSubPermissionCap(granterPermissions, requestedGrant, isSuperAdmin = false) {
    if (isSuperAdmin)
        return { allowed: true };
    const denied = [];
    const keys = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'];
    for (const k of keys) {
        if (requestedGrant[k] === true && !granterPermissions[k]) {
            denied.push(k);
        }
    }
    if (denied.length > 0) {
        return { allowed: false, deniedKeys: denied };
    }
    return { allowed: true };
}
/**
 * Checks if a temporary delegation is currently active and valid.
 */
function isDelegationValid(delegation, nowDate = new Date()) {
    if (delegation.status !== 'active')
        return false;
    const from = new Date(delegation.valid_from).getTime();
    const until = new Date(delegation.valid_until).getTime();
    const now = nowDate.getTime();
    return now >= from && now <= until;
}
/**
 * Resolve effective permissions given role permissions, optional user override,
 * and any active temporary delegations.
 */
function resolveEffectivePermission(rolePerm, userOverride, activeDelegations = []) {
    const getVal = (key, defaultVal = false) => {
        // 1. User individual override has top priority
        if (userOverride && userOverride[key] !== undefined && userOverride[key] !== null) {
            return Boolean(userOverride[key]);
        }
        // 2. Base role permission
        if (rolePerm && rolePerm[key] !== undefined && rolePerm[key] !== null) {
            if (Boolean(rolePerm[key]))
                return true;
        }
        // 3. Active temporary delegation grant
        for (const del of activeDelegations) {
            if (del.action_key === 'all' || del.action_key === key) {
                return true;
            }
        }
        return defaultVal;
    };
    return {
        can_view: getVal('can_view', false),
        can_create: getVal('can_create', false),
        can_edit: getVal('can_edit', false),
        can_delete: getVal('can_delete', false),
        can_export: getVal('can_export', false),
        mask_pii_fields: getVal('mask_pii_fields', true),
    };
}
