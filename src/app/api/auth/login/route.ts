import { NextRequest, NextResponse } from 'next/server'
import { getUserProfileByEmail, createSession, SESSION_COOKIE_NAME, isPasswordChangeRequired } from '@/server/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await getUserProfileByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (user.status && user.status.toLowerCase() !== 'active') {
      return NextResponse.json(
        { error: 'Account is deactivated. Contact your administrator.' },
        { status: 403 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      // Check bootstrap plaintext fallback
      if (user.password_hash === password) {
        // Upgrade to bcrypt
        const hashed = await bcrypt.hash(password, 10)
        const { supabase } = await import('@/server/supabase')
        await supabase.from('user_profiles').update({ password_hash: hashed }).eq('id', user.id)
      } else {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }
    }

    // Check if password change required
    const pwdChangeRequired = await isPasswordChangeRequired(user.id)

    // Create persistent session
    const token = await createSession(user.id, 7)

    const { password_hash, ...safeUser } = user

    const response = NextResponse.json({
      success: true,
      user: {
        ...safeUser,
        password_change_required: pwdChangeRequired,
      },
      password_change_required: pwdChangeRequired,
      message: 'Login successful'
    })

    // Set cookie
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    })

    return response
  } catch (error: any) {
    console.error('Direct Login Route Handler Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error during authentication' },
      { status: 500 }
    )
  }
}
