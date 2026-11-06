"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE_NAME = void 0;
exports.generateToken = generateToken;
exports.createSession = createSession;
exports.invalidateSession = invalidateSession;
exports.invalidateAllUserSessions = invalidateAllUserSessions;
exports.getUserProfileById = getUserProfileById;
exports.getUserProfileByEmail = getUserProfileByEmail;
exports.validateSessionToken = validateSessionToken;
exports.verifyUserPassword = verifyUserPassword;
exports.hashPassword = hashPassword;
const supabase_1 = require("./supabase");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.SESSION_COOKIE_NAME = 'signsync_session';
// Generate secure random hex token
function generateToken(bytes = 32) {
    return crypto_1.default.randomBytes(bytes).toString('hex');
}
// Create new session in database
async function createSession(userId, durationDays = 7) {
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = `sess-${Date.now()}-${generateToken(4)}`;
    const { error } = await supabase_1.supabase.from('sessions').insert({
        id: sessionId,
        user_id: userId,
        token: token,
        expires_at: expiresAt,
    });
    if (error) {
        throw new Error(`Failed to create session in Supabase: ${error.message}`);
    }
    return token;
}
// Invalidate session by token
async function invalidateSession(token) {
    if (!token)
        return;
    await supabase_1.supabase.from('sessions').delete().eq('token', token);
}
// Invalidate all sessions for a user (e.g. on password reset, account freeze, or logout everywhere)
async function invalidateAllUserSessions(userId) {
    if (!userId)
        return;
    await supabase_1.supabase.from('sessions').delete().eq('user_id', userId);
}
// Direct, parameterized user profile lookup by ID with relations
async function getUserProfileById(userId) {
    var _a, _b, _c, _d, _e, _f;
    if (!userId)
        return null;
    const { data, error } = await supabase_1.supabase
        .from('user_profiles')
        .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
        .eq('id', userId)
        .maybeSingle();
    if (error || !data) {
        return null;
    }
    return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        phone_number: data.phone_number,
        role_id: data.role_id,
        role_name: ((_a = data.roles) === null || _a === void 0 ? void 0 : _a.name) || '',
        hierarchy_level_id: data.hierarchy_level_id,
        hierarchy_level_order: (_c = (_b = data.hierarchy_levels) === null || _b === void 0 ? void 0 : _b.level_order) !== null && _c !== void 0 ? _c : 99,
        level_name: ((_d = data.hierarchy_levels) === null || _d === void 0 ? void 0 : _d.level_name) || '',
        branch_id: data.branch_id,
        branch_name: (_e = data.branches) === null || _e === void 0 ? void 0 : _e.branch_name,
        status: data.status,
        permissions_frozen: Number(data.permissions_frozen || 0),
        can_grant_permissions: Number(data.can_grant_permissions || 0),
        mask_pii_fields: ((_f = data.hierarchy_levels) === null || _f === void 0 ? void 0 : _f.level_order) === 4 ? 1 : 0,
    };
}
// Direct, parameterized user profile lookup by Email with relations
async function getUserProfileByEmail(email) {
    var _a, _b, _c, _d, _e, _f;
    if (!email || typeof email !== 'string')
        return null;
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase_1.supabase
        .from('user_profiles')
        .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
        .ilike('email', cleanEmail)
        .maybeSingle();
    if (error || !data) {
        return null;
    }
    return {
        id: data.id,
        email: data.email,
        password_hash: data.password_hash,
        full_name: data.full_name,
        phone_number: data.phone_number,
        role_id: data.role_id,
        role_name: ((_a = data.roles) === null || _a === void 0 ? void 0 : _a.name) || '',
        hierarchy_level_id: data.hierarchy_level_id,
        hierarchy_level_order: (_c = (_b = data.hierarchy_levels) === null || _b === void 0 ? void 0 : _b.level_order) !== null && _c !== void 0 ? _c : 99,
        level_name: ((_d = data.hierarchy_levels) === null || _d === void 0 ? void 0 : _d.level_name) || '',
        branch_id: data.branch_id,
        branch_name: (_e = data.branches) === null || _e === void 0 ? void 0 : _e.branch_name,
        status: data.status,
        permissions_frozen: Number(data.permissions_frozen || 0),
        can_grant_permissions: Number(data.can_grant_permissions || 0),
        mask_pii_fields: ((_f = data.hierarchy_levels) === null || _f === void 0 ? void 0 : _f.level_order) === 4 ? 1 : 0,
    };
}
// Validate session token and return user profile
async function validateSessionToken(token) {
    if (!token)
        return null;
    const nowIso = new Date().toISOString();
    const { data: session, error } = await supabase_1.supabase
        .from('sessions')
        .select('user_id, expires_at')
        .eq('token', token)
        .gt('expires_at', nowIso)
        .maybeSingle();
    if (error || !session)
        return null;
    // Fetch full user profile directly via Supabase PostgREST
    const user = await getUserProfileById(session.user_id);
    if (!user || user.status !== 'active') {
        return null;
    }
    return user;
}
// Password verify helper (supports bcrypt hashes and bootstrap plain passwords, auto-upgrading to bcrypt)
async function verifyUserPassword(user, plainPassword) {
    if (!user.password_hash)
        return false;
    const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$');
    if (isBcrypt) {
        return await bcryptjs_1.default.compare(plainPassword, user.password_hash);
    }
    // Plain text fallback (for initial seed data), upgrade to bcrypt on success
    if (user.password_hash === plainPassword) {
        const hashed = await bcryptjs_1.default.hash(plainPassword, 10);
        await (0, supabase_1.run)(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashed, user.id]);
        return true;
    }
    return false;
}
// Password hash helper
async function hashPassword(plainPassword) {
    return await bcryptjs_1.default.hash(plainPassword, 10);
}
