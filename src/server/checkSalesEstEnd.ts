import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')
const lines = content.split('\n')
console.log('--- Lines 2160 to 2235 ---')
console.log(lines.slice(2159, 2235).join('\n'))

