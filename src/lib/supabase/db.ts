import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.')
}

/**
 * Backend-only Supabase client.
 * Uses service role / server-side credentials and is strictly disallowed in browser code.
 */
export const db = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

