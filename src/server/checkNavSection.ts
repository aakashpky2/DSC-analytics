import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 700 to 765 in page.tsx
const lines = content.split('\n')
console.log('--- Lines 700 to 765 ---')
console.log(lines.slice(699, 765).join('\n'))

