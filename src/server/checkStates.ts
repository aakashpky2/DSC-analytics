import fs from 'fs'

const content = fs.readFileSync('src/app/inventory/procurement/page.tsx', 'utf8')

// Let's inspect where quotes, estimates, profiles, locations, parties are managed in the code
console.log('Quotes state initialized:', content.includes('const [quotes, setQuotes]'))
console.log('Estimates state initialized:', content.includes('const [estimates, setEstimates]'))
console.log('Profiles state initialized:', content.includes('const [profiles, setProfiles]'))
console.log('Locations state initialized:', content.includes('const [locations, setLocations]'))
console.log('SalesPayments state initialized:', content.includes('const [salesPayments, setSalesPayments]'))

