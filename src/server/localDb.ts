import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.')
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export const db = supabase

// ============================================================================
// Direct Supabase Query & Multi-Table Relational Join Resolver
// ============================================================================

function extractTableName(sql: string): string {
  const match = sql.match(/(?:from|into|update)\s+([a-z_0-9]+)/i)
  return match ? match[1].toLowerCase() : ''
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const table = extractTableName(sql)
  if (!table) return []

  try {
    // 1. Roles with hierarchy & user counts
    if (table === 'roles' && sql.includes('hierarchy_levels')) {
      const { data: roles } = await supabase.from('roles').select('*, hierarchy_levels(level_order, level_name)')
      const { data: users } = await supabase.from('user_profiles').select('id, role_id')
      const counts: Record<string, number> = {}
      users?.forEach(u => { counts[u.role_id] = (counts[u.role_id] || 0) + 1 })
      const res = roles?.map(r => ({
        ...r,
        level_order: r.hierarchy_levels?.level_order,
        level_name: r.hierarchy_levels?.level_name,
        staff_count: counts[r.id] || 0
      })) || []
      res.sort((a, b) => (a.level_order || 0) - (b.level_order || 0))
      return res as T[]
    }

    // 2. User profiles with relations
    if (table === 'user_profiles' && sql.includes('JOIN')) {
      const { data: users } = await supabase.from('user_profiles').select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
      const res = users?.map(u => ({
        ...u,
        role_name: u.roles?.name,
        level_order: u.hierarchy_levels?.level_order,
        level_name: u.hierarchy_levels?.level_name,
        branch_name: u.branches?.branch_name
      })) || []
      res.sort((a, b) => (a.level_order || 0) - (b.level_order || 0))
      return res as T[]
    }

    // 3. DSC Applications with partner & product relations
    if (table === 'dsc_applications' && sql.includes('JOIN')) {
      const { data: apps } = await supabase.from('dsc_applications').select('*, partners(company_name), dsc_catalog(class_type, certificate_type, validity_years)')
      const res = apps?.map(a => ({
        ...a,
        partner_company: a.partners?.company_name,
        class_type: a.dsc_catalog?.class_type || a.class_type,
        certificate_type: a.dsc_catalog?.certificate_type,
        validity_years: a.dsc_catalog?.validity_years
      })) || []
      return res as T[]
    }

    // 4. Branch token stocks with branch relations
    if (table === 'branch_token_stocks' && sql.includes('JOIN branches')) {
      const { data: stocks } = await supabase.from('branch_token_stocks').select('*, branches(branch_name, branch_code)')
      const res = stocks?.map(s => ({
        ...s,
        branch_name: s.branches?.branch_name,
        branch_code: s.branches?.branch_code
      })) || []
      return res as T[]
    }

    // 5. CRM Leads with assigned agent
    if (table === 'crm_leads' && sql.includes('JOIN')) {
      const { data: leads } = await supabase.from('crm_leads').select('*, user_profiles(full_name)')
      const res = leads?.map(l => ({
        ...l,
        assigned_agent_name: l.user_profiles?.full_name
      })) || []
      return res as T[]
    }

    // 6. Service orders with partner relations
    if (table === 'service_orders' && sql.includes('JOIN')) {
      const { data: orders } = await supabase.from('service_orders').select('*, partners(company_name)')
      const res = orders?.map(o => ({
        ...o,
        partner_company: o.partners?.company_name
      })) || []
      return res as T[]
    }

    // 7. Temporary delegations with grantor details
    if (table === 'temporary_delegations' && sql.includes('JOIN')) {
      const { data: delegs } = await supabase.from('temporary_delegations').select('*')
      const { data: users } = await supabase.from('user_profiles').select('id, full_name, permissions_frozen, status')
      const userMap = new Map(users?.map(u => [u.id, u]))
      const res = delegs?.map(d => {
        const grantor = userMap.get(d.grantor_user_id)
        const recipient = userMap.get(d.recipient_user_id)
        return {
          ...d,
          grantor_name: grantor?.full_name,
          recipient_name: recipient?.full_name,
          grantor_frozen: grantor?.permissions_frozen,
          grantor_status: grantor?.status
        }
      }) || []
      return res as T[]
    }

    // 8. Audit logs with user details
    if (table === 'audit_logs' && sql.includes('JOIN')) {
      const { data: logs } = await supabase.from('audit_logs').select('*, user_profiles(full_name, email)')
      const res = logs?.map(a => ({
        ...a,
        staff_name: a.user_profiles?.full_name,
        staff_email: a.user_profiles?.email
      })) || []
      res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return res as T[]
    }

    // 9. Invoices with partner & bank details
    if (table === 'invoices' && sql.includes('JOIN')) {
      const { data: invs } = await supabase.from('invoices').select('*, partners(company_name, partner_code), bank_accounts(account_nickname, bank_name)')
      const res = invs?.map(i => ({
        ...i,
        company_name: i.partners?.company_name,
        partner_code: i.partners?.partner_code,
        account_nickname: i.bank_accounts?.account_nickname
      })) || []
      res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return res as T[]
    }

    // Default query builder
    let query = supabase.from(table).select('*')

    // Handle WHERE
    const whereMatch = sql.match(/where\s+([a-z_0-9]+)\s*=\s*\?/i)
    if (whereMatch && params.length > 0) {
      query = query.eq(whereMatch[1], params[0])
    }
    if (sql.includes('is_active = 1')) {
      query = query.eq('is_active', 1)
    }

    // Handle sanitized single-column ORDER BY
    const orderMatch = sql.match(/order\s+by\s+([a-z_0-9]+)(\s+(?:asc|desc))?/i)
    if (orderMatch) {
      const col = orderMatch[1].replace(/^.*\./, '')
      const asc = orderMatch[2] ? orderMatch[2].trim().toLowerCase() !== 'desc' : true
      query = query.order(col, { ascending: asc })
    }

    // Handle LIMIT / OFFSET
    const limitMatch = sql.match(/limit\s+(\d+)(\s+offset\s+(\d+))?/i)
    if (limitMatch) {
      const l = parseInt(limitMatch[1], 10)
      const o = limitMatch[3] ? parseInt(limitMatch[3], 10) : 0
      query = query.range(o, o + l - 1)
    }

    const { data, error } = await query
    if (error) {
      console.error(`queryAll error on ${table}:`, error.message)
      return []
    }
    return (data || []) as T[]
  } catch (err: any) {
    console.error(`queryAll exception on ${table}:`, err.message)
    return []
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const table = extractTableName(sql)
  if (!table) return null

  try {
    if (table === 'user_profiles' && sql.includes('JOIN')) {
      const id = params[0]
      const { data } = await supabase.from('user_profiles')
        .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')
        .eq(sql.includes('email =') ? 'email' : 'id', id)
        .single()
      if (!data) return null
      return {
        ...data,
        role_name: data.roles?.name,
        hierarchy_level_order: data.hierarchy_levels?.level_order,
        level_order: data.hierarchy_levels?.level_order,
        level_name: data.hierarchy_levels?.level_name,
        branch_name: data.branches?.branch_name
      } as T
    }

    let query = supabase.from(table).select('*')
    const whereMatch = sql.match(/where\s+([a-z_0-9]+)\s*=\s*\?/i)
    if (whereMatch && params.length > 0) {
      query = query.eq(whereMatch[1], params[0])
    }

    query = query.limit(1)
    const { data } = await query
    return (data && data[0] ? data[0] : null) as T | null
  } catch (err: any) {
    console.error(`queryOne exception on ${table}:`, err.message)
    return null
  }
}

export async function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  const table = extractTableName(sql)
  if (!table) return { lastID: 0, changes: 0 }

  const trimmed = sql.trim().toLowerCase()

  try {
    if (trimmed.startsWith('insert into')) {
      const colsMatch = sql.match(/\(([^)]+)\)\s*values/i)
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map(c => c.trim())
        const row: Record<string, any> = {}
        cols.forEach((col, idx) => {
          row[col] = params[idx]
        })
        const { error } = await supabase.from(table).insert(row)
        if (error) throw error
        return { lastID: 1, changes: 1 }
      }
    } else if (trimmed.startsWith('update')) {
      const setMatch = sql.match(/set\s+([\s\S]+?)\s+where/i)
      const whereMatch = sql.match(/where\s+([\s\S]+)$/i)
      if (setMatch && whereMatch) {
        const setParts = setMatch[1].split(',').map(s => s.trim())
        const row: Record<string, any> = {}
        let paramIdx = 0
        for (const sp of setParts) {
          const [col] = sp.split('=').map(s => s.trim())
          row[col] = params[paramIdx++]
        }
        
        let query = supabase.from(table).update(row)
        const whereFieldMatch = whereMatch[1].match(/([a-z_0-9]+)\s*=\s*\?/i)
        if (whereFieldMatch) {
          query = query.eq(whereFieldMatch[1], params[paramIdx++])
        }
        
        const { error } = await query
        if (error) throw error
        return { lastID: 0, changes: 1 }
      }
    } else if (trimmed.startsWith('delete from')) {
      const whereMatch = sql.match(/where\s+([a-z_0-9]+)\s*=\s*\?/i)
      if (whereMatch) {
        const { error } = await supabase.from(table).delete().eq(whereMatch[1], params[0])
        if (error) throw error
        return { lastID: 0, changes: 1 }
      }
    }
  } catch (err: any) {
    console.error(`run exception on ${table}:`, err.message)
    throw err
  }

  return { lastID: 0, changes: 0 }
}
