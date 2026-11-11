"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuantitySlabs = validateQuantitySlabs;
exports.getSalesRates = getSalesRates;
exports.saveSalesRate = saveSalesRate;
exports.deleteSalesRate = deleteSalesRate;
exports.getPricingCategories = getPricingCategories;
exports.savePricingCategory = savePricingCategory;
exports.deletePricingCategory = deletePricingCategory;
exports.getCustomerCategoryAssignments = getCustomerCategoryAssignments;
exports.saveCustomerCategoryAssignment = saveCustomerCategoryAssignment;
exports.deleteCustomerCategoryAssignment = deleteCustomerCategoryAssignment;
exports.getCustomerLevels = getCustomerLevels;
exports.saveCustomerLevel = saveCustomerLevel;
exports.deleteCustomerLevel = deleteCustomerLevel;
exports.getCustomerLevelRules = getCustomerLevelRules;
exports.saveCustomerLevelRule = saveCustomerLevelRule;
exports.deleteCustomerLevelRule = deleteCustomerLevelRule;
exports.getCustomerLevelAssignments = getCustomerLevelAssignments;
exports.saveCustomerLevelAssignment = saveCustomerLevelAssignment;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
// ----------------------------------------------------------------------------
// STORE KEYS
// ----------------------------------------------------------------------------
const STORE_SALES_RATES = 'token_sales_rates';
const STORE_PRICING_CATEGORIES = 'customer_pricing_categories';
const STORE_CATEGORY_ASSIGNMENTS = 'customer_category_assignments';
const STORE_CUSTOMER_LEVELS = 'customer_levels';
const STORE_CUSTOMER_LEVEL_RULES = 'customer_level_rules';
const STORE_CUSTOMER_LEVEL_ASSIGNMENTS = 'customer_level_assignments';
// ----------------------------------------------------------------------------
// SLAB VALIDATION HELPERS
// ----------------------------------------------------------------------------
function validateQuantitySlabs(slabs) {
    var _a;
    if (!slabs || slabs.length === 0) {
        return { valid: false, error: 'At least one quantity slab is required for slab pricing.' };
    }
    // Sort slabs by min_quantity
    const sorted = [...slabs].sort((a, b) => a.min_quantity - b.min_quantity);
    for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        if (s.min_quantity < 0) {
            return { valid: false, error: `Invalid minimum quantity ${s.min_quantity}. Must be 0 or greater.` };
        }
        if (s.unit_rate <= 0) {
            return { valid: false, error: `Invalid unit rate ${s.unit_rate}. Must be greater than 0.` };
        }
        if (s.max_quantity !== undefined && s.max_quantity !== null) {
            if (s.max_quantity <= s.min_quantity) {
                return { valid: false, error: `Inverted range: max quantity (${s.max_quantity}) must be greater than min quantity (${s.min_quantity}).` };
            }
        }
        if (i > 0) {
            const prev = sorted[i - 1];
            if (prev.max_quantity === undefined || prev.max_quantity === null) {
                return { valid: false, error: `Unbounded slab (min ${prev.min_quantity} to infinity) cannot be followed by another slab.` };
            }
            if (s.min_quantity < prev.max_quantity) {
                return { valid: false, error: `Overlapping slabs detected: slab [${prev.min_quantity}–${prev.max_quantity}] overlaps with [${s.min_quantity}–${(_a = s.max_quantity) !== null && _a !== void 0 ? _a : 'unlimited'}].` };
            }
            if (s.min_quantity === prev.min_quantity) {
                return { valid: false, error: `Duplicate range minimum ${s.min_quantity} detected.` };
            }
        }
    }
    return { valid: true };
}
// ----------------------------------------------------------------------------
// SALES RATES REPOSITORY
// ----------------------------------------------------------------------------
async function getSalesRates(orgId, filter) {
    // Try Supabase first
    try {
        let query = supabase_1.supabase.from('token_sales_rates').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.tokenModelId) {
            query = query.eq('token_model_id', filter.tokenModelId);
        }
        if (filter === null || filter === void 0 ? void 0 : filter.activeOnly) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            return data.filter(r => {
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) !== undefined) {
                    if (filter.profileId && r.company_profile_id && r.company_profile_id !== filter.profileId)
                        return false;
                }
                if ((filter === null || filter === void 0 ? void 0 : filter.customerCategoryId) !== undefined) {
                    if (filter.customerCategoryId === null && r.customer_category_id !== null)
                        return false;
                    if (filter.customerCategoryId && r.customer_category_id !== filter.customerCategoryId)
                        return false;
                }
                return true;
            });
        }
    }
    catch (_) { }
    // Fallback to relational store
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SALES_RATES);
    return all.filter(r => {
        if (r.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.tokenModelId) && r.token_model_id !== filter.tokenModelId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !r.is_active)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) !== undefined) {
            if (filter.profileId && r.company_profile_id && r.company_profile_id !== filter.profileId)
                return false;
        }
        if ((filter === null || filter === void 0 ? void 0 : filter.customerCategoryId) !== undefined) {
            if (filter.customerCategoryId === null && r.customer_category_id !== null)
                return false;
            if (filter.customerCategoryId && r.customer_category_id !== filter.customerCategoryId)
                return false;
        }
        return true;
    });
}
async function saveSalesRate(rate) {
    // Validate slab if SLAB
    if (rate.rate_type === 'SLAB') {
        const val = validateQuantitySlabs(rate.quantity_slabs || []);
        if (!val.valid) {
            throw new Error(`Slab validation error: ${val.error}`);
        }
    }
    // Update in relational store
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SALES_RATES);
    const idx = all.findIndex(r => r.id === rate.id);
    if (idx >= 0) {
        all[idx] = rate;
    }
    else {
        all.unshift(rate);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_SALES_RATES, all);
    // Try sync to Supabase
    try {
        await supabase_1.supabase.from('token_sales_rates').upsert(rate);
    }
    catch (_) { }
}
async function deleteSalesRate(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SALES_RATES);
    const filtered = all.filter(r => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_SALES_RATES, filtered);
    try {
        await supabase_1.supabase.from('token_sales_rates').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// CUSTOMER PRICING CATEGORIES REPOSITORY
// ----------------------------------------------------------------------------
async function getPricingCategories(orgId, profileId) {
    try {
        const { data, error } = await supabase_1.supabase.from('customer_pricing_categories').select('*').eq('organization_id', orgId);
        if (!error && data && data.length > 0) {
            return data.filter(c => !profileId || !c.company_profile_id || c.company_profile_id === profileId);
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PRICING_CATEGORIES);
    return all.filter(c => c.organization_id === orgId && (!profileId || !c.company_profile_id || c.company_profile_id === profileId));
}
async function savePricingCategory(category) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PRICING_CATEGORIES);
    const idx = all.findIndex(c => c.id === category.id);
    if (idx >= 0) {
        all[idx] = category;
    }
    else {
        all.push(category);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_PRICING_CATEGORIES, all);
    try {
        await supabase_1.supabase.from('customer_pricing_categories').upsert(category);
    }
    catch (_) { }
}
async function deletePricingCategory(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PRICING_CATEGORIES);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_PRICING_CATEGORIES, all.filter(c => !(c.id === id && c.organization_id === orgId)));
    try {
        await supabase_1.supabase.from('customer_pricing_categories').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// CUSTOMER CATEGORY ASSIGNMENTS REPOSITORY
// ----------------------------------------------------------------------------
async function getCustomerCategoryAssignments(orgId, customerId) {
    try {
        let q = supabase_1.supabase.from('customer_category_assignments').select('*').eq('organization_id', orgId);
        if (customerId)
            q = q.eq('customer_id', customerId);
        const { data, error } = await q;
        if (!error && data && data.length > 0)
            return data;
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CATEGORY_ASSIGNMENTS);
    return all.filter(a => a.organization_id === orgId && (!customerId || a.customer_id === customerId));
}
async function saveCustomerCategoryAssignment(assignment) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CATEGORY_ASSIGNMENTS);
    const idx = all.findIndex(a => a.id === assignment.id);
    if (idx >= 0) {
        all[idx] = assignment;
    }
    else {
        all.unshift(assignment);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CATEGORY_ASSIGNMENTS, all);
    try {
        await supabase_1.supabase.from('customer_category_assignments').upsert(assignment);
    }
    catch (_) { }
}
async function deleteCustomerCategoryAssignment(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CATEGORY_ASSIGNMENTS);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CATEGORY_ASSIGNMENTS, all.filter(a => !(a.id === id && a.organization_id === orgId)));
    try {
        await supabase_1.supabase.from('customer_category_assignments').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// CUSTOMER LEVELS REPOSITORY
// ----------------------------------------------------------------------------
async function getCustomerLevels(orgId) {
    try {
        const { data, error } = await supabase_1.supabase.from('customer_levels').select('*').eq('organization_id', orgId);
        if (!error && data && data.length > 0)
            return data;
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVELS);
    return all.filter(l => l.organization_id === orgId);
}
async function saveCustomerLevel(level) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVELS);
    const idx = all.findIndex(l => l.id === level.id);
    if (idx >= 0) {
        all[idx] = level;
    }
    else {
        all.push(level);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CUSTOMER_LEVELS, all);
    try {
        await supabase_1.supabase.from('customer_levels').upsert(level);
    }
    catch (_) { }
}
async function deleteCustomerLevel(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVELS);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CUSTOMER_LEVELS, all.filter(l => !(l.id === id && l.organization_id === orgId)));
    try {
        await supabase_1.supabase.from('customer_levels').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// CUSTOMER LEVEL RULES REPOSITORY
// ----------------------------------------------------------------------------
async function getCustomerLevelRules(orgId) {
    try {
        const { data, error } = await supabase_1.supabase.from('customer_level_rules').select('*').eq('organization_id', orgId);
        if (!error && data && data.length > 0)
            return data;
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVEL_RULES);
    return all.filter(r => r.organization_id === orgId);
}
async function saveCustomerLevelRule(rule) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVEL_RULES);
    const idx = all.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
        all[idx] = rule;
    }
    else {
        all.push(rule);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CUSTOMER_LEVEL_RULES, all);
    try {
        await supabase_1.supabase.from('customer_level_rules').upsert(rule);
    }
    catch (_) { }
}
async function deleteCustomerLevelRule(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVEL_RULES);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CUSTOMER_LEVEL_RULES, all.filter(r => !(r.id === id && r.organization_id === orgId)));
    try {
        await supabase_1.supabase.from('customer_level_rules').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// CUSTOMER LEVEL ASSIGNMENTS & OVERRIDES REPOSITORY
// ----------------------------------------------------------------------------
async function getCustomerLevelAssignments(orgId, customerId) {
    try {
        let q = supabase_1.supabase.from('customer_level_assignments').select('*').eq('organization_id', orgId).order('updated_at', { ascending: false });
        if (customerId)
            q = q.eq('customer_id', customerId);
        const { data, error } = await q;
        if (!error && data && data.length > 0)
            return data;
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVEL_ASSIGNMENTS);
    return all
        .filter(a => a.organization_id === orgId && (!customerId || a.customer_id === customerId))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}
async function saveCustomerLevelAssignment(assignment) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_CUSTOMER_LEVEL_ASSIGNMENTS);
    const idx = all.findIndex(a => a.id === assignment.id || a.customer_id === assignment.customer_id);
    if (idx >= 0) {
        all[idx] = assignment;
    }
    else {
        all.unshift(assignment);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_CUSTOMER_LEVEL_ASSIGNMENTS, all);
    try {
        await supabase_1.supabase.from('customer_level_assignments').upsert(assignment);
    }
    catch (_) { }
}
