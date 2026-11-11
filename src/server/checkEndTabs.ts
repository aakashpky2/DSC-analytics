import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check lines 3680 to end of file to see what tabs are rendered near the end
const lines = content.split('\n')
console.log('--- Lines 3680-3800 ---')
console.log(lines.slice(3679, 3800).join('\n'))

