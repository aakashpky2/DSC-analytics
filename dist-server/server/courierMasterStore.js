"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourierPartners = getCourierPartners;
exports.getShipmentStatuses = getShipmentStatuses;
exports.getCourierRtoReasons = getCourierRtoReasons;
exports.getDispatchMethods = getDispatchMethods;
exports.getPackagingTypes = getPackagingTypes;
exports.getSlaSettings = getSlaSettings;
exports.getManifests = getManifests;
exports.getMilestones = getMilestones;
exports.getRtoTasks = getRtoTasks;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
/**
 * Courier Master Store & Engine
 * Single Source of Truth for Logistics & Shipment Lifecycle
 */
async function getCourierPartners() {
    const { data } = await supabase_1.supabase.from('courier_partners').select('*').order('company_name', { ascending: true });
    return data || [];
}
async function getShipmentStatuses() {
    const statuses = await (0, dscMasterStore_1.getRelationalStore)('courier_master_shipment_statuses');
    return statuses.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
}
async function getCourierRtoReasons() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_master_rto_reasons');
}
async function getDispatchMethods() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_master_dispatch_methods');
}
async function getPackagingTypes() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_master_packaging_types');
}
async function getSlaSettings() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_master_sla_settings');
}
async function getManifests() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_rel_manifests');
}
async function getMilestones() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
}
async function getRtoTasks() {
    return await (0, dscMasterStore_1.getRelationalStore)('courier_rel_rto_tasks');
}
