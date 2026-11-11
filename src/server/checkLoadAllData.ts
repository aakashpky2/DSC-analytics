import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check where quotes, parties, estimates, profiles, locations were fetched
// In loadAllData:
const lines = content.split('\n')
console.log('--- Lines 380-440 ---')
console.log(lines.slice(379, 440).join('\n'))

