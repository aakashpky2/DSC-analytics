import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import { createClient } from '@supabase/supabase-js'

let rawUrl = process.env.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co'
if (rawUrl.endsWith('.supabase.c')) {
  rawUrl += 'o'
} else if (rawUrl.endsWith('.supabase.')) {
  rawUrl += 'co'
} else if (!rawUrl.includes('.supabase.co') && rawUrl.includes('kbqwsfmfiomcakbhclca')) {
  rawUrl = 'https://kbqwsfmfiomcakbhclca.supabase.co'
}
const supabaseUrl = rawUrl
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.')
}

/**
 * Backend Database Client (Used ONLY inside Express routes / Node.js backend).
 */
export const db = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

