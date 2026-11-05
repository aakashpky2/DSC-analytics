import { supabase, run } from './localDb'
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
  branch_name?: string
  status: string
  permissions_frozen: number
  can_grant_permissions: number
  mask_pii_fields: number
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

  const { error } = await supabase.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    token: token,
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(`Failed to create session in Supabase: ${error.message}`)
  }

  return token
}

// Invalidate session by token
export async function invalidateSession(token: string): Promise<void> {
  if (!token) return
  await supabase.from('sessions').delete().eq('token', token)
}

// Invalidate all sessions for a user (e.g. on password reset, account freeze, or logout everywhere)
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  if (!userId) return
  await supabase.from('sessions').delete().eq('user_id', userId)
}

// Direct, parameterized user profile lookup by ID with relations
export async function getUserProfileById(userId: string): Promise<SessionUser | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    phone_number: data.phone_number,
    role_id: data.role_id,
    role_name: data.roles?.name || '',
    hierarchy_level_id: data.hierarchy_level_id,
    hierarchy_level_order: data.hierarchy_levels?.level_order ?? 99,
    level_name: data.hierarchy_levels?.level_name || '',
    branch_id: data.branch_id,
    branch_name: data.branches?.branch_name,
    status: data.status,
    permissions_frozen: Number(data.permissions_frozen || 0),
    can_grant_permissions: Number(data.can_grant_permissions || 0),
    mask_pii_fields: data.hierarchy_levels?.level_order === 4 ? 1 : 0,
  }
}

// Direct, parameterized user profile lookup by Email with relations
export async function getUserProfileByEmail(email: string): Promise<(SessionUser & { password_hash: string }) | null> {
  if (!email || typeof email !== 'string') return null
  const cleanEmail = email.trim().toLowerCase()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
    .ilike('email', cleanEmail)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    email: data.email,
    password_hash: data.password_hash,
    full_name: data.full_name,
    phone_number: data.phone_number,
    role_id: data.role_id,
    role_name: data.roles?.name || '',
    hierarchy_level_id: data.hierarchy_level_id,
    hierarchy_level_order: data.hierarchy_levels?.level_order ?? 99,
    level_name: data.hierarchy_levels?.level_name || '',
    branch_id: data.branch_id,
    branch_name: data.branches?.branch_name,
    status: data.status,
    permissions_frozen: Number(data.permissions_frozen || 0),
    can_grant_permissions: Number(data.can_grant_permissions || 0),
    mask_pii_fields: data.hierarchy_levels?.level_order === 4 ? 1 : 0,
  }
}

// Validate session token and return user profile
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null

  const nowIso = new Date().toISOString()
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .gt('expires_at', nowIso)
    .maybeSingle()

  if (error || !session) return null

  // Fetch full user profile directly via Supabase PostgREST
  const user = await getUserProfileById(session.user_id)

  if (!user || user.status !== 'active') {
    return null
  }

  return user
}

// Password verify helper (supports bcrypt hashes and bootstrap plain passwords, auto-upgrading to bcrypt)
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
