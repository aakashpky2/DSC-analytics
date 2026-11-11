import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's find every occurrence of "estimates" and "quotes" and "parties" and "profiles" and "locations"
const lines = content.split('\n')
const checkTabs = ['quotes', 'sales-payments', 'vendors', 'estimates', 'profiles', 'locations']

checkTabs.forEach(t => {
  console.log(`Checking ${t}:`)
  lines.forEach((line, idx) => {
    if (line.includes(`'${t}'`) || line.includes(`"${t}"`)) {
      console.log(`  Line ${idx + 1}: ${line.trim()}`)
    }
  })
})

