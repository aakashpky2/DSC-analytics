import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

let rawUrl = process.env.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co'
// Auto-correct common truncated env var issues (e.g. Hostinger trailing .c instead of .co)
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

// Helper to apply in-memory filtering, sorting, and pagination (LIMIT/OFFSET) for complex JOINs
function applySqlFilteringAndPagination<T = any>(items: T[], sql: string, params: any[]): T[] {
  let result = [...items]

  // Extract limit & offset
  let limit: number | null = null
  let offset = 0

  const limitParamMatch = sql.match(/limit\s+\?\s+offset\s+\?/i)
  if (limitParamMatch && params.length >= 2) {
    limit = parseInt(String(params[params.length - 2]), 10)
    offset = parseInt(String(params[params.length - 1]), 10)
    // Remove the limit and offset params from the filter params slice
    params = params.slice(0, -2)
  } else {
    const limitNumMatch = sql.match(/limit\s+(\d+)(?:\s+offset\s+(\d+))?/i)
    if (limitNumMatch) {
      limit = parseInt(limitNumMatch[1], 10)
      if (limitNumMatch[2]) {
        offset = parseInt(limitNumMatch[2], 10)
      }
    }
  }

  // Filter if WHERE clause exists
  const whereIdx = sql.toLowerCase().indexOf('where')
  if (whereIdx !== -1) {
    const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0].trim()
    // Check if there are search LIKE params
    const likeParams = params.filter(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'))
    if (likeParams.length > 0) {
      const searchTerm = likeParams[0].slice(1, -1).toLowerCase()
      result = result.filter(item => {
        const itemStr = Object.values(item as any)
          .map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v || '')))
          .join(' ')
          .toLowerCase()
        return itemStr.includes(searchTerm)
      })
    }
  }

  // Pagination slice
  if (limit !== null && !isNaN(limit)) {
    result = result.slice(offset, offset + limit)
  }

  return result
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 4. Branch token stocks with branch relations
    if (table === 'branch_token_stocks' && sql.includes('JOIN branches')) {
      const { data: stocks } = await supabase.from('branch_token_stocks').select('*, branches(branch_name, branch_code)')
      const res = stocks?.map(s => ({
        ...s,
        branch_name: s.branches?.branch_name,
        branch_code: s.branches?.branch_code
      })) || []
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 5. CRM Leads with assigned agent
    if (table === 'crm_leads' && sql.includes('JOIN')) {
      const { data: leads } = await supabase.from('crm_leads').select('*, user_profiles(full_name)')
      let res = leads?.map(l => ({
        ...l,
        assigned_agent_name: l.user_profiles?.full_name
      })) || []
      if (sql.includes('is_merged = 0')) {
        res = res.filter(l => Number(l.is_merged) === 0)
      } else if (sql.includes('is_merged = 1')) {
        res = res.filter(l => Number(l.is_merged) === 1)
      }
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 6. Service orders with partner relations
    if (table === 'service_orders' && sql.includes('JOIN')) {
      const { data: orders } = await supabase.from('service_orders').select('*, partners(company_name)')
      const res = orders?.map(o => ({
        ...o,
        partner_company: o.partners?.company_name
      })) || []
      return applySqlFilteringAndPagination(res, sql, params) as T[]
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
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
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 10. Payments Received queue with invoices and partner joins
    if (table === 'payments_received' && sql.includes('JOIN invoices')) {
      const { data: queue } = await supabase
        .from('payments_received')
        .select('*, invoices(invoice_number, total_amount, outstanding_balance, line_items), partners(company_name), bank_accounts(bank_name, account_number)')
        .order('created_at', { ascending: false })
      const res = queue?.map(p => ({
        ...p,
        invoice_number: p.invoices?.invoice_number,
        total_amount: p.invoices?.total_amount,
        outstanding_balance: p.invoices?.outstanding_balance,
        line_items: p.invoices?.line_items,
        partner_company: p.partners?.company_name,
        bank_name: p.bank_accounts?.bank_name,
        account_number: p.bank_accounts?.account_number
      })) || []
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 11. CRM Follow-ups with leads and staff joins
    if (table === 'crm_follow_ups' && sql.includes('JOIN')) {
      const { data: followUps } = await supabase
        .from('crm_follow_ups')
        .select('*, crm_leads(company_name, contact_person, phone, email, lead_code), user_profiles(full_name)')
        .order('scheduled_at', { ascending: true })
      const res = followUps?.map(f => ({
        ...f,
        contact_mode: f.channel,
        follow_up_date: f.scheduled_at,
        company_name: f.crm_leads?.company_name,
        contact_person: f.crm_leads?.contact_person,
        phone: f.crm_leads?.phone,
        email: f.crm_leads?.email,
        lead_code: f.crm_leads?.lead_code,
        conducted_by_name: f.user_profiles?.full_name
      })) || []
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // 12. Delivery challans with branches joins
    if (table === 'delivery_challans' && sql.includes('JOIN')) {
      const { data: challans } = await supabase.from('delivery_challans').select('*')
      const { data: branches } = await supabase.from('branches').select('id, branch_name, branch_code')
      const branchMap = new Map(branches?.map(b => [b.id, b]))
      const res = challans?.map(dc => {
        const sb = branchMap.get(dc.source_branch_id)
        const db = branchMap.get(dc.destination_branch_id)
        return {
          ...dc,
          source_branch_name: sb?.branch_name,
          source_branch_code: sb?.branch_code,
          destination_branch_name: db?.branch_name,
          destination_branch_code: db?.branch_code,
        }
      }) || []
      return applySqlFilteringAndPagination(res, sql, params) as T[]
    }

    // Default query builder
    let query = supabase.from(table).select('*')

    // Handle parameterized WHERE clauses
    const whereIdx = sql.toLowerCase().indexOf('where')
    if (whereIdx !== -1) {
      const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0]
      const conditions = wherePart.split(/\s+and\s+/i)
      let paramIndex = 0

      for (const cond of conditions) {
        const trimmedCond = cond.trim()
        if (trimmedCond.includes('is_active = 1')) {
          query = query.eq('is_active', 1)
        } else if (trimmedCond.includes('is_active = 0')) {
          query = query.eq('is_active', 0)
        } else if (trimmedCond.includes('is_merged = 0')) {
          query = query.eq('is_merged', 0)
        } else if (trimmedCond.includes('is_merged = 1')) {
          query = query.eq('is_merged', 1)
        } else if (trimmedCond.includes(' OR ') || trimmedCond.includes(' or ')) {
          // Compound OR search condition, e.g. (col1 LIKE ? OR col2 LIKE ?)
          const orCols: string[] = []
          const re = /([a-z_0-9\.]+)\s*(?:like|ilike)\s*\?/gi
          let m: RegExpExecArray | null
          let searchVal = ''
          while ((m = re.exec(trimmedCond)) !== null) {
            orCols.push(m[1].replace(/^[a-z0-9_]+\./i, ''))
            if (paramIndex < params.length) {
              searchVal = String(params[paramIndex++])
            }
          }
          if (orCols.length > 0 && searchVal) {
            const cleanVal = searchVal.replace(/%/g, '')
            const orClause = orCols.map(c => `${c}.ilike.%${cleanVal}%`).join(',')
            query = query.or(orClause)
          }
        } else {
          const match = trimmedCond.match(/([a-z_0-9\.]+)\s*(=|!=|<>|>|<|>=|<=|like|ilike)\s*\?/i)
          if (match && paramIndex < params.length) {
            const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '')
            const op = match[2].toLowerCase()
            const val = params[paramIndex++]

            if (op === '=') {
              query = query.eq(rawCol, val)
            } else if (op === '!=' || op === '<>') {
              query = query.neq(rawCol, val)
            } else if (op === '>') {
              query = query.gt(rawCol, val)
            } else if (op === '>=') {
              query = query.gte(rawCol, val)
            } else if (op === '<') {
              query = query.lt(rawCol, val)
            } else if (op === '<=') {
              query = query.lte(rawCol, val)
            } else if (op === 'like' || op === 'ilike') {
              query = query.ilike(rawCol, val)
            }
          }
        }
      }
    }

    // Handle sanitized single-column ORDER BY
    const orderMatch = sql.match(/order\s+by\s+([a-z_0-9\.]+)(\s+(?:asc|desc))?/i)
    if (orderMatch) {
      const col = orderMatch[1].replace(/^.*\./, '')
      const asc = orderMatch[2] ? orderMatch[2].trim().toLowerCase() !== 'desc' : true
      query = query.order(col, { ascending: asc })
    }

    // Handle LIMIT / OFFSET
    let limitNum: number | null = null
    let offsetNum = 0
    const limitParamMatch = sql.match(/limit\s+\?\s+offset\s+\?/i)
    if (limitParamMatch && params.length >= 2) {
      limitNum = parseInt(String(params[params.length - 2]), 10)
      offsetNum = parseInt(String(params[params.length - 1]), 10)
    } else {
      const limitMatch = sql.match(/limit\s+(\d+)(\s+offset\s+(\d+))?/i)
      if (limitMatch) {
        limitNum = parseInt(limitMatch[1], 10)
        offsetNum = limitMatch[3] ? parseInt(limitMatch[3], 10) : 0
      }
    }
    if (limitNum !== null && !isNaN(limitNum)) {
      query = query.range(offsetNum, offsetNum + limitNum - 1)
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
    // 0. Handle COUNT(*) queries directly
    if (/select\s+count\s*\(\s*\*\s*\)\s*(?:as\s+count)?/i.test(sql)) {
      const allRows = await queryAll(sql.replace(/select\s+count\s*\(\s*\*\s*\)\s*(?:as\s+count)?/i, 'SELECT *'), params)
      return { count: allRows.length } as unknown as T
    }

    // 1. User Profiles join lookup
    if (table === 'user_profiles' && (sql.includes('JOIN') || sql.includes('join'))) {
      const isEmailQuery = /lower\s*\(\s*(?:u\.)?email\s*\)\s*=\s*\?|(?:u\.)?email\s*=\s*\?/i.test(sql)
      const paramVal = params[0]

      let query = supabase
        .from('user_profiles')
        .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)')

      if (isEmailQuery) {
        query = query.ilike('email', String(paramVal).trim().toLowerCase())
      } else {
        query = query.eq('id', paramVal)
      }

      const { data, error } = await query.maybeSingle()
      if (error || !data) return null
      return {
        ...data,
        role_name: data.roles?.name,
        hierarchy_level_order: data.hierarchy_levels?.level_order,
        level_order: data.hierarchy_levels?.level_order,
        level_name: data.hierarchy_levels?.level_name,
        branch_name: data.branches?.branch_name
      } as T
    }

    // 2. Direct user_profiles by lowercase email without join
    if (table === 'user_profiles' && /lower\s*\(\s*email\s*\)\s*=\s*\?/i.test(sql)) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', String(params[0]).trim().toLowerCase())
        .maybeSingle()
      return (data || null) as T | null
    }

    // 3. User permission overrides lookup with subquery
    if (table === 'user_permission_overrides' && sql.includes('app_modules')) {
      const userId = params[0]
      const moduleKey = params[1]
      const { data: mod } = await supabase.from('app_modules').select('id').eq('module_key', moduleKey).maybeSingle()
      if (!mod) return null
      const { data: override } = await supabase
        .from('user_permission_overrides')
        .select('*')
        .eq('user_id', userId)
        .eq('module_id', mod.id)
        .maybeSingle()
      return (override || null) as T | null
    }

    // 4. Role module permissions lookup with subquery
    if (table === 'role_module_permissions' && sql.includes('app_modules')) {
      const roleId = params[0]
      const moduleKey = params[1]
      const { data: mod } = await supabase.from('app_modules').select('id').eq('module_key', moduleKey).maybeSingle()
      if (!mod) return null
      const { data: perm } = await supabase
        .from('role_module_permissions')
        .select('*')
        .eq('role_id', roleId)
        .eq('module_id', mod.id)
        .maybeSingle()
      return (perm || null) as T | null
    }

    // 5. Temporary delegations active grant check
    if (table === 'temporary_delegations' && sql.includes('JOIN user_profiles')) {
      const recipientUserId = params[0]
      const moduleKey = params[1]
      const actionKey = params[2]
      const nowIso = params[3] || new Date().toISOString()

      const { data: delegs } = await supabase
        .from('temporary_delegations')
        .select('*, user_profiles!temporary_delegations_grantor_user_id_fkey(permissions_frozen, status)')
        .eq('recipient_user_id', recipientUserId)
        .eq('module_key', moduleKey)
        .eq('status', 'active')
        .lte('valid_from', nowIso)
        .gte('valid_until', nowIso)

      if (!delegs || delegs.length === 0) return null
      const matched = delegs.find(d => d.action_key === actionKey || d.action_key === 'all')
      if (!matched) return null

      return {
        ...matched,
        grantor_frozen: (matched as any).user_profiles?.permissions_frozen,
        grantor_status: (matched as any).user_profiles?.status,
      } as T
    }

    // 6. Generic query builder handling ALL AND conditions
    let query = supabase.from(table).select('*')

    const whereIdx = sql.toLowerCase().indexOf('where')
    if (whereIdx !== -1) {
      const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0]
      const conditions = wherePart.split(/\s+and\s+/i)
      let paramIndex = 0

      for (const cond of conditions) {
        const trimmedCond = cond.trim()
        if (trimmedCond.includes('is_active = 1')) {
          query = query.eq('is_active', 1)
        } else if (trimmedCond.includes('is_active = 0')) {
          query = query.eq('is_active', 0)
        } else if (trimmedCond.includes('is_merged = 0')) {
          query = query.eq('is_merged', 0)
        } else if (trimmedCond.includes('is_merged = 1')) {
          query = query.eq('is_merged', 1)
        } else if (trimmedCond.includes('used = 0')) {
          query = query.eq('used', 0)
        } else {
          const match = trimmedCond.match(/([a-z_0-9\.]+)\s*(=|!=|<>|>|<|>=|<=|like|ilike)\s*\?/i)
          if (match && paramIndex < params.length) {
            const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '')
            const op = match[2].toLowerCase()
            const val = params[paramIndex++]

            if (op === '=') {
              query = query.eq(rawCol, val)
            } else if (op === '!=' || op === '<>') {
              query = query.neq(rawCol, val)
            } else if (op === '>') {
              query = query.gt(rawCol, val)
            } else if (op === '>=') {
              query = query.gte(rawCol, val)
            } else if (op === '<') {
              query = query.lt(rawCol, val)
            } else if (op === '<=') {
              query = query.lte(rawCol, val)
            } else if (op === 'like' || op === 'ilike') {
              query = query.ilike(rawCol, val)
            }
          }
        }
      }
    }

    const { data, error } = await query.limit(1).maybeSingle()
    if (error) {
      console.error(`queryOne error on ${table}:`, error.message)
      return null
    }
    return (data || null) as T | null
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
      // 1. Handle stock updates with arithmetic increments/decrements
      if (table === 'branch_token_stocks') {
        const branchMatch = sql.match(/branch_id\s*=\s*\?/i)
        const tokenMatch = sql.match(/token_model\s*=\s*\?/i)
        if (branchMatch && tokenMatch) {
          // Identify branch_id and token_model in params
          // Standard pattern: [qty, branch_id, token_model] or [qty, qty, branch_id, token_model]
          const branchId = params[params.length - 2]
          const tokenModel = params[params.length - 1]

          const { data: currentStock } = await supabase
            .from('branch_token_stocks')
            .select('*')
            .eq('branch_id', branchId)
            .eq('token_model', tokenModel)
            .maybeSingle()

          if (currentStock) {
            let newQty = currentStock.quantity_on_hand
            let newDamaged = currentStock.quarantine_damaged

            if (sql.includes('quantity_on_hand = quantity_on_hand - ?')) {
              newQty -= Number(params[0])
            } else if (sql.includes('quantity_on_hand = quantity_on_hand + ?')) {
              newQty += Number(params[0])
            }

            if (sql.includes('quarantine_damaged = quarantine_damaged + ?')) {
              newDamaged += Number(params[1])
            }

            await supabase
              .from('branch_token_stocks')
              .update({ quantity_on_hand: newQty, quarantine_damaged: newDamaged })
              .eq('branch_id', branchId)
              .eq('token_model', tokenModel)

            return { lastID: 0, changes: 1 }
          }
        }
      }

      // 2. Standard update parsing with multiple WHERE conditions
      const setMatch = sql.match(/set\s+([\s\S]+?)\s+where/i)
      const whereMatch = sql.match(/where\s+([\s\S]+)$/i)
      if (setMatch && whereMatch) {
        // Split by comma outside parentheses
        const setStr = setMatch[1].trim()
        const setParts: string[] = []
        let current = ''
        let depth = 0

        for (let i = 0; i < setStr.length; i++) {
          const char = setStr[i]
          if (char === '(') depth++
          else if (char === ')') depth--

          if (char === ',' && depth === 0) {
            setParts.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        if (current.trim()) {
          setParts.push(current.trim())
        }

        const row: Record<string, any> = {}
        let paramIdx = 0

        for (const sp of setParts) {
          const eqIdx = sp.indexOf('=')
          if (eqIdx === -1) continue
          const col = sp.substring(0, eqIdx).trim()
          
          // Check if this SET clause has a placeholder '?'
          if (sp.includes('?')) {
            const val = params[paramIdx++]
            // Skip updating with null/undefined if it is wrapped in COALESCE
            if (sp.toLowerCase().includes('coalesce(') && (val === undefined || val === null)) {
              continue
            }
            row[col] = val
          } else {
            // Expression like updated_at = CURRENT_TIMESTAMP or updated_at = NOW()
            if (col === 'updated_at') {
              row[col] = new Date().toISOString()
            }
          }
        }

        let query = supabase.from(table).update(row)
        const whereConditions = whereMatch[1].split(/\s+and\s+/i)

        for (const wc of whereConditions) {
          const match = wc.match(/([a-z_0-9\.]+)\s*(=|!=|<>)\s*\?/i)
          if (match && paramIdx < params.length) {
            const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '')
            query = query.eq(rawCol, params[paramIdx++])
          }
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
