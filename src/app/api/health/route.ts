import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase/db'

export async function GET() {
  try {
    // Backend health / DB ping test
    const { error } = await db.auth.getSession()

    if (error) {
      return NextResponse.json(
        { status: 'error', message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Backend API successfully connected to Supabase database',
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error'
    return NextResponse.json(
      { status: 'error', message: errorMsg },
      { status: 500 }
    )
  }
}

