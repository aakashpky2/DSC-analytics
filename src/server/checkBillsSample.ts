import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check the table structures for bills, orders, inwards, couriers
const lines = content.split('\n')
const billsStart = lines.findIndex(l => l.includes("activeTab === 'bills'"))
console.log('--- Bills section sample (lines', billsStart + 1, 'to', billsStart + 60, ') ---')
console.log(lines.slice(billsStart, billsStart + 60).join('\n'))

