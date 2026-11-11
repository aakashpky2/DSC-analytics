"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_DSC_COMMISSION_TRANSACTIONS = exports.STORE_DSC_TURNOVER_INCENTIVES = exports.STORE_DSC_QUANTITY_INCENTIVES = exports.STORE_DSC_COMMISSION_CONFIGS = exports.STORE_DSC_PROVIDER_PAYOUTS = void 0;
exports.getProviderPayouts = getProviderPayouts;
exports.saveProviderPayout = saveProviderPayout;
exports.deleteProviderPayout = deleteProviderPayout;
exports.getCommissionConfigs = getCommissionConfigs;
exports.saveCommissionConfig = saveCommissionConfig;
exports.deleteCommissionConfig = deleteCommissionConfig;
exports.getQuantityIncentives = getQuantityIncentives;
exports.saveQuantityIncentive = saveQuantityIncentive;
exports.deleteQuantityIncentive = deleteQuantityIncentive;
exports.getTurnoverIncentives = getTurnoverIncentives;
exports.saveTurnoverIncentive = saveTurnoverIncentive;
exports.deleteTurnoverIncentive = deleteTurnoverIncentive;
exports.getCommissionTransactions = getCommissionTransactions;
exports.saveCommissionTransaction = saveCommissionTransaction;
exports.deleteCommissionTransaction = deleteCommissionTransaction;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
// ----------------------------------------------------------------------------
// STORE KEYS
// ----------------------------------------------------------------------------
exports.STORE_DSC_PROVIDER_PAYOUTS = 'dsc_provider_payouts';
exports.STORE_DSC_COMMISSION_CONFIGS = 'dsc_partner_commission_configs';
exports.STORE_DSC_QUANTITY_INCENTIVES = 'dsc_partner_quantity_incentives';
exports.STORE_DSC_TURNOVER_INCENTIVES = 'dsc_partner_turnover_incentives';
exports.STORE_DSC_COMMISSION_TRANSACTIONS = 'dsc_commission_transactions';
// ----------------------------------------------------------------------------
// PROVIDER PAYOUTS REPOSITORY
// ----------------------------------------------------------------------------
async function getProviderPayouts(orgId, filter) {
    try {
        let q = supabase_1.supabase.from('dsc_provider_payouts').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.companyId)
            q = q.eq('company_id', filter.companyId);
        if (filter === null || filter === void 0 ? void 0 : filter.productId)
            q = q.eq('product_id', filter.productId);
        if (filter === null || filter === void 0 ? void 0 : filter.activeOnly)
            q = q.eq('is_active', true);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
            return data.filter((item) => {
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
                    return false;
                if (filter === null || filter === void 0 ? void 0 : filter.date) {
                    const d = new Date(filter.date);
                    if (item.effective_from && new Date(item.effective_from) > d)
                        return false;
                    if (item.effective_to && new Date(item.effective_to) < d)
                        return false;
                }
                return true;
            });
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_PROVIDER_PAYOUTS);
    return all.filter((item) => {
        if (item.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.productId) && item.product_id !== filter.productId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !item.is_active)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
            return false;
        if (filter === null || filter === void 0 ? void 0 : filter.date) {
            const d = new Date(filter.date);
            if (item.effective_from && new Date(item.effective_from) > d)
                return false;
            if (item.effective_to && new Date(item.effective_to) < d)
                return false;
        }
        return true;
    });
}
async function saveProviderPayout(item) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_PROVIDER_PAYOUTS);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) {
        all[idx] = item;
    }
    else {
        all.unshift(item);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_PROVIDER_PAYOUTS, all);
    try {
        await supabase_1.supabase.from('dsc_provider_payouts').upsert(item);
    }
    catch (_) { }
}
async function deleteProviderPayout(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_PROVIDER_PAYOUTS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_PROVIDER_PAYOUTS, filtered);
    try {
        await supabase_1.supabase.from('dsc_provider_payouts').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// PARTNER COMMISSION CONFIGURATIONS REPOSITORY
// ----------------------------------------------------------------------------
async function getCommissionConfigs(orgId, filter) {
    try {
        let q = supabase_1.supabase.from('dsc_partner_commission_configs').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.feeType)
            q = q.eq('fee_type', filter.feeType);
        if (filter === null || filter === void 0 ? void 0 : filter.companyId)
            q = q.eq('company_id', filter.companyId);
        if (filter === null || filter === void 0 ? void 0 : filter.activeOnly)
            q = q.eq('is_active', true);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
            return data.filter((item) => {
                if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== filter.partnerId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.productId) && item.product_id && item.product_id !== filter.productId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
                    return false;
                if (filter === null || filter === void 0 ? void 0 : filter.date) {
                    const d = new Date(filter.date);
                    if (item.effective_from && new Date(item.effective_from) > d)
                        return false;
                    if (item.effective_to && new Date(item.effective_to) < d)
                        return false;
                }
                return true;
            });
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_CONFIGS);
    return all.filter((item) => {
        if (item.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.feeType) && item.fee_type !== filter.feeType)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.productId) && item.product_id && item.product_id !== filter.productId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== filter.partnerId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !item.is_active)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
            return false;
        if (filter === null || filter === void 0 ? void 0 : filter.date) {
            const d = new Date(filter.date);
            if (item.effective_from && new Date(item.effective_from) > d)
                return false;
            if (item.effective_to && new Date(item.effective_to) < d)
                return false;
        }
        return true;
    });
}
async function saveCommissionConfig(item) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_CONFIGS);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) {
        all[idx] = item;
    }
    else {
        all.unshift(item);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_COMMISSION_CONFIGS, all);
    try {
        await supabase_1.supabase.from('dsc_partner_commission_configs').upsert(item);
    }
    catch (_) { }
}
async function deleteCommissionConfig(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_CONFIGS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_COMMISSION_CONFIGS, filtered);
    try {
        await supabase_1.supabase.from('dsc_partner_commission_configs').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// QUANTITY INCENTIVES REPOSITORY
// ----------------------------------------------------------------------------
async function getQuantityIncentives(orgId, filter) {
    try {
        let q = supabase_1.supabase.from('dsc_partner_quantity_incentives').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.periodType)
            q = q.eq('period_type', filter.periodType);
        if (filter === null || filter === void 0 ? void 0 : filter.activeOnly)
            q = q.eq('is_active', true);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
            return data.filter((item) => {
                if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id && item.company_id !== filter.companyId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
                    return false;
                return true;
            });
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_QUANTITY_INCENTIVES);
    return all.filter((item) => {
        if (item.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.periodType) && item.period_type !== filter.periodType)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !item.is_active)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id && item.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
            return false;
        return true;
    });
}
async function saveQuantityIncentive(item) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_QUANTITY_INCENTIVES);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) {
        all[idx] = item;
    }
    else {
        all.push(item);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_QUANTITY_INCENTIVES, all);
    try {
        await supabase_1.supabase.from('dsc_partner_quantity_incentives').upsert(item);
    }
    catch (_) { }
}
async function deleteQuantityIncentive(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_QUANTITY_INCENTIVES);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_QUANTITY_INCENTIVES, filtered);
    try {
        await supabase_1.supabase.from('dsc_partner_quantity_incentives').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// TURNOVER INCENTIVES REPOSITORY
// ----------------------------------------------------------------------------
async function getTurnoverIncentives(orgId, filter) {
    try {
        let q = supabase_1.supabase.from('dsc_partner_turnover_incentives').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.periodType)
            q = q.eq('period_type', filter.periodType);
        if (filter === null || filter === void 0 ? void 0 : filter.activeOnly)
            q = q.eq('is_active', true);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
            return data.filter((item) => {
                if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id && item.company_id !== filter.companyId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
                    return false;
                return true;
            });
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_TURNOVER_INCENTIVES);
    return all.filter((item) => {
        if (item.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.periodType) && item.period_type !== filter.periodType)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !item.is_active)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) !== undefined && item.partner_id !== null && item.partner_id !== filter.partnerId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id && item.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
            return false;
        return true;
    });
}
async function saveTurnoverIncentive(item) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_TURNOVER_INCENTIVES);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) {
        all[idx] = item;
    }
    else {
        all.push(item);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_TURNOVER_INCENTIVES, all);
    try {
        await supabase_1.supabase.from('dsc_partner_turnover_incentives').upsert(item);
    }
    catch (_) { }
}
async function deleteTurnoverIncentive(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_TURNOVER_INCENTIVES);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_TURNOVER_INCENTIVES, filtered);
    try {
        await supabase_1.supabase.from('dsc_partner_turnover_incentives').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
// ----------------------------------------------------------------------------
// COMMISSION TRANSACTIONS REPOSITORY
// ----------------------------------------------------------------------------
async function getCommissionTransactions(orgId, filter) {
    try {
        let q = supabase_1.supabase.from('dsc_commission_transactions').select('*').eq('organization_id', orgId);
        if (filter === null || filter === void 0 ? void 0 : filter.partnerId)
            q = q.eq('partner_id', filter.partnerId);
        if (filter === null || filter === void 0 ? void 0 : filter.companyId)
            q = q.eq('company_id', filter.companyId);
        if (filter === null || filter === void 0 ? void 0 : filter.status)
            q = q.eq('status', filter.status);
        if (filter === null || filter === void 0 ? void 0 : filter.settlementStatus)
            q = q.eq('settlement_status', filter.settlementStatus);
        if (filter === null || filter === void 0 ? void 0 : filter.marginWarningOnly)
            q = q.eq('margin_warning', true);
        const { data, error } = await q;
        if (!error && data && data.length > 0) {
            return data.filter((item) => {
                if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.fromDate) && new Date(item.transaction_date) < new Date(filter.fromDate))
                    return false;
                if ((filter === null || filter === void 0 ? void 0 : filter.toDate) && new Date(item.transaction_date) > new Date(filter.toDate))
                    return false;
                return true;
            });
        }
    }
    catch (_) { }
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_TRANSACTIONS);
    return all.filter((item) => {
        if (item.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.partnerId) && item.partner_id !== filter.partnerId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && item.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.profileId) && item.company_profile_id && item.company_profile_id !== filter.profileId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.status) && item.status !== filter.status)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.settlementStatus) && item.settlement_status !== filter.settlementStatus)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.marginWarningOnly) && !item.margin_warning)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.fromDate) && new Date(item.transaction_date) < new Date(filter.fromDate))
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.toDate) && new Date(item.transaction_date) > new Date(filter.toDate))
            return false;
        return true;
    });
}
async function saveCommissionTransaction(item) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_TRANSACTIONS);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) {
        all[idx] = item;
    }
    else {
        all.unshift(item);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_COMMISSION_TRANSACTIONS, all);
    try {
        await supabase_1.supabase.from('dsc_commission_transactions').upsert(item);
    }
    catch (_) { }
}
async function deleteCommissionTransaction(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_COMMISSION_TRANSACTIONS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_COMMISSION_TRANSACTIONS, filtered);
    try {
        await supabase_1.supabase.from('dsc_commission_transactions').delete().eq('id', id).eq('organization_id', orgId);
    }
    catch (_) { }
}
