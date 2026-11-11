import { queryAll, run } from './supabase'

async function checkColumns() {
  const sample = await queryAll('SELECT * FROM user_profiles LIMIT 1')
  console.log('user_profiles keys:', sample.length > 0 ? Object.keys(sample[0]) : 'empty')

  // Check if we can alter table to add columns or if we already have columns
  // Let's test checking column existence
  try {
    const res = await queryAll('SELECT employee_code, password_change_required FROM user_profiles LIMIT 1')
    console.log('Columns employee_code and password_change_required exist!', res)
  } catch (err: any) {
    console.log('Columns test error:', err.message)
  }
}

checkColumns()

