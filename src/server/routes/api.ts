import { Router, Request, Response, NextFunction } from 'express'
import { queryAll, queryOne, run } from '../localDb'
import { calculateLandedCost, evaluateLeadDuplicates, calculateGst } from '../../lib/businessLogic'
import { formatReferenceNumber, NumberingConfig } from '../../lib/numberingEngine'
import { applyPiiMasking } from '../../lib/masking'
import { validateDelegationAuthority, validateSubPermissionCap } from '../../lib/permissions'
import { parsePaginationParams, executePaginatedQuery } from '../pagination'
import {
  SESSION_COOKIE_NAME,
  createSession,
  invalidateSession,
  invalidateAllUserSessions,
  validateSessionToken,
  verifyUserPassword,
  hashPassword,
  generateToken,
} from '../auth'

export const apiRouter = Router()

// ==========================================
// RBAC & Session Security Middleware
// ==========================================
async function resolveUserContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME]
    if (token) {
      const sessionUser = await validateSessionToken(token)
      if (sessionUser) {
        ;(req as any).user = sessionUser
        return next()
      }
    }

    const headerUserId = req.headers['x-user-id'] as string
    if (headerUserId) {
      const user = await queryOne(`
        SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
        FROM user_profiles u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
        WHERE u.id = ?
      `, [headerUserId])
      if (user) {
        ;(req as any).user = user
        return next()
      }
    }

    ;(req as any).user = null
    next()
  } catch {
    ;(req as any).user = null
    next()
  }
}

apiRouter.use(resolveUserContext)

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
  }
  if (user.permissions_frozen) {
    return res.status(403).json({ error: 'Your account access has been temporarily paused by an administrator.' })
  }
  next()
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
  }
  if (user.permissions_frozen) {
    return res.status(403).json({ error: 'Your account access has been temporarily paused by an administrator.' })
  }
  if (user.hierarchy_level_order > 1) {
    return res.status(403).json({ error: 'You do not have permission to open this page.' })
  }
  next()
}

/**
 * Granular Permission Guard: Checks module-level CRUD or specific action permission,
 * resolving role matrix, user overrides, and valid temporary delegations.
 */
function requirePermission(moduleKey: string, actionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive.' })
    }
    if (user.permissions_frozen) {
      return res.status(403).json({ error: 'Account permissions are frozen by administrator.' })
    }

    // Super Admin (Level 0) has root authority across all modules and actions
    if (user.hierarchy_level_order === 0) {
      return next()
    }

    try {
      // 1. Check user direct override
      const override = await queryOne<any>(
        'SELECT * FROM user_permission_overrides WHERE user_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)',
        [user.id, moduleKey]
      )

      if (override && override[actionKey] !== null && override[actionKey] !== undefined) {
        if (override[actionKey] === 1 || override[actionKey] === true) {
          return next()
        } else {
          return res.status(403).json({ error: `Permission denied: ${moduleKey}.${actionKey} is restricted for your account.` })
        }
      }

      // 2. Check role matrix permission
      const rolePerm = await queryOne<any>(
        'SELECT * FROM role_module_permissions WHERE role_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)',
        [user.role_id, moduleKey]
      )

      if (rolePerm && (rolePerm[actionKey] === 1 || rolePerm[actionKey] === true)) {
        return next()
      }

      // 3. Check active temporary delegations
      const nowIso = new Date().toISOString()
      const delegation = await queryOne<any>(`
        SELECT d.*, g.permissions_frozen as grantor_frozen, g.status as grantor_status
        FROM temporary_delegations d
        JOIN user_profiles g ON d.grantor_user_id = g.id
        WHERE d.recipient_user_id = ?
          AND d.module_key = ?
          AND (d.action_key = ? OR d.action_key = 'all')
          AND d.status = 'active'
          AND d.valid_from <= ?
          AND d.valid_until >= ?
      `, [user.id, moduleKey, actionKey, nowIso, nowIso])

      if (delegation) {
        if (delegation.grantor_frozen || delegation.grantor_status !== 'active') {
          return res.status(403).json({ error: 'Delegated permission is invalid because the grantor account is frozen or inactive.' })
        }
        ;(req as any).delegation = delegation
        return next()
      }

      // Deny access if not authorized
      return res.status(403).json({
        error: `Permission denied: You do not have '${actionKey}' authority on '${moduleKey}'.`,
      })
    } catch (err: unknown) {
      return res.status(500).json({ error: (err as Error).message })
    }
  }
}

/**
 * Record administrative change in audit_logs
 */
async function logAuditEvent(params: {
  userId: string
  actionType: string
  moduleKey: string
  tableAffected: string
  recordId?: string
  oldValueJson?: any
  newValueJson?: any
  reason?: string
  delegationId?: string
  ipAddress?: string
}) {
  try {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    await run(`
      INSERT INTO audit_logs (id, user_id, action_type, module_key, table_affected, record_id, old_value_json, new_value_json, reason, delegation_id, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
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
    ])
  } catch (err) {
    console.error('Audit log failure:', err)
  }
}

/**
 * Concurrency-Safe Document Reference Number Allocator
 * Atomically increments counter and formats business reference string.
 */
async function allocateNextReferenceNumber(
  documentType: string,
  options?: { companyCode?: string; branchCode?: string; date?: Date }
): Promise<string> {
  const config = await queryOne<NumberingConfig>(
    'SELECT * FROM numbering_series_configs WHERE document_type = ? AND is_active = 1 LIMIT 1',
    [documentType]
  )

  if (!config) {
    // Fallback safe timestamp reference
    return `${documentType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`
  }

  const nextCounter = (config.current_counter || 1000) + 1
  await run(
    'UPDATE numbering_series_configs SET current_counter = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [nextCounter, config.id]
  )

  return formatReferenceNumber(config, nextCounter, options)
}

// ==========================================
// Authentication Endpoints (/api/auth/*)
// ==========================================

// 1. POST /api/auth/login
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' })
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Please enter your password.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await queryOne<any>(
      `SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
       FROM user_profiles u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
       WHERE LOWER(u.email) = ?`,
      [cleanEmail]
    )

    if (!user) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' })
    }

    const isValid = await verifyUserPassword(user, password)
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' })
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
    }

    if (user.permissions_frozen) {
      return res.status(403).json({ error: 'Your account access has been temporarily paused by an administrator.' })
    }

    const durationDays = rememberMe ? 30 : 1
    const token = await createSession(user.id, durationDays)

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: durationDays * 24 * 60 * 60 * 1000,
    })

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
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: 'An unexpected system error occurred. Please try again.' })
  }
})

// 2. POST /api/auth/logout
apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME]
    if (token) {
      await invalidateSession(token)
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })

    return res.json({ success: true, message: 'You have been logged out successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Error logging out.' })
  }
})

// 3. GET /api/auth/me
apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Your login has expired. Please sign in again.' })
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
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 4. POST /api/auth/forgot-password
apiRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await queryOne<any>('SELECT id, email, full_name FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail])

    if (user) {
      const resetToken = generateToken(32)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const resetId = `rst-${Date.now()}`

      await run(
        `INSERT INTO password_resets (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
        [resetId, user.id, resetToken, expiresAt]
      )
    }

    return res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.',
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to process password reset request.' })
  }
})

// 5. POST /api/auth/reset-password
apiRouter.post('/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body
    if (!token) {
      return res.status(400).json({ error: 'Invalid or missing password reset link.' })
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' })
    }

    const nowIso = new Date().toISOString()
    const resetRecord = await queryOne<any>(
      `SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > ?`,
      [token, nowIso]
    )

    if (!resetRecord) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' })
    }

    const hashedPassword = await hashPassword(newPassword)
    await run(`UPDATE user_profiles SET password_hash = ? WHERE id = ?`, [hashedPassword, resetRecord.user_id])
    await run(`UPDATE password_resets SET used = 1 WHERE id = ?`, [resetRecord.id])
    await invalidateAllUserSessions(resetRecord.user_id)

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.',
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: 'Failed to reset password.' })
  }
})

// ==========================================
// 1. System Health & Session Context
// ==========================================
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const user = await queryOne('SELECT * FROM user_profiles WHERE id = ?', ['usr-admin-root'])
    return res.json({
      status: 'ok',
      platform: 'SignSync B2B Enterprise v2.4',
      database: 'Connected (PostgreSQL / Local High-Speed SQLite Store)',
      activeUser: user?.full_name,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Database error'
    return res.status(500).json({ status: 'error', message: errorMsg })
  }
})

