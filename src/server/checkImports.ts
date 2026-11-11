import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 1 to 30
console.log(content.split('\n').slice(0, 30).join('\n'))

