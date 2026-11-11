"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dscCommissionRouter = void 0;
const express_1 = require("express");
const dscCommissionStore_1 = require("../dscCommissionStore");
const dscCommissionEngine_1 = require("../dscCommissionEngine");
const supabase_1 = require("../supabase");
exports.dscCommissionRouter = (0, express_1.Router)();
function getSessionUser(req) {
    return req.user;
}
function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    next();
}
function requireAdmin(req, res, next) {
    const user = getSessionUser(req);
    if (!user || user.hierarchy_level_order > 1) {
        return res.status(403).json({ error: 'You do not have permission to manage commission configurations.' });
    }
    next();
}
// ----------------------------------------------------------------------------
// 1. PARTNER ROLE TOGGLE & RETRIEVAL (Dual-role support)
// ----------------------------------------------------------------------------
// GET /api/dsc/partners/:id/roles
exports.dscCommissionRouter.get('/dsc/partners/:id/roles', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const partner = await (0, supabase_1.queryOne)('SELECT id, partner_code, company_name, type, is_token_customer, is_dsc_partner, organization_id FROM partners WHERE id = ?', [req.params.id]);
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found.' });
        }
        // Organization isolation
        if (user.hierarchy_level_order > 0 && partner.organization_id && partner.organization_id !== orgId) {
            return res.status(403).json({ error: 'Access denied across organizations.' });
        }
        const isTokenCustomer = partner.is_token_customer === true ||
            partner.type === 'token_partner' ||
            partner.type === 'both';
        const isDscPartner = partner.is_dsc_partner === true ||
            partner.type === 'dsc_partner' ||
            partner.type === 'associate_partner' ||
            partner.type === 'master_distributor' ||
            partner.type === 'both';
        return res.json({
            id: partner.id,
            partner_code: partner.partner_code,
            company_name: partner.company_name,
            type: partner.type,
            is_token_customer: isTokenCustomer,
            is_dsc_partner: isDscPartner,
            roles: [
                ...(isTokenCustomer ? ['token_customer'] : []),
                ...(isDscPartner ? ['dsc_partner'] : []),
            ],
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PUT /api/dsc/partners/:id/roles
exports.dscCommissionRouter.put('/dsc/partners/:id/roles', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { is_token_customer, is_dsc_partner } = req.body;
        const existing = await (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Partner not found.' });
        }
        if (user.hierarchy_level_order > 0 && existing.organization_id && existing.organization_id !== orgId) {
            return res.status(403).json({ error: 'Access denied across organizations.' });
        }
        const tokenCust = is_token_customer !== undefined ? Boolean(is_token_customer) : Boolean(existing.is_token_customer);
        const dscPart = is_dsc_partner !== undefined ? Boolean(is_dsc_partner) : Boolean(existing.is_dsc_partner);
        // Ensure at least one role remains active
        if (!tokenCust && !dscPart) {
            return res.status(400).json({ error: 'A party must have at least one active role (Token Customer or DSC Partner).' });
        }
        // Determine legacy type representation
        let newType = existing.type;
        if (tokenCust && dscPart) {
            newType = 'both';
        }
        else if (tokenCust) {
            newType = 'token_partner';
        }
        else if (dscPart) {
            newType = 'dsc_partner';
        }
        try {
            const { error: updErr } = await supabase_1.supabase
                .from('partners')
                .update({ type: newType })
                .eq('id', req.params.id);
            if (updErr) {
                console.error('Error updating partner role type:', updErr);
            }
        }
        catch (_) { }
        return res.json({
            success: true,
            partner_id: req.params.id,
            is_token_customer: tokenCust,
            is_dsc_partner: dscPart,
            type: newType,
            message: 'Partner roles updated successfully without data loss or duplication.',
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 2. PROVIDER PAYOUTS MASTER CRUD (/api/dsc/provider-payouts)
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.get('/dsc/provider-payouts', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { company_id, product_id, active_only, date } = req.query;
        const payouts = await (0, dscCommissionStore_1.getProviderPayouts)(orgId, {
            companyId: company_id,
            productId: product_id,
            activeOnly: active_only === 'true',
            date: date,
        });
        return res.json({ payouts, total: payouts.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.post('/dsc/provider-payouts', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { company_id, product_id, class_id, validity_id, payout_amount, calculation_basis = 'BASE_PRICE_ONLY', effective_from, effective_to, is_active = true, notes, } = req.body;
        if (!company_id || !product_id || payout_amount === undefined || !effective_from) {
            return res.status(400).json({
                error: 'company_id, product_id, payout_amount, and effective_from are required.',
            });
        }
        if (Number(payout_amount) < 0) {
            return res.status(400).json({ error: 'Payout amount cannot be negative.' });
        }
        const id = `dpp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const record = {
            id,
            organization_id: orgId,
            company_profile_id: user.company_profile_id || null,
            company_id,
            product_id,
            class_id: class_id || null,
            validity_id: validity_id || null,
            payout_amount: Number(payout_amount),
            calculation_basis,
            effective_from,
            effective_to: effective_to || null,
            is_active: Boolean(is_active),
            notes: notes || null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await (0, dscCommissionStore_1.saveProviderPayout)(record);
        return res.status(201).json({ success: true, payout: record });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.delete('/dsc/provider-payouts/:id', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await (0, dscCommissionStore_1.deleteProviderPayout)(orgId, id);
        return res.json({ success: true, message: 'Provider payout deleted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 3. PARTNER COMMISSION CONFIGURATIONS CRUD (/api/dsc/commission-configs)
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.get('/dsc/commission-configs', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, fee_type, company_id, product_id, active_only, date } = req.query;
        const configs = await (0, dscCommissionStore_1.getCommissionConfigs)(orgId, {
            partnerId: partner_id !== undefined ? partner_id : undefined,
            feeType: fee_type,
            companyId: company_id,
            productId: product_id,
            activeOnly: active_only === 'true',
            date: date,
        });
        return res.json({ configs, total: configs.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.post('/dsc/commission-configs', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, fee_type = 'DSC_PRODUCT', company_id, product_id, class_id, validity_id, commission_type = 'FIXED', commission_value, calculation_basis = 'BASE_PRICE_ONLY', effective_from, effective_to, is_active = true, priority = 0, notes, } = req.body;
        if (!company_id || commission_value === undefined || !effective_from) {
            return res.status(400).json({
                error: 'company_id, commission_value, and effective_from are required.',
            });
        }
        if (Number(commission_value) < 0) {
            return res.status(400).json({ error: 'Commission value cannot be negative.' });
        }
        const id = `dpcc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const config = {
            id,
            organization_id: orgId,
            company_profile_id: user.company_profile_id || null,
            partner_id: partner_id || null,
            fee_type,
            company_id,
            product_id: product_id || null,
            class_id: class_id || null,
            validity_id: validity_id || null,
            commission_type,
            commission_value: Number(commission_value),
            calculation_basis,
            effective_from,
            effective_to: effective_to || null,
            is_active: Boolean(is_active),
            priority: Number(priority || 0),
            notes: notes || null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await (0, dscCommissionStore_1.saveCommissionConfig)(config);
        return res.status(201).json({ success: true, config });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.delete('/dsc/commission-configs/:id', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await (0, dscCommissionStore_1.deleteCommissionConfig)(orgId, id);
        return res.json({ success: true, message: 'Commission configuration deleted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 4. INCENTIVE CONFIGURATIONS CRUD (Quantity & Turnover)
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.get('/dsc/incentives/quantity', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const incentives = await (0, dscCommissionStore_1.getQuantityIncentives)(orgId, {
            partnerId: req.query.partner_id,
            companyId: req.query.company_id,
            periodType: req.query.period_type,
        });
        return res.json({ incentives, total: incentives.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.post('/dsc/incentives/quantity', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, period_type = 'MONTHLY', min_quantity, max_quantity, incentive_amount, incentive_type = 'PER_UNIT', custom_period_from, custom_period_to, is_active = true, priority = 0, notes, } = req.body;
        if (min_quantity === undefined || incentive_amount === undefined) {
            return res.status(400).json({ error: 'min_quantity and incentive_amount are required.' });
        }
        if (Number(min_quantity) < 0 || Number(incentive_amount) < 0) {
            return res.status(400).json({ error: 'min_quantity and incentive_amount cannot be negative.' });
        }
        const id = `dpqi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const incentive = {
            id,
            organization_id: orgId,
            company_profile_id: user.company_profile_id || null,
            partner_id: partner_id || null,
            company_id: company_id || null,
            period_type,
            min_quantity: Number(min_quantity),
            max_quantity: max_quantity !== undefined && max_quantity !== null ? Number(max_quantity) : null,
            incentive_amount: Number(incentive_amount),
            incentive_type,
            custom_period_from: custom_period_from || null,
            custom_period_to: custom_period_to || null,
            is_active: Boolean(is_active),
            priority: Number(priority || 0),
            notes: notes || null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await (0, dscCommissionStore_1.saveQuantityIncentive)(incentive);
        return res.status(201).json({ success: true, incentive });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.delete('/dsc/incentives/quantity/:id', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await (0, dscCommissionStore_1.deleteQuantityIncentive)(orgId, id);
        return res.json({ success: true, message: 'Quantity incentive deleted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.get('/dsc/incentives/turnover', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const incentives = await (0, dscCommissionStore_1.getTurnoverIncentives)(orgId, {
            partnerId: req.query.partner_id,
            companyId: req.query.company_id,
            periodType: req.query.period_type,
        });
        return res.json({ incentives, total: incentives.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.post('/dsc/incentives/turnover', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, period_type = 'MONTHLY', min_turnover, max_turnover, calculation_basis = 'BASE_PRICE_ONLY', incentive_type = 'PERCENTAGE', incentive_value, custom_period_from, custom_period_to, is_active = true, priority = 0, notes, } = req.body;
        if (min_turnover === undefined || incentive_value === undefined) {
            return res.status(400).json({ error: 'min_turnover and incentive_value are required.' });
        }
        if (Number(min_turnover) < 0 || Number(incentive_value) < 0) {
            return res.status(400).json({ error: 'min_turnover and incentive_value cannot be negative.' });
        }
        const id = `dpti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const incentive = {
            id,
            organization_id: orgId,
            company_profile_id: user.company_profile_id || null,
            partner_id: partner_id || null,
            company_id: company_id || null,
            period_type,
            min_turnover: Number(min_turnover),
            max_turnover: max_turnover !== undefined && max_turnover !== null ? Number(max_turnover) : null,
            calculation_basis,
            incentive_type,
            incentive_value: Number(incentive_value),
            custom_period_from: custom_period_from || null,
            custom_period_to: custom_period_to || null,
            is_active: Boolean(is_active),
            priority: Number(priority || 0),
            notes: notes || null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        await (0, dscCommissionStore_1.saveTurnoverIncentive)(incentive);
        return res.status(201).json({ success: true, incentive });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscCommissionRouter.delete('/dsc/incentives/turnover/:id', requireAdmin, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await (0, dscCommissionStore_1.deleteTurnoverIncentive)(orgId, id);
        return res.json({ success: true, message: 'Turnover incentive deleted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 5. COMMISSION RESOLUTION & SIMULATION ENDPOINT (/api/dsc/commission/resolve)
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.post('/dsc/commission/resolve', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, product_id, class_id, validity_id, selling_base_rate, gst_rate, date, support_fee_base_amount, quantity, } = req.body;
        if (!partner_id || !company_id || !product_id || selling_base_rate === undefined) {
            return res.status(400).json({
                error: 'partner_id, company_id, product_id, and selling_base_rate are required.',
            });
        }
        const resolution = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgId,
            companyProfileId: user.company_profile_id || null,
            partnerId: partner_id,
            companyId: company_id,
            productId: product_id,
            classId: class_id,
            validityId: validity_id,
            sellingBaseRate: Number(selling_base_rate),
            gstRate: gst_rate !== undefined ? Number(gst_rate) : 18,
            date: date || new Date().toISOString().split('T')[0],
            supportFeeBaseAmount: support_fee_base_amount ? Number(support_fee_base_amount) : 0,
            customQuantity: quantity ? Number(quantity) : 1,
        });
        return res.json({ success: true, resolution });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 6. COMMISSION TRANSACTIONS EXECUTION & OVERRIDE GUARD
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.post('/dsc/commission/transactions', requireAuth, async (req, res) => {
    var _a;
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, product_id, class_id, validity_id, selling_base_rate, gst_rate, date, support_fee_base_amount, quantity, override_warning, override_reason, } = req.body;
        if (!partner_id || !company_id || !product_id || selling_base_rate === undefined) {
            return res.status(400).json({
                error: 'partner_id, company_id, product_id, and selling_base_rate are required.',
            });
        }
        // 1. Resolve commission
        const resolution = await (0, dscCommissionEngine_1.resolveDscCommission)({
            organizationId: orgId,
            companyProfileId: user.company_profile_id || null,
            partnerId: partner_id,
            companyId: company_id,
            productId: product_id,
            classId: class_id,
            validityId: validity_id,
            sellingBaseRate: Number(selling_base_rate),
            gstRate: gst_rate !== undefined ? Number(gst_rate) : 18,
            date: date || new Date().toISOString().split('T')[0],
            supportFeeBaseAmount: support_fee_base_amount ? Number(support_fee_base_amount) : 0,
            customQuantity: quantity ? Number(quantity) : 1,
        });
        // 2. Check override guard if warning is active
        const result = await (0, dscCommissionEngine_1.createCommissionTransaction)(resolution, user, {
            isOverrideRequested: Boolean(override_warning),
            overrideReason: override_reason,
        });
        if (!result.success) {
            // 400 Bad Request or 403 Forbidden with warning details
            const isRbac = (_a = result.error) === null || _a === void 0 ? void 0 : _a.includes('Security restriction');
            return res.status(isRbac ? 403 : 400).json({
                error: result.error,
                margin_warning: resolution.marginWarning,
                margin_warning_amount: resolution.marginWarningAmount,
                provider_payout: resolution.providerPayoutAmount,
                partner_payout: resolution.totalPartnerPayout,
                requires_override: resolution.marginWarning,
            });
        }
        return res.status(201).json({
            success: true,
            transaction: result.transaction,
            resolution,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 7. REPORTS: PARTNER COMMISSIONS & MARGIN EXCEPTIONS
// ----------------------------------------------------------------------------
exports.dscCommissionRouter.get('/dsc/reports/commissions', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, from_date, to_date, margin_warning_only } = req.query;
        const txns = await (0, dscCommissionStore_1.getCommissionTransactions)(orgId, {
            partnerId: partner_id,
            companyId: company_id,
            fromDate: from_date,
            toDate: to_date,
            marginWarningOnly: margin_warning_only === 'true',
        });
        const summary = {
            total_transactions: txns.length,
            total_certificates: txns.reduce((s, t) => s + (t.quantity || 1), 0),
            total_selling_amount: txns.reduce((s, t) => s + Number(t.total_selling_price || 0), 0),
            total_provider_payout: txns.reduce((s, t) => s + Number(t.provider_payout_amount || 0), 0),
            total_partner_commission: txns.reduce((s, t) => s + Number(t.total_partner_payout || 0), 0),
            total_net_margin: txns.reduce((s, t) => s + Number(t.net_retained_margin || 0), 0),
            margin_warning_count: txns.filter((t) => t.margin_warning).length,
        };
        return res.json({ summary, transactions: txns });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Calculate partner incentives across period
exports.dscCommissionRouter.get('/dsc/reports/incentives-summary', requireAuth, async (req, res) => {
    try {
        const user = getSessionUser(req);
        const orgId = user.organization_id || 'comp-default';
        const { partner_id, company_id, from_date, to_date } = req.query;
        if (!partner_id || !from_date || !to_date) {
            return res.status(400).json({ error: 'partner_id, from_date, and to_date are required.' });
        }
        const calc = await (0, dscCommissionEngine_1.calculatePartnerIncentives)(orgId, partner_id, {
            companyId: company_id,
            fromDate: from_date,
            toDate: to_date,
        });
        return res.json({ success: true, calculation: calc });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
