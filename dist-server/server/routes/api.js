"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const { queryAll, queryOne, run } = require('../initLocalDb.js');
const businessLogic_1 = require("../../lib/businessLogic");
const masking_1 = require("../../lib/masking");
exports.apiRouter = (0, express_1.Router)();
// ==========================================
// 1. System Health & Session Context
// ==========================================
exports.apiRouter.get('/health', async (_req, res) => {
    try {
        const user = await queryOne('SELECT * FROM user_profiles WHERE id = ?', ['usr-admin-root']);
        return res.json({
            status: 'ok',
            platform: 'SignSync B2B Enterprise v2.4',
            database: 'Connected (PostgreSQL / Local High-Speed SQLite Store)',
            activeUser: user === null || user === void 0 ? void 0 : user.full_name,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Database error';
        return res.status(500).json({ status: 'error', message: errorMsg });
    }
});
// Current user profile & effective permissions
exports.apiRouter.get('/auth/me', async (req, res) => {
    try {
        // Current user defaults to Super Admin or header user
        const userId = req.headers['x-user-id'] || 'usr-admin-root';
        const user = await queryOne(`
      SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      WHERE u.id = ?
    `, [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }
        return res.json({ user });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 2. User Administration & Granular RBAC
// ==========================================
exports.apiRouter.get('/admin/users', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const users = await queryAll(`
      SELECT u.id, u.email, u.full_name, u.phone_number, u.can_grant_permissions, u.permissions_frozen, u.status, u.created_at,
             r.name as role_name, h.level_order, h.level_name, b.branch_name
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      LEFT JOIN branches b ON u.branch_id = b.id
      ORDER BY h.level_order ASC, u.created_at DESC
    `);
        const sanitized = users.map((u) => (0, masking_1.applyPiiMasking)(u, mask));
        return res.json({ users: sanitized });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/users', async (req, res) => {
    try {
        const { email, full_name, phone_number, role_id, hierarchy_level_id, branch_id } = req.body;
        const id = `usr-${Date.now()}`;
        await run(`
      INSERT INTO user_profiles (id, email, password_hash, full_name, phone_number, role_id, hierarchy_level_id, branch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, email, 'password123', full_name, phone_number, role_id, hierarchy_level_id, branch_id]);
        return res.status(201).json({ success: true, id });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/users/:id/freeze', async (req, res) => {
    try {
        const { frozen } = req.body;
        await run(`UPDATE user_profiles SET permissions_frozen = ? WHERE id = ?`, [frozen ? 1 : 0, req.params.id]);
        return res.json({ success: true, frozen: Boolean(frozen) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 3. Partner Network Management
// ==========================================
exports.apiRouter.get('/partners', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const partners = await queryAll('SELECT * FROM partners ORDER BY created_at DESC');
        const sanitized = partners.map((p) => (0, masking_1.applyPiiMasking)(p, mask));
        return res.json({ partners: sanitized });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/partners/:id', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const partner = await queryOne('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const orders = await queryAll('SELECT * FROM dsc_applications WHERE partner_id = ? ORDER BY created_at DESC', [req.params.id]);
        const invoices = await queryAll('SELECT * FROM invoices WHERE partner_id = ? ORDER BY invoice_date DESC', [req.params.id]);
        const ledger = await queryAll('SELECT * FROM financial_ledger WHERE partner_id = ? ORDER BY entry_date DESC', [req.params.id]);
        return res.json({
            partner: (0, masking_1.applyPiiMasking)(partner, mask),
            orders,
            invoices,
            ledger,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/partners', async (req, res) => {
    try {
        const { type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit = 0, credit_period_days = 0, } = req.body;
        const id = `part-${Date.now()}`;
        const partner_code = `PRT-${Date.now().toString().slice(-4)}`;
        await run(`
      INSERT INTO partners (id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days]);
        return res.status(201).json({ success: true, id, partner_code });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 4. DSC Catalogue & Applications
// ==========================================
exports.apiRouter.get('/dsc/catalog', async (_req, res) => {
    try {
        const items = await queryAll('SELECT * FROM dsc_catalog ORDER BY class_type, validity_years');
        return res.json({ catalog: items });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/dsc/applications', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const apps = await queryAll(`
      SELECT a.*, p.company_name as partner_company, c.class_type, c.certificate_type, c.validity_years
      FROM dsc_applications a
      LEFT JOIN partners p ON a.partner_id = p.id
      LEFT JOIN dsc_catalog c ON a.catalog_id = c.id
      ORDER BY a.created_at DESC
    `);
        const sanitized = apps.map((app) => (0, masking_1.applyPiiMasking)(app, mask));
        return res.json({ applications: sanitized });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/dsc/applications', async (req, res) => {
    try {
        const { partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan } = req.body;
        const id = `app-${Date.now()}`;
        const application_number = `DSC-${Date.now().toString().slice(-6)}`;
        await run(`
      INSERT INTO dsc_applications (id, application_number, partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake')
    `, [id, application_number, partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan]);
        return res.status(201).json({ success: true, id, application_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/dsc/applications/:id/stage', async (req, res) => {
    try {
        const { stage, ca_reference_no, notes } = req.body;
        await run(`
      UPDATE dsc_applications
      SET stage = COALESCE(?, stage),
          ca_reference_no = COALESCE(?, ca_reference_no),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [stage, ca_reference_no, notes, req.params.id]);
        return res.json({ success: true });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 5. Hardware Token Inventory & Landed Cost
// ==========================================
exports.apiRouter.get('/inventory/batches', async (_req, res) => {
    try {
        const batches = await queryAll('SELECT * FROM token_purchase_batches ORDER BY created_at DESC');
        return res.json({ batches });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/inventory/batches', async (req, res) => {
    try {
        const { token_model, vendor_name, quantity_purchased, base_unit_price, inward_shipping_cost = 0, customs_or_taxes = 0, handling_charges = 0, } = req.body;
        const calc = (0, businessLogic_1.calculateLandedCost)({
            quantityPurchased: Number(quantity_purchased),
            baseUnitPrice: Number(base_unit_price),
            inwardShippingCost: Number(inward_shipping_cost),
            customsOrTaxes: Number(customs_or_taxes),
            handlingCharges: Number(handling_charges),
        });
        const id = `batch-${Date.now()}`;
        const batch_number = `BAT-${Date.now().toString().slice(-6)}`;
        await run(`
      INSERT INTO token_purchase_batches (
        id, batch_number, token_model, vendor_name, quantity_purchased,
        base_unit_price, inward_shipping_cost, customs_or_taxes, handling_charges,
        total_landed_cost, unit_landed_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id,
            batch_number,
            token_model,
            vendor_name,
            quantity_purchased,
            base_unit_price,
            inward_shipping_cost,
            customs_or_taxes,
            handling_charges,
            calc.totalBatchLandedCost,
            calc.unitLandedCost,
        ]);
        return res.status(201).json(Object.assign({ success: true, id, batch_number }, calc));
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/inventory/branches', async (_req, res) => {
    try {
        const stock = await queryAll(`
      SELECT s.*, b.branch_name, b.branch_code
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
    `);
        return res.json({ stock });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 6. CRM Leads & Deduplication Engine
// ==========================================
exports.apiRouter.get('/crm/leads', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const leads = await queryAll(`
      SELECT l.*, u.full_name as assigned_agent_name
      FROM crm_leads l
      LEFT JOIN user_profiles u ON l.assigned_to = u.id
      WHERE l.is_merged = 0
      ORDER BY l.created_at DESC
    `);
        const sanitized = leads.map((l) => (0, masking_1.applyPiiMasking)(l, mask));
        return res.json({ leads: sanitized });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/leads/check-duplicate', async (req, res) => {
    try {
        const { gstin, phone, email, pan, company_name } = req.body;
        const existing = await queryAll('SELECT id, lead_code, company_name, email, phone, gstin, pan FROM crm_leads WHERE is_merged = 0');
        const matches = (0, businessLogic_1.evaluateLeadDuplicates)({ gstin, phone, email, pan, companyName: company_name }, existing.map((e) => ({
            id: e.id,
            leadCode: e.lead_code,
            companyName: e.company_name,
            email: e.email,
            phone: e.phone,
            gstin: e.gstin,
            pan: e.pan,
        })));
        return res.json({
            matches,
            hasAlert: matches.some((m) => m.isDuplicateAlert),
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/leads', async (req, res) => {
    try {
        const { company_name, contact_person, email, phone, gstin, pan, requirement_summary } = req.body;
        const id = `lead-${Date.now()}`;
        const lead_code = `LD-${Date.now().toString().slice(-6)}`;
        await run(`
      INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `, [id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary]);
        return res.status(201).json({ success: true, id, lead_code });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/leads/merge', async (req, res) => {
    try {
        const { primary_lead_id, secondary_lead_id } = req.body;
        await run(`
      UPDATE crm_leads
      SET is_merged = 1, merged_into_lead_id = ?, status = 'merged', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [primary_lead_id, secondary_lead_id]);
        return res.json({ success: true, primary_lead_id, merged_id: secondary_lead_id });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 7. Additional Business Services Hub
// ==========================================
exports.apiRouter.get('/services/orders', async (_req, res) => {
    try {
        const orders = await queryAll(`
      SELECT s.*, p.company_name as partner_company
      FROM service_orders s
      LEFT JOIN partners p ON s.partner_id = p.id
      ORDER BY s.created_at DESC
    `);
        return res.json({ orders });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/services/orders', async (req, res) => {
    try {
        const { service_type, partner_id, client_name, client_contact, government_fees = 0, professional_fees = 0, notes } = req.body;
        const id = `srv-${Date.now()}`;
        const order_number = `SRV-${Date.now().toString().slice(-6)}`;
        await run(`
      INSERT INTO service_orders (id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft_review')
    `, [id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes]);
        return res.status(201).json({ success: true, id, order_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 8. Multi-Account Billing & Payments Queue
// ==========================================
exports.apiRouter.get('/billing/accounts', async (_req, res) => {
    try {
        const accounts = await queryAll('SELECT * FROM bank_accounts WHERE is_active = 1');
        return res.json({ accounts });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/billing/series', async (_req, res) => {
    try {
        const series = await queryAll(`
      SELECT s.*, b.bank_name, b.account_number, b.upi_id
      FROM invoice_series_configs s
      JOIN bank_accounts b ON s.mapped_bank_account_id = b.id
    `);
        return res.json({ series });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/billing/invoices', async (_req, res) => {
    try {
        const invoices = await queryAll(`
      SELECT i.*, p.company_name as partner_company, b.bank_name, b.account_number, b.upi_id
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      LEFT JOIN bank_accounts b ON i.bank_account_snapshot_id = b.id
      ORDER BY i.created_at DESC
    `);
        return res.json({ invoices });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/billing/invoices', async (req, res) => {
    try {
        const { series_id, partner_id, due_days = 30, line_items = [] } = req.body;
        const series = await queryOne('SELECT * FROM invoice_series_configs WHERE id = ?', [series_id]);
        if (!series)
            return res.status(404).json({ error: 'Invoice series config not found' });
        const partner = await queryOne('SELECT * FROM partners WHERE id = ?', [partner_id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const subtotal = line_items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
        const gst = (0, businessLogic_1.calculateGst)(subtotal, partner.state_code);
        const nextCounter = series.current_counter + 1;
        const invoice_number = `${series.prefix}${nextCounter}${series.suffix || ''}`;
        const id = `inv-${Date.now()}`;
        await run('UPDATE invoice_series_configs SET current_counter = ? WHERE id = ?', [nextCounter, series.id]);
        await run(`
      INSERT INTO invoices (
        id, invoice_number, series_id, partner_id, invoice_date, due_date,
        subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, paid_amount,
        outstanding_balance, status, bank_account_snapshot_id, line_items
      ) VALUES (?, ?, ?, ?, DATE('now'), DATE('now', '+' || ? || ' days'), ?, ?, ?, ?, ?, 0.0, ?, 'unpaid', ?, ?)
    `, [
            id,
            invoice_number,
            series.id,
            partner.id,
            due_days,
            subtotal,
            gst.cgst,
            gst.sgst,
            gst.igst,
            gst.total,
            gst.total,
            series.mapped_bank_account_id,
            JSON.stringify(line_items),
        ]);
        // Ledger debit entry
        await run(`
      INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
      VALUES (?, ?, 'invoice_raised', ?, ?, 0.0, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) + ?), ?)
    `, [`led-${Date.now()}`, partner.id, id, gst.total, partner.id, gst.total, `Invoice ${invoice_number} raised`]);
        return res.status(201).json({ success: true, id, invoice_number, total: gst.total });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Payment screenshot verification queue
exports.apiRouter.get('/billing/payments/queue', async (_req, res) => {
    try {
        const queue = await queryAll(`
      SELECT p.*, i.invoice_number, i.total_amount, i.outstanding_balance, i.line_items,
             pt.company_name as partner_company, b.bank_name, b.account_number
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
      LEFT JOIN bank_accounts b ON p.bank_account_id = b.id
      ORDER BY p.created_at DESC
    `);
        return res.json({ queue });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/billing/payments/verify', async (req, res) => {
    try {
        const { payment_id, action, rejection_remarks } = req.body; // action: 'verified' | 'rejected'
        const payment = await queryOne('SELECT * FROM payments_received WHERE id = ?', [payment_id]);
        if (!payment)
            return res.status(404).json({ error: 'Payment record not found' });
        if (action === 'verified') {
            await run(`
        UPDATE payments_received
        SET verified_status = 'verified', verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [payment_id]);
            // Update invoice paid amount
            await run(`
        UPDATE invoices
        SET paid_amount = paid_amount + ?,
            outstanding_balance = outstanding_balance - ?,
            status = CASE WHEN (outstanding_balance - ?) <= 0 THEN 'paid' ELSE 'partially_paid' END
        WHERE id = ?
      `, [payment.amount_paid, payment.amount_paid, payment.amount_paid, payment.invoice_id]);
            // Post credit to financial ledger
            await run(`
        INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
        VALUES (?, ?, 'payment_received', ?, 0.0, ?, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) - ?), ?)
      `, [`led-${Date.now()}`, payment.partner_id, payment.id, payment.amount_paid, payment.partner_id, payment.amount_paid, `Payment received UTR: ${payment.transaction_reference_utr || 'Direct'}`]);
            return res.json({ success: true, status: 'verified' });
        }
        else {
            await run(`
        UPDATE payments_received
        SET verified_status = 'rejected', rejection_remarks = ?, verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [rejection_remarks || 'Screenshot mismatch or invalid UTR', payment_id]);
            return res.json({ success: true, status: 'rejected' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 9. Logistics, Couriers & POD Tracking
// ==========================================
exports.apiRouter.get('/courier/dispatches', async (_req, res) => {
    try {
        const dispatches = await queryAll('SELECT * FROM courier_dispatches ORDER BY dispatched_at DESC');
        return res.json({ dispatches });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/courier/dispatches', async (req, res) => {
    try {
        const { carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents } = req.body;
        const id = `disp-${Date.now()}`;
        const dispatch_number = `DSP-${Date.now().toString().slice(-6)}`;
        await run(`
      INSERT INTO courier_dispatches (id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manifested')
    `, [id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents]);
        return res.status(201).json({ success: true, id, dispatch_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
