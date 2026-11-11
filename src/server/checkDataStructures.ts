import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's check the structure of quotes, sales-payments, vendors, estimates, profiles, locations
console.log('quotes item sample:', content.match(/quotes\[0\]/))
console.log('estimates item sample:', content.match(/estimates\[0\]/))
console.log('profiles item sample:', content.match(/profiles\[0\]/))
console.log('locations item sample:', content.match(/locations\[0\]/))

