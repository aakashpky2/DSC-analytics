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
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.logAuditEvent = logAuditEvent;
exports.allocateNextReferenceNumber = allocateNextReferenceNumber;
const express_1 = require("express");
const supabase_1 = require("../supabase");
const businessLogic_1 = require("../../lib/businessLogic");
const numberingEngine_1 = require("../../lib/numberingEngine");
const masking_1 = require("../../lib/masking");
const pagination_1 = require("../pagination");
const auth_1 = require("../auth");
const leadManagement_1 = require("./leadManagement");
const dscMaster_1 = require("./dscMaster");
const courierModule_1 = require("./courierModule");
const billingModule_1 = require("./billingModule");
const tokenProcurement_1 = require("./tokenProcurement");
const tokenSales_1 = require("./tokenSales");
const partyLedgers_1 = require("./partyLedgers");
const tokenModuleRouter_1 = require("./tokenModuleRouter");
const dscCommissionRouter_1 = require("./dscCommissionRouter");
const dscIssuanceRouter_1 = require("./dscIssuanceRouter");
const dscDirectIssuanceRouter_1 = require("./dscDirectIssuanceRouter");
const unifiedRevenueRouter_1 = require("./unifiedRevenueRouter");
const dashboardRouter_1 = require("./dashboardRouter");
const leadValidation_1 = require("../../lib/leadValidation");
const leadStore_1 = require("../leadStore");
const partnerMatchEngine_1 = require("../partnerMatchEngine");
exports.apiRouter = (0, express_1.Router)();
// ==========================================
// RBAC & Session Security Middleware
// ==========================================
// Cryptographically verified session-only identity resolution.
// Arbitrary client-supplied identity/role headers (x-user-id, x-user-role) are strictly rejected.
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
// Mount Sub-routers (Lead Management, DSC Masters, Logistics, and Invoicing & Billing)
exports.apiRouter.use(leadManagement_1.leadManagementRouter);
exports.apiRouter.use(dscMaster_1.dscMasterRouter);
exports.apiRouter.use(courierModule_1.courierModuleRouter);
exports.apiRouter.use(billingModule_1.billingRouter);
exports.apiRouter.use(tokenProcurement_1.procurementRouter);
exports.apiRouter.use(tokenSales_1.tokenSalesRouter);
exports.apiRouter.use(partyLedgers_1.reportsAndLedgersRouter);
exports.apiRouter.use(tokenModuleRouter_1.tokenModuleRouter);
exports.apiRouter.use(dscCommissionRouter_1.dscCommissionRouter);
exports.apiRouter.use(dscIssuanceRouter_1.dscIssuanceRouter);
exports.apiRouter.use(dscDirectIssuanceRouter_1.dscDirectIssuanceRouter);
exports.apiRouter.use(unifiedRevenueRouter_1.unifiedRevenueRouter);
exports.apiRouter.use(dashboardRouter_1.dashboardRouter);
function requireAuth(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }
    next();
}
function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    if (user.status !== 'active') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }
    if (user.hierarchy_level_order > 1) {
        return res.status(403).json({ error: 'You do not have permission to open this page.' });
    }
    next();
}
/**
 * Determine whether PII masking must be enforced for a request based on verified server-side session.
 * The client cannot disable masking if user role/hierarchy dictates it (e.g. Field Telecaller Tier 4).
 */
function shouldMaskPii(req) {
    const user = req.user;
    if (!user)
        return true;
    // Super Admin (Tier 0) and Regional Admin (Tier 1) can view unmasked PII unless client requested ?mask=true
    if (user.hierarchy_level_order <= 1) {
        return req.query.mask === 'true';
    }
    // Field staff / tele-callers (Tier 4) are strictly masked server-side
    if (user.hierarchy_level_order >= 4 || user.mask_pii_fields === 1) {
        return true;
    }
    // For intermediate tiers (Tier 2 Branch Manager, Tier 3 Senior Staff), respect query param or role flag
    return req.query.mask === 'true' || user.mask_pii_fields === 1;
}
/**
 * Granular Permission Guard: Checks module-level CRUD or specific action permission,
 * resolving role matrix, user overrides, and valid temporary delegations.
 */
