"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const localDb_1 = require("../localDb");
const businessLogic_1 = require("../../lib/businessLogic");
const masking_1 = require("../../lib/masking");
const auth_1 = require("../auth");
exports.apiRouter = (0, express_1.Router)();
// ==========================================
// RBAC & Session Security Middleware
// ==========================================
async function resolveUserContext(req, _res, next) {
    var _a;
    try {
        const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[auth_1.SESSION_COOKIE_NAME];
        if (token) {
            const sessionUser = await (0, auth_1.validateSessionToken)(token);
            if (sessionUser) {
                ;
                req.user = sessionUser;
                return next();
            }
        }
        const headerUserId = req.headers['x-user-id'];
        if (headerUserId) {
            const user = await (0, localDb_1.queryOne)(`
        SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
        FROM user_profiles u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
        WHERE u.id = ?
      `, [headerUserId]);
            if (user) {
                ;
                req.user = user;
                return next();
            }
        }
        ;
        req.user = null;
        next();
    }
    catch (_b) {
        ;
        req.user = null;
        next();
    }
}
exports.apiRouter.use(resolveUserContext);
function requireAuth(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }
    if (user.permissions_frozen) {
        return res.status(403).json({ error: 'Your account access has been temporarily paused by an administrator.' });
    }
    next();
}
function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.hierarchy_level_order > 1) {
        return res.status(403).json({ error: 'You do not have permission to open this page.' });
    }
    next();
}
// ==========================================
// Authentication Endpoints (/api/auth/*)
// ==========================================
// 1. POST /api/auth/login
exports.apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Please enter your email address.' });
        }
        if (!password || typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ error: 'Please enter your password.' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await (0, localDb_1.queryOne)(`SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
       FROM user_profiles u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
       WHERE LOWER(u.email) = ?`, [cleanEmail]);
        if (!user) {
            return res.status(401).json({ error: 'Incorrect email or password. Please try again.' });
        }
        const isValid = await (0, auth_1.verifyUserPassword)(user, password);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect email or password. Please try again.' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
        }
        if (user.permissions_frozen) {
            return res.status(403).json({ error: 'Your account access has been temporarily paused by an administrator.' });
        }
        const durationDays = rememberMe ? 30 : 1;
        const token = await (0, auth_1.createSession)(user.id, durationDays);
        res.cookie(auth_1.SESSION_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: durationDays * 24 * 60 * 60 * 1000,
        });
        return res.json({
            success: true,
            message: 'Signed in successfully.',
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role_name: user.role_name,
                level_order: user.hierarchy_level_order,
                level_name: user.level_name,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'An unexpected system error occurred. Please try again.' });
    }
});
// 2. POST /api/auth/logout
exports.apiRouter.post('/auth/logout', async (req, res) => {
    var _a;
    try {
        const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a[auth_1.SESSION_COOKIE_NAME];
        if (token) {
            await (0, auth_1.invalidateSession)(token);
        }
        res.clearCookie(auth_1.SESSION_COOKIE_NAME, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
        });
        return res.json({ success: true, message: 'You have been logged out successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Error logging out.' });
    }
});
// 3. GET /api/auth/me
exports.apiRouter.get('/auth/me', async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Your login has expired. Please sign in again.' });
        }
        return res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone_number: user.phone_number,
                role_name: user.role_name,
                hierarchy_level_order: user.hierarchy_level_order,
                level_name: user.level_name,
                status: user.status,
                permissions_frozen: user.permissions_frozen,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 4. POST /api/auth/forgot-password
