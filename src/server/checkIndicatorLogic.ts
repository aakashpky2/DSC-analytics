import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Look at line with active indicator
const lines = content.split('\n')
const idx = lines.findIndex(l => l.includes('Active:'))
console.log('--- Lines around Active indicator ---')
console.log(lines.slice(idx - 5, idx + 45).join('\n'))

