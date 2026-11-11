import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Look at line with active indicator list
const lines = content.split('\n')
const idx = lines.findIndex(l => l.includes('Active:'))
console.log('--- Lines around Active indicator list ---')
console.log(lines.slice(idx, idx + 35).join('\n'))

