import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')
const lines = content.split('\n')
console.log('--- Lines 2000-2050 ---')
console.log(lines.slice(1999, 2050).join('\n'))

