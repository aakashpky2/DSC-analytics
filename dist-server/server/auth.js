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
exports.validateSessionToken = validateSessionToken;
exports.verifyUserPassword = verifyUserPassword;
exports.hashPassword = hashPassword;
const localDb_1 = require("./localDb");
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
    await (0, localDb_1.run)(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`, [sessionId, userId, token, expiresAt]);
    return token;
}
// Invalidate session by token
async function invalidateSession(token) {
    if (!token)
        return;
    await (0, localDb_1.run)(`DELETE FROM sessions WHERE token = ?`, [token]);
}
// Invalidate all sessions for a user (e.g. on password reset or account freeze)
async function invalidateAllUserSessions(userId) {
    if (!userId)
        return;
    await (0, localDb_1.run)(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}
// Validate session token and return user profile
async function validateSessionToken(token) {
    if (!token)
        return null;
    const nowIso = new Date().toISOString();
    const session = await (0, localDb_1.queryOne)(`SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?`, [token, nowIso]);
    if (!session)
        return null;
    // Fetch full user profile with hierarchy and role
    const user = await (0, localDb_1.queryOne)(`SELECT u.id, u.email, u.full_name, u.phone_number, u.role_id, u.hierarchy_level_id,
            u.branch_id, u.status, u.permissions_frozen, u.can_grant_permissions,
            r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
     FROM user_profiles u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
     WHERE u.id = ?`, [session.user_id]);
    if (!user || user.status !== 'active') {
        return null;
    }
    return user;
}
// Password verify helper (supports both bcrypt hashes and bootstrap plain passwords, auto-upgrading to bcrypt)
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
        await (0, localDb_1.run)(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashed, user.id]);
        return true;
    }
    return false;
}
// Password hash helper
async function hashPassword(plainPassword) {
    return await bcryptjs_1.default.hash(plainPassword, 10);
}
