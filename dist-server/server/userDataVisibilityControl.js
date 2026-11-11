"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_USER_VISIBILITY_SCOPES = void 0;
exports.getUserVisibilityScope = getUserVisibilityScope;
exports.saveUserVisibilityScope = saveUserVisibilityScope;
exports.deleteUserVisibilityScope = deleteUserVisibilityScope;
exports.resolveUserDataScope = resolveUserDataScope;
exports.filterRecordsByVisibilityScope = filterRecordsByVisibilityScope;
const dscMasterStore_1 = require("./dscMasterStore");
const supabase_1 = require("./supabase");
exports.STORE_USER_VISIBILITY_SCOPES = 'user_data_visibility_scopes';
/**
 * Fetch raw scope configuration from relational persistence
 */
async function getUserVisibilityScope(orgId, userId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_USER_VISIBILITY_SCOPES);
    return all.find((s) => s.organization_id === orgId && s.user_id === userId) || null;
}
/**
 * Save user visibility scope
 */
async function saveUserVisibilityScope(scope) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_USER_VISIBILITY_SCOPES);
    const idx = all.findIndex((s) => s.organization_id === scope.organization_id && s.user_id === scope.user_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), scope), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(scope);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_USER_VISIBILITY_SCOPES, all);
}
/**
 * Delete user visibility scope
 */
async function deleteUserVisibilityScope(orgId, userId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_USER_VISIBILITY_SCOPES);
    const filtered = all.filter((s) => !(s.organization_id === orgId && s.user_id === userId));
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_USER_VISIBILITY_SCOPES, filtered);
}
/**
 * Main Authorization & Visibility Scope Resolver
 * Enforces hierarchy:
 * 1. Super Admin (tier-0 / role-super-admin) -> unrestricted across org
 * 2. Staff / Other Roles -> derives configured scope
 */
async function resolveUserDataScope(user) {
    var _a;
    const orgId = user.organization_id || 'comp-default';
    const isSuperAdmin = user.role_id === 'role-super-admin' ||
        user.hierarchy_level_id === 'tier-0' ||
        user.hierarchy_level_order === 0;
    // 1. If super admin, full organizational access
    if (isSuperAdmin) {
        const allProfiles = await (0, supabase_1.queryAll)('SELECT id FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true', [orgId]);
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
        };
    }
    // 2. Lookup configured user scope
    const config = await getUserVisibilityScope(orgId, user.id);
    // Get active internal profiles in organization
    const allProfiles = await (0, supabase_1.queryAll)('SELECT id FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true', [orgId]);
    const allProfileIds = allProfiles.map((p) => p.id);
    if (!config) {
        // Default fallback for staff when no explicit override configured:
        // Defaults to all active profiles within their org, unrestricted customers, revenue allowed if tier <= 3
        const canView = ((_a = user.hierarchy_level_order) !== null && _a !== void 0 ? _a : 99) <= 3;
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
        };
    }
    let resolvedProfiles = [];
    if (config.all_profiles_access) {
        resolvedProfiles = allProfileIds;
    }
    else {
        // Intersect assigned profile IDs with existing active profile IDs
        const assignedSet = new Set(config.assigned_profile_ids || []);
        resolvedProfiles = allProfileIds.filter((id) => assignedSet.has(id));
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
    };
}
/**
 * Filter an array of records according to resolved visibility scope.
 * Works seamlessly across DSC Applications, Commission Transactions, Estimates, and Invoices.
 */
async function filterRecordsByVisibilityScope(records, scope) {
    if (scope.isSuperAdmin) {
        return records;
    }
    // 1. Profile Scope: Record's company_profile_id MUST be in allowedProfileIds
    const allowedProfilesSet = new Set(scope.allowedProfileIds);
    let filtered = records.filter((r) => {
        if (!r.company_profile_id)
            return true;
        return allowedProfilesSet.has(r.company_profile_id);
    });
    // 2. Fetch customer details for state, individual customer, and category checking
    const checkState = scope.allowedStateCodes && scope.allowedStateCodes.length > 0;
    const checkCustomer = scope.allowedCustomerIds && scope.allowedCustomerIds.length > 0;
    const checkCategory = scope.allowedCategoryIds && scope.allowedCategoryIds.length > 0;
    if (!checkState && !checkCustomer && !checkCategory) {
        return filtered;
    }
    // Collect all unique party IDs present in filtered records (or if records themselves are partners)
    const partyIds = new Set();
    for (const r of filtered) {
        if (r.client_id)
            partyIds.add(r.client_id);
        if (r.partner_id)
            partyIds.add(r.partner_id);
        if (r.billing_party_id)
            partyIds.add(r.billing_party_id);
        if (r.id)
            partyIds.add(r.id);
    }
    if (partyIds.size === 0) {
        return filtered;
    }
    // Fetch partners info
    const parties = await (0, supabase_1.queryAll)('SELECT id, state_code FROM partners WHERE organization_id = ?', [scope.organizationId]);
    const partyStateMap = new Map(parties.map((p) => [p.id, p.state_code || '']));
    // Fetch customer category assignments if checkCategory is active
    let customerCategoryMap = new Map();
    if (checkCategory) {
        const assignments = await (0, supabase_1.queryAll)('SELECT customer_id, customer_category_id FROM customer_category_assignments WHERE organization_id = ? AND is_active = true', [
            scope.organizationId,
        ]);
        for (const a of assignments) {
            if (!customerCategoryMap.has(a.customer_id)) {
                customerCategoryMap.set(a.customer_id, new Set());
            }
            customerCategoryMap.get(a.customer_id).add(a.customer_category_id);
        }
    }
    const allowedStatesSet = new Set(scope.allowedStateCodes);
    const allowedCustomersSet = new Set(scope.allowedCustomerIds);
    const allowedCategoriesSet = new Set(scope.allowedCategoryIds);
    return filtered.filter((r) => {
        // If the record itself is a partner, r.id is the partner id
        const pId = r.client_id || r.billing_party_id || r.partner_id || (partyStateMap.has(r.id || '') ? r.id : undefined);
        if (!pId)
            return true;
        // State / Region Check
        if (checkState) {
            const stateCode = partyStateMap.get(pId) || '';
            if (!allowedStatesSet.has(stateCode)) {
                return false;
            }
        }
        // Individual Customer Check
        if (checkCustomer) {
            if (!allowedCustomersSet.has(pId)) {
                return false;
            }
        }
        // Customer Category Check
        if (checkCategory) {
            const catSet = customerCategoryMap.get(pId);
            if (!catSet)
                return false;
            let hasMatchingCat = false;
            for (const catId of catSet) {
                if (allowedCategoriesSet.has(catId)) {
                    hasMatchingCat = true;
                    break;
                }
            }
            if (!hasMatchingCat)
                return false;
        }
        return true;
    });
}
