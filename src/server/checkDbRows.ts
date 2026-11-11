import { queryAll } from './supabase'

async function checkRows() {
  const [quotes, estimates, profiles, locations, parties, salesPayments] = await Promise.all([
    queryAll('SELECT * FROM token_vendor_quotes LIMIT 2'),
    queryAll('SELECT * FROM token_purchase_estimates LIMIT 2'),
    queryAll('SELECT * FROM purchase_internal_profiles LIMIT 2'),
    queryAll('SELECT * FROM purchase_delivery_locations LIMIT 2'),
    queryAll('SELECT * FROM token_purchase_parties WHERE is_active = true LIMIT 2'),
    queryAll('SELECT * FROM token_sales_payments LIMIT 2')
  ])

  console.log('Quotes:', quotes)
  console.log('Estimates:', estimates)
  console.log('Profiles:', profiles)
  console.log('Locations:', locations)
  console.log('Parties:', parties)
  console.log('SalesPayments:', salesPayments)
  process.exit(0)
}

checkRows()
