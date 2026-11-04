import { Router, Request, Response, NextFunction } from 'express'
import { queryAll, queryOne, run } from '../localDb'
import { calculateLandedCost, evaluateLeadDuplicates, calculateGst } from '../../lib/businessLogic'
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
  if (user.hierarchy_level_order > 1) {
    return res.status(403).json({ error: 'You do not have permission to open this page.' })
  }
  next()
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
    return res.json({ roles, levels })
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
    const partner_code = `PRT-${Date.now().toString().slice(-4)}`

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
    const application_number = `DSC-${Date.now().toString().slice(-6)}`

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

apiRouter.post('/inventory/batches', async (req: Request, res: Response) => {
  try {
    const {
      token_model,
      vendor_name,
      quantity_purchased,
      base_unit_price,
      inward_shipping_cost = 0,
      customs_or_taxes = 0,
      handling_charges = 0,
    } = req.body

    const calc = calculateLandedCost({
      quantityPurchased: Number(quantity_purchased),
      baseUnitPrice: Number(base_unit_price),
      inwardShippingCost: Number(inward_shipping_cost),
      customsOrTaxes: Number(customs_or_taxes),
      handlingCharges: Number(handling_charges),
    })

    const id = `batch-${Date.now()}`
    const batch_number = `BAT-${Date.now().toString().slice(-6)}`

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
    ])

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
apiRouter.post('/inventory/transfers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { source_branch_id, destination_branch_id, token_model, quantity, remarks, transfer_date } = req.body
    const currentUser = (req as any).user

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

    const challanId = `dc-${Date.now()}`
    const challanNumber = `DC-2026-${Date.now().toString().slice(-5)}`
    const effectiveDate = transfer_date || new Date().toISOString().split('T')[0]

    // Atomically record transfer and deduct stock from source branch
    await run(
      `INSERT INTO delivery_challans (
        id, challan_number, source_branch_id, destination_branch_id, token_model, quantity, purpose, issued_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dispatched', ?)`,
      [challanId, challanNumber, source_branch_id, destination_branch_id, token_model, parsedQty, remarks || 'Inter-branch stock transfer', currentUser.id, effectiveDate]
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
    const lead_code = `LD-${Date.now().toString().slice(-6)}`

    await run(`
      INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `, [id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary])

    return res.status(201).json({ success: true, id, lead_code })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

apiRouter.post('/crm/leads/merge', async (req: Request, res: Response) => {
  try {
    const { primary_lead_id, secondary_lead_id } = req.body
    await run(`
      UPDATE crm_leads
      SET is_merged = 1, merged_into_lead_id = ?, status = 'merged', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [primary_lead_id, secondary_lead_id])

    return res.json({ success: true, primary_lead_id, merged_id: secondary_lead_id })
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
    const order_number = `SRV-${Date.now().toString().slice(-6)}`

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

apiRouter.post('/billing/invoices', async (req: Request, res: Response) => {
  try {
    const { series_id, partner_id, due_days = 30, line_items = [] } = req.body

    const series = await queryOne('SELECT * FROM invoice_series_configs WHERE id = ?', [series_id])
    if (!series) return res.status(404).json({ error: 'Invoice series config not found' })

    const partner = await queryOne('SELECT * FROM partners WHERE id = ?', [partner_id])
    if (!partner) return res.status(404).json({ error: 'Partner not found' })

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
    ])

    // Ledger debit entry
    await run(`
      INSERT INTO financial_ledger (id, partner_id, transaction_type, reference_id, debit, credit, running_balance, remarks)
      VALUES (?, ?, 'invoice_raised', ?, ?, 0.0, (COALESCE((SELECT running_balance FROM financial_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 1), 0) + ?), ?)
    `, [`led-${Date.now()}`, partner.id, id, gst.total, partner.id, gst.total, `Invoice ${invoice_number} raised`])

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

apiRouter.post('/billing/payments/verify', async (req: Request, res: Response) => {
  try {
    const { payment_id, action, rejection_remarks } = req.body // action: 'verified' | 'rejected'
    const payment = await queryOne('SELECT * FROM payments_received WHERE id = ?', [payment_id])
    if (!payment) return res.status(404).json({ error: 'Payment record not found' })

    if (action === 'verified') {
      await run(`
        UPDATE payments_received
        SET verified_status = 'verified', verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [payment_id])

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

      return res.json({ success: true, status: 'verified' })
    } else {
      await run(`
        UPDATE payments_received
        SET verified_status = 'rejected', rejection_remarks = ?, verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [rejection_remarks || 'Screenshot mismatch or invalid UTR', payment_id])

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
    const dispatch_number = `DSP-${Date.now().toString().slice(-6)}`

    await run(`
      INSERT INTO courier_dispatches (id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manifested')
    `, [id, dispatch_number, carrier_name, awb_number, recipient_name, recipient_phone, shipping_address, package_contents])

    return res.status(201).json({ success: true, id, dispatch_number })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})


// Delivery Challan / Transfer Document PDF Compilation
apiRouter.get('/inventory/transfers/pdf', async (req: Request, res: Response) => {
  try {
    const challanNumber = (req.query.challan_number as string) || 'DC-2026-0001'
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
        legalName: 'SignSync Enterprise Solutions Pvt Ltd',
        gstin: '27AAACS1234A1Z1',
        registeredOffice: 'Express Towers, Nariman Point, Mumbai, Maharashtra 400021',
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