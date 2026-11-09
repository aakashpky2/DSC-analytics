"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRelationalStore = getRelationalStore;
exports.saveRelationalStore = saveRelationalStore;
exports.appendRelationalStore = appendRelationalStore;
exports.getWorkflowStages = getWorkflowStages;
exports.getCertificateTypes = getCertificateTypes;
exports.getApplicantCategories = getApplicantCategories;
exports.getValidities = getValidities;
exports.getTokenStatuses = getTokenStatuses;
exports.getRmaReasons = getRmaReasons;
exports.getTokenManufacturers = getTokenManufacturers;
exports.getDscCompanies = getDscCompanies;
exports.getDscProducts = getDscProducts;
exports.getDscClasses = getDscClasses;
exports.getDscRates = getDscRates;
exports.getCategoryAdditionalCharges = getCategoryAdditionalCharges;
exports.getTokenCompanies = getTokenCompanies;
exports.getTokenProducts = getTokenProducts;
exports.getTokenVersions = getTokenVersions;
exports.getCountries = getCountries;
exports.getStates = getStates;
const supabase_1 = require("./supabase");
// Memory cache with 2-second TTL for microsecond-level query speed while ensuring database freshness
const CACHE_TTL_MS = 2000;
const memoryCache = new Map();
async function getRelationalStore(storeId) {
    const cached = memoryCache.get(storeId);
    const now = Date.now();
    if (cached && cached.expiry > now) {
        return cached.data;
    }
    const { data, error } = await supabase_1.supabase
        .from('company_profile')
        .select('registered_address')
        .eq('id', storeId)
        .maybeSingle();
    if (error || !data || !data.registered_address) {
        return [];
    }
    try {
        const parsed = JSON.parse(data.registered_address);
        const list = Array.isArray(parsed) ? parsed : [];
        memoryCache.set(storeId, { data: list, expiry: now + CACHE_TTL_MS });
        return list;
    }
    catch (err) {
        console.error(`Error parsing JSON payload for ${storeId}:`, err);
        return [];
    }
}
async function saveRelationalStore(storeId, items) {
    const payload = JSON.stringify(items);
    const { error } = await supabase_1.supabase
        .from('company_profile')
        .update({ registered_address: payload, updated_at: new Date().toISOString() })
        .eq('id', storeId);
    if (error) {
        console.error(`Error saving store ${storeId}:`, error);
        return false;
    }
    memoryCache.set(storeId, { data: items, expiry: Date.now() + CACHE_TTL_MS });
    return true;
}
async function appendRelationalStore(storeId, item) {
    const current = await getRelationalStore(storeId);
    current.push(item);
    return await saveRelationalStore(storeId, current);
}
// Master Fetchers
async function getWorkflowStages() {
    const stages = await getRelationalStore('dsc_master_workflow_stages');
    return stages.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getCertificateTypes() {
    const types = await getRelationalStore('dsc_master_certificate_types');
    return types.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getApplicantCategories() {
    const cats = await getRelationalStore('dsc_master_applicant_categories');
    return cats.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getValidities() {
    const vals = await getRelationalStore('dsc_master_validities');
    return vals.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getTokenStatuses() {
    const statuses = await getRelationalStore('token_master_statuses');
    return statuses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getRmaReasons() {
    return await getRelationalStore('token_master_rma_reasons');
}
async function getTokenManufacturers() {
    return await getRelationalStore('token_master_manufacturers');
}
// DSC Hierarchy Master Fetchers
async function getDscCompanies() {
    const companies = await getRelationalStore('dsc_master_companies');
    return companies.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getDscProducts(companyId) {
    const products = await getRelationalStore('dsc_master_products');
    const filtered = companyId ? products.filter((p) => p.company_id === companyId) : products;
    return filtered.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getDscClasses() {
    const classes = await getRelationalStore('dsc_master_classes');
    return classes.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getDscRates(filter) {
    const rates = await getRelationalStore('dsc_master_rates');
    const targetDate = (filter === null || filter === void 0 ? void 0 : filter.date) ? new Date(filter.date) : new Date();
    return rates.filter((r) => {
        if (r.is_active === 0)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.company_id) && r.company_id !== filter.company_id)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.product_id) && r.product_id !== filter.product_id)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.class_id) && r.class_id !== filter.class_id)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.validity_id) && r.validity_id !== filter.validity_id)
            return false;
        if (r.effective_from && new Date(r.effective_from) > targetDate)
            return false;
        if (r.effective_to && new Date(r.effective_to) < targetDate)
            return false;
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getCategoryAdditionalCharges(categoryId, activeOnly = true) {
    const charges = await getRelationalStore('dsc_category_additional_charges');
    const now = new Date();
    return charges.filter((c) => {
        if (categoryId && c.category_id !== categoryId)
            return false;
        if (activeOnly) {
            if (c.is_active === 0)
                return false;
            if (c.effective_from && new Date(c.effective_from) > now)
                return false;
            if (c.effective_to && new Date(c.effective_to) < now)
                return false;
        }
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
// Token Master Hierarchy Fetchers (Company -> Product -> Version)
async function getTokenCompanies(activeOnly = true) {
    const companies = await getRelationalStore('token_master_companies');
    return companies
        .filter((c) => !activeOnly || c.is_active !== 0)
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getTokenProducts(filter) {
    const products = await getRelationalStore('token_master_products');
    const targetDate = (filter === null || filter === void 0 ? void 0 : filter.date) ? new Date(filter.date) : new Date();
    return products.filter((p) => {
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) !== false && p.is_active === 0)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.company_id) && p.company_id !== filter.company_id)
            return false;
        if (filter === null || filter === void 0 ? void 0 : filter.date) {
            if (p.active_from && new Date(p.active_from) > targetDate)
                return false;
            if (p.active_to && new Date(p.active_to) < targetDate)
                return false;
        }
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getTokenVersions(filter) {
    const versions = await getRelationalStore('token_master_versions');
    const targetDate = (filter === null || filter === void 0 ? void 0 : filter.date) ? new Date(filter.date) : new Date();
    return versions.filter((v) => {
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) !== false && v.is_active === 0)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.product_id) && v.product_id !== filter.product_id)
            return false;
        if (filter === null || filter === void 0 ? void 0 : filter.date) {
            if (v.active_from && new Date(v.active_from) > targetDate)
                return false;
            if (v.active_to && new Date(v.active_to) < targetDate)
                return false;
        }
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
// Country & State Master Fetchers with Organization Isolation
async function getCountries(organizationId, activeOnly = true) {
    const countries = await getRelationalStore('app_master_countries');
    const targetOrg = organizationId || 'org-default';
    const now = new Date();
    return countries.filter((c) => {
        if (c.organization_id && c.organization_id !== targetOrg)
            return false;
        if (activeOnly) {
            if (c.is_active === 0)
                return false;
            if (c.active_from && new Date(c.active_from) > now)
                return false;
            if (c.active_to && new Date(c.active_to) < now)
                return false;
        }
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
async function getStates(filter) {
    const states = await getRelationalStore('app_master_states');
    const targetOrg = (filter === null || filter === void 0 ? void 0 : filter.organization_id) || 'org-default';
    const targetDate = (filter === null || filter === void 0 ? void 0 : filter.date) ? new Date(filter.date) : new Date();
    return states.filter((s) => {
        if (s.organization_id && s.organization_id !== targetOrg)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.country_id) && s.country_id !== filter.country_id)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) !== false) {
            if (s.is_active === 0)
                return false;
            if (s.active_from && new Date(s.active_from) > targetDate)
                return false;
            if (s.active_to && new Date(s.active_to) < targetDate)
                return false;
        }
        return true;
    }).sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
