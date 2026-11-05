import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = process.env.SUPABASE_URL || 'NOT_SET'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'NOT_SET'

  let testResult = 'unknown'
  let testError: any = null
  let userFound: any = null

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(url, key)
    const { data, error } = await sb.from('user_profiles').select('id, email, status').eq('email', 'admin@signsync.io')
    if (error) {
      testResult = 'supabase_error'
      testError = error
    } else {
      testResult = 'success'
      userFound = data
    }
  } catch (err: any) {
    testResult = 'catch_error'
    testError = err.message
  }

  return NextResponse.json({
    supabase_url_configured: url !== 'NOT_SET',
    supabase_url_value: url,
    supabase_key_length: key.length,
    supabase_key_prefix: key.slice(0, 12),
    supabase_key_suffix: key.slice(-8),
    testResult,
    testError,
    userFound,
    node_env: process.env.NODE_ENV,
  })
}
