import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 3950 to 4100
const lines = content.split('\n')
console.log('--- Lines 3950-4100 ---')
console.log(lines.slice(3949, 4100).join('\n'))