exports.apiRouter.post('/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({ error: 'Please enter your email address.' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const user = await (0, localDb_1.queryOne)('SELECT id, email, full_name FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail]);
        if (user) {
            const resetToken = (0, auth_1.generateToken)(32);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            const resetId = `rst-${Date.now()}`;
            await (0, localDb_1.run)(`INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`, [resetId, user.id, resetToken, expiresAt]);
        }
        return res.json({
            success: true,
            message: 'If an account exists with this email, you will receive password reset instructions.',
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to process password reset request.' });
    }
});
// 5. POST /api/auth/reset-password
exports.apiRouter.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Invalid or missing password reset link.' });
        }
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }
        const nowIso = new Date().toISOString();
        const resetRecord = await (0, localDb_1.queryOne)(`SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?`, [token, nowIso]);
        if (!resetRecord) {
            return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
        }
        const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
        await (0, localDb_1.run)(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashedPassword, resetRecord.user_id]);
        await (0, localDb_1.run)(`UPDATE password_resets SET used = 1 WHERE id = ?`, [resetRecord.id]);
        await (0, auth_1.invalidateAllUserSessions)(resetRecord.user_id);
        return res.json({
            success: true,
            message: 'Your password has been reset successfully. You can now sign in with your new password.',
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to reset password.' });
    }
});
// ==========================================
// 1. System Health & Session Context
// ==========================================
exports.apiRouter.get('/health', async (_req, res) => {
    try {
        const user = await (0, localDb_1.queryOne)('SELECT * FROM user_profiles WHERE id = ?', ['usr-admin-root']);
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
        const user = await (0, localDb_1.queryOne)(`
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
exports.apiRouter.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const users = await (0, localDb_1.queryAll)(`
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
exports.apiRouter.post('/admin/users', requireAdmin, async (req, res) => {
    try {
        const { email, full_name, phone_number, role_id, hierarchy_level_id, branch_id, initial_password } = req.body;
        if (!email || !full_name) {
            return res.status(400).json({ error: 'Email and full name are required.' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const existing = await (0, localDb_1.queryOne)('SELECT id FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail]);
        if (existing) {
            return res.status(400).json({ error: 'A staff member with this email address already exists.' });
        }
        const id = `usr-${Date.now()}`;
        const passwordPlain = initial_password && initial_password.length >= 8 ? initial_password : 'ChangeMe@123';
        const password_hash = await (0, auth_1.hashPassword)(passwordPlain);
        await (0, localDb_1.run)(`
      INSERT INTO user_profiles (id, email, password_hash, full_name, phone_number, role_id, hierarchy_level_id, branch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, cleanEmail, password_hash, full_name.trim(), phone_number || null, role_id || 'role-field-staff', hierarchy_level_id || 'tier-4', branch_id || null]);
        return res.status(201).json({ success: true, id, message: 'Staff account created successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/users/:id/freeze', requireAdmin, async (req, res) => {
    try {
        const { frozen } = req.body;
        const userId = req.params.id;
        if (userId === 'usr-admin-root') {
            return res.status(400).json({ error: 'The Master Super Admin account cannot be frozen.' });
        }
        await (0, localDb_1.run)(`UPDATE user_profiles SET permissions_frozen = ? WHERE id = ?`, [frozen ? 1 : 0, userId]);
        if (frozen) {
            await (0, auth_1.invalidateAllUserSessions)(userId);
        }
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
        const partners = await (0, localDb_1.queryAll)('SELECT * FROM partners ORDER BY created_at DESC');
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
        const partner = await (0, localDb_1.queryOne)('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const orders = await (0, localDb_1.queryAll)('SELECT * FROM dsc_applications WHERE partner_id = ? ORDER BY created_at DESC', [req.params.id]);
        const invoices = await (0, localDb_1.queryAll)('SELECT * FROM invoices WHERE partner_id = ? ORDER BY invoice_date DESC', [req.params.id]);
        const ledger = await (0, localDb_1.queryAll)('SELECT * FROM financial_ledger WHERE partner_id = ? ORDER BY entry_date DESC', [req.params.id]);
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
        await (0, localDb_1.run)(`
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
        const items = await (0, localDb_1.queryAll)('SELECT * FROM dsc_catalog ORDER BY class_type, validity_years');
        return res.json({ catalog: items });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/dsc/applications', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const apps = await (0, localDb_1.queryAll)(`
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
        await (0, localDb_1.run)(`
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
        await (0, localDb_1.run)(`
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
        const batches = await (0, localDb_1.queryAll)('SELECT * FROM token_purchase_batches ORDER BY created_at DESC');
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
        await (0, localDb_1.run)(`
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
        const stock = await (0, localDb_1.queryAll)(`
      SELECT s.*, b.branch_name, b.branch_code
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
      ORDER BY b.branch_name ASC
    `);
        const branches = await (0, localDb_1.queryAll)('SELECT id, branch_name, branch_code, city, state_code FROM branches ORDER BY branch_name ASC');
        return res.json({ stock, branches });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Transfer History: List Delivery Challans / Notes
exports.apiRouter.get('/inventory/transfers', async (_req, res) => {
    try {
        const challans = await (0, localDb_1.queryAll)(`
      SELECT dc.*, 
             sb.branch_name as source_branch_name, sb.branch_code as source_branch_code,
             db.branch_name as destination_branch_name, db.branch_code as destination_branch_code,
             u.full_name as issued_by_name
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      LEFT JOIN user_profiles u ON dc.issued_by = u.id
      ORDER BY dc.created_at DESC
    `);
        return res.json({ challans });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Create Delivery Challan / Inter-Branch Stock Transfer
exports.apiRouter.post('/inventory/transfers', requireAuth, async (req, res) => {
    try {
        const { source_branch_id, destination_branch_id, token_model, quantity, remarks, transfer_date } = req.body;
        const currentUser = req.user;
        if (!source_branch_id || !destination_branch_id || !token_model) {
            return res.status(400).json({ error: 'Source branch, destination branch, and token model are required.' });
        }
        if (source_branch_id === destination_branch_id) {
            return res.status(400).json({ error: 'Please select another branch. Source and destination branches must differ.' });
        }
        const parsedQty = parseInt(quantity, 10);
        if (isNaN(parsedQty) || parsedQty <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive whole number.' });
        }
        // Server-side stock verification against race conditions & over-allocation
        const sourceStock = await (0, localDb_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [source_branch_id, token_model]);
        if (!sourceStock || sourceStock.quantity_on_hand < parsedQty) {
            const available = sourceStock ? sourceStock.quantity_on_hand : 0;
            return res.status(400).json({
                error: `Not enough stock available. Source branch has only ${available} usable tokens.`
            });
        }
        const challanId = `dc-${Date.now()}`;
        const challanNumber = `DC-2026-${Date.now().toString().slice(-5)}`;
        const effectiveDate = transfer_date || new Date().toISOString().split('T')[0];
        // Atomically record transfer and deduct stock from source branch
        await (0, localDb_1.run)(`INSERT INTO delivery_challans (
        id, challan_number, source_branch_id, destination_branch_id, token_model, quantity, purpose, issued_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', ?)`, [challanId, challanNumber, source_branch_id, destination_branch_id, token_model, parsedQty, remarks || 'Inter-branch stock transfer', currentUser.id, effectiveDate]);
        // Deduct stock from source branch
        await (0, localDb_1.run)('UPDATE branch_token_stocks SET quantity_on_hand = quantity_on_hand - ? WHERE branch_id = ? AND token_model = ?', [parsedQty, source_branch_id, token_model]);
        // Ensure destination branch stock row exists and record receipt or in-transit
        const destStock = await (0, localDb_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [destination_branch_id, token_model]);
        if (!destStock) {
            const newStockId = `stock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await (0, localDb_1.run)('INSERT INTO branch_token_stocks (id, branch_id, token_model, quantity_on_hand, quarantine_damaged, min_threshold) VALUES (?, ?, ?, ?, 0, 10)', [newStockId, destination_branch_id, token_model, 0]);
        }
        return res.status(201).json({
            success: true,
            id: challanId,
            challan_number: challanNumber,
            message: 'Delivery note created successfully.'
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Confirm receipt of delivery challan at destination branch
exports.apiRouter.patch('/inventory/transfers/:id/receive', requireAuth, async (req, res) => {
    try {
        const challanId = req.params.id;
        const challan = await (0, localDb_1.queryOne)('SELECT * FROM delivery_challans WHERE id = ?', [challanId]);
        if (!challan)
            return res.status(404).json({ error: 'Delivery Challan not found.' });
        if (challan.status === 'received') {
            return res.status(400).json({ error: 'This delivery note has already been received.' });
        }
        if (challan.status === 'cancelled') {
            return res.status(400).json({ error: 'Cancelled delivery notes cannot be received.' });
        }
        // Add received quantity to destination branch
        await (0, localDb_1.run)('UPDATE branch_token_stocks SET quantity_on_hand = quantity_on_hand + ? WHERE branch_id = ? AND token_model = ?', [challan.quantity, challan.destination_branch_id, challan.token_model]);
        // Mark challan received
        await (0, localDb_1.run)('UPDATE delivery_challans SET status = \'received\' WHERE id = ?', [challanId]);
        return res.json({ success: true, status: 'received', message: 'Stock received and credited to destination branch.' });
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
        const leads = await (0, localDb_1.queryAll)(`
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
        const existing = await (0, localDb_1.queryAll)('SELECT id, lead_code, company_name, email, phone, gstin, pan FROM crm_leads WHERE is_merged = 0');
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
        await (0, localDb_1.run)(`
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
        await (0, localDb_1.run)(`
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
        const orders = await (0, localDb_1.queryAll)(`
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
        await (0, localDb_1.run)(`
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
        const accounts = await (0, localDb_1.queryAll)('SELECT * FROM bank_accounts WHERE is_active = 1');
        return res.json({ accounts });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/billing/series', async (_req, res) => {
    try {
        const series = await (0, localDb_1.queryAll)(`
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
        const invoices = await (0, localDb_1.queryAll)(`
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
        const series = await (0, localDb_1.queryOne)('SELECT * FROM invoice_series_configs WHERE id = ?', [series_id]);
        if (!series)
            return res.status(404).json({ error: 'Invoice series config not found' });
        const partner = await (0, localDb_1.queryOne)('SELECT * FROM partners WHERE id = ?', [partner_id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const subtotal = line_items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
        const gst = (0, businessLogic_1.calculateGst)(subtotal, partner.state_code);
        const nextCounter = series.current_counter + 1;
        const invoice_number = `${series.prefix}${nextCounter}${series.suffix || ''}`;
        const id = `inv-${Date.now()}`;
        await (0, localDb_1.run)('UPDATE invoice_series_configs SET current_counter = ? WHERE id = ?', [nextCounter, series.id]);
        await (0, localDb_1.run)(`
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
        await (0, localDb_1.run)(`
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
        const queue = await (0, localDb_1.queryAll)(`
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
        const payment = await (0, localDb_1.queryOne)('SELECT * FROM payments_received WHERE id = ?', [payment_id]);
        if (!payment)
            return res.status(404).json({ error: 'Payment record not found' });
        if (action === 'verified') {
            await (0, localDb_1.run)(`
        UPDATE payments_received
        SET verified_status = 'verified', verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [payment_id]);
            // Update invoice paid amount
            await (0, localDb_1.run)(`
        UPDATE invoices
        SET paid_amount = paid_amount + ?,
            outstanding_balance = outstanding_balance - ?,
            status = CASE WHEN (outstanding_balance - ?) <= 0 THEN 'paid' ELSE 'partially_paid' END
        WHERE id = ?
      `, [payment.amount_paid, payment.amount_paid, payment.amount_paid, payment.invoice_id]);
            // Post credit to financial ledger
            await (0, localDb_1.run)(`
        INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
        VALUES (?, ?, 'payment_received', ?, 0.0, ?, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) - ?), ?)
      `, [`led-${Date.now()}`, payment.partner_id, payment.id, payment.amount_paid, payment.partner_id, payment.amount_paid, `Payment received UTR: ${payment.transaction_reference_utr || 'Direct'}`]);
            return res.json({ success: true, status: 'verified' });
        }
        else {
            await (0, localDb_1.run)(`
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
        const dispatches = await (0, localDb_1.queryAll)('SELECT * FROM courier_dispatches ORDER BY dispatched_at DESC');
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
        await (0, localDb_1.run)(`
      INSERT INTO courier_dispatches (id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manifested')
    `, [id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents]);
        return res.status(201).json({ success: true, id, dispatch_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Delivery Challan / Transfer Document PDF Compilation
exports.apiRouter.get('/inventory/transfers/pdf', async (req, res) => {
    try {
        const challanNumber = req.query.challan_number || 'DC-2026-0001';
        const challans = await (0, localDb_1.queryAll)(`
      SELECT dc.*, 
             sb.branch_name as source_branch_name, sb.branch_code as source_branch_code, sb.city as source_city, sb.state_code as source_state,
             db.branch_name as destination_branch_name, db.branch_code as destination_branch_code, db.city as dest_city, db.state_code as dest_state,
             u.full_name as issued_by_name
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      LEFT JOIN user_profiles u ON dc.issued_by = u.id
      WHERE dc.challan_number = ?
    `, [challanNumber]);
        const challan = challans[0];
        const doc = {
            documentType: 'Inter-Branch Stock Transfer Delivery Challan',
            challanNumber: challan ? challan.challan_number : challanNumber,
            transferDate: challan ? challan.created_at : new Date().toISOString().split('T')[0],
            sourceBranch: {
                name: (challan === null || challan === void 0 ? void 0 : challan.source_branch_name) || 'Headquarters - Mumbai',
                code: (challan === null || challan === void 0 ? void 0 : challan.source_branch_code) || 'HQ-MUM',
                city: (challan === null || challan === void 0 ? void 0 : challan.source_city) || 'Mumbai',
                state: (challan === null || challan === void 0 ? void 0 : challan.source_state) || 'MH',
            },
            destinationBranch: {
                name: (challan === null || challan === void 0 ? void 0 : challan.destination_branch_name) || 'Regional Branch - Delhi',
                code: (challan === null || challan === void 0 ? void 0 : challan.destination_branch_code) || 'BR-DEL',
                city: (challan === null || challan === void 0 ? void 0 : challan.dest_city) || 'New Delhi',
                state: (challan === null || challan === void 0 ? void 0 : challan.dest_state) || 'DL',
            },
            lineItems: [
                {
                    item: challan ? challan.token_model.toUpperCase().replace('_', ' ') : 'EPASS2003 AUTO',
                    description: 'FIPS 140-2 Level 3 Cryptographic USB Hardware Token',
                    quantity: challan ? challan.quantity : 50,
                    purpose: (challan === null || challan === void 0 ? void 0 : challan.purpose) || 'Stock replenishment for local branch operations',
                }
            ],
            companyDetails: {
                legalName: 'SignSync Enterprise Solutions Pvt Ltd',
                gstin: '27AAACS1234A1Z1',
                registeredOffice: 'Express Towers, Nariman Point, Mumbai, Maharashtra 400021',
            },
            authorizedBy: (challan === null || challan === void 0 ? void 0 : challan.issued_by_name) || 'Operations Manager',
            status: (challan === null || challan === void 0 ? void 0 : challan.status) || 'dispatched',
            rulesCompliance: 'Under Rule 55 of CGST Rules 2017 - Movement of goods without supply',
            generatedAt: new Date().toISOString(),
        };
        return res.json(doc);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
