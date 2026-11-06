"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dscMasterRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../supabase");
const dscMasterStore_1 = require("../dscMasterStore");
exports.dscMasterRouter = (0, express_1.Router)();
// Simple session check helper
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
        return res.status(403).json({ error: 'You do not have permission to manage system masters.' });
    }
    next();
}
// ----------------------------------------------------
// 1. Unified Master Fetcher (/api/dsc/masters/all)
// ----------------------------------------------------
exports.dscMasterRouter.get('/dsc/masters/all', requireAuth, async (_req, res) => {
    try {
        const [workflowStages, certificateTypes, applicantCategories, validities, tokenStatuses, rmaReasons, tokenManufacturers, tokenModels, hardwareVendors, certifyingAuthorities, courierPartners,] = await Promise.all([
            (0, dscMasterStore_1.getWorkflowStages)(),
            (0, dscMasterStore_1.getCertificateTypes)(),
            (0, dscMasterStore_1.getApplicantCategories)(),
            (0, dscMasterStore_1.getValidities)(),
            (0, dscMasterStore_1.getTokenStatuses)(),
            (0, dscMasterStore_1.getRmaReasons)(),
            (0, dscMasterStore_1.getTokenManufacturers)(),
            (0, supabase_1.queryAll)('SELECT * FROM token_models ORDER BY model_name ASC'),
            (0, supabase_1.queryAll)('SELECT * FROM hardware_vendors ORDER BY vendor_name ASC'),
            (0, supabase_1.queryAll)('SELECT * FROM certifying_authorities ORDER BY ca_name ASC'),
            (0, supabase_1.queryAll)('SELECT * FROM courier_partners ORDER BY company_name ASC'),
        ]);
        return res.json({
            workflowStages,
            certificateTypes,
            applicantCategories,
            validities,
            tokenStatuses,
            rmaReasons,
            tokenManufacturers,
            tokenModels,
            hardwareVendors,
            certifyingAuthorities,
            courierPartners,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to fetch master data' });
    }
});
// ----------------------------------------------------
// 2. Individual Category Endpoints
// ----------------------------------------------------
// Workflows & Stages
exports.dscMasterRouter.get('/dsc/masters/workflow-stages', requireAuth, async (_req, res) => {
    try {
        const stages = await (0, dscMasterStore_1.getWorkflowStages)();
        return res.json({ stages });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/workflow-stages', requireAdmin, async (req, res) => {
    try {
        const { stage_key, stage_label, role_responsible, allowed_transitions, color, display_order } = req.body;
        if (!stage_key || !stage_label) {
            return res.status(400).json({ error: 'stage_key and stage_label are required.' });
        }
        const stages = await (0, dscMasterStore_1.getWorkflowStages)();
        const id = `stg-${Date.now()}`;
        const newStage = {
            id,
            workflow_id: 'wf-default',
            stage_key: stage_key.trim(),
            stage_label: stage_label.trim(),
            role_responsible: role_responsible || 'Staff',
            allowed_transitions: Array.isArray(allowed_transitions) ? allowed_transitions : [],
            color: color || 'border-indigo-500/40 text-indigo-400',
            display_order: Number(display_order) || stages.length + 1,
            is_active: 1,
        };
        stages.push(newStage);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_workflow_stages', stages);
        return res.status(201).json({ success: true, stage: newStage });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.put('/dsc/masters/workflow-stages/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const stages = await (0, dscMasterStore_1.getWorkflowStages)();
        const idx = stages.findIndex((s) => s.id === id || s.stage_key === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Workflow stage not found.' });
        }
        stages[idx] = Object.assign(Object.assign({}, stages[idx]), req.body);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_workflow_stages', stages);
        return res.json({ success: true, stage: stages[idx] });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.patch('/dsc/masters/workflow-stages/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const stages = await (0, dscMasterStore_1.getWorkflowStages)();
        const idx = stages.findIndex((s) => s.id === id || s.stage_key === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Workflow stage not found.' });
        }
        stages[idx].is_active = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_workflow_stages', stages);
        return res.json({ success: true, is_active: Boolean(stages[idx].is_active) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Certificate Types
exports.dscMasterRouter.get('/dsc/masters/certificate-types', requireAuth, async (_req, res) => {
    try {
        const types = await (0, dscMasterStore_1.getCertificateTypes)();
        return res.json({ certificate_types: types });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/certificate-types', requireAdmin, async (req, res) => {
    try {
        const { code, display_name, description } = req.body;
        if (!code || !display_name) {
            return res.status(400).json({ error: 'code and display_name are required.' });
        }
        const types = await (0, dscMasterStore_1.getCertificateTypes)();
        const newType = {
            id: `ct-${Date.now()}`,
            code: code.trim(),
            display_name: display_name.trim(),
            description: description || '',
            is_active: 1,
            display_order: types.length + 1,
        };
        types.push(newType);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_certificate_types', types);
        return res.status(201).json({ success: true, certificate_type: newType });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Applicant Categories
exports.dscMasterRouter.get('/dsc/masters/applicant-categories', requireAuth, async (_req, res) => {
    try {
        const categories = await (0, dscMasterStore_1.getApplicantCategories)();
        return res.json({ categories });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/applicant-categories', requireAdmin, async (req, res) => {
    try {
        const { code, display_name } = req.body;
        if (!code || !display_name) {
            return res.status(400).json({ error: 'code and display_name are required.' });
        }
        const categories = await (0, dscMasterStore_1.getApplicantCategories)();
        const newCat = {
            id: `ac-${Date.now()}`,
            code: code.trim(),
            display_name: display_name.trim(),
            is_active: 1,
            display_order: categories.length + 1,
        };
        categories.push(newCat);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_applicant_categories', categories);
        return res.status(201).json({ success: true, category: newCat });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Validities
exports.dscMasterRouter.get('/dsc/masters/validities', requireAuth, async (_req, res) => {
    try {
        const validities = await (0, dscMasterStore_1.getValidities)();
        return res.json({ validities });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/validities', requireAdmin, async (req, res) => {
    try {
        const { code, display_name, numeric_years } = req.body;
        if (!code || !display_name) {
            return res.status(400).json({ error: 'code and display_name are required.' });
        }
        const validities = await (0, dscMasterStore_1.getValidities)();
        const newVal = {
            id: `val-${Date.now()}`,
            code: code.trim(),
            display_name: display_name.trim(),
            numeric_years: Number(numeric_years) || 1,
            is_active: 1,
            display_order: validities.length + 1,
        };
        validities.push(newVal);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_master_validities', validities);
        return res.status(201).json({ success: true, validity: newVal });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Token Status Master
exports.dscMasterRouter.get('/dsc/masters/token-statuses', requireAuth, async (_req, res) => {
    try {
        const statuses = await (0, dscMasterStore_1.getTokenStatuses)();
        return res.json({ statuses });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// RMA Reasons Master
exports.dscMasterRouter.get('/dsc/masters/rma-reasons', requireAuth, async (_req, res) => {
    try {
        const reasons = await (0, dscMasterStore_1.getRmaReasons)();
        return res.json({ reasons });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/rma-reasons', requireAdmin, async (req, res) => {
    try {
        const { code, label } = req.body;
        if (!code || !label) {
            return res.status(400).json({ error: 'code and label are required.' });
        }
        const reasons = await (0, dscMasterStore_1.getRmaReasons)();
        const newReason = {
            id: `rma-${Date.now()}`,
            code: code.trim().toUpperCase(),
            label: label.trim(),
            is_active: 1,
        };
        reasons.push(newReason);
        await (0, dscMasterStore_1.saveRelationalStore)('token_master_rma_reasons', reasons);
        return res.status(201).json({ success: true, reason: newReason });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Token Manufacturers Master
exports.dscMasterRouter.get('/dsc/masters/manufacturers', requireAuth, async (_req, res) => {
    try {
        const manufacturers = await (0, dscMasterStore_1.getTokenManufacturers)();
        return res.json({ manufacturers });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.dscMasterRouter.post('/dsc/masters/manufacturers', requireAdmin, async (req, res) => {
    try {
        const { manufacturer_name, country, support_email } = req.body;
        if (!manufacturer_name) {
            return res.status(400).json({ error: 'manufacturer_name is required.' });
        }
        const manufacturers = await (0, dscMasterStore_1.getTokenManufacturers)();
        const newMan = {
            id: `man-${Date.now()}`,
            manufacturer_name: manufacturer_name.trim(),
            country: country || 'Global',
            support_email: support_email || '',
            is_active: 1,
        };
        manufacturers.push(newMan);
        await (0, dscMasterStore_1.saveRelationalStore)('token_master_manufacturers', manufacturers);
        return res.status(201).json({ success: true, manufacturer: newMan });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 3. Dynamic Workflow Stage Transition Engine
// ----------------------------------------------------
exports.dscMasterRouter.patch('/dsc/applications/:id/transition', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { target_stage, ca_reference_no, notes } = req.body;
        const currentUser = getSessionUser(req);
        if (!target_stage) {
            return res.status(400).json({ error: 'target_stage is required.' });
        }
        // 1. Fetch current application
        const app = await (0, supabase_1.queryOne)('SELECT * FROM dsc_applications WHERE id = ?', [id]);
        if (!app) {
            return res.status(404).json({ error: 'DSC Application not found.' });
        }
        const currentStageKey = app.stage || 'intake';
        // 2. Fetch active workflow stages from DB
        const stages = await (0, dscMasterStore_1.getWorkflowStages)();
        const currentConfig = stages.find((s) => s.stage_key === currentStageKey);
        const targetConfig = stages.find((s) => s.stage_key === target_stage);
        if (!targetConfig) {
            return res.status(400).json({ error: `Target stage '${target_stage}' is not a valid workflow stage.` });
        }
        // 3. Verify transition rule (unless user is super admin override or current == target)
        if (currentStageKey !== target_stage) {
            const allowed = (currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.allowed_transitions) || [];
            const isSuperAdmin = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.hierarchy_level_order) === 0;
            if (!allowed.includes(target_stage) && !isSuperAdmin) {
                return res.status(400).json({
                    error: `Workflow transition violation: Moving from '${(currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.stage_label) || currentStageKey}' to '${targetConfig.stage_label}' is not permitted by current workflow policy. Allowed transitions: ${allowed.join(', ') || 'None (Terminal stage)'}.`,
                });
            }
        }
        // 4. Update application in DB
        await (0, supabase_1.run)(`
      UPDATE dsc_applications
      SET stage = ?,
          ca_reference_no = COALESCE(?, ca_reference_no),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [target_stage, ca_reference_no || null, notes || null, id]);
        // 5. Record immutable stage transition audit log in relational store
        const historyEntry = {
            id: `trans-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            application_id: id,
            application_number: app.application_number,
            from_stage: currentStageKey,
            to_stage: target_stage,
            transitioned_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            transitioned_by_name: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'System User',
            ca_reference_no: ca_reference_no || app.ca_reference_no || null,
            notes: notes || null,
            timestamp: new Date().toISOString(),
        };
        const stageHistory = await (0, dscMasterStore_1.getRelationalStore)('dsc_rel_stage_history');
        stageHistory.push(historyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('dsc_rel_stage_history', stageHistory);
        return res.json({
            success: true,
            message: `Application transitioned to '${targetConfig.stage_label}' successfully.`,
            current_stage: target_stage,
            history_id: historyEntry.id,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Transition failed' });
    }
});
// ----------------------------------------------------
// 4. Token Lifecycle Engine (Reserve, Configure, Dispatch, Deliver, RMA)
// ----------------------------------------------------
// A. Token Reservation (Atomic check-and-set to prevent double assignment)
exports.dscMasterRouter.post('/inventory/tokens/reserve', requireAuth, async (req, res) => {
    try {
        const { serial_number, partner_id, application_id, lead_id, notes } = req.body;
        const currentUser = getSessionUser(req);
        if (!serial_number) {
            return res.status(400).json({ error: 'serial_number is required.' });
        }
        const cleanSerial = String(serial_number).trim().toUpperCase();
        // 1. Check existing serial status
        const serialRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!serialRow) {
            return res.status(404).json({ error: `Token serial '${cleanSerial}' not found in inventory.` });
        }
        // Normalizing status check: 'AVAILABLE' or legacy 'in_stock'
        const isAvail = serialRow.status === 'AVAILABLE' || serialRow.status === 'in_stock';
        if (!isAvail) {
            return res.status(409).json({
                error: `Token allocation conflict: Token '${cleanSerial}' is currently in status '${serialRow.status}' and cannot be reserved.`,
                current_status: serialRow.status,
                partner_id: serialRow.partner_id,
            });
        }
        // 2. Atomic update to RESERVED using direct supabase client
        const { data: updatedData, error: updateErr } = await supabase_1.supabase
            .from('token_serials')
            .update({
            status: 'RESERVED',
            partner_id: partner_id || null,
        })
            .eq('serial_number', cleanSerial)
            .in('status', ['AVAILABLE', 'in_stock'])
            .select();
        if (updateErr || !updatedData || updatedData.length === 0) {
            return res.status(409).json({ error: 'Token was reserved by another concurrent transaction.' });
        }
        const updated = updatedData[0];
        // 3. Record custody audit entry
        const custodyEntry = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanSerial,
            from_status: serialRow.status,
            to_status: 'RESERVED',
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            partner_id: partner_id || null,
            application_id: application_id || null,
            lead_id: lead_id || null,
            notes: notes || 'Token reserved for allocation',
            timestamp: new Date().toISOString(),
        };
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push(custodyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        return res.json({
            success: true,
            message: `Token '${cleanSerial}' successfully reserved.`,
            serial: updated,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// B. Token Configuration (Cryptographic DSC certificate written)
exports.dscMasterRouter.post('/inventory/tokens/configure', requireAuth, async (req, res) => {
    try {
        const { serial_number, application_id, ca_code, expiry_date, notes } = req.body;
        const currentUser = getSessionUser(req);
        if (!serial_number) {
            return res.status(400).json({ error: 'serial_number is required.' });
        }
        const cleanSerial = String(serial_number).trim().toUpperCase();
        const serialRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!serialRow) {
            return res.status(404).json({ error: `Token serial '${cleanSerial}' not found.` });
        }
        if (serialRow.status !== 'RESERVED' && serialRow.status !== 'AVAILABLE' && serialRow.status !== 'in_stock') {
            return res.status(400).json({
                error: `Cannot configure token in '${serialRow.status}' status. Token must be RESERVED or AVAILABLE.`,
            });
        }
        await (0, supabase_1.run)(`
      UPDATE token_serials
      SET status = 'CONFIGURED'
      WHERE serial_number = ?
    `, [cleanSerial]);
        const custodyEntry = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanSerial,
            from_status: serialRow.status,
            to_status: 'CONFIGURED',
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            application_id: application_id || null,
            ca_code: ca_code || null,
            expiry_date: expiry_date || null,
            notes: notes || 'DSC Certificate written to cryptographic token',
            timestamp: new Date().toISOString(),
        };
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push(custodyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        return res.json({
            success: true,
            message: `Token '${cleanSerial}' configured successfully.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// C. Token Dispatch & Delivery
exports.dscMasterRouter.post('/inventory/tokens/dispatch', requireAuth, async (req, res) => {
    try {
        const { serial_number, courier_partner_id, awb_number, recipient_name, recipient_phone, shipping_address } = req.body;
        const currentUser = getSessionUser(req);
        if (!serial_number || !courier_partner_id || !awb_number) {
            return res.status(400).json({ error: 'serial_number, courier_partner_id, and awb_number are required.' });
        }
        const cleanSerial = String(serial_number).trim().toUpperCase();
        const serialRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!serialRow) {
            return res.status(404).json({ error: `Token serial '${cleanSerial}' not found.` });
        }
        await (0, supabase_1.run)(`
      UPDATE token_serials
      SET status = 'DISPATCHED'
      WHERE serial_number = ?
    `, [cleanSerial]);
        const custodyEntry = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanSerial,
            from_status: serialRow.status,
            to_status: 'DISPATCHED',
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            courier_partner_id,
            awb_number,
            recipient_name: recipient_name || null,
            recipient_phone: recipient_phone || null,
            shipping_address: shipping_address || null,
            notes: `Dispatched via courier AWB: ${awb_number}`,
            timestamp: new Date().toISOString(),
        };
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push(custodyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        return res.json({
            success: true,
            message: `Token '${cleanSerial}' dispatched with AWB ${awb_number}.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// D. Token Delivery Confirmation
exports.dscMasterRouter.post('/inventory/tokens/deliver', requireAuth, async (req, res) => {
    try {
        const { serial_number, proof_of_delivery_url, receiver_signature_name, delivered_date } = req.body;
        const currentUser = getSessionUser(req);
        if (!serial_number) {
            return res.status(400).json({ error: 'serial_number is required.' });
        }
        const cleanSerial = String(serial_number).trim().toUpperCase();
        const serialRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!serialRow) {
            return res.status(404).json({ error: `Token serial '${cleanSerial}' not found.` });
        }
        await (0, supabase_1.run)(`
      UPDATE token_serials
      SET status = 'DELIVERED'
      WHERE serial_number = ?
    `, [cleanSerial]);
        const custodyEntry = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanSerial,
            from_status: serialRow.status,
            to_status: 'DELIVERED',
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            proof_of_delivery_url: proof_of_delivery_url || null,
            receiver_signature_name: receiver_signature_name || null,
            delivered_date: delivered_date || new Date().toISOString(),
            notes: `Delivered to recipient. Receiver: ${receiver_signature_name || 'Confirmed'}`,
            timestamp: new Date().toISOString(),
        };
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push(custodyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        return res.json({
            success: true,
            message: `Token '${cleanSerial}' confirmed delivered.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// E. RMA / Defective Replacement Engine
exports.dscMasterRouter.post('/inventory/tokens/rma', requireAuth, async (req, res) => {
    try {
        const { defective_serial, rma_reason_code, replacement_serial, vendor_id, notes, } = req.body;
        const currentUser = getSessionUser(req);
        if (!defective_serial || !rma_reason_code) {
            return res.status(400).json({ error: 'defective_serial and rma_reason_code are required.' });
        }
        const cleanDefective = String(defective_serial).trim().toUpperCase();
        // 1. Mark defective token as BLOCKED_DEFECTIVE / RETURNED_RMA
        const defRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanDefective]);
        if (!defRow) {
            return res.status(404).json({ error: `Defective token serial '${cleanDefective}' not found.` });
        }
        await (0, supabase_1.run)(`
      UPDATE token_serials
      SET status = 'RETURNED_RMA'
      WHERE serial_number = ?
    `, [cleanDefective]);
        // 2. If replacement token provided, verify it is available and reserve/issue it
        let repClean = null;
        if (replacement_serial) {
            repClean = String(replacement_serial).trim().toUpperCase();
            const repRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [repClean]);
            if (!repRow) {
                return res.status(404).json({ error: `Replacement token '${repClean}' not found.` });
            }
            if (repRow.status !== 'AVAILABLE' && repRow.status !== 'in_stock') {
                return res.status(409).json({ error: `Replacement token '${repClean}' is not available (status: ${repRow.status}).` });
            }
            await (0, supabase_1.run)(`
        UPDATE token_serials
        SET status = 'RESERVED',
            partner_id = ?
        WHERE serial_number = ?
      `, [defRow.partner_id || null, repClean]);
        }
        // 3. Save RMA Record
        const rmaRecord = {
            id: `rma-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            defective_serial: cleanDefective,
            token_model: defRow.token_model,
            partner_id: defRow.partner_id || null,
            rma_reason_code,
            vendor_id: vendor_id || null,
            replacement_serial: repClean,
            status: 'RETURNED_RMA',
            initiated_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            notes: notes || '',
            created_at: new Date().toISOString(),
        };
        const rmaList = await (0, dscMasterStore_1.getRelationalStore)('token_rel_rma_records');
        rmaList.push(rmaRecord);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_rma_records', rmaList);
        // 4. Custody audit record
        const custodyEntry = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanDefective,
            from_status: defRow.status,
            to_status: 'RETURNED_RMA',
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            notes: `Token marked defective (Reason: ${rma_reason_code}). RMA ID: ${rmaRecord.id}. Replacement: ${repClean || 'None'}`,
            timestamp: new Date().toISOString(),
        };
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push(custodyEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        return res.status(201).json({
            success: true,
            message: `RMA recorded for token '${cleanDefective}'.`,
            rma: rmaRecord,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 5. Reporting & Stock Ledger APIs
// ----------------------------------------------------
// A. Token Stock Ledger (Available, Reserved, Configured, Dispatched, Delivered, Defective, RMA per model)
exports.dscMasterRouter.get('/reports/token-stock-ledger', requireAuth, async (_req, res) => {
    try {
        const models = await (0, supabase_1.queryAll)('SELECT * FROM token_models WHERE is_active = 1 ORDER BY model_name ASC');
        const serials = await (0, supabase_1.queryAll)('SELECT token_model, status FROM token_serials');
        const ledger = models.map((m) => {
            const modelSerials = serials.filter((s) => { var _a, _b; return ((_a = s.token_model) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === ((_b = m.model_name) === null || _b === void 0 ? void 0 : _b.toUpperCase()); });
            const available = modelSerials.filter((s) => s.status === 'AVAILABLE' || s.status === 'in_stock').length;
            const reserved = modelSerials.filter((s) => s.status === 'RESERVED').length;
            const configured = modelSerials.filter((s) => s.status === 'CONFIGURED').length;
            const dispatched = modelSerials.filter((s) => s.status === 'DISPATCHED').length;
            const delivered = modelSerials.filter((s) => s.status === 'DELIVERED').length;
            const defective = modelSerials.filter((s) => s.status === 'BLOCKED_DEFECTIVE').length;
            const rma = modelSerials.filter((s) => s.status === 'RETURNED_RMA').length;
            const total = modelSerials.length;
            return {
                id: m.id,
                model_name: m.model_name,
                manufacturer: m.manufacturer,
                min_threshold: m.min_threshold,
                total_procured: total,
                available,
                reserved,
                configured,
                dispatched,
                delivered,
                defective,
                returned_rma: rma,
                is_low_stock: available <= (m.min_threshold || 10),
            };
        });
        return res.json({ ledger });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// B. Token Serial Audit Trail
exports.dscMasterRouter.get('/reports/token-serials/:serial/audit', requireAuth, async (req, res) => {
    try {
        const cleanSerial = String(req.params.serial).trim().toUpperCase();
        const serialRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!serialRow) {
            return res.status(404).json({ error: 'Token serial not found' });
        }
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        const auditTrail = custodyHistory.filter((c) => c.serial_number === cleanSerial);
        return res.json({
            serial: serialRow,
            audit_trail: auditTrail,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// C. RMA Report
exports.dscMasterRouter.get('/reports/token-rma', requireAuth, async (_req, res) => {
    try {
        const rmaRecords = await (0, dscMasterStore_1.getRelationalStore)('token_rel_rma_records');
        return res.json({ rma_records: rmaRecords });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// D. Available Tokens for Assignment (Filtered by model)
exports.dscMasterRouter.get('/inventory/tokens/available', requireAuth, async (req, res) => {
    try {
        const model = req.query.model ? String(req.query.model).trim().toUpperCase() : '';
        let sql = `SELECT * FROM token_serials WHERE (status = 'AVAILABLE' OR status = 'in_stock')`;
        const params = [];
        if (model) {
            sql += ' AND UPPER(token_model) = ?';
            params.push(model);
        }
        sql += ' ORDER BY created_at ASC LIMIT 100';
        const tokens = await (0, supabase_1.queryAll)(sql, params);
        return res.json({ tokens });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
