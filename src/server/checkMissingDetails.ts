import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's see how receipts, inwards, couriers etc. are rendered.
const missing = ['quotes', 'sales-payments', 'vendors', 'estimates', 'profiles', 'locations']
console.log('Total length of page.tsx:', content.split('\n').length)

// Check if quotes, vendors, etc. are used anywhere in the JSX
missing.forEach(m => {
  const count = (content.match(new RegExp(m, 'g')) || []).length
  console.log(`Word count for ${m}:`, count)
})

