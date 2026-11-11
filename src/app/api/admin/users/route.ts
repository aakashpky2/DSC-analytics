import { NextRequest, NextResponse } from 'next/server'
import { validateSessionToken, SESSION_COOKIE_NAME, hashPassword } from '@/server/auth'
import { queryOne, queryAll, supabase } from '@/server/supabase'
import {
  validateEmployeeName,
  validateCompanyEmail,
  validateMobileNumber,
  validateInitialPassword,
} from '@/lib/staffValidation'

export const dynamic = 'force-dynamic'

// Allowed roles mapping from hierarchy level
const LEVEL_ROLE_MAP: Record<string, { role_id: string; role_name: string; level_order: number }> = {
  'tier-0': { role_id: 'role-super-admin', role_name: 'Super Administrator', level_order: 0 },
  'tier-1': { role_id: 'role-partner-admin', role_name: 'Regional Partner Admin', level_order: 1 },
  'tier-2': { role_id: 'role-branch-mgr', role_name: 'Branch Manager', level_order: 2 },
  'tier-3': { role_id: 'role-senior-exec', role_name: 'Operations Executive', level_order: 3 },
  'tier-4': { role_id: 'role-field-staff', role_name: 'Field Staff / Tele-caller', level_order: 4 },
}

// GET /api/admin/users
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: 'Please enter your email and password to sign in.' }, { status: 401 })
    }

    const currentUser = await validateSessionToken(token)
    if (!currentUser) {
      return NextResponse.json({ error: 'Please enter your email and password to sign in.' }, { status: 401 })
    }

    if (currentUser.status !== 'active') {
      return NextResponse.json({ error: 'Your account is inactive. Please contact your administrator.' }, { status: 403 })
    }

    if (currentUser.hierarchy_level_order > 1) {
      return NextResponse.json({ error: 'You do not have permission to view staff users.' }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get('search')?.trim() || ''

    let sql = `
      SELECT u.id, u.email, u.full_name, u.phone_number, u.role_id, u.hierarchy_level_id,
             u.branch_id, u.status, u.permissions_frozen, u.created_at,
             r.role_name
      FROM user_profiles u
      LEFT JOIN roles r ON u.role_id = r.id
    `
    const params: any[] = []

    if (search) {
      sql += ` WHERE (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR u.phone_number LIKE ?)`
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`, `%${search}%`)
    }

    sql += ` ORDER BY u.created_at DESC`

    const users = await queryAll(sql, params)

    return NextResponse.json({
      users,
      page: 1,
      limit: users.length,
      totalCount: users.length,
      totalPages: 1,
    })
  } catch (err: any) {
    console.error('GET /api/admin/users error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 })
  }
}

// POST /api/admin/users
export async function POST(req: NextRequest) {
  try {
    // 1. Session & Authentication Check
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Please enter your email and password to sign in.' },
        { status: 401 }
      )
    }

    const currentUser = await validateSessionToken(token)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Your session has expired. Please sign in again.' },
        { status: 401 }
      )
    }

    if (currentUser.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Your account is inactive. Please contact your administrator.' },
        { status: 403 }
      )
    }

    // 2. Authorization / RBAC Guard
    // Only Super Admin (Level 0) or Regional Admin (Level 1) can create staff users
    if (currentUser.hierarchy_level_order > 1) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to create staff members.' },
        { status: 403 }
      )
    }

    // 3. Parse Request Payload safely
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload.' },
        { status: 400 }
      )
    }

    const { full_name, email, phone_number, hierarchy_level_id, initial_password, branch_id } = body || {}

    // 4. Strict Validation: Full Name
    const nameCheck = validateEmployeeName(full_name)
    if (!nameCheck.valid) {
      return NextResponse.json({ success: false, error: nameCheck.error }, { status: 400 })
    }

    // 5. Strict Validation: Email
    const emailCheck = validateCompanyEmail(email)
    if (!emailCheck.valid) {
      return NextResponse.json({ success: false, error: emailCheck.error }, { status: 400 })
    }

    // 6. Strict Validation: Mobile Number
    const mobileCheck = validateMobileNumber(phone_number)
    if (!mobileCheck.valid) {
      return NextResponse.json({ success: false, error: mobileCheck.error }, { status: 400 })
    }

    // 7. Strict Validation: Initial Password
    const passwordCheck = validateInitialPassword(initial_password)
    if (!passwordCheck.valid) {
      return NextResponse.json({ success: false, error: passwordCheck.error }, { status: 400 })
    }

    // 8. Strict Validation: Access Level & Hierarchy Privilege Guard
    const selectedLevelId = hierarchy_level_id || 'tier-4'
    const levelConfig = LEVEL_ROLE_MAP[selectedLevelId]
    if (!levelConfig) {
      return NextResponse.json(
        { success: false, error: 'Please select a valid access level.' },
        { status: 400 }
      )
    }

    // Privilege Escalation Guard: Admin cannot create a user with a higher privilege than themselves
    if (levelConfig.level_order < currentUser.hierarchy_level_order) {
      return NextResponse.json(
        { success: false, error: 'You cannot create a staff user with higher privileges than your own.' },
        { status: 403 }
      )
    }

    // 9. Duplicate User Protection: Check if email already exists
    const cleanEmail = emailCheck.email
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM user_profiles WHERE LOWER(email) = ?',
      [cleanEmail]
    )
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A staff member with this email address already exists.' },
        { status: 409 }
      )
    }

    // Check duplicate mobile number
    const existingPhone = await queryOne<{ id: string }>(
      'SELECT id FROM user_profiles WHERE phone_number = ?',
      [mobileCheck.mobile]
    )
    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'A staff member with this mobile number already exists.' },
        { status: 409 }
      )
    }

    // 10. Generate Record Data & Bcrypt Password Hash
    const userId = `usr-${Date.now()}`
    const passwordHash = await hashPassword(passwordCheck.password)
    const orgId = currentUser.organization_id || 'comp-default'

    // 11. Atomic Insert via Supabase
    const { error: insertError } = await supabase.from('user_profiles').insert({
      id: userId,
      email: cleanEmail,
      password_hash: passwordHash,
      full_name: nameCheck.name,
      phone_number: mobileCheck.mobile,
      role_id: levelConfig.role_id,
      hierarchy_level_id: selectedLevelId,
      branch_id: branch_id || null,
      organization_id: orgId,
      status: 'active',
      permissions_frozen: 0,
    })

    if (insertError) {
      console.error('Database insert error in /api/admin/users:', insertError.message)
      return NextResponse.json(
        { success: false, error: 'Database error occurred while creating staff account.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: userId,
        message: 'Staff account created successfully.',
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Unhandled error in POST /api/admin/users:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'An unexpected server error occurred.' },
      { status: 500 }
    )
  }
}
