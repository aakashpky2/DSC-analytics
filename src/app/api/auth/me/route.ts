import { NextRequest, NextResponse } from 'next/server'
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/server/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
    }

    const user = await validateSessionToken(token)
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user
    })
  } catch (error: any) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 })
  }
}

