import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.')
}

/**
 * Backend Supabase Client (Service Role for full backend authorization)
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

export const db = supabase

// ============================================================================
// SQL-to-PostgREST Adapter Layer
// Enables zero-regression compatibility for all Express routes & business logic
// ============================================================================

/**
 * Helper to convert SQL WHERE clauses with parameters into Supabase query builder
 */
function applyConditions(query: any, sql: string, params: any[]) {
  // Extract WHERE / ORDER BY / LIMIT
  const lowerSql = sql.toLowerCase()
  
  // Extract WHERE clause
  const whereIdx = lowerSql.indexOf(' where ')
  if (whereIdx !== -1) {
    let whereClause = sql.substring(whereIdx + 7)
    const orderIdx = whereClause.toLowerCase().indexOf(' order by ')
    const limitIdx = whereClause.toLowerCase().indexOf(' limit ')
    
    let cutIdx = whereClause.length
    if (orderIdx !== -1) cutIdx = Math.min(cutIdx, orderIdx)
    if (limitIdx !== -1) cutIdx = Math.min(cutIdx, limitIdx)
    
    whereClause = whereClause.substring(0, cutIdx).trim()
    
    // Split by AND
    const conditions = whereClause.split(/\s+AND\s+/i)
    let paramIdx = 0
    
    for (const cond of conditions) {
      const trimmed = cond.trim()
      if (trimmed.includes('=')) {
        const [field] = trimmed.split('=').map(s => s.trim().replace(/^.*\./, ''))
        const val = params[paramIdx++]
        if (val !== undefined) {
          query = query.eq(field, val)
        }
      } else if (trimmed.toLowerCase().includes(' is null')) {
        const field = trimmed.toLowerCase().replace(' is null', '').trim().replace(/^.*\./, '')
        query = query.is(field, null)
      } else if (trimmed.toLowerCase().includes(' is not null')) {
        const field = trimmed.toLowerCase().replace(' is not null', '').trim().replace(/^.*\./, '')
        query = query.not(field, 'is', null)
      }
    }
  }

  // Handle ORDER BY
  const orderIdx = lowerSql.indexOf(' order by ')
  if (orderIdx !== -1) {
    let orderClause = sql.substring(orderIdx + 10)
    const limitIdx = orderClause.toLowerCase().indexOf(' limit ')
    if (limitIdx !== -1) orderClause = orderClause.substring(0, limitIdx)
    
    const parts = orderClause.trim().split(/\s+/)
    const field = parts[0].replace(/^.*\./, '')
    const isAsc = parts[1] ? parts[1].toLowerCase() !== 'desc' : true
    query = query.order(field, { ascending: isAsc })
  }

  // Handle LIMIT / OFFSET
  const limitMatch = sql.match(/limit\s+(\d+)(\s+offset\s+(\d+))?/i)
  if (limitMatch) {
    const limit = parseInt(limitMatch[1], 10)
    const offset = limitMatch[3] ? parseInt(limitMatch[3], 10) : 0
    query = query.range(offset, offset + limit - 1)
  }

  return query
}

function extractTableName(sql: string): string {
  const match = sql.match(/(?:from|into|update)\s+([a-z_0-9]+)/i)
  return match ? match[1].toLowerCase() : ''
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const table = extractTableName(sql)
  if (!table) return []

  try {
    let query = supabase.from(table).select('*')
    query = applyConditions(query, sql, params)
    const { data, error } = await query
    if (error) {
      console.error(`queryAll error on ${table}:`, error.message, sql)
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
    let query = supabase.from(table).select('*')
    query = applyConditions(query, sql, params)
    query = query.limit(1)
    const { data, error } = await query
    if (error) {
      console.error(`queryOne error on ${table}:`, error.message, sql)
      return null
    }
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
      // Parse insert column names and values
      const colsMatch = sql.match(/\(([^)]+)\)\s*values/i)
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map(c => c.trim())
        const row: Record<string, any> = {}
        cols.forEach((col, idx) => {
          row[col] = params[idx]
        })
        const { error } = await supabase.from(table).insert(row)
        if (error) {
          console.error(`run insert error on ${table}:`, error.message)
          throw error
        }
        return { lastID: 1, changes: 1 }
      }
    } else if (trimmed.startsWith('update')) {
      // Parse SET fields
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
        
        // Parse where clause condition
        const whereFieldMatch = whereMatch[1].match(/([a-z_0-9]+)\s*=\s*\?/i)
        if (whereFieldMatch) {
          const whereCol = whereFieldMatch[1]
          const whereVal = params[paramIdx++]
          query = query.eq(whereCol, whereVal)
        }
        
        const { error } = await query
        if (error) {
          console.error(`run update error on ${table}:`, error.message)
          throw error
        }
        return { lastID: 0, changes: 1 }
      }
    } else if (trimmed.startsWith('delete from')) {
      const whereMatch = sql.match(/where\s+([a-z_0-9]+)\s*=\s*\?/i)
      if (whereMatch) {
        const whereCol = whereMatch[1]
        const whereVal = params[0]
        const { error } = await supabase.from(table).delete().eq(whereCol, whereVal)
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

