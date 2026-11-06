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
