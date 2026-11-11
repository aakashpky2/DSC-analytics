import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Find sales-estimates in page.tsx
const lines = content.split('\n')
lines.forEach((l, idx) => {
  if (l.includes('sales-estimates') || l.includes('sales-invoices')) {
    console.log(`${idx + 1}: ${l.trim().slice(0, 100)}`)
  }
})