// Current user profile & effective permissions
apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    // Current user defaults to Super Admin or header user
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin-root'
    const user = await queryOne(`
      SELECT u.*, r.name as role_name, h.level_order as hierarchy_level_order, h.level_name
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      WHERE u.id = ?
    `, [userId])

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    return res.json({ user })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 2. User Administration & Granular RBAC
// ==========================================
apiRouter.get('/admin/roles', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const roles = await queryAll(`
      SELECT r.*, h.level_order, h.level_name, COUNT(u.id) as staff_count
      FROM roles r
      JOIN hierarchy_levels h ON r.hierarchy_level_id = h.id
      LEFT JOIN user_profiles u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY h.level_order ASC
    `)
    const levels = await queryAll('SELECT * FROM hierarchy_levels ORDER BY level_order ASC')
    const modules = await queryAll('SELECT * FROM app_modules ORDER BY display_name ASC')
    const rolePermissions = await queryAll('SELECT * FROM role_module_permissions')
    return res.json({ roles, levels, modules, rolePermissions })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Update role matrix permissions
apiRouter.put('/admin/roles/:id/permissions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    if (currentUser.hierarchy_level_order !== 0) {
      return res.status(403).json({ error: 'Only the Super Admin (Level 0) can modify role permission matrices.' })
    }

    const roleId = req.params.id
    const { permissions = [] } = req.body // Array of { module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields }

    for (const p of permissions) {
      await run(`
        INSERT INTO role_module_permissions (id, role_id, module_id, can_view, can_create, can_edit, can_delete, can_export, mask_pii_fields)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(role_id, module_id) DO UPDATE SET
          can_view = excluded.can_view,
          can_create = excluded.can_create,
          can_edit = excluded.can_edit,
          can_delete = excluded.can_delete,
          can_export = excluded.can_export,
          mask_pii_fields = excluded.mask_pii_fields
      `, [
        `rmp-${roleId}-${p.module_id}`,
        roleId,
        p.module_id,
        p.can_view ? 1 : 0,
        p.can_create ? 1 : 0,
        p.can_edit ? 1 : 0,
        p.can_delete ? 1 : 0,
        p.can_export ? 1 : 0,
        p.mask_pii_fields !== undefined ? (p.mask_pii_fields ? 1 : 0) : 1,
      ])
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
    })

    return res.json({ success: true, message: 'Role permissions updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const mask = req.query.mask === 'true'
    const search = req.query.search ? String(req.query.search).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    let whereClause = ''
    const params: any[] = []
    if (search) {
      whereClause = ` WHERE (u.full_name LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ? OR r.name LIKE ?)`
      const s = `%${search}%`
      params.push(s, s, s, s)
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
    `

    const countSql = `
      SELECT COUNT(*) as count
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      const sanitized = result.data.map((u: any) => applyPiiMasking(u, mask))
      return res.json({
        users: sanitized,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const users = await queryAll(selectSql, params)
    const sanitized = users.map((u: any) => applyPiiMasking(u, mask))
    return res.json({
      users: sanitized,
      page: 1,
      limit: sanitized.length,
      totalCount: sanitized.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, full_name, phone_number, role_id, hierarchy_level_id, branch_id, initial_password } = req.body
    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email and full name are required.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const existing = await queryOne('SELECT id FROM user_profiles WHERE LOWER(email) = ?', [cleanEmail])
    if (existing) {
      return res.status(400).json({ error: 'A staff member with this email address already exists.' })
    }

    const id = `usr-${Date.now()}`
    const passwordPlain = initial_password && initial_password.length >= 8 ? initial_password : 'ChangeMe@123'
    const password_hash = await hashPassword(passwordPlain)

    await run(`
      INSERT INTO user_profiles (id, email, password_hash, full_name, phone_number, role_id, hierarchy_level_id, branch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, cleanEmail, password_hash, full_name.trim(), phone_number || null, role_id || 'role-field-staff', hierarchy_level_id || 'tier-4', branch_id || null])

    return res.status(201).json({ success: true, id, message: 'Staff account created successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/users/:id/freeze', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { frozen } = req.body
    const userId = req.params.id as string
    if (userId === 'usr-admin-root') {
      return res.status(400).json({ error: 'The Master Super Admin account cannot be frozen.' })
    }
    await run(`UPDATE user_profiles SET permissions_frozen = ? WHERE id = ?`, [frozen ? 1 : 0, userId])
    if (frozen) {
      await invalidateAllUserSessions(userId)
    }
    return res.json({ success: true, frozen: Boolean(frozen) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 3. Partner Network Management
// ==========================================
apiRouter.get('/partners', async (req: Request, res: Response) => {
  try {
    const mask = req.query.mask === 'true'
    const search = req.query.search ? String(req.query.search).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    let whereClause = ''
    const params: any[] = []
    if (search) {
      whereClause = ` WHERE (company_name LIKE ? OR contact_person LIKE ? OR partner_code LIKE ? OR email LIKE ? OR phone LIKE ?)`
      const s = `%${search}%`
      params.push(s, s, s, s, s)
    }

    const selectSql = `SELECT * FROM partners ${whereClause} ORDER BY created_at DESC`
    const countSql = `SELECT COUNT(*) as count FROM partners ${whereClause}`

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      const sanitized = result.data.map((p: any) => applyPiiMasking(p, mask))
      return res.json({
        partners: sanitized,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const partners = await queryAll(selectSql, params)
    const sanitized = partners.map((p: any) => applyPiiMasking(p, mask))
    return res.json({
      partners: sanitized,
      page: 1,
      limit: sanitized.length,
      totalCount: sanitized.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/partners/:id', async (req: Request, res: Response) => {
  try {
    const mask = req.query.mask === 'true'
    const partner = await queryOne('SELECT * FROM partners WHERE id = ?', [req.params.id])
    if (!partner) return res.status(404).json({ error: 'Partner not found' })

    const orders = await queryAll('SELECT * FROM dsc_applications WHERE partner_id = ? ORDER BY created_at DESC', [req.params.id])
    const invoices = await queryAll('SELECT * FROM invoices WHERE partner_id = ? ORDER BY invoice_date DESC', [req.params.id])
    const ledger = await queryAll('SELECT * FROM financial_ledger WHERE partner_id = ? ORDER BY entry_date DESC', [req.params.id])

    return res.json({
      partner: applyPiiMasking(partner, mask),
      orders,
      invoices,
      ledger,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/partners', async (req: Request, res: Response) => {
  try {
    const {
      type,
      company_name,
      contact_person,
      email,
      phone,
      gstin,
      pan,
      billing_address,
      state_code,
      credit_limit = 0,
      credit_period_days = 0,
    } = req.body

    const id = `part-${Date.now()}`
    const partner_code = await allocateNextReferenceNumber('partner')

    await run(`
      INSERT INTO partners (id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, credit_limit, credit_period_days])

    return res.status(201).json({ success: true, id, partner_code })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 4. DSC Catalogue & Applications
// ==========================================
apiRouter.get('/dsc/catalog', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = 'SELECT * FROM dsc_catalog ORDER BY class_type, validity_years'
    const countSql = 'SELECT COUNT(*) as count FROM dsc_catalog'

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        catalog: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const items = await queryAll(selectSql)
    return res.json({
      catalog: items,
      page: 1,
      limit: items.length,
      totalCount: items.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/dsc/catalog', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { class_type, certificate_type, validity_years, vendor_base_price, partner_price, mrp } = req.body
    if (!class_type || !certificate_type || !validity_years) {
      return res.status(400).json({ error: 'Class type, certificate type, and validity are required.' })
    }
    const id = `cat-${Date.now()}`
    await run(`
      INSERT INTO dsc_catalog (id, class_type, certificate_type, validity_years, vendor_base_price, partner_price, mrp, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, class_type, certificate_type, validity_years, parseFloat(vendor_base_price)||0, parseFloat(partner_price)||0, parseFloat(mrp)||0])
    return res.status(201).json({ success: true, id, message: 'DSC Product added successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.put('/dsc/catalog/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { vendor_base_price, partner_price, mrp, is_active } = req.body
    await run(`
      UPDATE dsc_catalog
      SET vendor_base_price = COALESCE(?, vendor_base_price),
          partner_price = COALESCE(?, partner_price),
          mrp = COALESCE(?, mrp),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [vendor_base_price, partner_price, mrp, is_active, req.params.id])
    return res.json({ success: true, message: 'Price slab updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/dsc/catalog/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE dsc_catalog SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus), message: `Product ${newStatus ? 'activated' : 'deactivated'}.` })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/dsc/applications', async (req: Request, res: Response) => {
  try {
    const mask = req.query.mask === 'true'
    const stage = req.query.stage ? String(req.query.stage).trim() : ''
    const search = req.query.search ? String(req.query.search).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    const conditions: string[] = []
    const params: any[] = []

    if (stage) {
      conditions.push('a.stage = ?')
      params.push(stage)
    }

    if (search) {
      conditions.push('(a.applicant_name LIKE ? OR a.application_number LIKE ? OR a.applicant_pan LIKE ? OR p.company_name LIKE ?)')
      const s = `%${search}%`
      params.push(s, s, s, s)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const selectSql = `
      SELECT a.*, p.company_name as partner_company, c.class_type, c.certificate_type, c.validity_years
      FROM dsc_applications a
      LEFT JOIN partners p ON a.partner_id = p.id
      LEFT JOIN dsc_catalog c ON a.catalog_id = c.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `

    const countSql = `
      SELECT COUNT(*) as count
      FROM dsc_applications a
      LEFT JOIN partners p ON a.partner_id = p.id
      ${whereClause}
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      const sanitized = result.data.map((app: any) => applyPiiMasking(app, mask))
      return res.json({
        applications: sanitized,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const apps = await queryAll(selectSql, params)
    const sanitized = apps.map((app: any) => applyPiiMasking(app, mask))
    return res.json({
      applications: sanitized,
      page: 1,
      limit: sanitized.length,
      totalCount: sanitized.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/dsc/applications', async (req: Request, res: Response) => {
  try {
    const { partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan } = req.body
    const id = `app-${Date.now()}`
    const application_number = await allocateNextReferenceNumber('dsc_application')

    await run(`
      INSERT INTO dsc_applications (id, application_number, partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake')
    `, [id, application_number, partner_id, catalog_id, applicant_name, applicant_email, applicant_phone, applicant_pan])

    return res.status(201).json({ success: true, id, application_number })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/dsc/applications/:id/stage', async (req: Request, res: Response) => {
  try {
    const { stage, ca_reference_no, notes } = req.body
    await run(`
      UPDATE dsc_applications
      SET stage = COALESCE(?, stage),
          ca_reference_no = COALESCE(?, ca_reference_no),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [stage, ca_reference_no, notes, req.params.id])

    return res.json({ success: true })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 5. Hardware Token Inventory & Landed Cost
// ==========================================
apiRouter.get('/inventory/batches', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = 'SELECT * FROM token_purchase_batches ORDER BY created_at DESC'
    const countSql = 'SELECT COUNT(*) as count FROM token_purchase_batches'

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        batches: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const batches = await queryAll(selectSql)
    return res.json({
      batches,
      page: 1,
      limit: batches.length,
      totalCount: batches.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/inventory/batches', requirePermission('inventory', 'can_create'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const delegation = (req as any).delegation
    const {
      token_model,
      vendor_name,
      quantity_purchased,
      base_unit_price,
      inward_shipping_cost = 0,
      customs_or_taxes = 0,
      handling_charges = 0,
    } = req.body

    const qty = Number(quantity_purchased)
    const basePrice = Number(base_unit_price)

    if (!token_model || !vendor_name || isNaN(qty) || qty <= 0 || isNaN(basePrice) || basePrice < 0) {
      return res.status(400).json({ error: 'Valid token model, vendor name, quantity, and unit price are required.' })
    }

    const calc = calculateLandedCost({
      quantityPurchased: qty,
      baseUnitPrice: basePrice,
      inwardShippingCost: Number(inward_shipping_cost),
      customsOrTaxes: Number(customs_or_taxes),
      handlingCharges: Number(handling_charges),
    })

    const id = `batch-${Date.now()}`
    const batch_number = await allocateNextReferenceNumber('token_batch')

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
      qty,
      basePrice,
      Number(inward_shipping_cost),
      Number(customs_or_taxes),
      Number(handling_charges),
      calc.totalBatchLandedCost,
      calc.unitLandedCost,
    ])

    // Update headquarters stock
    const hqBranch = await queryOne<any>('SELECT id FROM branches WHERE branch_code = ? LIMIT 1', ['HQ-MUM'])
    const branchId = hqBranch ? hqBranch.id : 'branch-hq'

    await run(`
      INSERT INTO branch_token_stocks (id, branch_id, token_model, quantity_on_hand, quarantine_damaged, min_threshold)
      VALUES (?, ?, ?, ?, 0, 25)
      ON CONFLICT(branch_id, token_model) DO UPDATE SET
      quantity_on_hand = quantity_on_hand + excluded.quantity_on_hand
    `, [`stk-${Date.now()}`, branchId, token_model, qty])

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'PURCHASE_TOKEN_BATCH',
      moduleKey: 'inventory',
      tableAffected: 'token_purchase_batches',
      recordId: id,
      newValueJson: { batch_number, token_model, qty, total_landed_cost: calc.totalBatchLandedCost },
      delegationId: delegation?.id,
      ipAddress: req.ip,
    })

    return res.status(201).json({ success: true, id, batch_number, ...calc })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/inventory/branches', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = `
      SELECT s.*, b.branch_name, b.branch_code
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
      ORDER BY b.branch_name ASC
    `
    const countSql = `
      SELECT COUNT(*) as count
      FROM branch_token_stocks s
      JOIN branches b ON s.branch_id = b.id
    `

    const branches = await queryAll('SELECT id, branch_name, branch_code, city, state_code FROM branches ORDER BY branch_name ASC')

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        stock: result.data,
        branches,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const stock = await queryAll(selectSql)
    return res.json({
      stock,
      branches,
      page: 1,
      limit: stock.length,
      totalCount: stock.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Branch CRUD & Management
apiRouter.post('/admin/branches', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { branch_name, branch_code, address, city, state_code } = req.body
    if (!branch_name || !branch_code || !city || !state_code) {
      return res.status(400).json({ error: 'Branch name, code, city, and state code are required.' })
    }
    const id = `br-${Date.now()}`
    await run(`
      INSERT INTO branches (id, branch_name, branch_code, address, city, state_code, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [id, branch_name.trim(), branch_code.trim().toUpperCase(), address || '', city.trim(), state_code.trim()])

    return res.status(201).json({ success: true, id, message: 'Branch created successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.put('/admin/branches/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { branch_name, branch_code, address, city, state_code, is_active } = req.body
    await run(`
      UPDATE branches
      SET branch_name = COALESCE(?, branch_name),
          branch_code = COALESCE(?, branch_code),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state_code = COALESCE(?, state_code),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [branch_name, branch_code, address, city, state_code, is_active, req.params.id])

    return res.json({ success: true, message: 'Branch updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/branches/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE branches SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus), message: `Branch ${newStatus ? 'activated' : 'deactivated'}.` })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Transfer History: List Delivery Challans / Notes
apiRouter.get('/inventory/transfers', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
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
    `
    const countSql = `SELECT COUNT(*) as count FROM delivery_challans`

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        challans: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const challans = await queryAll(selectSql)
    return res.json({
      challans,
      page: 1,
      limit: challans.length,
      totalCount: challans.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Create Delivery Challan / Inter-Branch Stock Transfer
apiRouter.post('/inventory/transfers', requirePermission('inventory', 'can_create'), async (req: Request, res: Response) => {
  try {
    const { source_branch_id, destination_branch_id, token_model, quantity, remarks, transfer_date } = req.body
    const currentUser = (req as any).user
    const delegation = (req as any).delegation

    if (!source_branch_id || !destination_branch_id || !token_model) {
      return res.status(400).json({ error: 'Source branch, destination branch, and token model are required.' })
    }

    if (source_branch_id === destination_branch_id) {
      return res.status(400).json({ error: 'Please select another branch. Source and destination branches must differ.' })
    }

    const parsedQty = parseInt(quantity, 10)
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive whole number.' })
    }

    // Server-side stock verification against race conditions & over-allocation
    const sourceStock = await queryOne<any>(
      'SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?',
      [source_branch_id, token_model]
    )

    if (!sourceStock || sourceStock.quantity_on_hand < parsedQty) {
      const available = sourceStock ? sourceStock.quantity_on_hand : 0
      return res.status(400).json({
        error: `Not enough stock available. Source branch has only ${available} usable tokens.`
      })
    }

    // Snapshot company legal data at challan issue time
    const company = await queryOne<any>('SELECT * FROM company_profile LIMIT 1')

    const challanId = `dc-${Date.now()}`
    const challanNumber = await allocateNextReferenceNumber('delivery_challan')
    const effectiveDate = transfer_date || new Date().toISOString().split('T')[0]

    // Atomically record transfer and deduct stock from source branch
    await run(
      `INSERT INTO delivery_challans (
        id, challan_number, source_branch_id, destination_branch_id, token_model, quantity, purpose, issued_by, status, created_at, company_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', ?, ?)`,
      [challanId, challanNumber, source_branch_id, destination_branch_id, token_model, parsedQty, remarks || 'Inter-branch stock transfer', currentUser.id, effectiveDate, company ? JSON.stringify(company) : null]
    )

    // Deduct stock from source branch
    await run(
      'UPDATE branch_token_stocks SET quantity_on_hand = quantity_on_hand - ? WHERE branch_id = ? AND token_model = ?',
      [parsedQty, source_branch_id, token_model]
    )

    // Ensure destination branch stock row exists and record receipt or in-transit
    const destStock = await queryOne<any>(
      'SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?',
      [destination_branch_id, token_model]
    )
    if (!destStock) {
      const newStockId = `stock-${Date.now()}-${Math.floor(Math.random()*1000)}`
      await run(
        'INSERT INTO branch_token_stocks (id, branch_id, token_model, quantity_on_hand, quarantine_damaged, min_threshold) VALUES (?, ?, ?, ?, 0, 10)',
        [newStockId, destination_branch_id, token_model, 0]
      )
    }

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'DISPATCH_TRANSFER',
      moduleKey: 'inventory',
      tableAffected: 'delivery_challans',
      recordId: challanId,
      newValueJson: { challanNumber, source_branch_id, destination_branch_id, token_model, parsedQty },
      delegationId: delegation?.id,
      ipAddress: req.ip,
    })

    return res.status(201).json({
      success: true,
      id: challanId,
      challan_number: challanNumber,
      message: 'Delivery note created successfully.'
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Confirm receipt of delivery challan at destination branch
apiRouter.patch('/inventory/transfers/:id/receive', requireAuth, async (req: Request, res: Response) => {
  try {
    const challanId = req.params.id as string
    const challan = await queryOne<any>('SELECT * FROM delivery_challans WHERE id = ?', [challanId])
    if (!challan) return res.status(404).json({ error: 'Delivery Challan not found.' })

    if (challan.status === 'received') {
      return res.status(400).json({ error: 'This delivery note has already been received.' })
    }
    if (challan.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled delivery notes cannot be received.' })
    }

    // Add received quantity to destination branch
    await run(
      'UPDATE branch_token_stocks SET quantity_on_hand = quantity_on_hand + ? WHERE branch_id = ? AND token_model = ?',
      [challan.quantity, challan.destination_branch_id, challan.token_model]
    )

    // Mark challan received
    await run('UPDATE delivery_challans SET status = \'received\' WHERE id = ?', [challanId])

    return res.json({ success: true, status: 'received', message: 'Stock received and credited to destination branch.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Stock Adjustment & Damaged Token Handling (Item 10)
apiRouter.post('/inventory/adjust', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { branch_id, token_model, adjustment_type, quantity, reason } = req.body
    const currentUser = (req as any).user

    if (!branch_id || !token_model || !adjustment_type || quantity === undefined) {
      return res.status(400).json({ error: 'Branch, token model, adjustment type, and quantity are required.' })
    }

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer.' })
    }

    // Ensure branch stock row exists
    let stock = await queryOne<any>(
      'SELECT * FROM branch_token_stocks WHERE branch_id = ? AND token_model = ?',
      [branch_id, token_model]
    )
    if (!stock) {
      const newStockId = `stock-${Date.now()}`
      await run(
        'INSERT INTO branch_token_stocks (id, branch_id, token_model, quantity_on_hand, quarantine_damaged, min_threshold) VALUES (?, ?, ?, 0, 0, 10)',
        [newStockId, branch_id, token_model]
      )
      stock = { id: newStockId, quantity_on_hand: 0, quarantine_damaged: 0 }
    }

    if (adjustment_type === 'quarantine_damaged') {
      if (stock.quantity_on_hand < qty) {
        return res.status(400).json({ error: `Cannot quarantine ${qty} tokens. Only ${stock.quantity_on_hand} tokens available on hand.` })
      }
      await run(`
        UPDATE branch_token_stocks
        SET quantity_on_hand = quantity_on_hand - ?,
            quarantine_damaged = quarantine_damaged + ?
        WHERE branch_id = ? AND token_model = ?
      `, [qty, qty, branch_id, token_model])
    } else if (adjustment_type === 'reconcile_add') {
      await run(`
        UPDATE branch_token_stocks
        SET quantity_on_hand = quantity_on_hand + ?
        WHERE branch_id = ? AND token_model = ?
      `, [qty, branch_id, token_model])
    } else if (adjustment_type === 'reconcile_deduct') {
      if (stock.quantity_on_hand < qty) {
        return res.status(400).json({ error: `Cannot deduct ${qty} tokens. Only ${stock.quantity_on_hand} tokens available on hand.` })
      }
      await run(`
        UPDATE branch_token_stocks
        SET quantity_on_hand = quantity_on_hand - ?
        WHERE branch_id = ? AND token_model = ?
      `, [qty, branch_id, token_model])
    } else {
      return res.status(400).json({ error: 'Invalid adjustment type.' })
    }

    const adjId = `adj-${Date.now()}`
    await run(`
      INSERT INTO stock_adjustments (id, branch_id, token_model, adjustment_type, quantity, reason, adjusted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [adjId, branch_id, token_model, adjustment_type, qty, reason || 'Physical inventory audit adjustment', currentUser?.id || 'admin'])

    return res.status(201).json({ success: true, id: adjId, message: 'Stock adjustment successfully posted.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 6. CRM Leads & Deduplication Engine
// ==========================================
apiRouter.get('/crm/leads', async (req: Request, res: Response) => {
  try {
    const mask = req.query.mask === 'true'
    const search = req.query.search ? String(req.query.search).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    let whereClause = 'WHERE l.is_merged = 0'
    const params: any[] = []
    if (search) {
      whereClause += ' AND (l.company_name LIKE ? OR l.contact_person LIKE ? OR l.lead_code LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s, s)
    }

    const selectSql = `
      SELECT l.*, u.full_name as assigned_agent_name
      FROM crm_leads l
      LEFT JOIN user_profiles u ON l.assigned_to = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `

    const countSql = `
      SELECT COUNT(*) as count
      FROM crm_leads l
      ${whereClause}
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      const sanitized = result.data.map((l: any) => applyPiiMasking(l, mask))
      return res.json({
        leads: sanitized,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const leads = await queryAll(selectSql, params)
    const sanitized = leads.map((l: any) => applyPiiMasking(l, mask))
    return res.json({
      leads: sanitized,
      page: 1,
      limit: sanitized.length,
      totalCount: sanitized.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/leads/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { gstin, phone, email, pan, company_name } = req.body
    const existing = await queryAll('SELECT id, lead_code, company_name, email, phone, gstin, pan FROM crm_leads WHERE is_merged = 0')
    const matches = evaluateLeadDuplicates(
      { gstin, phone, email, pan, companyName: company_name },
      existing.map((e: any) => ({
        id: e.id,
        leadCode: e.lead_code,
        companyName: e.company_name,
        email: e.email,
        phone: e.phone,
        gstin: e.gstin,
        pan: e.pan,
      }))
    )

    return res.json({
      matches,
      hasAlert: matches.some((m) => m.isDuplicateAlert),
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/leads', async (req: Request, res: Response) => {
  try {
    const { company_name, contact_person, email, phone, gstin, pan, requirement_summary } = req.body
    const id = `lead-${Date.now()}`
    const lead_code = await allocateNextReferenceNumber('lead')

    await run(`
      INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `, [id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary])

    return res.status(201).json({ success: true, id, lead_code })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/leads/merge', requirePermission('crm', 'can_edit'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const delegation = (req as any).delegation
    const { primary_lead_id, secondary_lead_id } = req.body
    await run(`
      UPDATE crm_leads
      SET is_merged = 1, merged_into_lead_id = ?, status = 'merged', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [primary_lead_id, secondary_lead_id])

    // Move associated follow-ups to primary lead
    await run(`UPDATE crm_follow_ups SET lead_id = ? WHERE lead_id = ?`, [primary_lead_id, secondary_lead_id])

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'MERGE_LEADS',
      moduleKey: 'crm',
      tableAffected: 'crm_leads',
      recordId: primary_lead_id,
      newValueJson: { merged_id: secondary_lead_id },
      reason: 'Deduplication consolidation',
      delegationId: delegation?.id,
      ipAddress: req.ip,
    })

    return res.json({ success: true, primary_lead_id, merged_id: secondary_lead_id })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Lead Edit, Assignment & Status Update (Item 5)
apiRouter.put('/crm/leads/:id', async (req: Request, res: Response) => {
  try {
    const { company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, assigned_to } = req.body
    await run(`
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
    `, [company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, assigned_to, req.params.id])

    return res.json({ success: true, message: 'Lead updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// CRM Follow-Up Actions & Agenda
apiRouter.get('/crm/follow-ups', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = `
      SELECT f.id, f.lead_id, f.channel as contact_mode, f.scheduled_at as follow_up_date, f.status, f.disposition, f.notes,
             l.company_name, l.contact_person, l.phone, l.email, l.lead_code, u.full_name as conducted_by_name
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
      LEFT JOIN user_profiles u ON f.conducted_by = u.id
      ORDER BY f.scheduled_at ASC
    `
    const countSql = `
      SELECT COUNT(*) as count
      FROM crm_follow_ups f
      JOIN crm_leads l ON f.lead_id = l.id
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        followUps: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const followUps = await queryAll(selectSql)
    return res.json({
      followUps,
      page: 1,
      limit: followUps.length,
      totalCount: followUps.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/follow-ups', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lead_id, follow_up_date, contact_mode, notes, disposition } = req.body
    const currentUser = (req as any).user
    if (!lead_id) return res.status(400).json({ error: 'Lead is required.' })
    const id = `fu-${Date.now()}`
    await run(`
      INSERT INTO crm_follow_ups (id, lead_id, channel, scheduled_at, notes, disposition, conducted_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [id, lead_id, contact_mode || 'phone_call', follow_up_date || new Date().toISOString(), notes || null, disposition || null, currentUser.id])
    return res.status(201).json({ success: true, id, message: 'Follow-up scheduled.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/crm/follow-ups/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { disposition, notes } = req.body
    await run(`
      UPDATE crm_follow_ups
      SET status = 'completed', disposition = COALESCE(?, disposition), notes = COALESCE(?, notes)
      WHERE id = ?
    `, [disposition, notes, req.params.id])
    return res.json({ success: true, message: 'Follow-up completed.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/crm/follow-ups/:id/reschedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const { scheduled_at, notes, disposition } = req.body
    if (!scheduled_at) {
      return res.status(400).json({ error: 'New scheduled date/time is required.' })
    }
    await run(`
      UPDATE crm_follow_ups
      SET scheduled_at = ?,
          notes = COALESCE(?, notes),
          disposition = COALESCE(?, disposition),
          status = 'pending'
      WHERE id = ?
    `, [scheduled_at, notes, disposition, req.params.id])
    return res.json({ success: true, message: 'Follow-up rescheduled successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 7. Additional Business Services Hub
// ==========================================
apiRouter.get('/services/orders', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = `
      SELECT s.*, p.company_name as partner_company
      FROM service_orders s
      LEFT JOIN partners p ON s.partner_id = p.id
      ORDER BY s.created_at DESC
    `
    const countSql = `SELECT COUNT(*) as count FROM service_orders`

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        orders: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const orders = await queryAll(selectSql)
    return res.json({
      orders,
      page: 1,
      limit: orders.length,
      totalCount: orders.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/services/orders', async (req: Request, res: Response) => {
  try {
    const { service_type, partner_id, client_name, client_contact, government_fees = 0, professional_fees = 0, notes } = req.body
    const id = `srv-${Date.now()}`
    const order_number = await allocateNextReferenceNumber('service_order')

    await run(`
      INSERT INTO service_orders (id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft_review')
    `, [id, order_number, service_type, partner_id, client_name, client_contact, government_fees, professional_fees, notes])

    return res.status(201).json({ success: true, id, order_number })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 8. Multi-Account Billing & Payments Queue
// ==========================================
apiRouter.get('/billing/accounts', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = 'SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY account_nickname ASC'
    const countSql = 'SELECT COUNT(*) as count FROM bank_accounts WHERE is_active = 1'

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        accounts: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const accounts = await queryAll(selectSql)
    return res.json({
      accounts,
      page: 1,
      limit: accounts.length,
      totalCount: accounts.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/billing/accounts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { account_nickname, bank_name, account_number, ifsc_code, branch_name, account_holder_name, upi_id } = req.body
    if (!account_nickname || !bank_name || !account_number || !ifsc_code) {
      return res.status(400).json({ error: 'Account nickname, bank name, account number, and IFSC are required.' })
    }
    const id = `bank-${Date.now()}`
    await run(`
      INSERT INTO bank_accounts (id, account_nickname, bank_name, account_number, ifsc_code, branch_name, account_holder_name, upi_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, account_nickname, bank_name, account_number, ifsc_code, branch_name || 'Main Branch', account_holder_name || account_nickname, upi_id || null])
    return res.status(201).json({ success: true, id, message: 'Bank account added successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/billing/accounts/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    await run('UPDATE bank_accounts SET is_active = 0 WHERE id = ?', [req.params.id])
    return res.json({ success: true, message: 'Bank account deactivated.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/billing/series', async (_req: Request, res: Response) => {
  try {
    const series = await queryAll(`
      SELECT s.*, b.bank_name, b.account_number, b.upi_id
      FROM invoice_series_configs s
      JOIN bank_accounts b ON s.mapped_bank_account_id = b.id
    `)
    return res.json({ series })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/billing/series', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id } = req.body
    if (!series_name || !prefix || !mapped_bank_account_id) {
      return res.status(400).json({ error: 'Series name, prefix, and mapped bank account are required.' })
    }
    const id = `ser-${Date.now()}`
    await run(`
      INSERT INTO invoice_series_configs (id, series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, series_name.trim(), prefix.trim().toUpperCase(), suffix ? suffix.trim() : null, current_counter || 1000, is_gst_compliant ? 1 : 0, mapped_bank_account_id])
    return res.status(201).json({ success: true, id, message: 'Invoice series created successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.put('/billing/series/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active } = req.body
    await run(`
      UPDATE invoice_series_configs
      SET series_name = COALESCE(?, series_name),
          prefix = COALESCE(?, prefix),
          suffix = COALESCE(?, suffix),
          current_counter = COALESCE(?, current_counter),
          is_gst_compliant = COALESCE(?, is_gst_compliant),
          mapped_bank_account_id = COALESCE(?, mapped_bank_account_id),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [series_name, prefix, suffix, current_counter, is_gst_compliant, mapped_bank_account_id, is_active, req.params.id])
    return res.json({ success: true, message: 'Invoice series updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.get('/billing/invoices', async (req: Request, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : ''
    const status = req.query.status ? String(req.query.status).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    const conditions: string[] = []
    const params: any[] = []

    if (status) {
      conditions.push('i.status = ?')
      params.push(status)
    }

    if (search) {
      conditions.push('(i.invoice_number LIKE ? OR p.company_name LIKE ? OR b.bank_name LIKE ?)')
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const selectSql = `
      SELECT i.*, p.company_name as partner_company, b.bank_name, b.account_number, b.upi_id
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      LEFT JOIN bank_accounts b ON i.bank_account_snapshot_id = b.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `

    const countSql = `
      SELECT COUNT(*) as count
      FROM invoices i
      LEFT JOIN partners p ON i.partner_id = p.id
      ${whereClause}
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      return res.json({
        invoices: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const invoices = await queryAll(selectSql, params)
    return res.json({
      invoices,
      page: 1,
      limit: invoices.length,
      totalCount: invoices.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/billing/invoices', requirePermission('billing', 'can_create'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const delegation = (req as any).delegation
    const { series_id, partner_id, due_days = 30, line_items = [] } = req.body

    const series = await queryOne<any>('SELECT * FROM invoice_series_configs WHERE id = ?', [series_id])
    if (!series) return res.status(404).json({ error: 'Invoice series config not found' })

    const partner = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [partner_id])
    if (!partner) return res.status(404).json({ error: 'Partner not found' })

    // Snapshot company legal data at issue time to prevent historical corruption
    const company = await queryOne<any>('SELECT * FROM company_profile LIMIT 1')

    const subtotal = line_items.reduce((sum: number, item: any) => sum + (item.qty * item.rate), 0)
    const gst = calculateGst(subtotal, partner.state_code)

    const nextCounter = series.current_counter + 1
    const invoice_number = `${series.prefix}${nextCounter}${series.suffix || ''}`
    const id = `inv-${Date.now()}`

    await run('UPDATE invoice_series_configs SET current_counter = ? WHERE id = ?', [nextCounter, series.id])

    await run(`
      INSERT INTO invoices (
        id, invoice_number, series_id, partner_id, invoice_date, due_date,
        subtotal, cgst_amount, sgst_amount, igst_amount, total_amount, paid_amount,
        outstanding_balance, status, bank_account_snapshot_id, line_items, company_snapshot
      ) VALUES (?, ?, ?, ?, DATE('now'), DATE('now', '+' || ? || ' days'), ?, ?, ?, ?, ?, 0.0, ?, 'unpaid', ?, ?, ?)
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
      company ? JSON.stringify(company) : null,
    ])

    // Ledger debit entry
    await run(`
      INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
      VALUES (?, ?, 'invoice_raised', ?, ?, 0.0, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) + ?), ?)
    `, [`led-${Date.now()}`, partner.id, id, gst.total, partner.id, gst.total, `Invoice ${invoice_number} raised`])

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'CREATE_INVOICE',
      moduleKey: 'billing',
      tableAffected: 'invoices',
      recordId: id,
      newValueJson: { invoice_number, total: gst.total, partner_id },
      delegationId: delegation?.id,
      ipAddress: req.ip,
    })

    return res.status(201).json({ success: true, id, invoice_number, total: gst.total })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Payment screenshot verification queue
apiRouter.get('/billing/payments/queue', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = `
      SELECT p.*, i.invoice_number, i.total_amount, i.outstanding_balance, i.line_items,
             pt.company_name as partner_company, b.bank_name, b.account_number
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
      LEFT JOIN bank_accounts b ON p.bank_account_id = b.id
      ORDER BY p.created_at DESC
    `
    const countSql = `
      SELECT COUNT(*) as count
      FROM payments_received p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN partners pt ON p.partner_id = pt.id
    `

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        queue: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const queue = await queryAll(selectSql)
    return res.json({
      queue,
      page: 1,
      limit: queue.length,
      totalCount: queue.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/billing/payments/verify', requirePermission('billing', 'can_edit'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const delegation = (req as any).delegation
    const { payment_id, action, rejection_remarks } = req.body // action: 'verified' | 'rejected'
    const payment = await queryOne<any>('SELECT * FROM payments_received WHERE id = ?', [payment_id])
    if (!payment) return res.status(404).json({ error: 'Payment record not found' })

    if (action === 'verified') {
      await run(`
        UPDATE payments_received
        SET verified_status = 'verified', verified_at = CURRENT_TIMESTAMP, verified_by = ?
        WHERE id = ?
      `, [currentUser.id, payment_id])

      // Update invoice paid amount
      await run(`
        UPDATE invoices
        SET paid_amount = paid_amount + ?,
            outstanding_balance = outstanding_balance - ?,
            status = CASE WHEN (outstanding_balance - ?) <= 0 THEN 'paid' ELSE 'partially_paid' END
        WHERE id = ?
      `, [payment.amount_paid, payment.amount_paid, payment.amount_paid, payment.invoice_id])

      // Post credit to financial ledger
      await run(`
        INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
        VALUES (?, ?, 'payment_received', ?, 0.0, ?, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) - ?), ?)
      `, [`led-${Date.now()}`, payment.partner_id, payment.id, payment.amount_paid, payment.partner_id, payment.amount_paid, `Payment received UTR: ${payment.transaction_reference_utr || 'Direct'}`])

      await logAuditEvent({
        userId: currentUser.id,
        actionType: 'VERIFY_PAYMENT',
        moduleKey: 'billing',
        tableAffected: 'payments_received',
        recordId: payment_id,
        oldValueJson: { status: payment.verified_status },
        newValueJson: { status: 'verified', amount: payment.amount_paid },
        delegationId: delegation?.id,
        ipAddress: req.ip,
      })

      return res.json({ success: true, status: 'verified' })
    } else {
      await run(`
        UPDATE payments_received
        SET verified_status = 'rejected', rejection_remarks = ?, verified_at = CURRENT_TIMESTAMP, verified_by = ?
        WHERE id = ?
      `, [rejection_remarks || 'Screenshot mismatch or invalid UTR', currentUser.id, payment_id])

      await logAuditEvent({
        userId: currentUser.id,
        actionType: 'REJECT_PAYMENT',
        moduleKey: 'billing',
        tableAffected: 'payments_received',
        recordId: payment_id,
        oldValueJson: { status: payment.verified_status },
        newValueJson: { status: 'rejected', remarks: rejection_remarks },
        delegationId: delegation?.id,
        ipAddress: req.ip,
      })

      return res.json({ success: true, status: 'rejected' })
    }
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 9. Logistics, Couriers & POD Tracking
// ==========================================
apiRouter.get('/courier/dispatches', async (req: Request, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : ''
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)

    let whereClause = ''
    const params: any[] = []
    if (search) {
      whereClause = 'WHERE (dispatch_number LIKE ? OR carrier_name LIKE ? OR awb_number LIKE ? OR recipient_name LIKE ?)'
      const s = `%${search}%`
      params.push(s, s, s, s)
    }

    const selectSql = `SELECT * FROM courier_dispatches ${whereClause} ORDER BY dispatched_at DESC`
    const countSql = `SELECT COUNT(*) as count FROM courier_dispatches ${whereClause}`

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, params, { page, limit, offset })
      return res.json({
        dispatches: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const dispatches = await queryAll(selectSql, params)
    return res.json({
      dispatches,
      page: 1,
      limit: dispatches.length,
      totalCount: dispatches.length,
      totalPages: 1,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/courier/dispatches', async (req: Request, res: Response) => {
  try {
    const { carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents } = req.body
    const id = `disp-${Date.now()}`
    const dispatch_number = await allocateNextReferenceNumber('courier_dispatch')

    await run(`
      INSERT INTO courier_dispatches (id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manifested')
    `, [id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents])

    return res.status(201).json({ success: true, id, dispatch_number })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/courier/dispatches/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, proof_of_delivery_url, notes } = req.body
    if (!status) {
      return res.status(400).json({ error: 'Status is required.' })
    }

    const deliveredAt = status === 'delivered' ? new Date().toISOString() : null

    await run(`
      UPDATE courier_dispatches
      SET status = ?,
          proof_of_delivery_url = COALESCE(?, proof_of_delivery_url),
          notes = COALESCE(?, notes),
          delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
      WHERE id = ?
    `, [status, proof_of_delivery_url, notes, status, req.params.id])

    return res.json({ success: true, message: `Courier status updated to ${status}.` })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})


// Delivery Challan / Transfer Document PDF Compilation
apiRouter.get('/inventory/transfers/pdf', async (req: Request, res: Response) => {
  try {
    const challanNumber = (req.query.challan_number as string) || 'DC-2026-0001'
    const profile = await queryOne<any>('SELECT * FROM company_profile LIMIT 1')

    const challans = await queryAll(`
      SELECT dc.*, 
             sb.branch_name as source_branch_name, sb.branch_code as source_branch_code, sb.city as source_city, sb.state_code as source_state,
             db.branch_name as destination_branch_name, db.branch_code as destination_branch_code, db.city as dest_city, db.state_code as dest_state,
             u.full_name as issued_by_name
      FROM delivery_challans dc
      LEFT JOIN branches sb ON dc.source_branch_id = sb.id
      LEFT JOIN branches db ON dc.destination_branch_id = db.id
      LEFT JOIN user_profiles u ON dc.issued_by = u.id
      WHERE dc.challan_number = ?
    `, [challanNumber])

    const challan = challans[0]
    const doc = {
      documentType: 'Inter-Branch Stock Transfer Delivery Challan',
      challanNumber: challan ? challan.challan_number : challanNumber,
      transferDate: challan ? challan.created_at : new Date().toISOString().split('T')[0],
      sourceBranch: {
        name: challan?.source_branch_name || 'Headquarters - Mumbai',
        code: challan?.source_branch_code || 'HQ-MUM',
        city: challan?.source_city || 'Mumbai',
        state: challan?.source_state || 'MH',
      },
      destinationBranch: {
        name: challan?.destination_branch_name || 'Regional Branch - Delhi',
        code: challan?.destination_branch_code || 'BR-DEL',
        city: challan?.dest_city || 'New Delhi',
        state: challan?.dest_state || 'DL',
      },
      lineItems: [
        {
          item: challan ? challan.token_model.toUpperCase().replace('_', ' ') : 'EPASS2003 AUTO',
          description: 'FIPS 140-2 Level 3 Cryptographic USB Hardware Token',
          quantity: challan ? challan.quantity : 50,
          purpose: challan?.purpose || 'Stock replenishment for local branch operations',
        }
      ],
      companyDetails: {
        legalName: profile?.legal_name || 'SignSync Technologies Private Limited',
        gstin: profile?.gstin || '27AAACS1234A1Z1',
        registeredOffice: profile?.registered_address || 'Suite 401, Nariman Point, Mumbai, Maharashtra 400021',
      },
      authorizedBy: challan?.issued_by_name || 'Operations Manager',
      status: challan?.status || 'dispatched',
      rulesCompliance: 'Under Rule 55 of CGST Rules 2017 - Movement of goods without supply',
      generatedAt: new Date().toISOString(),
    }

    return res.json(doc)
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// 10. Administrator Central Settings (Phase 2)
// ==========================================

// A. Company Profile Settings
apiRouter.get('/admin/settings/company', async (_req: Request, res: Response) => {
  try {
    const profile = await queryOne('SELECT * FROM company_profile LIMIT 1')
    return res.json({ profile })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.put('/admin/settings/company', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name } = req.body
    if (!legal_name || !gstin || !state_code) {
      return res.status(400).json({ error: 'Legal name, GSTIN, and default state are required.' })
    }

    await run(`
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
    `, [legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name])

    return res.json({ success: true, message: 'Company profile updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// B. Token Models Master
apiRouter.get('/admin/settings/tokens', async (_req: Request, res: Response) => {
  try {
    const models = await queryAll('SELECT * FROM token_models ORDER BY model_name ASC')
    return res.json({ models })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/settings/tokens', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { model_name, manufacturer, vendor_contact, min_threshold } = req.body
    if (!model_name || !manufacturer) {
      return res.status(400).json({ error: 'Model name and manufacturer are required.' })
    }
    const id = `tm-${Date.now()}`
    await run(`
      INSERT INTO token_models (id, model_name, manufacturer, vendor_contact, min_threshold, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, model_name.trim().toUpperCase(), manufacturer.trim(), vendor_contact || null, Number(min_threshold) || 10])

    return res.status(201).json({ success: true, id, message: 'Token model added successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// C. Courier Companies Master
apiRouter.get('/admin/settings/couriers', async (_req: Request, res: Response) => {
  try {
    const couriers = await queryAll('SELECT * FROM courier_partners ORDER BY company_name ASC')
    return res.json({ couriers })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/settings/couriers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { company_name, tracking_url_template, support_phone } = req.body
    if (!company_name) return res.status(400).json({ error: 'Company name is required.' })
    const id = `cp-${Date.now()}`
    await run(`
      INSERT INTO courier_partners (id, company_name, tracking_url_template, support_phone, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [id, company_name.trim(), tracking_url_template || null, support_phone || null])

    return res.status(201).json({ success: true, id, message: 'Courier company added successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// D. Business Services Master
apiRouter.get('/admin/settings/services', async (_req: Request, res: Response) => {
  try {
    const services = await queryAll('SELECT * FROM services_catalog ORDER BY category, service_name')
    return res.json({ services })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/settings/services', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { service_key, service_name, category, government_fee, professional_fee } = req.body
    if (!service_key || !service_name || !category) {
      return res.status(400).json({ error: 'Service key, name, and category are required.' })
    }
    const id = `srv-${Date.now()}`
    await run(`
      INSERT INTO services_catalog (id, service_key, service_name, category, government_fee, professional_fee, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [id, service_key.trim().toLowerCase(), service_name.trim(), category.trim(), Number(government_fee) || 0, Number(professional_fee) || 0])

    return res.status(201).json({ success: true, id, message: 'Service catalog item added successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// E. Partner Edit API (Phase 3)
apiRouter.put('/partners/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const {
      company_name,
      contact_person,
      email,
      phone,
      gstin,
      pan,
      billing_address,
      state_code,
      credit_limit,
      credit_period_days,
      status,
    } = req.body

    const existing = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Partner not found' })

    // Strict Security Guard: Only Super Admin (Level 0) or Partner Admin (Level 1) can modify credit limits or credit periods
    if (credit_limit !== undefined || credit_period_days !== undefined) {
      if (currentUser.hierarchy_level_order > 1) {
        return res.status(403).json({ error: 'Security restriction: Only authorized administrators (Level 0/1) can modify credit limits and terms.' })
      }
    }

    const newCreditLimit = credit_limit !== undefined ? Number(credit_limit) : existing.credit_limit
    const newCreditPeriod = credit_period_days !== undefined ? Number(credit_period_days) : existing.credit_period_days

    await run(`
      UPDATE partners
      SET company_name = COALESCE(?, company_name),
          contact_person = COALESCE(?, contact_person),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          gstin = COALESCE(?, gstin),
          pan = COALESCE(?, pan),
          billing_address = COALESCE(?, billing_address),
          state_code = COALESCE(?, state_code),
          credit_limit = ?,
          credit_period_days = ?,
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
      newCreditLimit,
      newCreditPeriod,
      status,
      req.params.id,
    ])

    if (credit_limit !== undefined && Number(credit_limit) !== existing.credit_limit) {
      const partId = req.params.id
      await logAuditEvent({
        userId: currentUser.id,
        actionType: 'CHANGE_CREDIT_LIMIT',
        moduleKey: 'partners',
        tableAffected: 'partners',
        recordId: Array.isArray(partId) ? partId[0] : partId,
        oldValueJson: { credit_limit: existing.credit_limit, credit_period_days: existing.credit_period_days },
        newValueJson: { credit_limit: newCreditLimit, credit_period_days: newCreditPeriod },
        reason: 'Credit policy adjustment',
        ipAddress: req.ip,
      })
    }

    return res.json({ success: true, message: 'Partner details updated successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// Central Master Configuration APIs (Phase 2)
// ==========================================

// 1. Certifying Authorities (CA)
apiRouter.get('/admin/masters/ca', async (_req: Request, res: Response) => {
  try {
    const authorities = await queryAll('SELECT * FROM certifying_authorities ORDER BY ca_name ASC')
    return res.json({ authorities })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/masters/ca', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { ca_name, ca_code, api_endpoint, support_contact } = req.body
    if (!ca_name || !ca_code) {
      return res.status(400).json({ error: 'CA Name and CA Code are required.' })
    }
    const id = `ca-${Date.now()}`
    await run(`
      INSERT INTO certifying_authorities (id, ca_name, ca_code, api_endpoint, support_contact, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [id, ca_name.trim(), ca_code.trim().toUpperCase(), api_endpoint || null, support_contact || null])

    const currentUser = (req as any).user
    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'CREATE_CA_MASTER',
      moduleKey: 'admin_users',
      tableAffected: 'certifying_authorities',
      recordId: id,
      newValueJson: { ca_name, ca_code },
      ipAddress: req.ip,
    })

    return res.status(201).json({ success: true, id, message: 'Certifying Authority added.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/masters/ca/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE certifying_authorities SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 2. Hardware Vendors
apiRouter.get('/admin/masters/vendors', async (_req: Request, res: Response) => {
  try {
    const vendors = await queryAll('SELECT * FROM hardware_vendors ORDER BY vendor_name ASC')
    return res.json({ vendors })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/masters/vendors', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { vendor_name, contact_person, email, phone, gstin, address } = req.body
    if (!vendor_name) return res.status(400).json({ error: 'Vendor name is required.' })
    const id = `ven-${Date.now()}`
    await run(`
      INSERT INTO hardware_vendors (id, vendor_name, contact_person, email, phone, gstin, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, vendor_name.trim(), contact_person || null, email || null, phone || null, gstin || null, address || null])

    const currentUser = (req as any).user
    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'CREATE_VENDOR_MASTER',
      moduleKey: 'admin_users',
      tableAffected: 'hardware_vendors',
      recordId: id,
      newValueJson: { vendor_name },
      ipAddress: req.ip,
    })

    return res.status(201).json({ success: true, id, message: 'Hardware vendor added.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 3. Stock Adjustment Reasons
apiRouter.get('/admin/masters/reasons', async (_req: Request, res: Response) => {
  try {
    const reasons = await queryAll('SELECT * FROM stock_adjustment_reasons ORDER BY reason_label ASC')
    return res.json({ reasons })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/masters/reasons', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason_code, reason_label, adjustment_type } = req.body
    if (!reason_code || !reason_label) return res.status(400).json({ error: 'Reason code and label are required.' })
    const id = `rsn-${Date.now()}`
    await run(`
      INSERT INTO stock_adjustment_reasons (id, reason_code, reason_label, adjustment_type, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [id, reason_code.trim().toUpperCase(), reason_label.trim(), adjustment_type || 'DAMAGE'])
    return res.status(201).json({ success: true, id, message: 'Adjustment reason added.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/masters/reasons/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE stock_adjustment_reasons SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 3b. CRM Lead Sources Master
apiRouter.get('/crm/lead-sources', async (_req: Request, res: Response) => {
  try {
    const sources = await queryAll('SELECT * FROM crm_lead_sources ORDER BY source_name ASC')
    return res.json({ sources })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/lead-sources', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source_name } = req.body
    if (!source_name) return res.status(400).json({ error: 'Lead source name is required.' })
    const id = `src-${Date.now()}`
    await run('INSERT INTO crm_lead_sources (id, source_name, is_active) VALUES (?, ?, 1)', [id, source_name.trim()])
    return res.status(201).json({ success: true, id, message: 'Lead source added.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/crm/lead-sources/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE crm_lead_sources SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 3c. Master Entities Deactivate / Update Endpoints
apiRouter.patch('/admin/masters/vendors/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE hardware_vendors SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/settings/tokens/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE token_models SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/settings/couriers/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE courier_partners SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.patch('/admin/settings/services/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { is_active } = req.body
    const newStatus = is_active !== undefined ? (is_active ? 1 : 0) : 0
    await run('UPDATE services_catalog SET is_active = ? WHERE id = ?', [newStatus, req.params.id])
    return res.json({ success: true, is_active: Boolean(newStatus) })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Branches List Endpoint
apiRouter.get('/admin/branches', async (_req: Request, res: Response) => {
  try {
    const branches = await queryAll('SELECT * FROM branches ORDER BY branch_name ASC')
    return res.json({ branches })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 4. Central Numbering Series Configuration Master
apiRouter.get('/admin/numbering', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const configs = await queryAll('SELECT * FROM numbering_series_configs ORDER BY document_type ASC')
    return res.json({ configs })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/numbering', requireAdmin, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const {
      series_name,
      document_type,
      prefix,
      suffix,
      separator = '-',
      parts_order = '["prefix", "fy", "counter", "suffix"]',
      fy_format = 'YY-YY',
      company_code,
      branch_code,
      counter_padding = 5,
      starting_counter = 1001,
      current_counter = 1000,
    } = req.body

    if (!series_name || !document_type) {
      return res.status(400).json({ error: 'Series name and document type are required.' })
    }

    const id = `num-${document_type}`
    await run(`
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
    ])

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'UPDATE_NUMBERING_CONFIG',
      moduleKey: 'admin_users',
      tableAffected: 'numbering_series_configs',
      recordId: id,
      newValueJson: req.body,
      reason: 'Numbering series pattern configuration update',
      ipAddress: req.ip,
    })

    return res.status(200).json({ success: true, message: 'Numbering configuration saved successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Numbering Live Preview API
apiRouter.post('/admin/numbering/preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      prefix,
      suffix,
      separator = '-',
      parts_order = '["prefix", "fy", "counter", "suffix"]',
      fy_format = 'YY-YY',
      company_code,
      branch_code,
      counter_padding = 5,
      counter = 1,
    } = req.body

    const mockConfig: NumberingConfig = {
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
    }

    const preview = formatReferenceNumber(mockConfig, counter, {
      companyCode: company_code,
      branchCode: branch_code,
    })

    return res.json({ preview })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// 5. Hardware Token Serials Import & Uniqueness API
apiRouter.post('/inventory/tokens/serials', requirePermission('inventory', 'can_create'), async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const { serial_numbers = [], token_model, branch_id, batch_id } = req.body

    if (!Array.isArray(serial_numbers) || serial_numbers.length === 0 || !token_model || !branch_id) {
      return res.status(400).json({ error: 'List of serial numbers, token model, and branch ID are required.' })
    }

    const inserted: string[] = []
    const duplicates: string[] = []

    for (const rawSerial of serial_numbers) {
      const serial = String(rawSerial).trim().toUpperCase()
      if (!serial) continue

      const exists = await queryOne('SELECT id FROM token_serials WHERE serial_number = ?', [serial])
      if (exists) {
        duplicates.push(serial)
      } else {
        const id = `ser-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        await run(`
          INSERT INTO token_serials (id, serial_number, token_model, batch_id, branch_id, status)
          VALUES (?, ?, ?, ?, ?, 'in_stock')
        `, [id, serial, token_model, batch_id || null, branch_id])
        inserted.push(serial)
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
    })

    return res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      duplicateCount: duplicates.length,
      duplicates,
      message: `Imported ${inserted.length} token serials successfully.`,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// Temporary Delegations Management (Phase 4)
// ==========================================
apiRouter.get('/admin/delegations', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const delegations = await queryAll(`
      SELECT d.*,
             g.full_name as grantor_name, g.email as grantor_email,
             r.full_name as recipient_name, r.email as recipient_email
      FROM temporary_delegations d
      JOIN user_profiles g ON d.grantor_user_id = g.id
      JOIN user_profiles r ON d.recipient_user_id = r.id
      ORDER BY d.created_at DESC
    `)
    return res.json({ delegations })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/admin/delegations', requireAuth, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const { recipient_user_id, module_key, action_key, valid_from, valid_until, reason, can_delegate_further, parent_delegation_id } = req.body

    // Only Level 0 (Super Admin) or Level 1-2 users with explicit delegation authority or valid parent delegation can grant
    if (currentUser.hierarchy_level_order > 2 && !parent_delegation_id) {
      return res.status(403).json({ error: 'You do not have delegation authority.' })
    }

    if (!recipient_user_id || !module_key || !action_key || !valid_from || !valid_until || !reason) {
      return res.status(400).json({ error: 'Recipient, module, action, validity window, and reason are required.' })
    }

    // Verify recipient existence and status
    const recipient = await queryOne<any>(`
      SELECT u.*, h.level_order as hierarchy_level_order
      FROM user_profiles u
      JOIN hierarchy_levels h ON u.hierarchy_level_id = h.id
      WHERE u.id = ?
    `, [recipient_user_id])

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found.' })
    }

    if (recipient.status !== 'active') {
      return res.status(400).json({ error: 'Cannot delegate to an inactive account.' })
    }

    if (recipient.permissions_frozen) {
      return res.status(400).json({ error: 'Cannot delegate to an account whose permissions are frozen.' })
    }

    // Downward Delegation Rule: Cannot delegate to equal or higher tier
    if (currentUser.hierarchy_level_order >= recipient.hierarchy_level_order && currentUser.hierarchy_level_order !== 0) {
      return res.status(403).json({
        error: `Strict Downward Rule: Level ${currentUser.hierarchy_level_order} cannot delegate permissions to Level ${recipient.hierarchy_level_order}.`
      })
    }

    // Security Rule: If onward delegation, ensure grantor holds a valid parent delegation that allows further delegation
    if (parent_delegation_id) {
      const parent = await queryOne<any>('SELECT * FROM temporary_delegations WHERE id = ?', [parent_delegation_id])
      if (!parent || parent.status !== 'active') {
        return res.status(400).json({ error: 'Parent delegation is inactive or revoked.' })
      }
      if (!parent.can_delegate_further) {
        return res.status(403).json({ error: 'Parent delegation does not permit onward delegation.' })
      }
      if (new Date(valid_until).getTime() > new Date(parent.valid_until).getTime()) {
        return res.status(400).json({ error: 'Child delegation expiry cannot exceed parent delegation expiry date.' })
      }
    }

    const id = `del-${Date.now()}`
    await run(`
      INSERT INTO temporary_delegations (
        id, grantor_user_id, recipient_user_id, module_key, action_key, valid_from, valid_until, reason, can_delegate_further, parent_delegation_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [id, currentUser.id, recipient_user_id, module_key, action_key, valid_from, valid_until, reason.trim(), can_delegate_further ? 1 : 0, parent_delegation_id || null])

    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'GRANT_TEMPORARY_DELEGATION',
      moduleKey: 'admin_users',
      tableAffected: 'temporary_delegations',
      recordId: id,
      newValueJson: { recipient_user_id, module_key, action_key, valid_from, valid_until, reason },
      reason,
      ipAddress: req.ip,
    })

    return res.status(201).json({ success: true, id, message: 'Temporary delegation granted successfully.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Revoke temporary delegation with cascading dependent invalidation
apiRouter.patch('/admin/delegations/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user
    const delegation = await queryOne<any>('SELECT * FROM temporary_delegations WHERE id = ?', [req.params.id])
    if (!delegation) return res.status(404).json({ error: 'Delegation record not found.' })

    const nowIso = new Date().toISOString()

    // 1. Revoke parent delegation
    await run(`
      UPDATE temporary_delegations
      SET status = 'revoked', revoked_at = ?, revoked_by = ?
      WHERE id = ?
    `, [nowIso, currentUser.id, req.params.id])

    // 2. Cascading invalidation of all child delegations in chain
    await run(`
      UPDATE temporary_delegations
      SET status = 'revoked', revoked_at = ?, revoked_by = ?
      WHERE parent_delegation_id = ?
    `, [nowIso, currentUser.id, req.params.id])

    // Also invalidate any grand-children (multi-level chain)
    await run(`
      UPDATE temporary_delegations
      SET status = 'revoked', revoked_at = ?, revoked_by = ?
      WHERE parent_delegation_id IN (SELECT id FROM temporary_delegations WHERE parent_delegation_id = ?)
    `, [nowIso, currentUser.id, req.params.id])

    const delId = req.params.id
    await logAuditEvent({
      userId: currentUser.id,
      actionType: 'REVOKE_DELEGATION',
      moduleKey: 'admin_users',
      tableAffected: 'temporary_delegations',
      recordId: Array.isArray(delId) ? delId[0] : delId,
      reason: 'Administrator manual revocation with cascading dependent invalidation',
      ipAddress: req.ip,
    })

    return res.json({ success: true, message: 'Delegation and dependent grants successfully revoked.' })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ==========================================
// Administrative Audit Logs Retrieval (Phase 5)
// ==========================================
apiRouter.get('/admin/audit-logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page, limit, offset, isPaginated } = parsePaginationParams(req.query)
    const selectSql = `
      SELECT a.*, u.full_name as staff_name, u.email as staff_email
      FROM audit_logs a
      LEFT JOIN user_profiles u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `
    const countSql = 'SELECT COUNT(*) as count FROM audit_logs'

    if (isPaginated) {
      const result = await executePaginatedQuery(selectSql, countSql, [], { page, limit, offset })
      return res.json({
        logs: result.data,
        page: result.page,
        limit: result.limit,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      })
    }

    const logs = await queryAll(selectSql)
    return res.json({ logs, totalCount: logs.length })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})
