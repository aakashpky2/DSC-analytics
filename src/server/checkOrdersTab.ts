import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's inspect activeTab === 'orders'
const lines = content.split('\n')
console.log('--- Lines 949 - 1000 ---')
console.log(lines.slice(948, 1000).join('\n'))

