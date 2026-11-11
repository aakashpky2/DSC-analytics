import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')
const lines = content.split('\n')

const regex = /\{\s*activeTab === ['"]([^'"]+)['"]/
lines.forEach((line, idx) => {
  const match = regex.exec(line)
  if (match) {
    console.log(`Line ${idx + 1}: activeTab === '${match[1]}'`)
  }
})

