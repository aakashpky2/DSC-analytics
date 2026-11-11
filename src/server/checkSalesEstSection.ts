import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')
const lines = content.split('\n')
console.log('--- Lines 2120 to 2160 ---')
console.log(lines.slice(2119, 2160).join('\n'))

