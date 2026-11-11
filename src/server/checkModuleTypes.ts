import fs from 'fs'

let content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 25 to 40
console.log(content.split('\n').slice(24, 40).join('\n'))

