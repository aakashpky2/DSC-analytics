import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

const terms = ['salesPayments', 'setSalesPayments', 'showSalesPayModal', 'quotes', 'parties', 'estimates', 'profiles', 'locations']
terms.forEach(t => {
  const matches: number[] = []
  content.split('\n').forEach((line, idx) => {
    if (line.includes(t)) matches.push(idx + 1)
  })
  console.log(`${t} found at lines:`, matches.slice(0, 15))
})

