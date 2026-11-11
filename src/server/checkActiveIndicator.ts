import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 740 to 800
const lines = content.split('\n')
console.log('--- Lines 740 to 800 ---')
console.log(lines.slice(739, 800).join('\n'))

