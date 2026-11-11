import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

const regex = /\{\s*activeTab === ['"]([^'"]+)['"]/g
let match
const activeTabConditions = new Set<string>()
while ((match = regex.exec(content)) !== null) {
  activeTabConditions.add(match[1])
}

console.log('All activeTab conditions in JSX:')
Array.from(activeTabConditions).sort().forEach(t => console.log(' - ' + t))

