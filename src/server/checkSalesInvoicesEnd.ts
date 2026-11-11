import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Look around line 1714 (sales-invoices) and line 1846 (customer-analytics)
const lines = content.split('\n')
console.log('--- Lines 1820-1860 ---')
console.log(lines.slice(1819, 1860).join('\n'))

