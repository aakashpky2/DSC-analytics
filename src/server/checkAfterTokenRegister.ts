import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 3800 to end
const lines = content.split('\n')
console.log('--- Lines 3800-3950 ---')
console.log(lines.slice(3799, 3950).join('\n'))

