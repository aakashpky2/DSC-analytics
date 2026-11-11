import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

const terms = ['quotes', 'sales-payments', 'vendors', 'estimates', 'profiles', 'locations']
for (const term of terms) {
  const lines: string[] = []
  content.split('\n').forEach((l, idx) => {
    if (l.includes(term)) {
      lines.push(`${idx + 1}: ${l.trim().slice(0, 100)}`)
    }
  })
  console.log(`=== Matches for ${term} ===`)
  console.log(lines.slice(0, 10).join('\n'))
}

