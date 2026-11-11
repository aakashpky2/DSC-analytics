import { queryAll } from './supabase'

async function checkMoreTables() {
  const [payments, invoices] = await Promise.all([
    queryAll('SELECT * FROM token_sales_payments LIMIT 5'),
    queryAll('SELECT * FROM token_sales_invoices LIMIT 5')
  ])
  console.log('token_sales_payments:', payments)
  console.log('token_sales_invoices:', invoices)
  process.exit(0)
}

checkMoreTables()

