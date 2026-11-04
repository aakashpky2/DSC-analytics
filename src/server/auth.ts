import { queryOne, run } from './localDb'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export const SESSION_COOKIE_NAME = 'signsync_session'

export interface SessionUser {
  id: string
  email: string
  full_name: string
  phone_number: string
  role_id: string
  role_name: string
  hierarchy_level_id: string
  hierarchy_level_order: number
  level_name: string
  branch_id?: string
  status: string
  permissions_frozen: number
  can_grant_permissions: number
}

// Generate secure random hex token
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

// Create new session in database
export async function createSession(userId: string, durationDays: number = 7): Promise<string> {
  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
  const sessionId = `sess-${Date.now()}-${generateToken(4)}`

  await run(
    `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [sessionId, userId, token, expiresAt]
  )

  return token
}

// Invalidate session by token
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return
  await run(`DELETE FROM sessions WHERE token = ?`, [token])
}

// Invalidate all sessions for a user (e.g. on password reset or account freeze)
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  if (!userId) return
  await run(`DELETE FROM sessions WHERE user_id = ?`, [userId])
}

// Validate session token and return user profile
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null

  const nowIso = new Date().toISOString()
  const session = await queryOne<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?`,
    [token, nowIso]
  )

  if (!session) return null

  // Fetch full user profile with hierarchy and role
  const user = await queryOne<SessionUser>(
    `SELECT u.id, u.email, u.full_name, u.phone_number, u.role_id, u.hierarchy_level_id,
            u.branch_id, u.status, u.permissions_frozen, u.can_grant_permissions,
            r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
     FROM user_profiles u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
     WHERE u.id = ?`,
    [session.user_id]
  )

  if (!user || user.status !== 'active') {
    return null
  }

  return user
}

// Password verify helper (supports both bcrypt hashes and bootstrap plain passwords, auto-upgrading to bcrypt)
export async function verifyUserPassword(user: { id: string; password_hash?: string }, plainPassword: string): Promise<boolean> {
  if (!user.password_hash) return false

  const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')
  if (isBcrypt) {
    return await bcrypt.compare(plainPassword, user.password_hash)
  }

  // Plain text fallback (for initial seed data), upgrade to bcrypt on success
  if (user.password_hash === plainPassword) {
    const hashed = await bcrypt.hash(plainPassword, 10)
    await run(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashed, user.id])
    return true
  }

  return false
}

// Password hash helper
export async function hashPassword(plainPassword: string): Promise<string> {
  return await bcrypt.hash(plainPassword, 10)
}
