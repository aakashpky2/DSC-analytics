"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.courierModuleRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../supabase");
const courierMasterStore_1 = require("../courierMasterStore");
const dscMasterStore_1 = require("../dscMasterStore");
const api_1 = require("./api");
const XLSX = __importStar(require("xlsx"));
const qrcode_1 = __importDefault(require("qrcode"));
exports.courierModuleRouter = (0, express_1.Router)();
function getSessionUser(req) {
    return req.user;
}
function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }
    next();
}
function requireAdmin(req, res, next) {
    const user = getSessionUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }
    if (user.hierarchy_level_order > 1) {
        return res.status(403).json({ error: 'You do not have permission to manage logistics master settings.' });
    }
    next();
}
// ----------------------------------------------------
// 1. Unified Master Fetcher (/api/courier/masters/all)
// ----------------------------------------------------
exports.courierModuleRouter.get('/courier/masters/all', (0, api_1.requirePermission)('courier', 'can_view'), async (_req, res) => {
    try {
        const [couriers, statuses, rtoReasons, dispatchMethods, packagingTypes, slaSettings,] = await Promise.all([
            (0, courierMasterStore_1.getCourierPartners)(),
            (0, courierMasterStore_1.getShipmentStatuses)(),
            (0, courierMasterStore_1.getCourierRtoReasons)(),
            (0, courierMasterStore_1.getDispatchMethods)(),
            (0, courierMasterStore_1.getPackagingTypes)(),
            (0, courierMasterStore_1.getSlaSettings)(),
        ]);
        return res.json({
            couriers,
            statuses,
            rtoReasons,
            dispatchMethods,
            packagingTypes,
            slaSettings,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to fetch logistics masters' });
    }
});
// ----------------------------------------------------
// 2. Dynamic Tracking URL Resolver
// ----------------------------------------------------
exports.courierModuleRouter.get('/courier/track-url', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    try {
        const { courier_id, awb } = req.query;
        if (!courier_id || !awb) {
            return res.status(400).json({ error: 'courier_id and awb are required.' });
        }
        const courier = await (0, supabase_1.queryOne)('SELECT * FROM courier_partners WHERE id = ?', [courier_id]);
        if (!courier) {
            return res.status(404).json({ error: 'Courier partner not found.' });
        }
        const template = courier.tracking_url_template || 'https://www.google.com/search?q={TRACKING_NO}';
        const trackingUrl = template
            .replace(/{TRACKING_NO}/gi, String(awb).trim())
            .replace(/{awb}/gi, String(awb).trim())
            .replace(/{TRACKING_NUMBER}/gi, String(awb).trim());
        return res.json({
            courier_name: courier.company_name,
            awb,
            tracking_url: trackingUrl,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 3. Package Verification API
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/verify-package', (0, api_1.requirePermission)('courier', 'can_create'), async (req, res) => {
    try {
        const currentUser = getSessionUser(req);
        const { application_id, lead_id, serial_number } = req.body;
        if (!serial_number) {
            return res.status(400).json({ error: 'serial_number is required.' });
        }
        const cleanSerial = String(serial_number).trim().toUpperCase();
        const token = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
        if (!token) {
            return res.status(404).json({ error: `Token serial '${cleanSerial}' not found in inventory.` });
        }
        // Branch scoping
        if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.branch_id) && token.branch_id && token.branch_id !== currentUser.branch_id) {
            return res.status(403).json({ error: 'Access denied: Token belongs to another branch.' });
        }
        // Check if token is ready for dispatch: status should be RESERVED or CONFIGURED
        const isReady = token.status === 'CONFIGURED' || token.status === 'RESERVED';
        if (!isReady) {
            return res.status(400).json({
                error: `Token '${cleanSerial}' is currently in status '${token.status}' and cannot be dispatched. Token must be CONFIGURED or RESERVED.`,
                current_status: token.status,
            });
        }
        // If application_id provided, verify DSC application
        let appRecord = null;
        if (application_id) {
            appRecord = await (0, supabase_1.queryOne)('SELECT * FROM dsc_applications WHERE id = ?', [application_id]);
        }
        // Audit verification
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'VERIFY_TOKEN_PACKAGE',
            moduleKey: 'courier',
            tableAffected: 'token_serials',
            recordId: token.id,
            newValueJson: { serial_number: cleanSerial, application_id, lead_id },
            reason: 'Physical hardware packaging verification prior to courier dispatch',
        });
        return res.json({
            verified: true,
            message: `Token '${cleanSerial}' verified and ready for shipment packaging.`,
            token: {
                id: token.id,
                serial_number: token.serial_number,
                token_model: token.token_model,
                status: token.status,
            },
            application: appRecord
                ? {
                    id: appRecord.id,
                    application_number: appRecord.application_number,
                    applicant_name: appRecord.applicant_name,
                    stage: appRecord.stage,
                }
                : null,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 4. Shipment Creation with Token Consistency & Snapshot
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/shipments', (0, api_1.requirePermission)('courier', 'can_create'), async (req, res) => {
    try {
        const currentUser = getSessionUser(req);
        const { courier_id, awb_number, dispatch_method_code, packaging_type_code, serial_number, application_id, lead_id, recipient_name, recipient_phone, alternate_phone, shipping_address, district, state, pin_code, expected_delivery_date, notes, } = req.body;
        // 1. Validation
        if (!recipient_name || !shipping_address) {
            return res.status(400).json({ error: 'Recipient name and shipping address are required.' });
        }
        const cleanAwb = awb_number ? String(awb_number).trim().toUpperCase() : null;
        const cleanSerial = serial_number ? String(serial_number).trim().toUpperCase() : null;
        // AWB uniqueness check
        if (cleanAwb) {
            const existingAwb = await (0, supabase_1.queryOne)('SELECT id FROM courier_dispatches WHERE awb_number = ?', [cleanAwb]);
            if (existingAwb) {
                return res.status(409).json({ error: `Tracking / AWB Number '${cleanAwb}' is already assigned to shipment ${existingAwb.id}.` });
            }
        }
        // Verify courier partner if provided
        let carrierName = 'Direct Logistics';
        let courierRecord = null;
        if (courier_id) {
            courierRecord = await (0, supabase_1.queryOne)('SELECT * FROM courier_partners WHERE id = ?', [courier_id]);
            if (!courierRecord) {
                return res.status(404).json({ error: 'Courier partner not found.' });
            }
            if (courierRecord.is_active === 0) {
                return res.status(400).json({ error: `Courier '${courierRecord.company_name}' is inactive and cannot accept new shipments.` });
            }
            carrierName = courierRecord.company_name;
        }
        // Verify token serial & atomic transition to DISPATCHED
        if (cleanSerial) {
            const tokenRow = await (0, supabase_1.queryOne)('SELECT * FROM token_serials WHERE serial_number = ?', [cleanSerial]);
            if (!tokenRow) {
                return res.status(404).json({ error: `Token serial '${cleanSerial}' not found in inventory.` });
            }
            if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.branch_id) && tokenRow.branch_id && tokenRow.branch_id !== currentUser.branch_id) {
                return res.status(403).json({ error: 'Access denied: Token belongs to another branch.' });
            }
            if (tokenRow.status !== 'CONFIGURED' && tokenRow.status !== 'RESERVED' && tokenRow.status !== 'AVAILABLE' && tokenRow.status !== 'in_stock') {
                return res.status(409).json({
                    error: `Token '${cleanSerial}' cannot be dispatched. Current status is '${tokenRow.status}'.`,
                });
            }
            // Atomically update token status to DISPATCHED
            const { data: updatedTokens, error: tokenErr } = await supabase_1.supabase
                .from('token_serials')
                .update({ status: 'DISPATCHED' })
                .eq('serial_number', cleanSerial)
                .select();
            if (tokenErr || !updatedTokens || updatedTokens.length === 0) {
                return res.status(409).json({ error: `Token '${cleanSerial}' was modified by another transaction.` });
            }
            // Record in token custody history
            const custodyEntry = {
                id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                serial_number: cleanSerial,
                from_status: tokenRow.status,
                to_status: 'DISPATCHED',
                performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
                courier_partner_id: courier_id || null,
                awb_number: cleanAwb || null,
                recipient_name,
                shipping_address,
                notes: `Dispatched via ${carrierName}. AWB: ${cleanAwb || 'N/A'}`,
                timestamp: new Date().toISOString(),
            };
            const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
            custodyHistory.push(custodyEntry);
            await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        }
        // 2. Generate Reference & Insert into courier_dispatches
        const dispatchId = `disp-${Date.now()}`;
        const dispatchNumber = `DSP-${Date.now().toString().slice(-6)}`;
        // Snapshot recipient & SLA info in notes JSON
        const dispatchSnapshot = {
            courier_id: courier_id || null,
            dispatch_method_code: dispatch_method_code || 'COURIER_SURFACE',
            packaging_type_code: packaging_type_code || 'TAMPER_EVIDENT_ENVELOPE',
            serial_number: cleanSerial,
            application_id: application_id || null,
            lead_id: lead_id || null,
            district: district || null,
            state: state || null,
            pin_code: pin_code || null,
            alternate_phone: alternate_phone || null,
            expected_delivery_date: expected_delivery_date || null,
            sla_snapshot_days: 3,
            manifest_id: null,
            notes: notes || 'Standard outward dispatch',
        };
        const orgId = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.organization_id) || 'comp-default';
        await (0, supabase_1.run)(`
      INSERT INTO courier_dispatches (
        id, organization_id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone,
        shipping_address, package_contents, status, proof_of_delivery_url, dispatched_at, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANIFESTED', null, CURRENT_TIMESTAMP, ?)
    `, [
            dispatchId,
            orgId,
            dispatchNumber,
            carrierName,
            cleanAwb || 'AWB-PENDING',
            recipient_name.trim(),
            recipient_phone || 'NA',
            shipping_address.trim(),
            cleanSerial ? `Hardware Token: ${cleanSerial}` : 'Cryptographic USB Token',
            JSON.stringify(dispatchSnapshot),
        ]);
        // 3. Record Initial Tracking Milestone
        const milestoneEntry = {
            id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            shipment_id: dispatchId,
            awb_number: cleanAwb,
            status: 'MANIFESTED',
            location: 'Central Fulfillment Hub',
            remarks: `Shipment created with ${carrierName}`,
            recorded_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'System Operator',
            timestamp: new Date().toISOString(),
        };
        const milestones = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
        milestones.push(milestoneEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_milestones', milestones);
        // 4. Customer Dispatch Notification Generation (SMS & WhatsApp queue)
        let dynamicTrackingUrl = `https://www.google.com/search?q=${cleanAwb || ''}`;
        if ((courierRecord === null || courierRecord === void 0 ? void 0 : courierRecord.tracking_url_template) && cleanAwb) {
            dynamicTrackingUrl = courierRecord.tracking_url_template
                .replace(/{TRACKING_NO}/gi, cleanAwb)
                .replace(/{awb}/gi, cleanAwb)
                .replace(/{TRACKING_NUMBER}/gi, cleanAwb);
        }
        const notificationRecord = {
            id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            shipment_id: dispatchId,
            dispatch_number: dispatchNumber,
            awb_number: cleanAwb,
            carrier_name: carrierName,
            tracking_url: dynamicTrackingUrl,
            recipient_name,
            recipient_phone: recipient_phone || 'NA',
            lead_id: lead_id || null,
            application_id: application_id || null,
            channels: ['SMS', 'WHATSAPP'],
            status: 'PENDING',
            message: `Dear ${recipient_name}, your SignSync cryptographic token order (${dispatchNumber}) has been dispatched via ${carrierName}. AWB: ${cleanAwb || 'Pending'}. Track your consignment: ${dynamicTrackingUrl}`,
            created_at: new Date().toISOString(),
        };
        const notifQueue = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_notifications');
        notifQueue.push(notificationRecord);
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_notifications', notifQueue);
        // 5. Audit Logging
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'CREATE_SHIPMENT_DISPATCH',
            moduleKey: 'courier',
            tableAffected: 'courier_dispatches',
            recordId: dispatchId,
            newValueJson: {
                dispatch_number: dispatchNumber,
                awb_number: cleanAwb,
                carrier_name: carrierName,
                serial_number: cleanSerial,
            },
            reason: `Consignment created with AWB ${cleanAwb || 'Pending'}`,
        });
        return res.status(201).json({
            success: true,
            shipment_id: dispatchId,
            dispatch_number: dispatchNumber,
            awb_number: cleanAwb,
            carrier_name: carrierName,
            status: 'MANIFESTED',
            notification: notificationRecord,
            message: 'Shipment created and package manifested successfully.',
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 5. Daily Dispatch Manifest API
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/manifests', (0, api_1.requirePermission)('courier', 'can_create'), async (req, res) => {
    try {
        const currentUser = getSessionUser(req);
        const { courier_id, shipment_ids = [], remarks } = req.body;
        if (!courier_id || !Array.isArray(shipment_ids) || shipment_ids.length === 0) {
            return res.status(400).json({ error: 'courier_id and list of shipment_ids are required.' });
        }
        const courier = await (0, supabase_1.queryOne)('SELECT * FROM courier_partners WHERE id = ?', [courier_id]);
        if (!courier) {
            return res.status(404).json({ error: 'Courier partner not found.' });
        }
        const manifestNumber = `MNF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        const manifestId = `mnf-${Date.now()}`;
        // Fetch and update shipments with manifest ID & update status to HANDED_TO_COURIER
        const manifestedShipments = [];
        for (const sId of shipment_ids) {
            const sh = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [sId]);
            if (sh) {
                let snap = {};
                try {
                    snap = JSON.parse(sh.notes || '{}');
                }
                catch (_a) { }
                snap.manifest_id = manifestId;
                snap.manifest_number = manifestNumber;
                await (0, supabase_1.run)(`
          UPDATE courier_dispatches
          SET status = ?,
              notes = ?
          WHERE id = ?
        `, ['HANDED_TO_COURIER', JSON.stringify(snap), sId]);
                manifestedShipments.push({
                    id: sh.id,
                    dispatch_number: sh.dispatch_number,
                    awb_number: sh.awb_number,
                    recipient_name: sh.recipient_name,
                    package_contents: sh.package_contents,
                });
                // Add milestone for each shipment
                const milestones = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
                milestones.push({
                    id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    shipment_id: sh.id,
                    awb_number: sh.awb_number,
                    status: 'HANDED_TO_COURIER',
                    location: 'Dispatch Dock / Hub',
                    remarks: `Handed over to ${courier.company_name} under Manifest ${manifestNumber}`,
                    recorded_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'Dispatch Executive',
                    timestamp: new Date().toISOString(),
                });
                await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_milestones', milestones);
            }
        }
        const manifestRecord = {
            id: manifestId,
            manifest_number: manifestNumber,
            courier_id,
            courier_name: courier.company_name,
            created_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            created_by_name: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'Logistics Officer',
            shipment_count: manifestedShipments.length,
            shipments: manifestedShipments,
            remarks: remarks || 'Standard daily courier collection',
            created_at: new Date().toISOString(),
        };
        const manifests = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_manifests');
        manifests.push(manifestRecord);
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_manifests', manifests);
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'CREATE_DISPATCH_MANIFEST',
            moduleKey: 'courier',
            tableAffected: 'courier_rel_manifests',
            recordId: manifestId,
            newValueJson: { manifest_number: manifestNumber, courier_name: courier.company_name, shipment_count: manifestedShipments.length },
            reason: `Consignments handed over to ${courier.company_name}`,
        });
        return res.status(201).json({
            success: true,
            manifest: manifestRecord,
            message: `Manifest ${manifestNumber} generated with ${manifestedShipments.length} consignments.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 6. Tracking Milestone Update (Manual or Carrier Webhook)
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/milestones', (0, api_1.requirePermission)('courier', 'can_edit'), async (req, res) => {
    try {
        const currentUser = getSessionUser(req);
        const { shipment_id, status, location, remarks } = req.body;
        if (!shipment_id || !status) {
            return res.status(400).json({ error: 'shipment_id and status are required.' });
        }
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [shipment_id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        // Update status on courier_dispatches
        await (0, supabase_1.run)(`
      UPDATE courier_dispatches
      SET status = ?,
          notes = notes
      WHERE id = ?
    `, [status, shipment_id]);
        const milestoneEntry = {
            id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            shipment_id,
            awb_number: shipment.awb_number,
            status,
            location: location || 'Transit Hub',
            remarks: remarks || `Status updated to ${status}`,
            recorded_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'Carrier API / Webhook',
            timestamp: new Date().toISOString(),
        };
        const milestones = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
        milestones.push(milestoneEntry);
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_milestones', milestones);
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'UPDATE_TRACKING_MILESTONE',
            moduleKey: 'courier',
            tableAffected: 'courier_dispatches',
            recordId: shipment_id,
            oldValueJson: { status: shipment.status },
            newValueJson: { status, location },
            reason: remarks || `Shipment transitioned to ${status}`,
        });
        return res.status(201).json({
            success: true,
            milestone: milestoneEntry,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 7. Delivery Confirmation & Acknowledgment
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/confirm-delivery', (0, api_1.requirePermission)('courier', 'can_edit'), async (req, res) => {
    var _a;
    try {
        const currentUser = getSessionUser(req);
        const { shipment_id, received_by, proof_of_delivery_url, remarks } = req.body;
        if (!shipment_id) {
            return res.status(400).json({ error: 'shipment_id is required.' });
        }
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [shipment_id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        // Update dispatch status to DELIVERED
        await (0, supabase_1.run)(`
      UPDATE courier_dispatches
      SET status = ?,
          notes = notes
      WHERE id = ?
    `, ['DELIVERED', shipment_id]);
        // Update corresponding token serial to DELIVERED if serial is present
        let snap = {};
        try {
            snap = JSON.parse(shipment.notes || '{}');
        }
        catch (_b) { }
        const serialToUpdate = snap.serial_number || (((_a = shipment.package_contents) === null || _a === void 0 ? void 0 : _a.startsWith('Hardware Token: ')) ? shipment.package_contents.replace('Hardware Token: ', '').trim() : null);
        if (serialToUpdate) {
            const { error: tokErr } = await supabase_1.supabase
                .from('token_serials')
                .update({ status: 'DELIVERED' })
                .eq('serial_number', serialToUpdate);
            if (tokErr) {
                console.error('Error updating token serial status to DELIVERED:', tokErr.message);
            }
            // Add custody entry
            const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
            custodyHistory.push({
                id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                serial_number: serialToUpdate,
                from_status: 'DISPATCHED',
                to_status: 'DELIVERED',
                performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
                proof_of_delivery_url: proof_of_delivery_url || null,
                notes: `Delivery confirmed. Received by: ${received_by || shipment.recipient_name}`,
                timestamp: new Date().toISOString(),
            });
            await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        }
        // Record milestone
        const milestones = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
        milestones.push({
            id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            shipment_id,
            awb_number: shipment.awb_number,
            status: 'DELIVERED',
            location: shipment.shipping_address,
            remarks: `Delivered and signed by ${received_by || shipment.recipient_name}. ${remarks || ''}`,
            recorded_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'System Operator',
            timestamp: new Date().toISOString(),
        });
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_milestones', milestones);
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'CONFIRM_DELIVERY',
            moduleKey: 'courier',
            tableAffected: 'courier_dispatches',
            recordId: shipment_id,
            newValueJson: { received_by: received_by || shipment.recipient_name, proof_of_delivery_url },
            reason: remarks || 'Delivery confirmed with proof of delivery',
        });
        return res.json({
            success: true,
            message: `Shipment ${shipment.dispatch_number} confirmed delivered.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 8. RTO Marking & Operational Remediation Task
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/rto', (0, api_1.requirePermission)('courier', 'can_edit'), async (req, res) => {
    try {
        const currentUser = getSessionUser(req);
        const { shipment_id, rto_reason_code, remarks } = req.body;
        if (!shipment_id || !rto_reason_code) {
            return res.status(400).json({ error: 'shipment_id and rto_reason_code are required.' });
        }
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [shipment_id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        // Update dispatch status to RTO_IN_TRANSIT
        await (0, supabase_1.run)(`
      UPDATE courier_dispatches
      SET status = ?
      WHERE id = ?
    `, ['RTO_IN_TRANSIT', shipment_id]);
        // Create operational RTO task
        const taskId = `rto-tsk-${Date.now()}`;
        const rtoTask = {
            id: taskId,
            shipment_id,
            dispatch_number: shipment.dispatch_number,
            awb_number: shipment.awb_number,
            recipient_name: shipment.recipient_name,
            recipient_phone: shipment.recipient_phone,
            rto_reason_code,
            status: 'PENDING_VERIFICATION',
            assigned_team: 'Telecalling & Field Operations',
            created_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            created_by_name: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'Logistics Officer',
            remarks: remarks || 'RTO initiated by delivery courier',
            created_at: new Date().toISOString(),
        };
        const rtoTasks = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_rto_tasks');
        rtoTasks.push(rtoTask);
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_rto_tasks', rtoTasks);
        // Record milestone
        const milestones = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_milestones');
        milestones.push({
            id: `ms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            shipment_id,
            awb_number: shipment.awb_number,
            status: 'RTO_IN_TRANSIT',
            location: 'Return Sorting Center',
            remarks: `RTO initiated: ${rto_reason_code}. Operational task ${taskId} assigned.`,
            recorded_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.full_name) || 'System Operator',
            timestamp: new Date().toISOString(),
        });
        await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_milestones', milestones);
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'MARK_RTO_EXCEPTION',
            moduleKey: 'courier',
            tableAffected: 'courier_dispatches',
            recordId: shipment_id,
            newValueJson: { rto_reason_code, task_id: taskId },
            reason: remarks || `RTO initiated for ${rto_reason_code}`,
        });
        return res.status(201).json({
            success: true,
            task: rtoTask,
            message: `Shipment marked as RTO. Operational remediation task ${taskId} created.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 9. Physical Return Verification & Inventory Restocking
// ----------------------------------------------------
exports.courierModuleRouter.post('/courier/return-to-inventory', (0, api_1.requirePermission)('courier', 'can_edit'), async (req, res) => {
    var _a;
    try {
        const currentUser = getSessionUser(req);
        const { shipment_id, verified_serial_number, physical_condition, branch_id, notes } = req.body;
        if (!shipment_id || !verified_serial_number) {
            return res.status(400).json({ error: 'shipment_id and verified_serial_number are required.' });
        }
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [shipment_id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        let snap = {};
        try {
            snap = JSON.parse(shipment.notes || '{}');
        }
        catch (_b) { }
        const cleanVerified = String(verified_serial_number).trim().toUpperCase();
        let cleanOriginal = snap.serial_number ? String(snap.serial_number).trim().toUpperCase() : null;
        if (!cleanOriginal && ((_a = shipment.package_contents) === null || _a === void 0 ? void 0 : _a.startsWith('Hardware Token: '))) {
            cleanOriginal = shipment.package_contents.replace('Hardware Token: ', '').trim().toUpperCase();
        }
        // Strict physical verification check
        if (cleanOriginal && cleanVerified !== cleanOriginal) {
            return res.status(400).json({
                error: `Physical token mismatch violation: Returned token serial '${cleanVerified}' does NOT match original dispatched serial '${cleanOriginal}'. Restocking blocked.`,
                original_serial: cleanOriginal,
                verified_serial: cleanVerified,
            });
        }
        // Determine target token status based on physical condition
        const isDamaged = physical_condition === 'DAMAGED';
        const targetStatus = isDamaged ? 'BLOCKED_DEFECTIVE' : 'AVAILABLE';
        // Update token serial status and branch in database
        await (0, supabase_1.run)(`
      UPDATE token_serials
      SET status = ?,
          partner_id = null
      WHERE serial_number = ?
    `, [targetStatus, cleanVerified]);
        // Update shipment status to RETURNED_TO_OFFICE
        await (0, supabase_1.run)(`
      UPDATE courier_dispatches
      SET status = ?
      WHERE id = ?
    `, ['RETURNED_TO_OFFICE', shipment_id]);
        // Custody entry
        const custodyHistory = await (0, dscMasterStore_1.getRelationalStore)('token_rel_custody_history');
        custodyHistory.push({
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            serial_number: cleanVerified,
            from_status: 'DISPATCHED',
            to_status: targetStatus,
            performed_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            notes: `Token physically returned to office from shipment ${shipment.dispatch_number}. Condition: ${physical_condition || 'OK'}. Restocked to: ${targetStatus}`,
            timestamp: new Date().toISOString(),
        });
        await (0, dscMasterStore_1.saveRelationalStore)('token_rel_custody_history', custodyHistory);
        // Complete RTO task if exists
        const rtoTasks = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_rto_tasks');
        const tIdx = rtoTasks.findIndex((t) => t.shipment_id === shipment_id);
        if (tIdx !== -1) {
            rtoTasks[tIdx].status = 'RESTOCKED_COMPLETED';
            rtoTasks[tIdx].completed_at = new Date().toISOString();
            await (0, dscMasterStore_1.saveRelationalStore)('courier_rel_rto_tasks', rtoTasks);
        }
        await (0, api_1.logAuditEvent)({
            userId: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'system',
            actionType: 'RESTOCK_RETURNED_TOKEN',
            moduleKey: 'courier',
            tableAffected: 'token_serials',
            recordId: cleanVerified,
            newValueJson: { serial_number: cleanVerified, restocked_status: targetStatus, physical_condition },
            reason: notes || 'Token physically inspected and returned to inventory',
        });
        return res.json({
            success: true,
            message: `Token '${cleanVerified}' physically verified and restocked to status '${targetStatus}'.`,
            restocked_status: targetStatus,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 10. Shipping / Packing Slip API
// ----------------------------------------------------
exports.courierModuleRouter.get('/courier/shipments/:id/shipping-slip', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    var _a;
    try {
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [req.params.id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        let snap = {};
        try {
            snap = JSON.parse(shipment.notes || '{}');
        }
        catch (_b) { }
        const profile = await (0, supabase_1.queryOne)('SELECT * FROM company_profile WHERE id = ?', ['comp-default']);
        const tokenSerial = snap.serial_number || (((_a = shipment.package_contents) === null || _a === void 0 ? void 0 : _a.startsWith('Hardware Token: ')) ? shipment.package_contents.replace('Hardware Token: ', '').trim() : 'N/A');
        const orderId = snap.application_id || shipment.dispatch_number;
        // Generate Barcode / QR Data URL resolving Order ID + Token Serial
        const qrPayload = JSON.stringify({
            order_id: orderId,
            serial_number: tokenSerial,
            awb: shipment.awb_number,
            carrier: shipment.carrier_name,
        });
        const qrDataUrl = await qrcode_1.default.toDataURL(qrPayload, { margin: 1, width: 140 });
        const slip = {
            document_type: 'Tax Invoice & Physical Packing Slip',
            dispatch_number: shipment.dispatch_number,
            order_id: orderId,
            awb_number: shipment.awb_number,
            carrier_name: shipment.carrier_name,
            dispatched_at: shipment.dispatched_at || shipment.created_at,
            token_serial_number: tokenSerial,
            contents: shipment.package_contents,
            consignee: {
                name: shipment.recipient_name,
                phone: shipment.recipient_phone,
                alternate_phone: snap.alternate_phone || null,
                shipping_address: shipment.shipping_address,
                district: snap.district || 'N/A',
                state: snap.state || 'N/A',
                pin_code: snap.pin_code || 'N/A',
            },
            consignor: {
                legal_name: (profile === null || profile === void 0 ? void 0 : profile.legal_name) || 'SignSync Digital Services Private Limited',
                trade_name: (profile === null || profile === void 0 ? void 0 : profile.trade_name) || 'SignSync B2B Enterprise',
                return_address: (profile === null || profile === void 0 ? void 0 : profile.registered_address) || 'Suite 404, Tech Park, Andheri East, Mumbai, Maharashtra 400069',
                support_phone: (profile === null || profile === void 0 ? void 0 : profile.phone) || '+91 22 4567 8900',
                support_email: (profile === null || profile === void 0 ? void 0 : profile.email) || 'support@signsync.io',
                gstin: (profile === null || profile === void 0 ? void 0 : profile.gstin) || '27AAECS1234F1Z5',
            },
            qr_code_data_url: qrDataUrl,
            generated_at: new Date().toISOString(),
        };
        if (req.query.format === 'html') {
            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shipping Slip - ${shipment.dispatch_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; font-size: 13px; color: #111; }
    .slip { border: 2px solid #000; padding: 20px; max-width: 600px; margin: 0 auto; }
    .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; }
    .title { font-size: 18px; font-weight: bold; }
    .grid { display: flex; gap: 20px; margin-bottom: 12px; }
    .col { flex: 1; border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
    .label { font-weight: bold; font-size: 10px; color: #555; text-transform: uppercase; margin-bottom: 4px; }
    .field { margin-bottom: 4px; }
    .qr { text-align: center; margin-top: 10px; }
    .footer { border-top: 1px dashed #000; padding-top: 10px; margin-top: 12px; font-size: 11px; text-align: center; }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <div>
        <div class="title">COURIER DISPATCH PACKING SLIP</div>
        <div>Dispatch #: <strong>${slip.dispatch_number}</strong></div>
        <div>Carrier: <strong>${slip.carrier_name}</strong> | AWB: <strong>${slip.awb_number}</strong></div>
      </div>
      <div class="qr">
        <img src="${slip.qr_code_data_url}" alt="QR" width="90" height="90" />
      </div>
    </div>
    <div class="grid">
      <div class="col">
        <div class="label">Deliver To (Consignee)</div>
        <div class="field"><strong>${slip.consignee.name}</strong></div>
        <div class="field">${slip.consignee.shipping_address}</div>
        <div class="field">${slip.consignee.district}, ${slip.consignee.state} - ${slip.consignee.pin_code}</div>
        <div class="field">Phone: ${slip.consignee.phone} ${slip.consignee.alternate_phone ? ' / ' + slip.consignee.alternate_phone : ''}</div>
      </div>
      <div class="col">
        <div class="label">Sender / Return To (Consignor)</div>
        <div class="field"><strong>${slip.consignor.legal_name}</strong></div>
        <div class="field">${slip.consignor.return_address}</div>
        <div class="field">GSTIN: ${slip.consignor.gstin}</div>
        <div class="field">Support: ${slip.consignor.support_phone}</div>
      </div>
    </div>
    <div style="border: 1px solid #000; padding: 8px; margin-bottom: 12px; background: #f9f9f9;">
      <div class="label">Package Contents & Verified Hardware</div>
      <div><strong>${slip.contents}</strong></div>
      <div>Hardware Serial Number: <strong>${slip.token_serial_number}</strong></div>
      <div>Linked Order Ref: <strong>${slip.order_id}</strong></div>
    </div>
    <div class="footer">
      Please inspect package tamper seal before signing courier receipt. For queries email ${slip.consignor.support_email}.
    </div>
  </div>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
        }
        return res.json({ slip });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------
// 11. Logistics Reporting & Export APIs
// ----------------------------------------------------
// A. Daily Manifests List & Export
exports.courierModuleRouter.get('/courier/reports/manifests', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    try {
        const manifests = await (0, courierMasterStore_1.getManifests)();
        const { format } = req.query;
        if (format === 'csv') {
            const flatList = manifests.map((m) => ({
                manifest_id: m.id,
                manifest_number: m.manifest_number,
                courier_name: m.courier_name,
                created_by_name: m.created_by_name,
                shipment_count: m.shipment_count,
                created_at: m.created_at,
                remarks: m.remarks,
            }));
            const ws = XLSX.utils.json_to_sheet(flatList);
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="Daily_Dispatch_Manifests.csv"');
            return res.send(csv);
        }
        else if (format === 'xlsx') {
            const flatList = manifests.map((m) => ({
                manifest_id: m.id,
                manifest_number: m.manifest_number,
                courier_name: m.courier_name,
                created_by_name: m.created_by_name,
                shipment_count: m.shipment_count,
                created_at: m.created_at,
                remarks: m.remarks,
            }));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(flatList);
            XLSX.utils.book_append_sheet(wb, ws, 'Manifests');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Daily_Dispatch_Manifests.xlsx"');
            return res.send(buf);
        }
        return res.json({ manifests });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// B. In-Transit Aging Report & Export
exports.courierModuleRouter.get('/courier/reports/in-transit-aging', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    var _a;
    try {
        const shipments = await (0, supabase_1.queryAll)(`
      SELECT * FROM courier_dispatches 
      WHERE status IN ('MANIFESTED', 'HANDED_TO_COURIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY')
      ORDER BY dispatched_at ASC
    `);
        const slaList = await (0, courierMasterStore_1.getSlaSettings)();
        const defaultSlaDays = ((_a = slaList[0]) === null || _a === void 0 ? void 0 : _a.standard_sla_days) || 3;
        const now = new Date().getTime();
        const agingReport = shipments.map((s) => {
            let snap = {};
            try {
                snap = JSON.parse(s.notes || '{}');
            }
            catch (_a) { }
            const dispatchedTime = new Date(s.dispatched_at || s.created_at).getTime();
            const daysInTransit = Math.max(1, Math.round((now - dispatchedTime) / (1000 * 60 * 60 * 24)));
            const slaDays = snap.sla_snapshot_days || defaultSlaDays;
            let slaStatus = 'WITHIN_SLA';
            if (daysInTransit > slaDays) {
                slaStatus = 'OVERDUE';
            }
            else if (daysInTransit === slaDays) {
                slaStatus = 'APPROACHING_SLA';
            }
            return {
                id: s.id,
                dispatch_number: s.dispatch_number,
                awb_number: s.awb_number,
                carrier_name: s.carrier_name,
                recipient_name: s.recipient_name,
                dispatched_at: s.dispatched_at,
                current_status: s.status,
                days_in_transit: daysInTransit,
                configured_sla_days: slaDays,
                sla_status: slaStatus,
            };
        });
        const { format } = req.query;
        if (format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(agingReport);
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="In_Transit_Aging_Report.csv"');
            return res.send(csv);
        }
        else if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(agingReport);
            XLSX.utils.book_append_sheet(wb, ws, 'Aging_Report');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="In_Transit_Aging_Report.xlsx"');
            return res.send(buf);
        }
        return res.json({ aging_report: agingReport });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// C. Delivery Success Rate & Carrier Performance & Export
exports.courierModuleRouter.get('/courier/reports/delivery-performance', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    try {
        const shipments = await (0, supabase_1.queryAll)('SELECT * FROM courier_dispatches');
        const total = shipments.length;
        const delivered = shipments.filter((s) => s.status === 'DELIVERED' || s.status === 'DELIVERY_ACKNOWLEDGED').length;
        const rto = shipments.filter((s) => s.status === 'RTO_IN_TRANSIT' || s.status === 'RETURNED_TO_OFFICE' || s.status === 'DELIVERY_FAILED').length;
        const inTransit = shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY' || s.status === 'HANDED_TO_COURIER').length;
        // Performance by carrier
        const carriers = await (0, courierMasterStore_1.getCourierPartners)();
        const carrierPerformance = carriers.map((c) => {
            const cShipments = shipments.filter((s) => { var _a, _b; return ((_a = s.carrier_name) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === ((_b = c.company_name) === null || _b === void 0 ? void 0 : _b.toUpperCase()); });
            const cDelivered = cShipments.filter((s) => s.status === 'DELIVERED' || s.status === 'DELIVERY_ACKNOWLEDGED').length;
            return {
                carrier_name: c.company_name,
                total_shipments: cShipments.length,
                delivered: cDelivered,
                success_rate: cShipments.length > 0 ? `${Math.round((cDelivered / cShipments.length) * 100)}%` : '0%',
            };
        });
        const { format } = req.query;
        if (format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(carrierPerformance);
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="Carrier_Performance_Report.csv"');
            return res.send(csv);
        }
        else if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(carrierPerformance);
            XLSX.utils.book_append_sheet(wb, ws, 'Carrier_Performance');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Carrier_Performance_Report.xlsx"');
            return res.send(buf);
        }
        return res.json({
            metrics: {
                total_shipments: total,
                delivered,
                in_transit: inTransit,
                rto,
                overall_success_rate: total > 0 ? `${Math.round((delivered / total) * 100)}%` : '0%',
            },
            carrier_performance: carrierPerformance,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// D. RTO Audit Report & Export
exports.courierModuleRouter.get('/courier/reports/rto-audit', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    try {
        const tasks = await (0, courierMasterStore_1.getRtoTasks)();
        const { format } = req.query;
        if (format === 'csv') {
            const exportList = tasks.map((t) => ({
                task_id: t.id,
                shipment_id: t.shipment_id,
                dispatch_number: t.dispatch_number,
                awb_number: t.awb_number,
                recipient_name: t.recipient_name,
                rto_reason_code: t.rto_reason_code,
                task_status: t.status,
                created_at: t.created_at,
                completed_at: t.completed_at || 'Pending',
                remarks: t.remarks,
            }));
            const ws = XLSX.utils.json_to_sheet(exportList);
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="RTO_Audit_Report.csv"');
            return res.send(csv);
        }
        else if (format === 'xlsx') {
            const exportList = tasks.map((t) => ({
                task_id: t.id,
                shipment_id: t.shipment_id,
                dispatch_number: t.dispatch_number,
                awb_number: t.awb_number,
                recipient_name: t.recipient_name,
                rto_reason_code: t.rto_reason_code,
                task_status: t.status,
                created_at: t.created_at,
                completed_at: t.completed_at || 'Pending',
                remarks: t.remarks,
            }));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportList);
            XLSX.utils.book_append_sheet(wb, ws, 'RTO_Audit');
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="RTO_Audit_Report.xlsx"');
            return res.send(buf);
        }
        return res.json({ rto_tasks: tasks });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// E. Customer Notifications Audit List
exports.courierModuleRouter.get('/courier/notifications', (0, api_1.requirePermission)('courier', 'can_view'), async (_req, res) => {
    try {
        const notifs = await (0, dscMasterStore_1.getRelationalStore)('courier_rel_notifications');
        return res.json({ notifications: notifs });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// F. Shipment Detail with Milestones
exports.courierModuleRouter.get('/courier/shipments/:id', (0, api_1.requirePermission)('courier', 'can_view'), async (req, res) => {
    try {
        const shipment = await (0, supabase_1.queryOne)('SELECT * FROM courier_dispatches WHERE id = ?', [req.params.id]);
        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }
        const allMilestones = await (0, courierMasterStore_1.getMilestones)();
        const shipmentMilestones = allMilestones.filter((m) => m.shipment_id === req.params.id);
        let snap = {};
        try {
            snap = JSON.parse(shipment.notes || '{}');
        }
        catch (_a) { }
        return res.json({
            shipment: Object.assign(Object.assign({}, shipment), { snapshot: snap }),
            milestones: shipmentMilestones,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