function requirePermission(moduleKey, actionKey) {
    return async (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive.' });
        }
        // Super Admin (Level 0) has root authority across all modules and actions
        if (user.hierarchy_level_order === 0) {
            return next();
        }
        try {
            // 1. Check user direct override
            const override = await (0, supabase_1.queryOne)('SELECT * FROM user_permission_overrides WHERE user_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)', [user.id, moduleKey]);
            if (override && override[actionKey] !== null && override[actionKey] !== undefined) {
                if (override[actionKey] === 1 || override[actionKey] === true) {
                    return next();
                }
                else {
                    return res.status(403).json({ error: `Permission denied: ${moduleKey}.${actionKey} is restricted for your account.` });
                }
            }
            // 2. Check role matrix permission
            const rolePerm = await (0, supabase_1.queryOne)('SELECT * FROM role_module_permissions WHERE role_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)', [user.role_id, moduleKey]);
            if (rolePerm && (rolePerm[actionKey] === 1 || rolePerm[actionKey] === true)) {
                return next();
            }
            // 3. Check active temporary delegations with full ancestor validation
            const nowIso = new Date().toISOString();
            const delegation = await (0, supabase_1.queryOne)(`
        SELECT d.*, g.permissions_frozen as grantor_frozen, g.status as grantor_status
        FROM temporary_delegations d
        JOIN user_profiles g ON d.grantor_user_id = g.id
        WHERE d.recipient_user_id = ?
          AND d.module_key = ?
          AND (d.action_key = ? OR d.action_key = 'all')
          AND d.status = 'active'
          AND d.valid_from <= ?
          AND d.valid_until >= ?
      `, [user.id, moduleKey, actionKey, nowIso, nowIso]);
            if (delegation) {
                if (delegation.grantor_frozen || delegation.grantor_status !== 'active') {
                    return res.status(403).json({ error: 'Delegated permission is invalid because the grantor account is frozen or inactive.' });
                }
                // Ancestor validity check: If child delegation, verify parent chain is fully active & unexpired
                if (delegation.parent_delegation_id) {
                    let currentParentId = delegation.parent_delegation_id;
                    let chainValid = true;
                    while (currentParentId) {
                        const parentRecord = await (0, supabase_1.queryOne)('SELECT * FROM temporary_delegations WHERE id = ?', [currentParentId]);
                        if (!parentRecord || parentRecord.status !== 'active' || parentRecord.valid_until < nowIso) {
                            chainValid = false;
                            break;
                        }
                        currentParentId = parentRecord.parent_delegation_id;
                    }
                    if (!chainValid) {
                        return res.status(403).json({ error: 'Delegated permission is invalid because an ancestor delegation was revoked or expired.' });
                    }
                }
                ;
                req.delegation = delegation;
                return next();
            }
            // Deny access if not authorized
            return res.status(403).json({
                error: `Permission denied: You do not have '${actionKey}' authority on '${moduleKey}'.`,
            });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
}
/**
 * Record administrative change in audit_logs
 */
async function logAuditEvent(params) {
    try {
        const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const orgId = params.organizationId || 'comp-default';
        await (0, supabase_1.run)(`
      INSERT INTO audit_logs (id, organization_id, user_id, action_type, module_key, table_affected, record_id, old_value_json, new_value_json, reason, delegation_id, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id,
            orgId,
            params.userId,
            params.actionType,
            params.moduleKey,
            params.tableAffected,
            params.recordId || null,
            params.oldValueJson ? JSON.stringify(params.oldValueJson) : null,
            params.newValueJson ? JSON.stringify(params.newValueJson) : null,
            params.reason || null,
            params.delegationId || null,
            params.ipAddress || null,
        ]);
    }
    catch (err) {
        console.error('Audit log failure:', err);
    }
}
/**
 * Concurrency-Safe Document Reference Number Allocator
 * Atomically increments counter using optimistic concurrency locking loop and formats business reference string.
 */
async function allocateNextReferenceNumber(documentType, options) {
    const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
    // Attempt optimistic concurrency lock up to 25 retries
    for (let attempt = 0; attempt < 25; attempt++) {
        const { data: config, error: fetchErr } = await supabase
            .from('numbering_series_configs')
            .select('*')
            .eq('document_type', documentType)
            .eq('is_active', 1)
            .limit(1)
            .maybeSingle();
        if (fetchErr || !config) {
            // Fallback safe timestamp reference if no series config exists
            return `${documentType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
        }
        const currentCounter = Number(config.current_counter || 1000);
        const nextCounter = currentCounter + 1;
        const { data: updated, error: updateErr } = await supabase
            .from('numbering_series_configs')
            .update({
            current_counter: nextCounter,
            updated_at: new Date().toISOString()
        })
            .eq('id', config.id)
            .eq('current_counter', currentCounter)
            .select();
        if (!updateErr && updated && updated.length > 0) {
            return (0, numberingEngine_1.formatReferenceNumber)(config, nextCounter, options);
        }
        // Brief jitter to alleviate concurrency stampede before retry
        await new Promise((r) => setTimeout(r, Math.random() * 25 + 5));
    }
    throw new Error(`Failed to allocate sequential reference number for ${documentType} after 25 concurrent attempts.`);
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
        // Explicit, validated user lookup using direct Supabase PostgREST
        const user = await (0, auth_1.getUserProfileByEmail)(cleanEmail);
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
exports.apiRouter.get('/auth/me', requireAuth, async (req, res) => {
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
                role_id: user.role_id,
                role_name: user.role_name,
                hierarchy_level_id: user.hierarchy_level_id,
                hierarchy_level_order: user.hierarchy_level_order,
                level_name: user.level_name,
                branch_id: user.branch_id,
                branch_name: user.branch_name,
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
        const user = await (0, supabase_1.queryOne)('SELECT id, email, full_name FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail]);
        if (user) {
            const resetToken = (0, auth_1.generateToken)(32);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            const resetId = `rst-${Date.now()}`;
            await (0, supabase_1.run)(`INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`, [resetId, user.id, resetToken, expiresAt]);
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
        const resetRecord = await (0, supabase_1.queryOne)(`SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?`, [token, nowIso]);
        if (!resetRecord) {
            return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
        }
        const hashedPassword = await (0, auth_1.hashPassword)(newPassword);
        await (0, supabase_1.run)(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashedPassword, resetRecord.user_id]);
        await (0, supabase_1.run)(`UPDATE password_resets SET used = 1 WHERE id = ?`, [resetRecord.id]);
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
        const user = await (0, supabase_1.queryOne)('SELECT * FROM user_profiles WHERE id = ?', ['usr-admin-root']);
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
// ==========================================
// 2. User Administration & Granular RBAC
// ==========================================
exports.apiRouter.get('/admin/roles', requireAdmin, async (_req, res) => {
    try {
        const roles = await (0, supabase_1.queryAll)(`
      SELECT r.*, h.level_order, h.level_name, COUNT(u.id) as staff_count
      FROM roles r
      JOIN hierarchy_levels h ON r.hierarchy_level_id = h.id
      LEFT JOIN user_profiles u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY h.level_order ASC
    `);
        const levels = await (0, supabase_1.queryAll)('SELECT * FROM hierarchy_levels ORDER BY level_order ASC');
        const modules = await (0, supabase_1.queryAll)('SELECT * FROM app_modules ORDER BY display_name ASC');
        const rolePermissions = await (0, supabase_1.queryAll)('SELECT * FROM role_module_permissions');
        return res.json({ roles, levels, modules, rolePermissions });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Update role matrix permissions
exports.apiRouter.put('/admin/roles/:id/permissions', requireAdmin, async (req, res) => {
    try {
        const currentUser = req.user;
        if (currentUser.hierarchy_level_order !== 0) {
            return res.status(403).json({ error: 'Only the Super Admin (Level 0) can modify role permission matrices.' });
        }
        const roleId = req.params.id;
        const { permissions = [] } = req.body; // Array of { module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields }
        const orgId = currentUser.organization_id || 'comp-default';
        for (const p of permissions) {
            const { error } = await supabase_1.supabase
                .from('role_module_permissions')
                .upsert({
                id: `rmp-${roleId}-${p.module_id}`,
                role_id: roleId,
                module_id: p.module_id,
                organization_id: orgId,
                can_view: p.can_view ? 1 : 0,
                can_create: p.can_create ? 1 : 0,
                can_edit: p.can_edit ? 1 : 0,
                can_delete: p.can_delete ? 1 : 0,
                can_export: p.can_export ? 1 : 0,
                mask_pii_fields: p.mask_pii_fields !== undefined ? (p.mask_pii_fields ? 1 : 0) : 1,
            }, { onConflict: 'role_id,module_id' });
            if (error)
                throw error;
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'UPDATE_ROLE_PERMISSIONS',
            moduleKey: 'admin_users',
            tableAffected: 'role_module_permissions',
            recordId: Array.isArray(roleId) ? roleId[0] : roleId,
            newValueJson: permissions,
            reason: 'Role Matrix Policy Update',
            ipAddress: req.ip,
            organizationId: orgId,
        });
        return res.json({ success: true, message: 'Role permissions updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const mask = shouldMaskPii(req);
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
        const users = await (0, supabase_1.queryAll)(selectSql, params);
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
        const currentUser = req.user;
        const { email, full_name, phone_number, role_id, hierarchy_level_id, branch_id, initial_password } = req.body || {};
        const { validateEmployeeName, validateCompanyEmail, validateMobileNumber, validateInitialPassword } = await Promise.resolve().then(() => __importStar(require('../../lib/staffValidation')));
        // Strict validation
        const nameCheck = validateEmployeeName(full_name);
        if (!nameCheck.valid) {
            return res.status(400).json({ success: false, error: nameCheck.error });
        }
        const emailCheck = validateCompanyEmail(email);
        if (!emailCheck.valid) {
            return res.status(400).json({ success: false, error: emailCheck.error });
        }
        const mobileCheck = validateMobileNumber(phone_number);
        if (!mobileCheck.valid) {
            return res.status(400).json({ success: false, error: mobileCheck.error });
        }
        const passwordCheck = validateInitialPassword(initial_password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ success: false, error: passwordCheck.error });
        }
        const tier = hierarchy_level_id || 'tier-4';
        const roleId = role_id || (tier === 'tier-1' ? 'role-partner-admin' : tier === 'tier-2' ? 'role-branch-mgr' : tier === 'tier-3' ? 'role-senior-exec' : 'role-field-staff');
        const cleanEmail = emailCheck.email;
        const existing = await (0, supabase_1.queryOne)('SELECT id FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail]);
        if (existing) {
            return res.status(409).json({ success: false, error: 'A staff member with this email address already exists.' });
        }
        const existingPhone = await (0, supabase_1.queryOne)('SELECT id FROM user_profiles WHERE phone_number = ?', [mobileCheck.mobile]);
        if (existingPhone) {
            return res.status(409).json({ success: false, error: 'A staff member with this mobile number already exists.' });
        }
        const id = `usr-${Date.now()}`;
        const password_hash = await (0, auth_1.hashPassword)(passwordCheck.password);
        const orgId = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.organization_id) || 'comp-default';
        const { supabase: sb } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const { error: insertError } = await sb.from('user_profiles').insert({
            id,
            email: cleanEmail,
            password_hash,
            full_name: nameCheck.name,
            phone_number: mobileCheck.mobile,
            role_id: roleId,
            hierarchy_level_id: tier,
            branch_id: branch_id || null,
            organization_id: orgId,
            status: 'active',
            permissions_frozen: 0,
        });
        if (insertError) {
            console.error('Insert error in /admin/users:', insertError.message);
            return res.status(500).json({ success: false, error: 'Database error occurred while creating staff account.' });
        }
        return res.status(201).json({ success: true, id, message: 'Staff account created successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Unexpected server error.' });
    }
});
exports.apiRouter.patch('/admin/users/:id/freeze', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        if (currentUser.hierarchy_level_order !== 0) {
            return res.status(403).json({ error: 'Only the Super Admin (Level 0) can freeze or unfreeze accounts.' });
        }
        const { frozen } = req.body;
        const userId = req.params.id;
        if (userId === 'usr-admin-root') {
            return res.status(400).json({ error: 'The Master Super Admin account cannot be frozen.' });
        }
        await (0, supabase_1.run)(`UPDATE user_profiles SET permissions_frozen = ? WHERE id = ?`, [frozen ? 1 : 0, userId]);
        await logAuditEvent({
            userId: currentUser.id,
            actionType: frozen ? 'FREEZE_USER_PERMISSIONS' : 'UNFREEZE_USER_PERMISSIONS',
            moduleKey: 'admin_users',
            tableAffected: 'user_profiles',
            recordId: userId,
            newValueJson: { permissions_frozen: frozen ? 1 : 0 },
            reason: frozen ? 'Administrator froze account permissions' : 'Administrator unfroze account permissions',
            ipAddress: req.ip,
        });
        return res.json({ success: true, frozen: Boolean(frozen) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Update user active / inactive status (Deactivate / Activate)
exports.apiRouter.patch('/admin/users/:id/status', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        if (currentUser.hierarchy_level_order !== 0) {
            return res.status(403).json({ error: 'Only the Super Admin (Level 0) can change user account status.' });
        }
        const { status } = req.body;
        const userId = req.params.id;
        if (userId === 'usr-admin-root') {
            return res.status(400).json({ error: 'The Master Super Admin account cannot be deactivated.' });
        }
        const validStatuses = ['active', 'inactive', 'deactivated'];
        if (!status || !validStatuses.includes(String(status).toLowerCase())) {
            return res.status(400).json({ error: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
        }
        // Standardize to database status: 'inactive'
        const normalizedStatus = String(status).toLowerCase() === 'active' ? 'active' : 'inactive';
        await (0, supabase_1.run)(`UPDATE user_profiles SET status = ? WHERE id = ?`, [normalizedStatus, userId]);
        // If deactivated, invalidate all active sessions for this user immediately
        if (normalizedStatus === 'inactive') {
            await (0, supabase_1.run)(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: normalizedStatus === 'active' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
            moduleKey: 'admin_users',
            tableAffected: 'user_profiles',
            recordId: userId,
            newValueJson: { status: normalizedStatus },
            reason: normalizedStatus === 'active' ? 'Administrator activated account' : 'Administrator deactivated account',
            ipAddress: req.ip,
        });
        return res.json({
            success: true,
            id: userId,
            status: normalizedStatus,
            message: normalizedStatus === 'active' ? 'User activated successfully.' : 'User deactivated successfully.'
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || 'Unable to change user status. Please try again.' });
    }
});
// ==========================================
// 3. Partner Network Management
// ==========================================
exports.apiRouter.get('/partners', requirePermission('partners', 'can_view'), async (req, res) => {
    try {
        const mask = shouldMaskPii(req);
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
        const partners = await (0, supabase_1.queryAll)(selectSql, params);
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
exports.apiRouter.get('/partners/:id', requirePermission('partners', 'can_view'), async (req, res) => {
    try {
        const mask = shouldMaskPii(req);
        const partner = await (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const orders = await (0, supabase_1.queryAll)('SELECT * FROM dsc_applications WHERE partner_id = ? ORDER BY created_at DESC', [req.params.id]);
        const invoices = await (0, supabase_1.queryAll)('SELECT * FROM invoices WHERE partner_id = ? ORDER BY invoice_date DESC', [req.params.id]);
        const ledger = await (0, supabase_1.queryAll)('SELECT * FROM financial_ledger WHERE partner_id = ? ORDER BY entry_date DESC', [req.params.id]);
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
exports.apiRouter.post('/partners', requirePermission('partners', 'can_create'), async (req, res) => {
    try {
        const { type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code = '27', credit_limit = 0, credit_period_days = 0, kyc_document_url, } = req.body;
        // Validate that partner type exists and is active in master configuration
        const activeTypes = await getPartnerTypesFromDb();
        const matchingType = activeTypes.find((t) => t.type_key === type);
        if (!matchingType) {
            return res.status(400).json({ error: `Invalid partner category: ${type}. Please select a registered category from system settings.` });
        }
        if (matchingType.is_active === 0 || matchingType.is_active === false) {
            return res.status(400).json({ error: `The partner category '${matchingType.type_name}' is currently deactivated. Cannot onboard new partners under this category.` });
        }
        const id = `part-${Date.now()}`;
        const partner_code = await allocateNextReferenceNumber('partner');
        await (0, supabase_1.run)(`
      INSERT INTO partners (id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, kyc_document_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, kyc_document_url || null]);
        return res.status(201).json({ success: true, id, partner_code });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 4. DSC Catalogue & Applications
// ==========================================
exports.apiRouter.get('/dsc/catalog', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (user && user.hierarchy_level_order > 3) {
            return res.status(403).json({ error: 'Access denied. You do not have permission to view DSC Product Catalog or Pricing.' });
        }
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
        const items = await (0, supabase_1.queryAll)(selectSql);
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
        await (0, supabase_1.run)(`
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
        await (0, supabase_1.run)(`
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
exports.apiRouter.patch('/dsc/catalog/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE dsc_catalog SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus), message: `Product ${newStatus ? 'activated' : 'deactivated'}.` });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/dsc/applications', requirePermission('dsc', 'can_view'), async (req, res) => {
    try {
        const mask = shouldMaskPii(req);
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
        const apps = await (0, supabase_1.queryAll)(selectSql, params);
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
exports.apiRouter.post('/dsc/applications', requirePermission('dsc', 'can_create'), async (req, res) => {
    try {
        const { partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan } = req.body;
        if (!partner_id || !catalog_id || !applicant_name || !applicant_name.trim()) {
            return res.status(400).json({ error: 'Partner, DSC product, and applicant name are required.' });
        }
        const id = `app-${Date.now()}`;
        const application_number = await allocateNextReferenceNumber('dsc_application');
        await (0, supabase_1.run)(`
      INSERT INTO dsc_applications (id, application_number, partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake')
    `, [id, application_number, partner_id, catalog_id, applicant_name.trim(), applicant_email || null, applicant_phone || null, applicant_pan || null]);
        return res.status(201).json({ success: true, id, application_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/dsc/applications/:id/stage', requirePermission('dsc', 'can_edit'), async (req, res) => {
    try {
        const { stage, ca_reference_no, notes } = req.body;
        await (0, supabase_1.run)(`
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
exports.apiRouter.get('/inventory/batches', requirePermission('inventory', 'can_view'), async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (batch_number LIKE ? OR token_model LIKE ? OR vendor_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        const selectSql = `SELECT * FROM token_purchase_batches ${whereClause} ORDER BY created_at DESC`;
        const countSql = `SELECT COUNT(*) as count FROM token_purchase_batches ${whereClause}`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                batches: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const batches = await (0, supabase_1.queryAll)(selectSql, params);
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
exports.apiRouter.post('/inventory/batches', requirePermission('inventory', 'can_create'), async (req, res) => {
    try {
        const currentUser = req.user;
        const delegation = req.delegation;
        const { token_model, vendor_name, quantity_purchased, base_unit_price, inward_shipping_cost = 0, customs_or_taxes = 0, handling_charges = 0, } = req.body;
        const qty = Number(quantity_purchased);
        const basePrice = Number(base_unit_price);
        if (!token_model || !vendor_name || isNaN(qty) || qty <= 0 || isNaN(basePrice) || basePrice < 0) {
            return res.status(400).json({ error: 'Valid token model, vendor name, quantity, and unit price are required.' });
        }
        const calc = (0, businessLogic_1.calculateLandedCost)({
            quantityPurchased: qty,
            baseUnitPrice: basePrice,
            inwardShippingCost: Number(inward_shipping_cost),
            customsOrTaxes: Number(customs_or_taxes),
            handlingCharges: Number(handling_charges),
        });
        const id = `batch-${Date.now()}`;
        const batch_number = await allocateNextReferenceNumber('token_batch');
        await (0, supabase_1.run)(`
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
            qty,
            basePrice,
            Number(inward_shipping_cost),
            Number(customs_or_taxes),
            Number(handling_charges),
            calc.totalBatchLandedCost,
            calc.unitLandedCost,
        ]);
        // Update headquarters stock
        const hqBranch = await (0, supabase_1.queryOne)('SELECT id FROM branches WHERE branch_code = ? LIMIT 1', ['HQ-MUM']);
        const branchId = hqBranch ? hqBranch.id : 'branch-hq';
        const existingStock = await (0, supabase_1.queryOne)('SELECT id, quantity_on_hand FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [branchId, token_model]);
        if (existingStock) {
            await (0, supabase_1.run)('UPDATE branch_token_stocks SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?', [qty, existingStock.id]);
        }
        else {
            await (0, supabase_1.run)(`
        INSERT INTO branch_token_stocks (id, branch_id, token_model, quantity_on_hand, quarantine_damaged, min_threshold)
        VALUES (?, ?, ?, ?, 0, 25)
      `, [`stk-${Date.now()}`, branchId, token_model, qty]);
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'PURCHASE_TOKEN_BATCH',
            moduleKey: 'inventory',
            tableAffected: 'token_purchase_batches',
            recordId: id,
            newValueJson: { batch_number, token_model, qty, total_landed_cost: calc.totalBatchLandedCost },
            delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
            ipAddress: req.ip,
        });
        return res.status(201).json(Object.assign({ success: true, id, batch_number }, calc));
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/inventory/branches', requirePermission('inventory', 'can_view'), async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (b.branch_name LIKE ? OR b.branch_code LIKE ? OR s.token_model LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        const selectSql = `
      SELECT s.*, b.branch_name, b.branch_code
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
      ${whereClause}
      ORDER BY b.branch_name ASC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
      ${whereClause}
    `;
        const branches = await (0, supabase_1.queryAll)('SELECT id, branch_name, branch_code, city, state_code FROM branches ORDER BY branch_name ASC');
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                stock: result.data,
                branches,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const stock = await (0, supabase_1.queryAll)(selectSql, params);
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
// Branch CRUD & Management
exports.apiRouter.post('/admin/branches', requireAdmin, async (req, res) => {
    try {
        const { branch_name, branch_code, address, city, state_code } = req.body;
        if (!branch_name || !branch_code || !city || !state_code) {
            return res.status(400).json({ error: 'Branch name, code, city, and state code are required.' });
        }
        const id = `br-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO branches (id, branch_name, branch_code, address, city, state_code, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [id, branch_name.trim(), branch_code.trim().toUpperCase(), address || '', city.trim(), state_code.trim()]);
        return res.status(201).json({ success: true, id, message: 'Branch created successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.put('/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
        const { branch_name, branch_code, address, city, state_code, is_active } = req.body;
        await (0, supabase_1.run)(`
      UPDATE branches
      SET branch_name = COALESCE(?, branch_name),
          branch_code = COALESCE(?, branch_code),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state_code = COALESCE(?, state_code),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [branch_name, branch_code, address, city, state_code, is_active, req.params.id]);
        return res.json({ success: true, message: 'Branch updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/branches/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE branches SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus), message: `Branch ${newStatus ? 'activated' : 'deactivated'}.` });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Transfer History: List Delivery Challans / Notes
exports.apiRouter.get('/inventory/transfers', requirePermission('inventory', 'can_view'), async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (dc.challan_number LIKE ? OR dc.token_model LIKE ? OR sb.branch_name LIKE ? OR db.branch_name LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        const selectSql = `
      SELECT dc.*, 
             sb.branch_name as source_branch_name, sb.branch_code as source_branch_code,
             db.branch_name as destination_branch_name, db.branch_code as destination_branch_code,
             u.full_name as issued_by_name
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      LEFT JOIN user_profiles u ON dc.issued_by = u.id
      ${whereClause}
      ORDER BY dc.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                challans: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const challans = await (0, supabase_1.queryAll)(selectSql, params);
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
exports.apiRouter.post('/inventory/transfers', requirePermission('inventory', 'can_create'), async (req, res) => {
    try {
        const { source_branch_id, destination_branch_id, token_model, quantity, remarks, transfer_date, serial_numbers } = req.body;
        const currentUser = req.user;
        const delegation = req.delegation;
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
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
        // Step 5: Concurrency-Safe Atomic Stock Deduction using Conditional Row Update
        const sourceStock = await (0, supabase_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [source_branch_id, token_model]);
        if (!sourceStock || Number(sourceStock.quantity_on_hand || 0) < parsedQty) {
            const available = sourceStock ? sourceStock.quantity_on_hand : 0;
            return res.status(400).json({
                error: `Not enough stock available. Source branch has only ${available} usable tokens.`
            });
        }
        // Attempt atomic conditional deduction
        const currentQty = Number(sourceStock.quantity_on_hand);
        const newQty = currentQty - parsedQty;
        const { data: updatedStock, error: deductErr } = await supabase
            .from('branch_token_stocks')
            .update({
            quantity_on_hand: newQty
        })
            .eq('id', sourceStock.id)
            .eq('quantity_on_hand', currentQty)
            .gte('quantity_on_hand', parsedQty)
            .select();
        if (deductErr || !updatedStock || updatedStock.length === 0) {
            return res.status(409).json({
                error: 'Stock allocation contention detected. Another transaction updated branch inventory. Please retry.'
            });
        }
        // Step 6: Individual Serial Verification and Assignment (if serials provided)
        if (Array.isArray(serial_numbers) && serial_numbers.length > 0) {
            if (serial_numbers.length !== parsedQty) {
                // Rollback stock deduction
                await supabase.from('branch_token_stocks').update({ quantity_on_hand: currentQty }).eq('id', sourceStock.id);
                return res.status(400).json({
                    error: `Selected serial count (${serial_numbers.length}) does not match transfer quantity (${parsedQty}).`
                });
            }
            // Verify all serials belong to source branch and are in_stock
            const { data: foundSerials } = await supabase
                .from('token_serials')
                .select('id, serial_number, branch_id, status')
                .in('serial_number', serial_numbers);
            const invalidSerials = serial_numbers.filter((sn) => !(foundSerials === null || foundSerials === void 0 ? void 0 : foundSerials.some((fs) => fs.serial_number === sn && fs.branch_id === source_branch_id && fs.status === 'in_stock')));
            if (invalidSerials.length > 0) {
                // Rollback stock deduction
                await supabase.from('branch_token_stocks').update({ quantity_on_hand: currentQty }).eq('id', sourceStock.id);
                return res.status(400).json({
                    error: `The following token serials are not available in source branch stock: ${invalidSerials.join(', ')}`
                });
            }
        }
        // Snapshot company legal data at challan issue time
        const company = await (0, supabase_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
        const challanId = `dc-${Date.now()}`;
        const challanNumber = await allocateNextReferenceNumber('delivery_challan');
        const effectiveDate = transfer_date || new Date().toISOString().split('T')[0];
        // Create delivery challan in 'dispatched' status
        const { error: chErr } = await supabase.from('delivery_challans').insert({
            id: challanId,
            challan_number: challanNumber,
            source_branch_id,
            destination_branch_id,
            token_model,
            quantity: parsedQty,
            purpose: remarks || 'Inter-branch stock transfer',
            issued_by: currentUser.id,
            status: 'dispatched',
            created_at: effectiveDate,
            company_snapshot: company ? JSON.stringify(company) : null
        });
        if (chErr) {
            // Rollback stock deduction
            await supabase.from('branch_token_stocks').update({ quantity_on_hand: currentQty }).eq('id', sourceStock.id);
            return res.status(500).json({ error: `Failed to create delivery challan: ${chErr.message}` });
        }
        // Step 6: Mark serials in-transit linked to this delivery challan
        if (Array.isArray(serial_numbers) && serial_numbers.length > 0) {
            await supabase
                .from('token_serials')
                .update({
                status: 'in_transit',
                delivery_challan_id: challanId
            })
                .in('serial_number', serial_numbers);
        }
        // Ensure destination branch stock row exists (initial 0 on hand if not present)
        const destStock = await (0, supabase_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [destination_branch_id, token_model]);
        if (!destStock) {
            const newStockId = `stock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await supabase.from('branch_token_stocks').insert({
                id: newStockId,
                branch_id: destination_branch_id,
                token_model,
                quantity_on_hand: 0,
                quarantine_damaged: 0,
                min_threshold: 10
            });
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'DISPATCH_TRANSFER',
            moduleKey: 'inventory',
            tableAffected: 'delivery_challans',
            recordId: challanId,
            newValueJson: { challanNumber, source_branch_id, destination_branch_id, token_model, parsedQty },
            delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
            ipAddress: req.ip,
        });
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
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const challan = await (0, supabase_1.queryOne)('SELECT * FROM delivery_challans WHERE id = ?', [challanId]);
        if (!challan)
            return res.status(404).json({ error: 'Delivery Challan not found.' });
        if (challan.status === 'received') {
            return res.status(400).json({ error: 'This delivery note has already been received.' });
        }
        if (challan.status === 'cancelled') {
            return res.status(400).json({ error: 'Cancelled delivery notes cannot be received.' });
        }
        // Step 5 & 10: Atomic Conditional Receipt - only 1 request can transition status from dispatched/in_transit to received
        const nowIso = new Date().toISOString();
        const { data: updatedChallan, error: updErr } = await supabase
            .from('delivery_challans')
            .update({
            status: 'received'
        })
            .eq('id', challanId)
            .eq('status', challan.status)
            .select();
        if (updErr || !updatedChallan || updatedChallan.length === 0) {
            return res.status(409).json({ error: 'Challan has already been received or modified concurrently.' });
        }
        // Atomically increment destination branch stock
        const destStock = await (0, supabase_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [challan.destination_branch_id, challan.token_model]);
        if (destStock) {
            await supabase
                .from('branch_token_stocks')
                .update({
                quantity_on_hand: Number(destStock.quantity_on_hand || 0) + Number(challan.quantity)
            })
                .eq('id', destStock.id);
        }
        else {
            await supabase.from('branch_token_stocks').insert({
                id: `stock-${Date.now()}`,
                branch_id: challan.destination_branch_id,
                token_model: challan.token_model,
                quantity_on_hand: Number(challan.quantity),
                quarantine_damaged: 0,
                min_threshold: 10
            });
        }
        // Step 6: Move in-transit token serials to destination branch
        await supabase
            .from('token_serials')
            .update({
            status: 'in_stock',
            branch_id: challan.destination_branch_id
        })
            .eq('delivery_challan_id', challanId);
        return res.json({ success: true, status: 'received', message: 'Stock received and credited to destination branch.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Stock Adjustment & Damaged Token Handling (Item 10)
exports.apiRouter.post('/inventory/adjust', requireAdmin, async (req, res) => {
    try {
        const { branch_id, token_model, adjustment_type, quantity, reason } = req.body;
        const currentUser = req.user;
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        if (!branch_id || !token_model || !adjustment_type || quantity === undefined) {
            return res.status(400).json({ error: 'Branch, token model, adjustment type, and quantity are required.' });
        }
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive integer.' });
        }
        // Ensure branch stock row exists
        let stock = await (0, supabase_1.queryOne)('SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?', [branch_id, token_model]);
        if (!stock) {
            const newStockId = `stock-${Date.now()}`;
            await supabase.from('branch_token_stocks').insert({
                id: newStockId,
                branch_id,
                token_model,
                quantity_on_hand: 0,
                quarantine_damaged: 0,
                min_threshold: 10
            });
            stock = { id: newStockId, quantity_on_hand: 0, quarantine_damaged: 0 };
        }
        const currentQtyOnHand = Number(stock.quantity_on_hand || 0);
        const currentDamaged = Number(stock.quarantine_damaged || 0);
        if (adjustment_type === 'quarantine_damaged') {
            if (currentQtyOnHand < qty) {
                return res.status(400).json({ error: `Cannot quarantine ${qty} tokens. Only ${currentQtyOnHand} tokens available on hand.` });
            }
            // Concurrency-safe atomic deduction & quarantine increment
            const { data: updated, error: adjErr } = await supabase
                .from('branch_token_stocks')
                .update({
                quantity_on_hand: currentQtyOnHand - qty,
                quarantine_damaged: currentDamaged + qty
            })
                .eq('id', stock.id)
                .gte('quantity_on_hand', qty)
                .select();
            if (adjErr || !updated || updated.length === 0) {
                return res.status(409).json({ error: 'Inventory adjusted concurrently. Please retry.' });
            }
        }
        else if (adjustment_type === 'reconcile_add') {
            await supabase
                .from('branch_token_stocks')
                .update({
                quantity_on_hand: currentQtyOnHand + qty
            })
                .eq('id', stock.id);
        }
        else if (adjustment_type === 'reconcile_deduct') {
            if (currentQtyOnHand < qty) {
                return res.status(400).json({ error: `Cannot deduct ${qty} tokens. Only ${currentQtyOnHand} tokens available on hand.` });
            }
            const { data: updated, error: adjErr } = await supabase
                .from('branch_token_stocks')
                .update({
                quantity_on_hand: currentQtyOnHand - qty
            })
                .eq('id', stock.id)
                .gte('quantity_on_hand', qty)
                .select();
            if (adjErr || !updated || updated.length === 0) {
                return res.status(409).json({ error: 'Inventory adjusted concurrently. Please retry.' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid adjustment type.' });
        }
        const adjId = `adj-${Date.now()}`;
        await supabase.from('stock_adjustments').insert({
            id: adjId,
            branch_id,
            token_model,
            adjustment_type,
            quantity: qty,
            reason: reason || 'Physical inventory audit adjustment',
            adjusted_by: (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) || 'admin'
        });
        return res.status(201).json({ success: true, id: adjId, message: 'Stock adjustment successfully posted.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 6. CRM Leads & Deduplication Engine
// ==========================================
exports.apiRouter.get('/crm/leads', requirePermission('crm', 'can_view'), async (req, res) => {
    try {
        const user = req.user;
        const mask = shouldMaskPii(req);
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { category_id, status } = req.query;
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const store = (0, leadStore_1.loadLeadStore)();
        const isSupervisor = user.hierarchy_level_order <= 1;
        // Synchronize category access from DB (crm_user_category_access) and store
        let userCatIds = (store.user_category_access || [])
            .filter((a) => a.user_id === user.id)
            .map((a) => a.category_id);
        if (!isSupervisor && userCatIds.length === 0) {
            try {
                const { data: dbAccess } = await supabase_1.supabase
                    .from('crm_user_category_access')
                    .select('category_id')
                    .eq('user_id', user.id);
                if (dbAccess && dbAccess.length > 0) {
                    userCatIds = dbAccess.map((d) => d.category_id);
                }
            }
            catch (_a) { }
        }
        let whereClause = 'WHERE l.is_merged = 0';
        const params = [];
        if (search) {
            whereClause += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.lead_code LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }
        if (status) {
            whereClause += ' AND l.status = ?';
            params.push(String(status));
        }
        const selectSql = `
      SELECT l.*, u.full_name as assigned_agent_name
      FROM crm_leads l
      LEFT JOIN user_profiles u ON l.assigned_to = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;
        const rawLeads = await (0, supabase_1.queryAll)(selectSql, params);
        // Merge extended metadata (category, source, service_intent, match_status, geography)
        // NOTE: Prefer relational attributes on 'l' (crm_leads table) with fallback to store.extended_leads
        const enriched = rawLeads.map((l) => {
            var _a, _b, _c;
            const ext = ((_a = store.extended_leads) === null || _a === void 0 ? void 0 : _a[l.id]) || {};
            return Object.assign(Object.assign({}, l), { alternate_name: l.alternate_name || ext.alternate_name || null, state: l.state || ext.state || null, district: l.district || ext.district || null, address: l.address || ext.address || null, pin_code: l.pin_code || ext.pin_code || null, source_id: l.source_id || ext.source_id || null, category_id: l.category_id || ext.category_id || null, service_intent: l.service_intent || ext.service_intent || 'Undecided', match_status: l.match_status || ext.match_status || 'NO_MATCH', linked_partner_id: l.linked_partner_id || ext.linked_partner_id || null, partner_match_score: (_c = (_b = l.partner_match_score) !== null && _b !== void 0 ? _b : ext.partner_match_score) !== null && _c !== void 0 ? _c : 0, partner_match_factors: l.partner_match_factors || ext.partner_match_factors || null, city: l.city || ext.city || null, pipeline_status: ext.pipeline_status || l.pipeline_status || (l.status === 'merged' ? 'WON' : l.status.toUpperCase()), applied_tat_days: ext.applied_tat_days || null, first_contact_due_at: ext.first_contact_due_at || null, assignment_history: ext.assignment_history || [] });
        });
        // LM-16: Strict Backend Category-Level Data Isolation
        const scopedLeads = enriched.filter((l) => {
            if (isSupervisor) {
                if (category_id && l.category_id !== category_id)
                    return false;
                return true;
            }
            // Unassigned staff cannot see uncategorized leads (LM-17)
            if (!l.category_id)
                return false;
            // Only view assigned categories
            if (!userCatIds.includes(l.category_id))
                return false;
            if (category_id && l.category_id !== category_id)
                return false;
            return true;
        });
        const sanitized = scopedLeads.map((l) => (0, masking_1.applyPiiMasking)(l, mask));
        if (isPaginated) {
            const paginatedSlice = sanitized.slice(offset, offset + limit);
            return res.json({
                leads: paginatedSlice,
                page,
                limit,
                totalCount: sanitized.length,
                totalPages: Math.ceil(sanitized.length / limit),
            });
        }
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
exports.apiRouter.post('/crm/leads/check-duplicate', requirePermission('crm', 'can_view'), async (req, res) => {
    try {
        const { gstin, phone, email, pan, company_name } = req.body;
        const existing = await (0, supabase_1.queryAll)('SELECT id, lead_code, company_name, email, phone, gstin, pan FROM crm_leads WHERE is_merged = 0');
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
exports.apiRouter.post('/crm/leads', requirePermission('crm', 'can_create'), async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const user = req.user;
        // LM-06 & LM-32: Strict supplied-value validation while preserving optional intake
        const validation = (0, leadValidation_1.validateLeadPayload)(req.body || {});
        if (!validation.valid) {
            return res.status(422).json({
                error: 'Validation failed on supplied lead details.',
                errors: validation.errors,
            });
        }
        const { company_name, alternate_name, contact_person, email, phone, state, district, address, pin_code, source_id, category_id, service_intent, city, pan, requirement_summary, } = validation.sanitized;
        const pipeline_status = (_a = req.body) === null || _a === void 0 ? void 0 : _a.pipeline_status;
        const cleanCompany = company_name || '';
        const cleanContact = contact_person || '';
        const cleanEmail = email || '';
        const cleanPhone = phone || '';
        const cleanPan = pan || null;
        const cleanReq = requirement_summary || '';
        const id = `lead-${Date.now()}`;
        const lead_code = await allocateNextReferenceNumber('lead');
        // LM-08 to LM-11: Evaluate partner matching immediately on creation
        const partnerMatch = await (0, partnerMatchEngine_1.evaluatePartnerMatch)({
            company_name: cleanCompany,
            alternate_name: alternate_name ? alternate_name.trim() : null,
            email: cleanEmail,
            phone: cleanPhone
        });
        const orgId = (user === null || user === void 0 ? void 0 : user.organization_id) || 'comp-default';
        // Insert primary record in crm_leads (PostgreSQL / Supabase compatible) with category_id and source_id
        await (0, supabase_1.run)(`
      INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, organization_id, category_id, source_id, city, state, district, address, pin_code, alternate_name)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id,
            lead_code,
            cleanCompany,
            cleanContact,
            cleanEmail,
            cleanPhone,
            cleanPan,
            cleanReq,
            orgId,
            category_id || null,
            source_id || null,
            city || null,
            state || null,
            district || null,
            address || null,
            pin_code || null,
            alternate_name || null
        ]);
        // Save extended specification attributes into leadStore
        if (id && id !== 'undefined' && String(id).trim().length > 0) {
            const store = (0, leadStore_1.loadLeadStore)();
            // DEF-04: Resolve active TAT setting for snapshot
            let appliedTatDays = 2;
            try {
                const { data: tatData } = await supabase_1.supabase
                    .from('crm_tat_settings')
                    .select('first_contact_tat_days')
                    .eq('is_active', 1)
                    .order('effective_from', { ascending: false })
                    .limit(1);
                if (tatData && tatData.length > 0 && tatData[0].first_contact_tat_days) {
                    appliedTatDays = Number(tatData[0].first_contact_tat_days);
                }
                else if ((_c = (_b = store.tat_settings) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.first_contact_tat_days) {
                    appliedTatDays = Number(store.tat_settings[0].first_contact_tat_days);
                }
            }
            catch (e) {
                if ((_e = (_d = store.tat_settings) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.first_contact_tat_days) {
                    appliedTatDays = Number(store.tat_settings[0].first_contact_tat_days);
                }
            }
            const firstContactDueAt = new Date(Date.now() + appliedTatDays * 24 * 60 * 60 * 1000).toISOString();
            store.extended_leads = store.extended_leads || {};
            store.extended_leads[id] = {
                alternate_name: alternate_name ? alternate_name.trim() : null,
                city: city ? city.trim() : null,
                state: state ? state.trim() : null,
                district: district ? district.trim() : null,
                address: address ? address.trim() : null,
                pin_code: pin_code ? pin_code.trim() : null,
                source_id: source_id || null,
                category_id: category_id || null,
                service_intent: service_intent || 'Undecided',
                pipeline_status: pipeline_status || 'NEW',
                match_status: partnerMatch.matchStatus,
                linked_partner_id: ((_f = partnerMatch.matchedPartner) === null || _f === void 0 ? void 0 : _f.id) || null,
                partner_match_score: partnerMatch.matchScore,
                partner_match_factors: partnerMatch.matchFactors.join(' | '),
                applied_tat_days: appliedTatDays,
                first_contact_due_at: firstContactDueAt
            };
            // Initialize service activation tracking (LM-26, LM-27)
            const lstId = `lst-${Date.now()}`;
            const lstNowIso = new Date().toISOString();
            const tokenReq = (service_intent === 'Token' || service_intent === 'Both') ? 1 : 0;
            const dscReq = (service_intent === 'DSC' || service_intent === 'Both') ? 1 : 0;
            store.service_tracking[id] = {
                id: lstId,
                lead_id: id,
                service_intent: service_intent || 'Undecided',
                token_requested: tokenReq,
                token_fulfilled: 0,
                dsc_requested: dscReq,
                dsc_fulfilled: 0,
                tracking_status: 'PENDING_QUALIFICATION',
                last_updated_by: user === null || user === void 0 ? void 0 : user.id,
                updated_at: lstNowIso
            };
            // Direct Relational Persistence into crm_lead_service_tracking (DEF-01)
            try {
                await supabase_1.supabase.from('crm_lead_service_tracking').upsert({
                    id: lstId,
                    lead_id: id,
                    service_intent: service_intent || 'Undecided',
                    token_requested: tokenReq,
                    token_fulfilled: 0,
                    token_fulfilled_at: null,
                    token_batch_id: null,
                    dsc_requested: dscReq,
                    dsc_fulfilled: 0,
                    dsc_fulfilled_at: null,
                    dsc_application_id: null,
                    tracking_status: 'PENDING_QUALIFICATION',
                    last_updated_by: user === null || user === void 0 ? void 0 : user.id,
                    updated_at: lstNowIso
                });
            }
            catch (e) {
                console.error('Direct persist POST /crm/leads service_tracking error:', e.message);
            }
            // Record review item if match detected
            if (partnerMatch.hasMatch && partnerMatch.matchedPartner) {
                const pmrId = `pmr-${Date.now()}`;
                const pmrNowIso = new Date().toISOString();
                const matchTypeVal = partnerMatch.matchType || 'PHONE_SIMILARITY';
                const matchDetailsVal = {
                    factors: partnerMatch.matchFactors,
                    partner_code: partnerMatch.matchedPartner.partner_code
                };
                store.match_reviews.push({
                    id: pmrId,
                    lead_id: id,
                    partner_id: partnerMatch.matchedPartner.id,
                    match_type: matchTypeVal,
                    match_details: matchDetailsVal,
                    resolution_status: 'PENDING_REVIEW',
                    created_at: pmrNowIso
                });
                // Direct Relational Persistence into crm_partner_match_reviews (DEF-01)
                try {
                    await supabase_1.supabase.from('crm_partner_match_reviews').upsert({
                        id: pmrId,
                        lead_id: id,
                        partner_id: partnerMatch.matchedPartner.id,
                        match_type: matchTypeVal,
                        match_details: matchDetailsVal,
                        resolution_status: 'PENDING_REVIEW',
                        created_at: pmrNowIso
                    });
                }
                catch (e) {
                    console.error('Direct persist POST /crm/leads match_reviews error:', e.message);
                }
            }
            (0, leadStore_1.saveLeadStore)(store);
        }
        return res.status(201).json({
            success: true,
            id,
            lead_code,
            partnerMatch
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/leads/merge', requirePermission('crm', 'can_edit'), async (req, res) => {
    try {
        const currentUser = req.user;
        const delegation = req.delegation;
        const { primary_lead_id, secondary_lead_id } = req.body;
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        if (!primary_lead_id || !secondary_lead_id) {
            return res.status(400).json({ error: 'Primary lead ID and secondary lead ID are required.' });
        }
        if (primary_lead_id === secondary_lead_id) {
            return res.status(400).json({ error: 'Cannot merge a lead into itself.' });
        }
        // Step 9: Atomic Lead Merge - Conditionally lock secondary lead so it cannot be merged twice
        const nowIso = new Date().toISOString();
        const { data: claimedLead, error: claimErr } = await supabase
            .from('crm_leads')
            .update({
            is_merged: 1,
            status: 'merged',
            merged_into_lead_id: primary_lead_id,
            updated_at: nowIso
        })
            .eq('id', secondary_lead_id)
            .eq('is_merged', 0)
            .select();
        if (claimErr || !claimedLead || claimedLead.length === 0) {
            return res.status(409).json({
                error: 'Secondary lead has already been merged or modified concurrently.'
            });
        }
        // Re-parent all associated follow-ups to primary lead
        await supabase
            .from('crm_follow_ups')
            .update({
            lead_id: primary_lead_id
        })
            .eq('lead_id', secondary_lead_id);
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'MERGE_LEADS',
            moduleKey: 'crm',
            tableAffected: 'crm_leads',
            recordId: primary_lead_id,
            newValueJson: { merged_id: secondary_lead_id },
            reason: 'Deduplication consolidation',
            delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
            ipAddress: req.ip,
        });
        return res.json({ success: true, primary_lead_id, merged_id: secondary_lead_id });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Lead Edit, Assignment & Status Update (Item 5)
exports.apiRouter.put('/crm/leads/:id', requirePermission('crm', 'can_edit'), async (req, res) => {
    try {
        const user = req.user;
        const leadId = String(req.params.id);
        const store = (0, leadStore_1.loadLeadStore)();
        const ext = store.extended_leads[leadId] || {};
        // LM-16: Category isolation check
        const isSupervisor = user.hierarchy_level_order <= 1;
        const userCatIds = (store.user_category_access || [])
            .filter((a) => a.user_id === user.id)
            .map((a) => a.category_id);
        if (!isSupervisor && ext.category_id && !userCatIds.includes(ext.category_id)) {
            return res.status(403).json({ error: 'You do not have permission to edit leads in this category.' });
        }
        const { company_name, alternate_name, contact_person, email, phone, state, district, address, pin_code, source_id, category_id, service_intent, gstin, pan, requirement_summary, status, assigned_to } = req.body;
        // Update core table
        await (0, supabase_1.run)(`
      UPDATE crm_leads
      SET company_name = COALESCE(?, company_name),
          contact_person = COALESCE(?, contact_person),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          gstin = COALESCE(?, gstin),
          pan = COALESCE(?, pan),
          requirement_summary = COALESCE(?, requirement_summary),
          status = COALESCE(?, status),
          assigned_to = COALESCE(?, assigned_to),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, assigned_to, leadId]);
        // Update extended specification attributes
        if (alternate_name !== undefined)
            ext.alternate_name = alternate_name;
        if (state !== undefined)
            ext.state = state;
        if (district !== undefined)
            ext.district = district;
        if (address !== undefined)
            ext.address = address;
        if (pin_code !== undefined)
            ext.pin_code = pin_code;
        if (source_id !== undefined)
            ext.source_id = source_id;
        if (category_id !== undefined)
            ext.category_id = category_id;
        if (service_intent !== undefined)
            ext.service_intent = service_intent;
        // LM-13: Re-evaluate partner match on update of identifying fields
        if (phone !== undefined || email !== undefined || company_name !== undefined || alternate_name !== undefined) {
            const match = await (0, partnerMatchEngine_1.evaluatePartnerMatch)({
                company_name: company_name || ext.alternate_name,
                alternate_name: ext.alternate_name,
                email: email,
                phone: phone
            });
            ext.match_status = match.matchStatus;
            ext.partner_match_score = match.matchScore;
            ext.partner_match_factors = match.matchFactors.join(' | ');
            if (match.matchedPartner) {
                ext.linked_partner_id = match.matchedPartner.id;
            }
        }
        if (leadId && leadId !== 'undefined' && leadId.trim().length > 0) {
            store.extended_leads[leadId] = ext;
            (0, leadStore_1.saveLeadStore)(store);
        }
        return res.json({ success: true, message: 'Lead updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// CRM Follow-Up Actions & Agenda
exports.apiRouter.get('/crm/follow-ups', requirePermission('crm', 'can_view'), async (req, res) => {
    try {
        const mask = shouldMaskPii(req);
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.lead_code LIKE ? OR f.notes LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        const selectSql = `
      SELECT f.id, f.lead_id, f.channel as contact_mode, f.scheduled_at as follow_up_date, f.status, f.disposition, f.notes,
             l.company_name, l.contact_person, l.phone, l.email, l.lead_code, u.full_name as conducted_by_name
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
      LEFT JOIN user_profiles u ON f.conducted_by = u.id
      ${whereClause}
      ORDER BY f.scheduled_at ASC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = result.data.map((f) => (0, masking_1.applyPiiMasking)(f, mask));
            return res.json({
                followUps: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const followUps = await (0, supabase_1.queryAll)(selectSql, params);
        const sanitized = followUps.map((f) => (0, masking_1.applyPiiMasking)(f, mask));
        return res.json({
            followUps: sanitized,
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
exports.apiRouter.post('/crm/follow-ups', requireAuth, async (req, res) => {
    try {
        const { lead_id, follow_up_date, contact_mode, notes, disposition } = req.body;
        const currentUser = req.user;
        if (!lead_id)
            return res.status(400).json({ error: 'Lead is required.' });
        if (!notes || !notes.trim())
            return res.status(400).json({ error: 'Follow-up notes/comments are required.' });
        const id = `fu-${Date.now()}`;
        const orgId = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.organization_id) || 'comp-default';
        await (0, supabase_1.run)(`
      INSERT INTO crm_follow_ups (id, lead_id, channel, scheduled_at, notes, disposition, conducted_by, status, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [id, lead_id, contact_mode || 'phone_call', follow_up_date || new Date().toISOString(), notes || null, disposition || null, currentUser.id, orgId]);
        return res.status(201).json({ success: true, id, message: 'Follow-up scheduled.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/crm/follow-ups/:id/complete', requireAuth, async (req, res) => {
    try {
        const { disposition, notes } = req.body;
        await (0, supabase_1.run)(`
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
exports.apiRouter.patch('/crm/follow-ups/:id/reschedule', requireAuth, async (req, res) => {
    try {
        const { scheduled_at, notes, disposition } = req.body;
        if (!scheduled_at) {
            return res.status(400).json({ error: 'New scheduled date/time is required.' });
        }
        await (0, supabase_1.run)(`
      UPDATE crm_follow_ups
      SET scheduled_at = ?,
          notes = COALESCE(?, notes),
          disposition = COALESCE(?, disposition),
          status = 'pending'
      WHERE id = ?
    `, [scheduled_at, notes, disposition, req.params.id]);
        return res.json({ success: true, message: 'Follow-up rescheduled successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 7. Additional Business Services Hub
// ==========================================
exports.apiRouter.get('/services', requirePermission('services', 'can_view'), async (req, res) => {
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
                services: result.data,
                orders: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const services = await (0, supabase_1.queryAll)(selectSql);
        return res.json({
            services,
            orders: services,
            page: 1,
            limit: services.length,
            totalCount: services.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/services/orders', requirePermission('services', 'can_view'), async (req, res) => {
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
        const orders = await (0, supabase_1.queryAll)(selectSql);
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
exports.apiRouter.post('/services/orders', requirePermission('services', 'can_create'), async (req, res) => {
    try {
        const { service_type, partner_id, client_name, client_contact, government_fees = 0, professional_fees = 0, notes } = req.body;
        const id = `srv-${Date.now()}`;
        const order_number = await allocateNextReferenceNumber('service_order');
        await (0, supabase_1.run)(`
      INSERT INTO service_orders (id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft_review')
    `, [id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes]);
        return res.status(201).json({ success: true, id, order_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/services/orders/:id/stage', requirePermission('services', 'can_edit'), async (req, res) => {
    try {
        const { stage, notes, certificate_url, query_remarks } = req.body;
        if (!stage) {
            return res.status(400).json({ error: 'stage is required' });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const updatePayload = { stage };
        if (notes)
            updatePayload.notes = notes;
        if (certificate_url)
            updatePayload.certificate_url = certificate_url;
        if (query_remarks)
            updatePayload.query_remarks = query_remarks;
        const { error: updateErr } = await supabase
            .from('service_orders')
            .update(updatePayload)
            .eq('id', req.params.id);
        if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
        }
        return res.json({ success: true, stage });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 8. Multi-Account Billing & Payments Queue
// ==========================================
exports.apiRouter.get('/billing/accounts', requirePermission('billing', 'can_view'), async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = 'WHERE is_active = 1';
        const params = [];
        if (search) {
            whereClause += ' AND (bank_name LIKE ? OR account_nickname LIKE ? OR account_number LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        const selectSql = `SELECT * FROM bank_accounts ${whereClause} ORDER BY account_nickname ASC`;
        const countSql = `SELECT COUNT(*) as count FROM bank_accounts ${whereClause}`;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                accounts: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const accounts = await (0, supabase_1.queryAll)(selectSql, params);
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
        await (0, supabase_1.run)(`
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
        await (0, supabase_1.run)('UPDATE bank_accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
        return res.json({ success: true, message: 'Bank account deactivated.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/billing/series', requirePermission('billing', 'can_view'), async (_req, res) => {
    try {
        const series = await (0, supabase_1.queryAll)(`
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
exports.apiRouter.post('/billing/series', requireAdmin, async (req, res) => {
    try {
        const { series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id } = req.body;
        if (!series_name || !prefix || !mapped_bank_account_id) {
            return res.status(400).json({ error: 'Series name, prefix, and mapped bank account are required.' });
        }
        const id = `ser-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO invoice_series_configs (id, series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, series_name.trim(), prefix.trim().toUpperCase(), suffix ? suffix.trim() : null, current_counter || 1000, is_gst_compliant ? 1 : 0, mapped_bank_account_id]);
        return res.status(201).json({ success: true, id, message: 'Invoice series created successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.put('/billing/series/:id', requireAdmin, async (req, res) => {
    try {
        const { series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active } = req.body;
        await (0, supabase_1.run)(`
      UPDATE invoice_series_configs
      SET series_name = COALESCE(?, series_name),
          prefix = COALESCE(?, prefix),
          suffix = COALESCE(?, suffix),
          current_counter = COALESCE(?, current_counter),
          is_gst_compliant = COALESCE(?, is_gst_compliant),
          mapped_bank_account_id = COALESCE(?, mapped_bank_account_id),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active, req.params.id]);
        return res.json({ success: true, message: 'Invoice series updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/billing/invoices', requirePermission('billing', 'can_view'), async (req, res) => {
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
        const mask = shouldMaskPii(req);
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = (result.data || []).map((inv) => (0, masking_1.applyPiiMasking)(inv, mask));
            return res.json({
                invoices: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const invoices = await (0, supabase_1.queryAll)(selectSql, params);
        const sanitized = (invoices || []).map((inv) => (0, masking_1.applyPiiMasking)(inv, mask));
        return res.json({
            invoices: sanitized,
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
exports.apiRouter.post('/billing/invoices', requirePermission('billing', 'can_create'), async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const currentUser = req.user;
        const delegation = req.delegation;
        const { series_id, partner_id, due_days = 30, line_items = [] } = req.body;
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        if (!Array.isArray(line_items) || line_items.length === 0) {
            return res.status(400).json({ error: 'Invoice must contain at least one line item.' });
        }
        for (const item of line_items) {
            const qty = Number((_b = (_a = item.quantity) !== null && _a !== void 0 ? _a : item.qty) !== null && _b !== void 0 ? _b : 0);
            const rate = Number((_d = (_c = item.unit_price) !== null && _c !== void 0 ? _c : item.rate) !== null && _d !== void 0 ? _d : 0);
            if (qty <= 0 || rate < 0) {
                return res.status(400).json({ error: 'Line item quantity must be positive and unit price cannot be negative.' });
            }
        }
        let series = null;
        if (series_id) {
            series = await (0, supabase_1.queryOne)('SELECT * FROM invoice_series_configs WHERE id = ?', [series_id]);
        }
        else {
            series = await (0, supabase_1.queryOne)('SELECT * FROM invoice_series_configs WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1');
        }
        if (!series)
            return res.status(404).json({ error: 'Invoice series config not found' });
        const partner = await (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [partner_id]);
        if (!partner)
            return res.status(404).json({ error: 'Partner not found' });
        const subtotal = line_items.reduce((sum, item) => {
            var _a, _b, _c, _d;
            const qty = Number((_b = (_a = item.quantity) !== null && _a !== void 0 ? _a : item.qty) !== null && _b !== void 0 ? _b : 0);
            const rate = Number((_d = (_c = item.unit_price) !== null && _c !== void 0 ? _c : item.rate) !== null && _d !== void 0 ? _d : 0);
            return sum + (qty * rate);
        }, 0);
        const gst = (0, businessLogic_1.calculateGst)(subtotal, partner.state_code);
        const invoiceTotal = gst.total;
        // Step 8: Credit Limit & Overdue Aging Verification
        // Retrieve latest partner ledger running balance
        const { data: latestLedger } = await supabase
            .from('financial_ledger')
            .select('running_balance')
            .eq('partner_id', partner.id)
            .order('created_at', { ascending: false })
            .limit(1);
        const currentBalance = latestLedger && latestLedger.length > 0 ? Number(latestLedger[0].running_balance || 0) : 0;
        const partnerCreditLimit = Number(partner.credit_limit || 0);
        if (partnerCreditLimit > 0 && (currentBalance + invoiceTotal) > partnerCreditLimit) {
            return res.status(400).json({
                error: `Credit limit exceeded. Current outstanding is ₹${currentBalance.toLocaleString('en-IN')}, credit limit is ₹${partnerCreditLimit.toLocaleString('en-IN')}. New invoice of ₹${invoiceTotal.toLocaleString('en-IN')} would exceed limit.`
            });
        }
        // Step 4 & 3: Concurrency-Safe Atomic Invoice Series Counter Allocation
        let allocatedCounter = 0;
        for (let attempt = 0; attempt < 25; attempt++) {
            const { data: curSeries, error: fetchErr } = await supabase
                .from('invoice_series_configs')
                .select('current_counter')
                .eq('id', series.id)
                .single();
            if (fetchErr || !curSeries) {
                return res.status(500).json({ error: 'Failed to read invoice series configuration.' });
            }
            const curCount = Number(curSeries.current_counter || 1000);
            const nextCount = curCount + 1;
            const { data: updatedSeries, error: updateErr } = await supabase
                .from('invoice_series_configs')
                .update({ current_counter: nextCount })
                .eq('id', series.id)
                .eq('current_counter', curCount)
                .select();
            if (!updateErr && updatedSeries && updatedSeries.length > 0) {
                allocatedCounter = nextCount;
                break;
            }
            // Concurrency jitter
            await new Promise((r) => setTimeout(r, Math.random() * 25 + 5));
        }
        if (!allocatedCounter) {
            return res.status(409).json({ error: 'Invoice series counter contention. Please retry creating the invoice.' });
        }
        const prefix = series.prefix || '';
        const suffix = series.suffix || '';
        const invoice_number = `${prefix}${allocatedCounter}${suffix}`;
        const id = `inv-${Date.now()}`;
        // Snapshot company legal data at issue time to prevent historical corruption
        const company = await (0, supabase_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
        const todayIso = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + (due_days * 86400000)).toISOString().split('T')[0];
        // Insert Invoice
        const { error: invErr } = await supabase.from('invoices').insert({
            id,
            invoice_number,
            series_id: series.id,
            partner_id: partner.id,
            invoice_date: todayIso,
            due_date: dueDate,
            subtotal,
            cgst_amount: gst.cgst,
            sgst_amount: gst.sgst,
            igst_amount: gst.igst,
            total_amount: invoiceTotal,
            paid_amount: 0.0,
            outstanding_balance: invoiceTotal,
            status: 'unpaid',
            bank_account_snapshot_id: series.mapped_bank_account_id,
            line_items: JSON.stringify(line_items),
            company_snapshot: company ? JSON.stringify(company) : null,
        });
        if (invErr) {
            return res.status(500).json({ error: `Invoice creation failed: ${invErr.message}` });
        }
        // Insert Financial Ledger Debit Entry atomically linked
        const newRunningBalance = currentBalance + invoiceTotal;
        const ledId = `led-${Date.now()}`;
        const { error: ledErr } = await supabase.from('financial_ledger').insert({
            id: ledId,
            partner_id: partner.id,
            entry_date: todayIso,
            transaction_type: 'invoice_raised',
            reference_id: id,
            debit: invoiceTotal,
            credit: 0.0,
            running_balance: newRunningBalance,
            remarks: `Invoice ${invoice_number} raised`
        });
        if (ledErr) {
            // Rollback inserted invoice to prevent dangling or mismatched state
            await supabase.from('invoices').delete().eq('id', id);
            return res.status(500).json({ error: `Financial ledger debit entry failed. Invoice rolled back: ${ledErr.message}` });
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'CREATE_INVOICE',
            moduleKey: 'billing',
            tableAffected: 'invoices',
            recordId: id,
            newValueJson: { invoice_number, total: invoiceTotal, partner_id },
            delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
            ipAddress: req.ip,
        });
        return res.status(201).json({ success: true, id, invoice_number, total: invoiceTotal });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Payment screenshot verification queue
exports.apiRouter.get('/billing/payments/queue', requirePermission('billing', 'can_view'), async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause = 'WHERE (i.invoice_number LIKE ? OR pt.company_name LIKE ? OR p.transaction_ref LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        const selectSql = `
      SELECT p.*, i.invoice_number, i.total_amount, i.outstanding_balance, i.line_items,
             pt.company_name as partner_company, b.bank_name, b.account_number
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
      LEFT JOIN bank_accounts b ON p.bank_account_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
      ${whereClause}
    `;
        const mask = shouldMaskPii(req);
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = (result.data || []).map((p) => (0, masking_1.applyPiiMasking)(p, mask));
            return res.json({
                queue: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const queue = await (0, supabase_1.queryAll)(selectSql, params);
        const sanitized = (queue || []).map((p) => (0, masking_1.applyPiiMasking)(p, mask));
        return res.json({
            queue: sanitized,
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
exports.apiRouter.post('/billing/payments/record', requirePermission('billing', 'can_create'), async (req, res) => {
    var _a;
    try {
        const { invoice_id, partner_id, bank_account_id, amount_received, amount_paid, payment_mode = 'neft', reference_number, transaction_reference_utr, screenshot_url, screenshot_proof_url } = req.body;
        const amount = Number((_a = amount_paid !== null && amount_paid !== void 0 ? amount_paid : amount_received) !== null && _a !== void 0 ? _a : 0);
        if (!invoice_id || amount <= 0) {
            return res.status(400).json({ error: 'Invoice and a positive payment amount are required.' });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        // If partner_id is not explicitly provided, resolve from the invoice
        let resolvedPartnerId = partner_id;
        if (!resolvedPartnerId) {
            const { data: inv } = await supabase.from('invoices').select('partner_id').eq('id', invoice_id).maybeSingle();
            resolvedPartnerId = inv === null || inv === void 0 ? void 0 : inv.partner_id;
        }
        if (!resolvedPartnerId) {
            return res.status(400).json({ error: 'Associated partner could not be identified for this invoice.' });
        }
        const id = `pay-${Date.now()}`;
        const { data, error } = await supabase.from('payments_received').insert({
            id,
            invoice_id,
            partner_id: resolvedPartnerId,
            bank_account_id: bank_account_id || null,
            amount_paid: amount,
            payment_mode,
            transaction_reference_utr: reference_number || transaction_reference_utr || `UTR${Date.now()}`,
            screenshot_proof_url: screenshot_url || screenshot_proof_url || null,
            verified_status: 'pending_verification',
            created_at: new Date().toISOString()
        }).select().single();
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        return res.status(201).json({ success: true, id, payment: data });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/billing/payments/verify', requirePermission('billing', 'can_edit'), async (req, res) => {
    try {
        const currentUser = req.user;
        const delegation = req.delegation;
        const { payment_id, action = 'verified', rejection_remarks } = req.body; // action: 'verified' | 'rejected'
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const payment = await (0, supabase_1.queryOne)('SELECT * FROM payments_received WHERE id = ?', [payment_id]);
        if (!payment)
            return res.status(404).json({ error: 'Payment record not found' });
        if (payment.verified_status !== 'pending_verification') {
            return res.status(400).json({ error: `Payment is already processed with status: ${payment.verified_status}` });
        }
        if (action === 'verified') {
            // Step 2: Atomic Verification Claim via Conditional Row-Locking
            // Ensures that even under high concurrency, exactly ONE request can verify this payment
            const nowIso = new Date().toISOString();
            const { data: claimedPayment, error: claimErr } = await supabase
                .from('payments_received')
                .update({
                verified_status: 'verified',
                verified_at: nowIso,
                verified_by: currentUser.id
            })
                .eq('id', payment_id)
                .eq('verified_status', 'pending_verification')
                .select();
            if (claimErr || !claimedPayment || claimedPayment.length === 0) {
                return res.status(409).json({
                    error: 'Payment has already been verified or is being processed concurrently by another administrator.'
                });
            }
            // Lock associated invoice and validate balances
            const invoice = await (0, supabase_1.queryOne)('SELECT * FROM invoices WHERE id = ?', [payment.invoice_id]);
            if (!invoice) {
                // Rollback verification claim if invoice does not exist
                await supabase.from('payments_received').update({ verified_status: 'pending_verification', verified_by: null, verified_at: null }).eq('id', payment_id);
                return res.status(404).json({ error: 'Associated invoice not found' });
            }
            const currentOutstanding = Number(invoice.outstanding_balance || 0);
            const currentPaid = Number(invoice.paid_amount || 0);
            const payAmount = Number(payment.amount_paid || 0);
            if (payAmount > currentOutstanding) {
                // Rollback payment claim
                await supabase.from('payments_received').update({ verified_status: 'pending_verification', verified_by: null, verified_at: null }).eq('id', payment_id);
                return res.status(400).json({
                    error: `Payment amount (₹${payAmount}) exceeds invoice outstanding balance (₹${currentOutstanding}). Overpayment is not permitted.`
                });
            }
            const newPaid = currentPaid + payAmount;
            const newOutstanding = Math.max(0, currentOutstanding - payAmount);
            const newStatus = newOutstanding <= 0.001 ? 'paid' : 'partially_paid';
            // Update invoice amounts atomically
            const { error: invErr } = await supabase.from('invoices').update({
                paid_amount: newPaid,
                outstanding_balance: newOutstanding,
                status: newStatus
            }).eq('id', invoice.id);
            if (invErr) {
                // Rollback payment verification claim
                await supabase.from('payments_received').update({ verified_status: 'pending_verification', verified_by: null, verified_at: null }).eq('id', payment_id);
                return res.status(500).json({ error: `Failed to update invoice balances: ${invErr.message}` });
            }
            // Post credit to partner financial ledger
            const { data: latestLedger } = await supabase
                .from('financial_ledger')
                .select('running_balance')
                .eq('partner_id', payment.partner_id)
                .order('created_at', { ascending: false })
                .limit(1);
            const curLedgerBalance = latestLedger && latestLedger.length > 0 ? Number(latestLedger[0].running_balance || 0) : 0;
            const newLedgerBalance = curLedgerBalance - payAmount;
            const ledId = `led-${Date.now()}`;
            const { error: ledErr } = await supabase.from('financial_ledger').insert({
                id: ledId,
                partner_id: payment.partner_id,
                entry_date: nowIso.split('T')[0],
                transaction_type: 'payment_received',
                reference_id: payment.id,
                debit: 0.0,
                credit: payAmount,
                running_balance: newLedgerBalance,
                remarks: `Payment received UTR: ${payment.transaction_reference_utr || 'Direct'}`
            });
            if (ledErr) {
                // Rollback invoice and payment updates
                await supabase.from('invoices').update({ paid_amount: currentPaid, outstanding_balance: currentOutstanding, status: invoice.status }).eq('id', invoice.id);
                await supabase.from('payments_received').update({ verified_status: 'pending_verification', verified_by: null, verified_at: null }).eq('id', payment_id);
                return res.status(500).json({ error: `Failed to post financial ledger entry: ${ledErr.message}` });
            }
            await logAuditEvent({
                userId: currentUser.id,
                actionType: 'VERIFY_PAYMENT',
                moduleKey: 'billing',
                tableAffected: 'payments_received',
                recordId: payment_id,
                oldValueJson: { status: payment.verified_status },
                newValueJson: { status: 'verified', amount: payAmount, invoice_id: invoice.id, new_outstanding: newOutstanding },
                delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
                ipAddress: req.ip,
            });
            return res.json({ success: true, status: 'verified', outstanding_balance: newOutstanding });
        }
        else {
            // Rejection branch
            const nowIso = new Date().toISOString();
            const { data: rejectedPayment, error: rejErr } = await supabase
                .from('payments_received')
                .update({
                verified_status: 'rejected',
                rejection_remarks: rejection_remarks || 'Screenshot mismatch or invalid UTR',
                verified_at: nowIso,
                verified_by: currentUser.id
            })
                .eq('id', payment_id)
                .eq('verified_status', 'pending_verification')
                .select();
            if (rejErr || !rejectedPayment || rejectedPayment.length === 0) {
                return res.status(409).json({ error: 'Payment is already processed or modified concurrently.' });
            }
            await logAuditEvent({
                userId: currentUser.id,
                actionType: 'REJECT_PAYMENT',
                moduleKey: 'billing',
                tableAffected: 'payments_received',
                recordId: payment_id,
                oldValueJson: { status: payment.verified_status },
                newValueJson: { status: 'rejected', remarks: rejection_remarks },
                delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
                ipAddress: req.ip,
            });
            return res.json({ success: true, status: 'rejected' });
        }
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 8.1 Payment Reminders & Aging Follow-ups
// ==========================================
// GET /api/billing/reminders/preview?partner_id=...
// Prepares reminder details, calculating real outstanding invoices and bank payment info
exports.apiRouter.get('/billing/reminders/preview', requirePermission('billing', 'can_view'), async (req, res) => {
    try {
        const partnerId = String(req.query.partner_id || '').trim();
        if (!partnerId) {
            return res.status(400).json({ error: 'partner_id is required' });
        }
        const partner = await (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [partnerId]);
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        // Fetch active unpaid / partially_paid invoices (exclude paid, rejected, cancelled)
        const allInvoices = await (0, supabase_1.queryAll)('SELECT id, invoice_number, total_amount, outstanding_balance, due_date, status, invoice_date FROM invoices WHERE partner_id = ? AND status IN (?, ?) AND outstanding_balance > 0 ORDER BY due_date ASC', [partnerId, 'unpaid', 'partially_paid']);
        const totalOutstanding = allInvoices.reduce((sum, inv) => sum + Number(inv.outstanding_balance || 0), 0);
        // Calculate earliest due date and overdue days
        let earliestDueDate = null;
        let maxOverdueDays = 0;
        const now = Date.now();
        if (allInvoices.length > 0) {
            earliestDueDate = allInvoices[0].due_date;
            allInvoices.forEach(inv => {
                if (inv.due_date) {
                    const dueTime = new Date(inv.due_date).getTime();
                    const diff = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
                    if (diff > maxOverdueDays) {
                        maxOverdueDays = diff;
                    }
                }
            });
        }
        // Fetch primary active bank account for payment details
        const bankAccount = await (0, supabase_1.queryOne)('SELECT bank_name, account_number, ifsc_code, upi_id, account_holder_name FROM bank_accounts WHERE is_active = 1 LIMIT 1');
        const mask = shouldMaskPii(req);
        const sanitizedPartner = (0, masking_1.applyPiiMasking)(partner, mask);
        // Construct default suggested message
        const isOverdue = maxOverdueDays > 0;
        const greeting = partner.contact_person ? `Dear ${partner.contact_person} (${partner.company_name}),` : `Dear ${partner.company_name},`;
        let invoiceLines = '';
        if (allInvoices.length === 1) {
            const inv = allInvoices[0];
            const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'Immediate';
            invoiceLines = `${inv.invoice_number} — ₹${Number(inv.outstanding_balance).toLocaleString('en-IN')} (Due: ${dueStr})`;
        }
        else {
            invoiceLines = allInvoices.slice(0, 5).map(inv => {
                const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'Immediate';
                return `• ${inv.invoice_number} — ₹${Number(inv.outstanding_balance).toLocaleString('en-IN')} (Due: ${dueStr})`;
            }).join('\n');
            if (allInvoices.length > 5) {
                invoiceLines += `\n• ...and ${allInvoices.length - 5} more invoice(s)`;
            }
        }
        let bankBlock = '';
        if (bankAccount) {
            bankBlock = `\nBank Transfer Details:\n• Bank: ${bankAccount.bank_name}\n• A/C No: ${bankAccount.account_number}\n• IFSC: ${bankAccount.ifsc_code}${bankAccount.upi_id ? `\n• UPI: ${bankAccount.upi_id}` : ''}\n`;
        }
        const toneText = isOverdue
            ? `This is a friendly payment reminder regarding overdue invoice(s) with an outstanding balance of ₹${totalOutstanding.toLocaleString('en-IN')}:`
            : `This is a payment reminder regarding the upcoming balance of ₹${totalOutstanding.toLocaleString('en-IN')} against invoice(s):`;
        const defaultMessage = `${greeting}\n\n${toneText}\n\n${invoiceLines}\n\nTotal Outstanding: ₹${totalOutstanding.toLocaleString('en-IN')}\n${bankBlock}\nKindly arrange payment at your earliest convenience. If payment has already been initiated, please reply with the UTR / transaction receipt so we can update your statement.\n\nRegards,\nSignSync Accounts Team`;
        return res.json({
            partner: sanitizedPartner,
            raw_phone: mask ? null : partner.phone,
            raw_email: mask ? null : partner.email,
            invoices: allInvoices,
            total_outstanding: totalOutstanding,
            earliest_due_date: earliestDueDate,
            overdue_days: maxOverdueDays,
            is_overdue: isOverdue,
            bank_account: bankAccount,
            default_message: defaultMessage
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/billing/reminders/log
// Records reminder action in Supabase audit_logs with idempotent check and strict permission enforcement
exports.apiRouter.post('/billing/reminders/log', requirePermission('billing', 'can_create'), async (req, res) => {
    try {
        const currentUser = req.user;
        const delegation = req.delegation;
        const { partner_id, channel, // 'whatsapp' | 'email'
        status, // 'drafted' | 'opened' | 'staff_confirmed_sent'
        outstanding_amount, invoices, recipient_phone, recipient_email, message_content, client_timestamp } = req.body;
        if (!partner_id || !channel || !status) {
            return res.status(400).json({ error: 'partner_id, channel, and status are required' });
        }
        if (!['whatsapp', 'email'].includes(channel)) {
            return res.status(400).json({ error: 'Channel must be whatsapp or email' });
        }
        if (!['drafted', 'opened', 'staff_confirmed_sent'].includes(status)) {
            return res.status(400).json({ error: 'Invalid reminder status' });
        }
        // Verify partner exists
        const partner = await (0, supabase_1.queryOne)('SELECT id, company_name FROM partners WHERE id = ?', [partner_id]);
        if (!partner) {
            return res.status(404).json({ error: 'Partner not found' });
        }
        // Double-click idempotency guard: check for identical reminder logged by same user in last 10 seconds
        const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
        const { data: recentLogs } = await supabase_1.supabase
            .from('audit_logs')
            .select('id, created_at, new_value_json')
            .eq('action_type', 'PAYMENT_REMINDER_LOGGED')
            .eq('user_id', currentUser.id)
            .eq('record_id', partner_id)
            .gte('created_at', tenSecondsAgo);
        if (recentLogs && recentLogs.length > 0) {
            // Find if same channel and status was recorded
            const duplicate = recentLogs.find((l) => {
                try {
                    const parsed = typeof l.new_value_json === 'string' ? JSON.parse(l.new_value_json) : l.new_value_json;
                    return (parsed === null || parsed === void 0 ? void 0 : parsed.channel) === channel && (parsed === null || parsed === void 0 ? void 0 : parsed.status) === status;
                }
                catch (_a) {
                    return false;
                }
            });
            if (duplicate) {
                return res.status(200).json({
                    success: true,
                    id: duplicate.id,
                    message: 'Reminder already logged recently (idempotent response)'
                });
            }
        }
        const reminderId = `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const reminderPayload = {
            reminder_id: reminderId,
            partner_id,
            partner_name: partner.company_name,
            channel,
            status, // 'drafted' | 'opened' | 'staff_confirmed_sent'
            outstanding_amount: Number(outstanding_amount) || 0,
            invoices: Array.isArray(invoices) ? invoices : [],
            recipient_phone: recipient_phone || null,
            recipient_email: recipient_email || null,
            message_snapshot: message_content || '',
            staff_id: currentUser.id,
            staff_name: currentUser.full_name,
            client_timestamp: client_timestamp || new Date().toISOString()
        };
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'PAYMENT_REMINDER_LOGGED',
            moduleKey: 'billing',
            tableAffected: 'partners',
            recordId: partner_id,
            newValueJson: reminderPayload,
            reason: `Payment reminder ${status} via ${channel} to ${partner.company_name} (₹${outstanding_amount})`,
            delegationId: delegation === null || delegation === void 0 ? void 0 : delegation.id,
            ipAddress: req.ip
        });
        return res.status(201).json({
            success: true,
            id: reminderId,
            status,
            channel,
            created_at: new Date().toISOString()
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/billing/reminders/history?partner_id=...
// Retrieves logged reminder history from Supabase audit_logs for a partner
exports.apiRouter.get('/billing/reminders/history', requirePermission('billing', 'can_view'), async (req, res) => {
    try {
        const partnerId = String(req.query.partner_id || '').trim();
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        let query = supabase_1.supabase
            .from('audit_logs')
            .select('id, user_id, action_type, new_value_json, created_at', { count: 'exact' })
            .eq('action_type', 'PAYMENT_REMINDER_LOGGED');
        if (partnerId) {
            query = query.eq('record_id', partnerId);
        }
        query = query.order('created_at', { ascending: false });
        if (isPaginated) {
            query = query.range(offset, offset + limit - 1);
        }
        else {
            query = query.limit(20);
        }
        const { data, count, error } = await query;
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        // Fetch user names for users who logged reminders
        const userIds = Array.from(new Set((data || []).map((d) => d.user_id).filter(Boolean)));
        let userMap = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase_1.supabase.from('user_profiles').select('id, full_name').in('id', userIds);
            users === null || users === void 0 ? void 0 : users.forEach((u) => { userMap[u.id] = u.full_name; });
        }
        const history = (data || []).map((row) => {
            let payload = {};
            try {
                payload = typeof row.new_value_json === 'string' ? JSON.parse(row.new_value_json) : (row.new_value_json || {});
            }
            catch (_a) {
                payload = {};
            }
            return {
                id: row.id,
                reminder_id: payload.reminder_id || row.id,
                partner_id: payload.partner_id || row.record_id,
                partner_name: payload.partner_name,
                channel: payload.channel,
                status: payload.status,
                outstanding_amount: payload.outstanding_amount,
                invoices: payload.invoices,
                recipient_phone: payload.recipient_phone,
                recipient_email: payload.recipient_email,
                message_snapshot: payload.message_snapshot,
                staff_id: row.user_id,
                staff_name: userMap[row.user_id] || payload.staff_name || 'Staff',
                created_at: row.created_at
            };
        });
        return res.json({
            history,
            totalCount: count || history.length,
            page: isPaginated ? page : 1,
            limit: isPaginated ? limit : history.length,
            totalPages: isPaginated ? Math.max(1, Math.ceil((count || 0) / limit)) : 1
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 9. Logistics, Couriers & POD Tracking
// ==========================================
exports.apiRouter.get('/courier/dispatches', requirePermission('courier', 'can_view'), async (req, res) => {
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
        const mask = shouldMaskPii(req);
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            const sanitized = (result.data || []).map((d) => (0, masking_1.applyPiiMasking)(d, mask));
            return res.json({
                dispatches: sanitized,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const dispatches = await (0, supabase_1.queryAll)(selectSql, params);
        const sanitized = (dispatches || []).map((d) => (0, masking_1.applyPiiMasking)(d, mask));
        return res.json({
            dispatches: sanitized,
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
exports.apiRouter.post('/courier/dispatches', requirePermission('courier', 'can_create'), async (req, res) => {
    try {
        const { carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents } = req.body;
        if (!carrier_name || !awb_number || !recipient_name) {
            return res.status(400).json({ error: 'Carrier name, AWB tracking number, and recipient name are required.' });
        }
        const id = `disp-${Date.now()}`;
        const dispatch_number = await allocateNextReferenceNumber('courier_dispatch');
        await (0, supabase_1.run)(`
      INSERT INTO courier_dispatches (id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manifested')
    `, [id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents]);
        return res.status(201).json({ success: true, id, dispatch_number });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/courier/dispatches/:id/status', requirePermission('courier', 'can_edit'), async (req, res) => {
    try {
        const { status, proof_of_delivery_url, notes } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required.' });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const updatePayload = {
            status
        };
        if (proof_of_delivery_url)
            updatePayload.proof_of_delivery_url = proof_of_delivery_url;
        if (notes)
            updatePayload.notes = notes;
        if (status === 'delivered')
            updatePayload.delivered_at = new Date().toISOString();
        const { error: updateErr } = await supabase
            .from('courier_dispatches')
            .update(updatePayload)
            .eq('id', req.params.id);
        if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
        }
        return res.json({ success: true, message: `Courier status updated to ${status}.` });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Delivery Challan / Transfer Document PDF Compilation
exports.apiRouter.get('/inventory/transfers/pdf', requirePermission('inventory', 'can_view'), async (req, res) => {
    try {
        const challanNumber = req.query.challan_number || 'DC-2026-0001';
        const profile = await (0, supabase_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
        const challans = await (0, supabase_1.queryAll)(`
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
const masterNavigationStore_1 = require("../masterNavigationStore");
// Hierarchical Master Navigation APIs
exports.apiRouter.get('/admin/master-navigation', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const items = (0, masterNavigationStore_1.loadMasterNavigation)();
        // Non-super-admins only see active items and modules they have permission for
        if (user && user.hierarchy_level_order > 0) {
            const activeItems = items.filter(i => i.is_active === 1);
            return res.json({ success: true, items: activeItems });
        }
        return res.json({ success: true, items });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
exports.apiRouter.post('/admin/master-navigation', requireAdmin, async (req, res) => {
    try {
        const { parent_id, name, code, type, route, icon, display_order, is_active, permission_key, master_resource } = req.body;
        if (!name || !code || !type) {
            return res.status(400).json({ success: false, error: 'Name, code, and type are required.' });
        }
        const validTypes = ['MODULE', 'SUB_MODULE', 'MASTER'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ success: false, error: `Invalid type. Allowed: ${validTypes.join(', ')}` });
        }
        // Hierarchy validation
        if (type === 'SUB_MODULE' && !parent_id) {
            return res.status(400).json({ success: false, error: 'Sub-module must have a parent Module.' });
        }
        if (type === 'MASTER' && !parent_id) {
            return res.status(400).json({ success: false, error: 'Master must have a parent Sub-module or Module.' });
        }
        const items = (0, masterNavigationStore_1.loadMasterNavigation)();
        // Validate duplicate code within siblings or globally
        if (items.some(i => i.code.toLowerCase() === code.trim().toLowerCase())) {
            return res.status(409).json({ success: false, error: `Navigation item with code "${code}" already exists.` });
        }
        const newItem = {
            id: `nav-${type.toLowerCase()}-${Date.now()}`,
            parent_id: parent_id || null,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            type,
            route: route ? route.trim() : null,
            icon: icon ? icon.trim() : (type === 'MODULE' ? 'Layers' : type === 'SUB_MODULE' ? 'ChevronRight' : 'Tag'),
            display_order: Number(display_order || items.length + 1),
            is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
            permission_key: permission_key ? permission_key.trim() : null,
            master_resource: master_resource ? master_resource.trim() : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        items.push(newItem);
        (0, masterNavigationStore_1.saveMasterNavigation)(items);
        return res.status(201).json({ success: true, item: newItem, message: `${type} created successfully.` });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
exports.apiRouter.put('/admin/master-navigation/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { parent_id, name, code, route, icon, display_order, is_active, permission_key, master_resource } = req.body;
        const items = (0, masterNavigationStore_1.loadMasterNavigation)();
        const index = items.findIndex(i => i.id === id);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Navigation item not found.' });
        }
        const current = items[index];
        if (code && code.trim().toLowerCase() !== current.code.toLowerCase()) {
            if (items.some(i => i.id !== id && i.code.toLowerCase() === code.trim().toLowerCase())) {
                return res.status(409).json({ success: false, error: `Code "${code}" is already in use.` });
            }
        }
        items[index] = Object.assign(Object.assign({}, current), { parent_id: parent_id !== undefined ? (parent_id || null) : current.parent_id, name: name ? name.trim() : current.name, code: code ? code.trim().toUpperCase() : current.code, route: route !== undefined ? (route ? route.trim() : null) : current.route, icon: icon !== undefined ? (icon ? icon.trim() : current.icon) : current.icon, display_order: display_order !== undefined ? Number(display_order) : current.display_order, is_active: is_active !== undefined ? (is_active ? 1 : 0) : current.is_active, permission_key: permission_key !== undefined ? (permission_key ? permission_key.trim() : null) : current.permission_key, master_resource: master_resource !== undefined ? (master_resource ? master_resource.trim() : null) : current.master_resource, updated_at: new Date().toISOString() });
        (0, masterNavigationStore_1.saveMasterNavigation)(items);
        return res.json({ success: true, item: items[index], message: 'Navigation item updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
exports.apiRouter.patch('/admin/master-navigation/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const items = (0, masterNavigationStore_1.loadMasterNavigation)();
        const index = items.findIndex(i => i.id === id);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Navigation item not found.' });
        }
        const newStatus = is_active ? 1 : 0;
        items[index].is_active = newStatus;
        items[index].updated_at = new Date().toISOString();
        (0, masterNavigationStore_1.saveMasterNavigation)(items);
        return res.json({
            success: true,
            id,
            is_active: newStatus,
            message: newStatus ? 'Master activated successfully.' : 'Master deactivated successfully.'
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
exports.apiRouter.put('/admin/master-navigation/reorder', requireAdmin, async (req, res) => {
    try {
        const { orderings } = req.body; // Array of { id: string, display_order: number }
        if (!Array.isArray(orderings)) {
            return res.status(400).json({ success: false, error: 'Orderings must be an array of { id, display_order }.' });
        }
        const items = (0, masterNavigationStore_1.loadMasterNavigation)();
        const orderMap = new Map(orderings.map((o) => [o.id, Number(o.display_order)]));
        items.forEach(item => {
            if (orderMap.has(item.id)) {
                item.display_order = orderMap.get(item.id);
                item.updated_at = new Date().toISOString();
            }
        });
        (0, masterNavigationStore_1.saveMasterNavigation)(items);
        return res.json({ success: true, message: 'Display order updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
// Support CRM Lead Statuses Master Endpoints
exports.apiRouter.get('/crm/lead-statuses', requireAuth, async (_req, res) => {
    try {
        const statuses = [
            { id: 'status-new', code: 'NEW', name: 'New Lead / Fresh Inquiry', is_active: 1, display_order: 1 },
            { id: 'status-contacted', code: 'CONTACTED', name: 'Contacted / Pitch Made', is_active: 1, display_order: 2 },
            { id: 'status-follow-up', code: 'FOLLOW_UP', name: 'Follow-up Scheduled', is_active: 1, display_order: 3 },
            { id: 'status-proposal-sent', code: 'PROPOSAL_SENT', name: 'Price Quotation / Proposal Sent', is_active: 1, display_order: 4 },
            { id: 'status-won', code: 'WON', name: 'Closed - Won / Partner Converted', is_active: 1, display_order: 5 },
            { id: 'status-lost', code: 'LOST', name: 'Closed - Lost / Not Interested', is_active: 1, display_order: 6 },
        ];
        return res.json({ success: true, statuses });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
// A. Company Profile Settings
exports.apiRouter.get('/admin/settings/company', requireAuth, async (_req, res) => {
    try {
        const profile = await (0, supabase_1.queryOne)('SELECT * FROM company_profile LIMIT 1');
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
        await (0, supabase_1.run)(`
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
exports.apiRouter.get('/admin/settings/tokens', requireAuth, async (_req, res) => {
    try {
        const models = await (0, supabase_1.queryAll)('SELECT * FROM token_models ORDER BY model_name ASC');
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
        await (0, supabase_1.run)(`
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
exports.apiRouter.get('/admin/settings/couriers', requireAuth, async (_req, res) => {
    try {
        const couriers = await (0, supabase_1.queryAll)('SELECT * FROM courier_partners ORDER BY company_name ASC');
        return res.json({ couriers });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/settings/couriers', requireAdmin, async (req, res) => {
    var _a;
    try {
        const { company_name, tracking_url_template, support_phone } = req.body;
        if (!company_name)
            return res.status(400).json({ error: 'Company name is required.' });
        const id = `cp-${Date.now()}`;
        const orgId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.organization_id) || 'comp-default';
        await (0, supabase_1.run)(`
      INSERT INTO courier_partners (id, organization_id, company_name, tracking_url_template, support_phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, orgId, company_name.trim(), tracking_url_template || null, support_phone || null]);
        return res.status(201).json({ success: true, id, message: 'Courier company added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// D. Business Services Master
exports.apiRouter.get('/admin/settings/services', requireAuth, async (_req, res) => {
    try {
        const services = await (0, supabase_1.queryAll)('SELECT * FROM services_catalog ORDER BY category, service_name');
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
        await (0, supabase_1.run)(`
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
exports.apiRouter.put('/partners/:id', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const { company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, status, kyc_verified } = req.body;
        const existing = await (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [req.params.id]);
        if (!existing)
            return res.status(404).json({ error: 'Partner not found' });
        // Strict Security Guard: Only Super Admin (Level 0) or Partner Admin (Level 1) can modify credit limits or credit periods
        if (credit_limit !== undefined || credit_period_days !== undefined) {
            if (currentUser.hierarchy_level_order > 1) {
                return res.status(403).json({ error: 'Security restriction: Only authorized administrators (Level 0/1) can modify credit limits and terms.' });
            }
        }
        const updateData = {};
        if (company_name !== undefined)
            updateData.company_name = company_name;
        if (contact_person !== undefined)
            updateData.contact_person = contact_person;
        if (email !== undefined)
            updateData.email = email;
        if (phone !== undefined)
            updateData.phone = phone;
        if (gstin !== undefined)
            updateData.gstin = gstin;
        if (pan !== undefined)
            updateData.pan = pan;
        if (billing_address !== undefined)
            updateData.billing_address = billing_address;
        if (state_code !== undefined)
            updateData.state_code = state_code;
        if (credit_limit !== undefined)
            updateData.credit_limit = Number(credit_limit);
        if (credit_period_days !== undefined)
            updateData.credit_period_days = Number(credit_period_days);
        if (status !== undefined)
            updateData.status = status;
        if (kyc_verified !== undefined)
            updateData.kyc_verified = Number(kyc_verified);
        const { error: updErr } = await supabase
            .from('partners')
            .update(updateData)
            .eq('id', req.params.id);
        if (updErr) {
            return res.status(500).json({ error: updErr.message });
        }
        if (credit_limit !== undefined && Number(credit_limit) !== existing.credit_limit) {
            const partId = req.params.id;
            await logAuditEvent({
                userId: currentUser.id,
                actionType: 'CHANGE_CREDIT_LIMIT',
                moduleKey: 'partners',
                tableAffected: 'partners',
                recordId: Array.isArray(partId) ? partId[0] : partId,
                oldValueJson: { credit_limit: existing.credit_limit, credit_period_days: existing.credit_period_days },
                newValueJson: { credit_limit: updateData.credit_limit, credit_period_days: updateData.credit_period_days || existing.credit_period_days },
                reason: 'Credit policy adjustment',
                ipAddress: req.ip,
            });
        }
        return res.json({ success: true, message: 'Partner details updated successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// Central Master Configuration APIs (Phase 2)
// ==========================================
// 1. Certifying Authorities (CA)
exports.apiRouter.get('/admin/masters/ca', requireAuth, async (_req, res) => {
    try {
        const authorities = await (0, supabase_1.queryAll)('SELECT * FROM certifying_authorities ORDER BY ca_name ASC');
        return res.json({ authorities });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/masters/ca', requireAdmin, async (req, res) => {
    try {
        const { ca_name, ca_code, api_endpoint, support_contact } = req.body;
        if (!ca_name || !ca_code) {
            return res.status(400).json({ error: 'CA Name and CA Code are required.' });
        }
        const id = `ca-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO certifying_authorities (id, ca_name, ca_code, api_endpoint, support_contact, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, ca_name.trim(), ca_code.trim().toUpperCase(), api_endpoint || null, support_contact || null]);
        const currentUser = req.user;
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'CREATE_CA_MASTER',
            moduleKey: 'admin_users',
            tableAffected: 'certifying_authorities',
            recordId: id,
            newValueJson: { ca_name, ca_code },
            ipAddress: req.ip,
        });
        return res.status(201).json({ success: true, id, message: 'Certifying Authority added.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/masters/ca/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE certifying_authorities SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 2. Hardware Vendors
exports.apiRouter.get('/admin/masters/vendors', requireAuth, async (_req, res) => {
    try {
        const vendors = await (0, supabase_1.queryAll)('SELECT * FROM hardware_vendors ORDER BY vendor_name ASC');
        return res.json({ vendors });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/masters/vendors', requireAdmin, async (req, res) => {
    try {
        const { vendor_name, contact_person, email, phone, gstin, address } = req.body;
        if (!vendor_name)
            return res.status(400).json({ error: 'Vendor name is required.' });
        const id = `ven-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO hardware_vendors (id, vendor_name, contact_person, email, phone, gstin, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, vendor_name.trim(), contact_person || null, email || null, phone || null, gstin || null, address || null]);
        const currentUser = req.user;
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'CREATE_VENDOR_MASTER',
            moduleKey: 'admin_users',
            tableAffected: 'hardware_vendors',
            recordId: id,
            newValueJson: { vendor_name },
            ipAddress: req.ip,
        });
        return res.status(201).json({ success: true, id, message: 'Hardware vendor added.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 2b. Partner Types Master (Supabase-backed via company_profile metadata)
async function getPartnerTypesFromDb() {
    const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
    const { data } = await supabase.from('company_profile').select('logo_url').single();
    const raw = (data === null || data === void 0 ? void 0 : data.logo_url) || '';
    if (raw.includes('#PARTNER_TYPES:')) {
        try {
            const jsonStr = raw.split('#PARTNER_TYPES:')[1];
            return JSON.parse(jsonStr);
        }
        catch (_a) {
            // fallback
        }
    }
    return [
        { id: 'pt-dsc', type_key: 'dsc_partner', type_name: 'DSC Retail Partner', is_active: 1 },
        { id: 'pt-token', type_key: 'token_partner', type_name: 'Hardware Token Stockist', is_active: 1 },
        { id: 'pt-assoc', type_key: 'associate_partner', type_name: 'Associate Business Partner', is_active: 1 },
        { id: 'pt-dist', type_key: 'master_distributor', type_name: 'Master Regional Distributor', is_active: 1 },
    ];
}
async function savePartnerTypesToDb(types) {
    const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
    const baseLogo = '/signsync-logo.png';
    const newMeta = `${baseLogo}#PARTNER_TYPES:${JSON.stringify(types)}`;
    await supabase.from('company_profile').update({ logo_url: newMeta }).eq('id', 'comp-default');
}
exports.apiRouter.get('/admin/masters/partner-types', requireAuth, async (_req, res) => {
    try {
        const types = await getPartnerTypesFromDb();
        return res.json({ partner_types: types });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/masters/partner-types', requireAdmin, async (req, res) => {
    try {
        const { type_key, type_name } = req.body;
        if (!type_key || !type_name) {
            return res.status(400).json({ error: 'Partner type key and display name are required.' });
        }
        const current = await getPartnerTypesFromDb();
        const cleanKey = type_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (current.some((t) => t.type_key === cleanKey)) {
            return res.status(400).json({ error: 'Partner type key already exists.' });
        }
        const newEntry = {
            id: `pt-${Date.now()}`,
            type_key: cleanKey,
            type_name: type_name.trim(),
            is_active: 1,
        };
        current.push(newEntry);
        await savePartnerTypesToDb(current);
        return res.status(201).json({ success: true, id: newEntry.id, message: 'Partner category added successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/masters/partner-types/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const current = await getPartnerTypesFromDb();
        const item = current.find((t) => t.id === req.params.id);
        if (!item)
            return res.status(404).json({ error: 'Partner type not found.' });
        item.is_active = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await savePartnerTypesToDb(current);
        return res.json({ success: true, is_active: Boolean(item.is_active) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// Genuine Supabase Storage API Endpoints
// ==========================================
const ALLOWED_STORAGE_BUCKETS = {
    'kyc': {
        bucket: 'kyc-documents',
        maxBytes: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    },
    'dsc': {
        bucket: 'dsc-documents',
        maxBytes: 15 * 1024 * 1024,
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm']
    },
    'payment': {
        bucket: 'payment-proofs',
        maxBytes: 8 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    },
    'pod': {
        bucket: 'courier-pod',
        maxBytes: 10 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    },
    'service': {
        bucket: 'service-documents',
        maxBytes: 20 * 1024 * 1024,
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/zip']
    }
};
exports.apiRouter.post('/storage/upload', requireAuth, async (req, res) => {
    try {
        const { category, fileName, fileBase64, contentType } = req.body;
        if (!category || !fileName || !fileBase64 || !contentType) {
            return res.status(400).json({ error: 'category, fileName, fileBase64, and contentType are required.' });
        }
        const config = ALLOWED_STORAGE_BUCKETS[category];
        if (!config) {
            return res.status(400).json({ error: `Invalid storage category. Permitted: ${Object.keys(ALLOWED_STORAGE_BUCKETS).join(', ')}` });
        }
        if (!config.allowedTypes.includes(contentType)) {
            return res.status(400).json({ error: `File type ${contentType} is not permitted for category ${category}.` });
        }
        const fileBuffer = Buffer.from(fileBase64, 'base64');
        if (fileBuffer.length > config.maxBytes) {
            return res.status(400).json({ error: `File size exceeds the limit of ${config.maxBytes / (1024 * 1024)}MB.` });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${Date.now()}_${sanitizedName}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from(config.bucket)
            .upload(storagePath, fileBuffer, {
            contentType,
            upsert: false
        });
        if (uploadErr) {
            return res.status(500).json({ error: `Supabase Storage upload failed: ${uploadErr.message}` });
        }
        // Generate authenticated signed URL valid for 24 hours (86,400 seconds)
        const { data: signedData, error: signErr } = await supabase.storage
            .from(config.bucket)
            .createSignedUrl(storagePath, 86400);
        return res.status(201).json({
            success: true,
            bucket: config.bucket,
            path: storagePath,
            signedUrl: (signedData === null || signedData === void 0 ? void 0 : signedData.signedUrl) || null,
            fullUrl: (signedData === null || signedData === void 0 ? void 0 : signedData.signedUrl) || `${config.bucket}/${storagePath}`
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/storage/signed-url', requireAuth, async (req, res) => {
    try {
        const { category, path } = req.body;
        if (!category || !path) {
            return res.status(400).json({ error: 'category and path are required.' });
        }
        const config = ALLOWED_STORAGE_BUCKETS[category];
        if (!config) {
            return res.status(400).json({ error: 'Invalid storage category.' });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../supabase')));
        const { data, error } = await supabase.storage
            .from(config.bucket)
            .createSignedUrl(path, 86400);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        return res.json({ signedUrl: data.signedUrl });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 3. Stock Adjustment Reasons
exports.apiRouter.get('/admin/masters/reasons', requireAuth, async (_req, res) => {
    try {
        const reasons = await (0, supabase_1.queryAll)('SELECT * FROM stock_adjustment_reasons ORDER BY reason_label ASC');
        return res.json({ reasons });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/masters/reasons', requireAdmin, async (req, res) => {
    try {
        const { reason_code, reason_label, adjustment_type } = req.body;
        if (!reason_code || !reason_label)
            return res.status(400).json({ error: 'Reason code and label are required.' });
        const id = `rsn-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO stock_adjustment_reasons (id, reason_code, reason_label, adjustment_type, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [id, reason_code.trim().toUpperCase(), reason_label.trim(), adjustment_type || 'DAMAGE']);
        return res.status(201).json({ success: true, id, message: 'Adjustment reason added.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/masters/reasons/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE stock_adjustment_reasons SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 3b. CRM Lead Sources Master
exports.apiRouter.get('/crm/lead-sources', requireAuth, async (_req, res) => {
    try {
        const sources = await (0, supabase_1.queryAll)('SELECT * FROM crm_lead_sources ORDER BY source_name ASC');
        return res.json({ sources });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/crm/lead-sources', requireAdmin, async (req, res) => {
    try {
        const user = req.user;
        const { source_name } = req.body;
        if (!source_name)
            return res.status(400).json({ error: 'Lead source name is required.' });
        const id = `src-${Date.now()}`;
        const orgId = (user === null || user === void 0 ? void 0 : user.organization_id) || 'comp-default';
        await (0, supabase_1.run)('INSERT INTO crm_lead_sources (id, source_name, is_active, organization_id) VALUES (?, ?, 1, ?)', [id, source_name.trim(), orgId]);
        return res.status(201).json({ success: true, id, message: 'Lead source added.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/crm/lead-sources/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE crm_lead_sources SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 3c. Master Entities Deactivate / Update Endpoints
exports.apiRouter.patch('/admin/masters/vendors/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE hardware_vendors SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/settings/tokens/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE token_models SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/settings/couriers/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE courier_partners SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.patch('/admin/settings/services/:id/deactivate', requireAdmin, async (req, res) => {
    try {
        const { is_active } = req.body;
        const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0;
        await (0, supabase_1.run)('UPDATE services_catalog SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
        return res.json({ success: true, is_active: Boolean(newStatus) });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Branches List Endpoint
exports.apiRouter.get('/admin/branches', requireAuth, async (_req, res) => {
    try {
        const branches = await (0, supabase_1.queryAll)('SELECT * FROM branches ORDER BY branch_name ASC');
        return res.json({ branches });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 4. Central Numbering Series Configuration Master
exports.apiRouter.get('/admin/numbering', requireAdmin, async (_req, res) => {
    try {
        const configs = await (0, supabase_1.queryAll)('SELECT * FROM numbering_series_configs ORDER BY document_type ASC');
        return res.json({ configs });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/numbering', requireAdmin, async (req, res) => {
    try {
        const currentUser = req.user;
        const { series_name, document_type, prefix, suffix, separator = '-', parts_order = '["prefix", "fy", "counter", "suffix"]', fy_format = 'YY-YY', company_code, branch_code, counter_padding = 5, starting_counter = 1001, current_counter = 1000, } = req.body;
        if (!series_name || !document_type) {
            return res.status(400).json({ error: 'Series name and document type are required.' });
        }
        const id = `num-${document_type}`;
        await (0, supabase_1.run)(`
      INSERT INTO numbering_series_configs (
        id, series_name, document_type, prefix, suffix, separator, parts_order, fy_format,
        company_code, branch_code, counter_padding, starting_counter, current_counter, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(document_type) DO UPDATE SET
        series_name = excluded.series_name,
        prefix = excluded.prefix,
        suffix = excluded.suffix,
        separator = excluded.separator,
        parts_order = excluded.parts_order,
        fy_format = excluded.fy_format,
        company_code = excluded.company_code,
        branch_code = excluded.branch_code,
        counter_padding = excluded.counter_padding,
        updated_at = CURRENT_TIMESTAMP
    `, [
            id,
            series_name.trim(),
            document_type.trim(),
            prefix ? prefix.trim().toUpperCase() : null,
            suffix ? suffix.trim().toUpperCase() : null,
            separator,
            typeof parts_order === 'string' ? parts_order : JSON.stringify(parts_order),
            fy_format,
            company_code ? company_code.trim().toUpperCase() : null,
            branch_code ? branch_code.trim().toUpperCase() : null,
            parseInt(counter_padding, 10) || 5,
            parseInt(starting_counter, 10) || 1001,
            parseInt(current_counter, 10) || 1000,
        ]);
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'UPDATE_NUMBERING_CONFIG',
            moduleKey: 'admin_users',
            tableAffected: 'numbering_series_configs',
            recordId: id,
            newValueJson: req.body,
            reason: 'Numbering series pattern configuration update',
            ipAddress: req.ip,
        });
        return res.status(200).json({ success: true, message: 'Numbering configuration saved successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Numbering Live Preview API
exports.apiRouter.post('/admin/numbering/preview', requireAdmin, async (req, res) => {
    try {
        const { prefix, suffix, separator = '-', parts_order = '["prefix", "fy", "counter", "suffix"]', fy_format = 'YY-YY', company_code, branch_code, counter_padding = 5, counter = 1, } = req.body;
        const mockConfig = {
            id: 'preview',
            series_name: 'Preview',
            document_type: 'preview',
            prefix,
            suffix,
            separator,
            parts_order: typeof parts_order === 'string' ? parts_order : JSON.stringify(parts_order),
            fy_format,
            company_code,
            branch_code,
            counter_padding: parseInt(counter_padding, 10) || 5,
            current_counter: counter,
            starting_counter: counter,
            is_active: 1,
        };
        const preview = (0, numberingEngine_1.formatReferenceNumber)(mockConfig, counter, {
            companyCode: company_code,
            branchCode: branch_code,
        });
        return res.json({ preview });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 5. Hardware Token Serials Import & Uniqueness API
exports.apiRouter.post('/inventory/tokens/serials', requirePermission('inventory', 'can_create'), async (req, res) => {
    try {
        const currentUser = req.user;
        const { serial_numbers = [], token_model, branch_id, batch_id } = req.body;
        if (!Array.isArray(serial_numbers) || serial_numbers.length === 0 || !token_model || !branch_id) {
            return res.status(400).json({ error: 'List of serial numbers, token model, and branch ID are required.' });
        }
        const inserted = [];
        const duplicates = [];
        for (const rawSerial of serial_numbers) {
            const serial = String(rawSerial).trim().toUpperCase();
            if (!serial)
                continue;
            const exists = await (0, supabase_1.queryOne)('SELECT id FROM token_serials WHERE serial_number = ?', [serial]);
            if (exists) {
                duplicates.push(serial);
            }
            else {
                const id = `ser-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                await (0, supabase_1.run)(`
          INSERT INTO token_serials (id, serial_number, token_model, batch_id, branch_id, status)
          VALUES (?, ?, ?, ?, ?, 'in_stock')
        `, [id, serial, token_model, batch_id || null, branch_id]);
                inserted.push(serial);
            }
        }
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'IMPORT_TOKEN_SERIALS',
            moduleKey: 'inventory',
            tableAffected: 'token_serials',
            newValueJson: { inserted_count: inserted.length, duplicate_count: duplicates.length, token_model, branch_id },
            reason: 'Physical token serial numbers import',
            ipAddress: req.ip,
        });
        return res.status(201).json({
            success: true,
            insertedCount: inserted.length,
            inserted,
            duplicateCount: duplicates.length,
            duplicates,
            message: `Imported ${inserted.length} token serials successfully.`,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// Temporary Delegations Management (Phase 4)
// ==========================================
exports.apiRouter.get('/admin/delegations', requireAdmin, async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const status = req.query.status ? String(req.query.status).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const conditions = [];
        const params = [];
        if (status) {
            conditions.push('d.status = ?');
            params.push(status);
        }
        if (search) {
            conditions.push('(g.full_name LIKE ? OR g.email LIKE ? OR r.full_name LIKE ? OR r.email LIKE ? OR d.module_key LIKE ? OR d.action_key LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const selectSql = `
      SELECT d.*,
             g.full_name as grantor_name, g.email as grantor_email,
             r.full_name as recipient_name, r.email as recipient_email
      FROM temporary_delegations d
      JOIN user_profiles g ON d.grantor_user_id = g.id
      JOIN user_profiles r ON d.recipient_user_id = r.id
      ${whereClause}
      ORDER BY d.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM temporary_delegations d
      JOIN user_profiles g ON d.grantor_user_id = g.id
      JOIN user_profiles r ON d.recipient_user_id = r.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                delegations: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const delegations = await (0, supabase_1.queryAll)(selectSql, params);
        return res.json({
            delegations,
            page: 1,
            limit: delegations.length,
            totalCount: delegations.length,
            totalPages: 1,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/admin/delegations', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        const { recipient_user_id, module_key, action_key, valid_from, valid_until, reason, can_delegate_further, parent_delegation_id } = req.body;
        // Only Level 0 (Super Admin) or Level 1-2 users with explicit delegation authority or valid parent delegation can grant
        if (currentUser.hierarchy_level_order > 2 && !parent_delegation_id) {
            return res.status(403).json({ error: 'You do not have delegation authority.' });
        }
        if (!recipient_user_id || !module_key || !action_key || !valid_from || !valid_until || !reason) {
            return res.status(400).json({ error: 'Recipient, module, action, validity window, and reason are required.' });
        }
        // Verify recipient existence and status
        const recipient = await (0, supabase_1.queryOne)(`
      SELECT u.*, h.level_order as hierarchy_level_order
      FROM user_profiles u
      JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      WHERE u.id = ?
    `, [recipient_user_id]);
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient user not found.' });
        }
        if (recipient.status !== 'active') {
            return res.status(400).json({ error: 'Cannot delegate to an inactive account.' });
        }
        if (recipient.permissions_frozen) {
            return res.status(400).json({ error: 'Cannot delegate to an account whose permissions are frozen.' });
        }
        // Downward Delegation Rule: Cannot delegate to equal or higher tier
        if (currentUser.hierarchy_level_order >= recipient.hierarchy_level_order && currentUser.hierarchy_level_order !== 0) {
            return res.status(403).json({
                error: `Strict Downward Rule: Level ${currentUser.hierarchy_level_order} cannot delegate permissions to Level ${recipient.hierarchy_level_order}.`
            });
        }
        // Sub-Permission Cap Rule: Non-root grantor cannot grant any action they do not effectively possess
        if (currentUser.hierarchy_level_order > 0) {
            // 1. Check user override for grantor
            const grantorOverride = await (0, supabase_1.queryOne)('SELECT * FROM user_permission_overrides WHERE user_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)', [currentUser.id, module_key]);
            // 2. Check role permissions for grantor
            const grantorRolePerm = await (0, supabase_1.queryOne)('SELECT * FROM role_module_permissions WHERE role_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)', [currentUser.role_id, module_key]);
            const actionsToCheck = action_key === 'all' ? ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export'] : [action_key];
            for (const act of actionsToCheck) {
                let hasAct = false;
                if (grantorOverride && grantorOverride[act] !== null && grantorOverride[act] !== undefined) {
                    hasAct = Boolean(grantorOverride[act]);
                }
                else if (grantorRolePerm && (grantorRolePerm[act] === 1 || grantorRolePerm[act] === true)) {
                    hasAct = true;
                }
                // Also check if grantor holds this action through a valid delegatable parent delegation
                if (!hasAct && parent_delegation_id) {
                    const parentDel = await (0, supabase_1.queryOne)('SELECT * FROM temporary_delegations WHERE id = ?', [parent_delegation_id]);
                    if (parentDel && parentDel.status === 'active' && parentDel.can_delegate_further && (parentDel.action_key === act || parentDel.action_key === 'all')) {
                        hasAct = true;
                    }
                }
                if (!hasAct) {
                    return res.status(403).json({
                        error: `Sub-Permission Cap Violation: You cannot delegate '${act}' on '${module_key}' because you do not possess this privilege.`
                    });
                }
            }
        }
        // Security Rule: If onward delegation, ensure grantor holds a valid parent delegation that allows further delegation
        if (parent_delegation_id) {
            const parent = await (0, supabase_1.queryOne)('SELECT * FROM temporary_delegations WHERE id = ?', [parent_delegation_id]);
            if (!parent || parent.status !== 'active') {
                return res.status(400).json({ error: 'Parent delegation is inactive or revoked.' });
            }
            if (!parent.can_delegate_further) {
                return res.status(403).json({ error: 'Parent delegation does not permit onward delegation.' });
            }
            if (new Date(valid_until).getTime() > new Date(parent.valid_until).getTime()) {
                return res.status(400).json({ error: 'Child delegation expiry cannot exceed parent delegation expiry date.' });
            }
        }
        // Check for exact duplicate active delegation to avoid redundant rows
        const existingActive = await (0, supabase_1.queryOne)(`
      SELECT id FROM temporary_delegations
      WHERE recipient_user_id = ?
        AND module_key = ?
        AND action_key = ?
        AND status = 'active'
        AND valid_until > CURRENT_TIMESTAMP
    `, [recipient_user_id, module_key, action_key]);
        if (existingActive) {
            return res.status(409).json({ error: 'An active delegation for this recipient, module, and action already exists.' });
        }
        const orgId = currentUser.organization_id || 'comp-default';
        const id = `del-${Date.now()}`;
        await (0, supabase_1.run)(`
      INSERT INTO temporary_delegations (
        id, organization_id, grantor_user_id, recipient_user_id, module_key, action_key, valid_from, valid_until, reason, can_delegate_further, parent_delegation_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, orgId, currentUser.id, recipient_user_id, module_key, action_key, valid_from, valid_until, reason.trim(), can_delegate_further ? 1 : 0, parent_delegation_id || null]);
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'GRANT_TEMPORARY_DELEGATION',
            moduleKey: 'admin_users',
            tableAffected: 'temporary_delegations',
            recordId: id,
            newValueJson: { recipient_user_id, module_key, action_key, valid_from, valid_until, reason },
            reason,
            ipAddress: req.ip,
            organizationId: orgId,
        });
        return res.status(201).json({ success: true, id, message: 'Temporary delegation granted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Revoke temporary delegation with cascading dependent invalidation
exports.apiRouter.patch('/admin/delegations/:id/revoke', requireAdmin, async (req, res) => {
    try {
        const currentUser = req.user;
        const delegation = await (0, supabase_1.queryOne)('SELECT * FROM temporary_delegations WHERE id = ?', [req.params.id]);
        if (!delegation)
            return res.status(404).json({ error: 'Delegation record not found.' });
        const nowIso = new Date().toISOString();
        // 1. Revoke parent delegation
        await supabase_1.supabase
            .from('temporary_delegations')
            .update({ status: 'revoked', revoked_at: nowIso, revoked_by: currentUser.id })
            .eq('id', req.params.id);
        // 2. Recursive cascading invalidation of all descendant delegations in chain
        let parentIds = [req.params.id];
        while (parentIds.length > 0) {
            const { data: children } = await supabase_1.supabase
                .from('temporary_delegations')
                .select('id')
                .in('parent_delegation_id', parentIds)
                .neq('status', 'revoked');
            if (children && children.length > 0) {
                const childIds = children.map((c) => c.id);
                await supabase_1.supabase
                    .from('temporary_delegations')
                    .update({ status: 'revoked', revoked_at: nowIso, revoked_by: currentUser.id })
                    .in('id', childIds);
                parentIds = childIds;
            }
            else {
                parentIds = [];
            }
        }
        const delId = req.params.id;
        await logAuditEvent({
            userId: currentUser.id,
            actionType: 'REVOKE_DELEGATION',
            moduleKey: 'admin_users',
            tableAffected: 'temporary_delegations',
            recordId: Array.isArray(delId) ? delId[0] : delId,
            reason: 'Administrator manual revocation with cascading dependent invalidation',
            ipAddress: req.ip,
        });
        return res.json({ success: true, message: 'Delegation and dependent grants successfully revoked.' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// Administrative Audit Logs Retrieval (Phase 5)
// ==========================================
exports.apiRouter.get('/admin/audit-logs', requireAdmin, async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const actionType = req.query.action_type ? String(req.query.action_type).trim() : '';
        const { page, limit, offset, isPaginated } = (0, pagination_1.parsePaginationParams)(req.query);
        const conditions = [];
        const params = [];
        if (actionType) {
            conditions.push('a.action_type = ?');
            params.push(actionType);
        }
        if (search) {
            conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR a.action_type LIKE ? OR a.table_affected LIKE ? OR a.record_id LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const selectSql = `
      SELECT a.*, u.full_name as staff_name, u.email as staff_email
      FROM audit_logs a
      LEFT JOIN user_profiles u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;
        const countSql = `
      SELECT COUNT(*) as count
      FROM audit_logs a
      LEFT JOIN user_profiles u ON a.user_id = u.id
      ${whereClause}
    `;
        if (isPaginated) {
            const result = await (0, pagination_1.executePaginatedQuery)(selectSql, countSql, params, { page, limit, offset });
            return res.json({
                logs: result.data,
                page: result.page,
                limit: result.limit,
                totalCount: result.totalCount,
                totalPages: result.totalPages,
            });
        }
        const logs = await (0, supabase_1.queryAll)(selectSql, params);
        return res.json({ logs, totalCount: logs.length });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
