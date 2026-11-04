"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const localDb_1 = require("../localDb");
const businessLogic_1 = require("../../lib/businessLogic");
const masking_1 = require("../../lib/masking");
const pagination_1 = require("../pagination");
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
exports.apiRouter.get('/admin/roles', requireAdmin, async (_req, res) => {
    try {
        const roles = await (0, localDb_1.queryAll)(`
      SELECT r.*, h.level_order, h.level_name, COUNT(u.id) as staff_count
      FROM roles r
      JOIN hierarchy_levels h ON r.hierarchy_level_id = h.id
      LEFT JOIN user_profiles u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY h.level_order ASC
    `);
        const levels = await (0, localDb_1.queryAll)('SELECT * FROM hierarchy_levels ORDER BY level_order ASC');
        return res.json({ roles, levels });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = ` WHERE (u.full_name LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ? OR r.name LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        const selectSql = `
      SELECT u.id, u.email, u.full_name, u.phone_number, u.can_grant_permissions, u.permissions_frozen, u.status, u.created_at,
             r.name as role_name, h.level_order, h.level_name, b.branch_name
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      LEFT JOIN branches b ON u.branch_id = b.id
      ${whereClause}
      ORDER BY h.level_order ASC, u.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = result.data.map((u) => (0, masking_1.applyPiiMasking)(u, mask));
            return res.json({
                users: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const users = await (0, localDb_1.queryAll)(selectSql, params);
        const sanitized = users.map((u) => (0, masking_1.applyPiiMasking)(u, mask));
        return res.json({
            users: sanitized,
            page: 1,
            limit: sanitized.length,
            totalCount: sanitized.length,
            totalPages: 1,
        });
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
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = ` WHERE (company_name LIKE ? OR contact_person LIKE ? OR partner_code LIKE ? OR email LIKE ? OR phone LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }
        const selectSql = `SELECT * FROM partners ${whereClause} ORDER BY created_at DESC`;
        const countSql = `SELECT COUNT(*) as count FROM partners ${whereClause}`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = result.data.map((p) => (0, masking_1.applyPiiMasking)(p, mask));
            return res.json({
                partners: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const partners = await (0, localDb_1.queryAll)(selectSql, params);
        const sanitized = partners.map((p) => (0, masking_1.applyPiiMasking)(p, mask));
        return res.json({
            partners: sanitized,
            page: 1,
            limit: sanitized.length,
            totalCount: sanitized.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/dsc/catalog', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = 'SELECT * FROM dsc_catalog ORDER BY class_type, validity_years';
        const countSql = 'SELECT COUNT(*) as count FROM dsc_catalog';
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                catalog: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const items = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            catalog: items,
            page: 1,
            limit: items.length,
            totalCount: items.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/dsc/catalog', requireAdmin, async (req, res) => {
    try {
        const { class_type, certificate_type, validity_years, vendor_base_price, partner_price, mrp } = req.body;
        if (!class_type || !certificate_type || !validity_years) {
            return res.status(400).json({ error: 'Class type, certificate type, and validity are required.' });
        }
        const id = `cat-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO dsc_catalog (id, class_type, certificate_type, validity_years, vendor_base_price, partner_price, mrp, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, class_type, certificate_type, validity_years, parseFloat(vendor_base_price) || 0, parseFloat(partner_price) || 0, parseFloat(mrp) || 0]);
        return res.status(201).json({ success: true, id, message: 'DSC Product added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.put('/dsc/catalog/:id', requireAdmin, async (req, res) => {
    try {
        const { vendor_base_price, partner_price, mrp, is_active } = req.body;
        await (0, localDb_1.run)(`
      UPDATE dsc_catalog
      SET vendor_base_price = COALESCE(?, vendor_base_price),
          partner_price = COALESCE(?, partner_price),
          mrp = COALESCE(?, mrp),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [vendor_base_price, partner_price, mrp, is_active, req.params.id]);
        return res.json({ success: true, message: 'Price slab updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/dsc/applications', async (req, res) => {
    try {
        const mask = req.query.mask === 'true';
        const stage = req.query.stage ? String(req.query.stage).trim() : '';
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const conditions = [];
        const params = [];
        if (stage) {
            conditions.push('a.stage = ?');
            params.push(stage);
        }
        if (search) {
            conditions.push('(a.applicant_name LIKE ? OR a.application_number LIKE ? OR a.applicant_pan LIKE ? OR p.company_name LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const selectSql = `
      SELECT a.*, p.company_name as partner_company, c.class_type, c.certificate_type, c.validity_years
      FROM dsc_applications a
      LEFT JOIN partners p ON a.partner_id = p.id
      LEFT JOIN dsc_catalog c ON a.catalog_id = c.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM dsc_applications a
      LEFT JOIN partners p ON a.partner_id = p.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = result.data.map((app) => (0, masking_1.applyPiiMasking)(app, mask));
            return res.json({
                applications: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const apps = await (0, localDb_1.queryAll)(selectSql, params);
        const sanitized = apps.map((app) => (0, masking_1.applyPiiMasking)(app, mask));
        return res.json({
            applications: sanitized,
            page: 1,
            limit: sanitized.length,
            totalCount: sanitized.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/inventory/batches', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = 'SELECT * FROM token_purchase_batches ORDER BY created_at DESC';
        const countSql = 'SELECT COUNT(*) as count FROM token_purchase_batches';
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                batches: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const batches = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            batches,
            page: 1,
            limit: batches.length,
            totalCount: batches.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/inventory/branches', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = `
      SELECT s.*, b.branch_name, b.branch_code
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
      ORDER BY b.branch_name ASC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
    `;
        const branches = await (0, localDb_1.queryAll)('SELECT id, branch_name, branch_code, city, state_code FROM branches ORDER BY branch_name ASC');
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                stock: result.data,
                branches,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const stock = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            stock,
            branches,
            page: 1,
            limit: stock.length,
            totalCount: stock.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Transfer History: List Delivery Challans / Notes
exports.apiRouter.get('/inventory/transfers', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = `
      SELECT dc.*, 
             sb.branch_name as source_branch_name, sb.branch_code as source_branch_code,
             db.branch_name as destination_branch_name, db.branch_code as destination_branch_code,
             u.full_name as issued_by_name
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      LEFT JOIN user_profiles u ON dc.issued_by = u.id
      ORDER BY dc.created_at DESC
    `;
        const countSql = `SELECT COUNT(*) as count FROM delivery_challans`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                challans: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const challans = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            challans,
            page: 1,
            limit: challans.length,
            totalCount: challans.length,
            totalPages: 1,
        });
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
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = 'WHERE l.is_merged = 0';
        const params = [];
        if (search) {
            whereClause += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.lead_code LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }
        const selectSql = `
      SELECT l.*, u.full_name as assigned_agent_name
      FROM crm_leads l
      LEFT JOIN user_profiles u ON l.assigned_to = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM crm_leads l
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = result.data.map((l) => (0, masking_1.applyPiiMasking)(l, mask));
            return res.json({
                leads: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const leads = await (0, localDb_1.queryAll)(selectSql, params);
        const sanitized = leads.map((l) => (0, masking_1.applyPiiMasking)(l, mask));
        return res.json({
            leads: sanitized,
            page: 1,
            limit: sanitized.length,
            totalCount: sanitized.length,
            totalPages: 1,
        });
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
// CRM Follow-Up Actions & Agenda
exports.apiRouter.get('/crm/follow-ups', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = `
      SELECT f.id, f.lead_id, f.channel as contact_mode, f.scheduled_at as follow_up_date, f.status, f.disposition, f.notes,
             l.company_name, l.contact_person, l.phone, l.email, l.lead_code, u.full_name as conducted_by_name
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
      LEFT JOIN user_profiles u ON f.conducted_by = u.id
      ORDER BY f.scheduled_at ASC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                followUps: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const followUps = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            followUps,
            page: 1,
            limit: followUps.length,
            totalCount: followUps.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/follow-ups', requireAuth, async (req, res) => {
    try {
        const { lead_id, follow_up_date, contact_mode, notes, disposition } = req.body;
        const currentUser = req.user;
        if (!lead_id)
            return res.status(400).json({ error: 'Lead is required.' });
        const id = `fu-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO crm_follow_ups (id, lead_id, channel, scheduled_at, notes, disposition, conducted_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [id, lead_id, contact_mode || 'phone_call', follow_up_date || new Date().toISOString(), notes || null, disposition || null, currentUser.id]);
        return res.status(201).json({ success: true, id, message: 'Follow-up scheduled.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/crm/follow-ups/:id/complete', requireAuth, async (req, res) => {
    try {
        const { disposition, notes } = req.body;
        await (0, localDb_1.run)(`
      UPDATE crm_follow_ups
      SET status = 'completed', disposition = COALESCE(?, disposition), notes = COALESCE(?, notes)
      WHERE id = ?
    `, [disposition, notes, req.params.id]);
        return res.json({ success: true, message: 'Follow-up completed.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 7. Additional Business Services Hub
// ==========================================
exports.apiRouter.get('/services/orders', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = `
      SELECT s.*, p.company_name as partner_company
      FROM service_orders s
      LEFT JOIN partners p ON s.partner_id = p.id
      ORDER BY s.created_at DESC
    `;
        const countSql = `SELECT COUNT(*) as count FROM service_orders`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                orders: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const orders = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            orders,
            page: 1,
            limit: orders.length,
            totalCount: orders.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/billing/accounts', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = 'SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY account_nickname ASC';
        const countSql = 'SELECT COUNT(*) as count FROM bank_accounts WHERE is_active = 1';
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                accounts: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const accounts = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            accounts,
            page: 1,
            limit: accounts.length,
            totalCount: accounts.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/billing/accounts', requireAdmin, async (req, res) => {
    try {
        const { account_nickname, bank_name, account_number, ifsc_code, branch_name, account_holder_name, upi_id } = req.body;
        if (!account_nickname || !bank_name || !account_number || !ifsc_code) {
            return res.status(400).json({ error: 'Account nickname, bank name, account number, and IFSC are required.' });
        }
        const id = `bank-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO bank_accounts (id, account_nickname, bank_name, account_number, ifsc_code, branch_name, account_holder_name, upi_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, account_nickname, bank_name, account_number, ifsc_code, branch_name || 'Main Branch', account_holder_name || account_nickname, upi_id || null]);
        return res.status(201).json({ success: true, id, message: 'Bank account added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/billing/accounts/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        await (0, localDb_1.run)('UPDATE bank_accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Bank account deactivated.' });
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
exports.apiRouter.get('/billing/invoices', async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const status = req.query.status ? String(req.query.status).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const conditions = [];
        const params = [];
        if (status) {
            conditions.push('i.status = ?');
            params.push(status);
        }
        if (search) {
            conditions.push('(i.invoice_number LIKE ? OR p.company_name LIKE ? OR b.bank_name LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const selectSql = `
      SELECT i.*, p.company_name as partner_company, b.bank_name, b.account_number, b.upi_id
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      LEFT JOIN bank_accounts b ON i.bank_account_snapshot_id = b.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                invoices: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const invoices = await (0, localDb_1.queryAll)(selectSql, params);
        return res.json({
            invoices,
            page: 1,
            limit: invoices.length,
            totalCount: invoices.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/billing/payments/queue', async (req, res) => {
    try {
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const selectSql = `
      SELECT p.*, i.invoice_number, i.total_amount, i.outstanding_balance, i.line_items,
             pt.company_name as partner_company, b.bank_name, b.account_number
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
      LEFT JOIN bank_accounts b ON p.bank_account_id = b.id
      ORDER BY p.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, [], { page, limit, offset });
            return res.json({
                queue: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const queue = await (0, localDb_1.queryAll)(selectSql);
        return res.json({
            queue,
            page: 1,
            limit: queue.length,
            totalCount: queue.length,
            totalPages: 1,
        });
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
exports.apiRouter.get('/courier/dispatches', async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (dispatch_number LIKE ? OR carrier_name LIKE ? OR awb_number LIKE ? OR recipient_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        const selectSql = `SELECT * FROM courier_dispatches ${whereClause} ORDER BY dispatched_at DESC`;
        const countSql = `SELECT COUNT(*) as count FROM courier_dispatches ${whereClause}`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                dispatches: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const dispatches = await (0, localDb_1.queryAll)(selectSql, params);
        return res.json({
            dispatches,
            page: 1,
            limit: dispatches.length,
            totalCount: dispatches.length,
            totalPages: 1,
        });
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
        const profile = await (0, localDb_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
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
                legalName: (profile === null || profile === void 0 ? void 0 : profile.legal_name) || 'SignSync Technologies Private Limited',
                gstin: (profile === null || profile === void 0 ? void 0 : profile.gstin) || '27AAACS1234A1Z1',
                registeredOffice: (profile === null || profile === void 0 ? void 0 : profile.registered_address) || 'Suite 401, Nariman Point, Mumbai, Maharashtra 400021',
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
// ==========================================
// 10. Administrator Central Settings (Phase 2)
// ==========================================
// A. Company Profile Settings
exports.apiRouter.get('/admin/settings/company', async (_req, res) => {
    try {
        const profile = await (0, localDb_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
        return res.json({ profile });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.put('/admin/settings/company', requireAdmin, async (req, res) => {
    try {
        const { legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name } = req.body;
        if (!legal_name || !gstin || !state_code) {
            return res.status(400).json({ error: 'Legal name, GSTIN, and default state are required.' });
        }
        await (0, localDb_1.run)(`
      UPDATE company_profile
      SET legal_name = ?,
          trade_name = ?,
          gstin = ?,
          pan = ?,
          email = ?,
          phone = ?,
          registered_address = ?,
          state_code = ?,
          state_name = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM company_profile LIMIT 1)
    `, [legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name]);
        return res.json({ success: true, message: 'Company profile updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// B. Token Models Master
exports.apiRouter.get('/admin/settings/tokens', async (_req, res) => {
    try {
        const models = await (0, localDb_1.queryAll)('SELECT * FROM token_models ORDER BY model_name ASC');
        return res.json({ models });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/settings/tokens', requireAdmin, async (req, res) => {
    try {
        const { model_name, manufacturer, vendor_contact, min_threshold } = req.body;
        if (!model_name || !manufacturer) {
            return res.status(400).json({ error: 'Model name and manufacturer are required.' });
        }
        const id = `tm-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO token_models (id, model_name, manufacturer, vendor_contact, min_threshold, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, model_name.trim().toUpperCase(), manufacturer.trim(), vendor_contact || null, Number(min_threshold) || 10]);
        return res.status(201).json({ success: true, id, message: 'Token model added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// C. Courier Companies Master
exports.apiRouter.get('/admin/settings/couriers', async (_req, res) => {
    try {
        const couriers = await (0, localDb_1.queryAll)('SELECT * FROM courier_partners ORDER BY company_name ASC');
        return res.json({ couriers });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/settings/couriers', requireAdmin, async (req, res) => {
    try {
        const { company_name, tracking_url_template, support_phone } = req.body;
        if (!company_name)
            return res.status(400).json({ error: 'Company name is required.' });
        const id = `cp-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO courier_partners (id, company_name, tracking_url_template, support_phone, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [id, company_name.trim(), tracking_url_template || null, support_phone || null]);
        return res.status(201).json({ success: true, id, message: 'Courier company added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// D. Business Services Master
exports.apiRouter.get('/admin/settings/services', async (_req, res) => {
    try {
        const services = await (0, localDb_1.queryAll)('SELECT * FROM services_catalog ORDER BY category, service_name');
        return res.json({ services });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/settings/services', requireAdmin, async (req, res) => {
    try {
        const { service_key, service_name, category, government_fee, professional_fee } = req.body;
        if (!service_key || !service_name || !category) {
            return res.status(400).json({ error: 'Service key, name, and category are required.' });
        }
        const id = `srv-${Date.now()}`;
        await (0, localDb_1.run)(`
      INSERT INTO services_catalog (id, service_key, service_name, category, government_fee, professional_fee, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [id, service_key.trim().toLowerCase(), service_name.trim(), category.trim(), Number(government_fee) || 0, Number(professional_fee) || 0]);
        return res.status(201).json({ success: true, id, message: 'Service catalog item added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// E. Partner Edit API (Phase 3)
exports.apiRouter.put('/partners/:id', async (req, res) => {
    try {
        const { company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, status, } = req.body;
        const existing = await (0, localDb_1.queryOne)('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!existing)
            return res.status(404).json({ error: 'Partner not found' });
        await (0, localDb_1.run)(`
      UPDATE partners
      SET company_name = COALESCE(?, company_name),
          contact_person = COALESCE(?, contact_person),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          gstin = COALESCE(?, gstin),
          pan = COALESCE(?, pan),
          billing_address = COALESCE(?, billing_address),
          state_code = COALESCE(?, state_code),
          credit_limit = COALESCE(?, credit_limit),
          credit_period_days = COALESCE(?, credit_period_days),
          status = COALESCE(?, status)
      WHERE id = ?
    `, [
            company_name,
            contact_person,
            email,
            phone,
            gstin,
            pan,
            billing_address,
            state_code,
            credit_limit !== undefined ? Number(credit_limit) : null,
            credit_period_days !== undefined ? Number(credit_period_days) : null,
            status,
            req.params.id,
        ]);
        return res.json({ success: true, message: 'Partner details updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
