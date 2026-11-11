import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 930 to 955 to see the end of calculator and start of orders
const lines = content.split('\n')
const calcEnd = lines.findIndex(l => l.includes("activeTab === 'orders'"))
console.log('--- Lines', calcEnd - 20, 'to', calcEnd + 10, '---')
console.log(lines.slice(calcEnd - 20, calcEnd + 10).join('\n'))

