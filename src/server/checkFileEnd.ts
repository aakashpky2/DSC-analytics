import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Check lines 5250 to 5335
const lines = content.split('\n')
console.log('--- Lines 5250 to end ---')
console.log(lines.slice(5249).join('\n'))

