import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')
const lines = content.split('\n')
console.log('--- Lines 2050-2100 ---')
console.log(lines.slice(2049, 2100).join('\n'))

