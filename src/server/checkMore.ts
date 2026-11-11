import { queryAll } from './supabase'

async function checkMoreTables() {
  const candidates = [
    'partners',
    'customer_pricing_categories',
    'purchase_internal_profiles',
    'app_master_states'
  ]
  for (const c of candidates) {
    try {
      const rows = await queryAll(`SELECT * FROM ${c} LIMIT 2`)
      console.log(`Table ${c} count: ${rows.length}, keys:`, rows.length > 0 ? Object.keys(rows[0]) : 'empty')
    } catch (e: any) {
      console.log(`Table ${c} error:`, e.message)
    }
  }
}
checkMoreTables()

