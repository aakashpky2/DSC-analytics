import { NextRequest, NextResponse } from 'next/server'
import { invalidateSession, SESSION_COOKIE_NAME } from '@/server/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value

    if (token) {
      await invalidateSession(token)
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' })
    response.cookies.delete(SESSION_COOKIE_NAME)
    return response
  } catch (error: any) {
    return NextResponse.json({ success: true, message: 'Logged out' })
  }
}

