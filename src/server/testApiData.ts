import fs from 'fs'

// Let's inspect how quotes, estimates, profiles, locations, vendors, sales-payments are structured in the database / API
// We can query the existing API or database to see sample rows
async function test() {
  const [qRes, eRes, pRes, lRes, vRes, spRes] = await Promise.all([
    fetch('http://localhost:3000/api/token-procurement/quotes').then(r => r.json()).catch(e => ({ error: e.message })),
    fetch('http://localhost:3000/api/token-procurement/estimates').then(r => r.json()).catch(e => ({ error: e.message })),
    fetch('http://localhost:3000/api/token-procurement/internal-profiles').then(r => r.json()).catch(e => ({ error: e.message })),
    fetch('http://localhost:3000/api/token-procurement/delivery-locations').then(r => r.json()).catch(e => ({ error: e.message })),
    fetch('http://localhost:3000/api/token-procurement/parties').then(r => r.json()).catch(e => ({ error: e.message })),
    fetch('http://localhost:3000/api/token-sales/payments').then(r => r.json()).catch(e => ({ error: e.message }))
  ])

  console.log('qRes keys:', Object.keys(qRes), 'sample:', qRes.quotes?.[0])
  console.log('eRes keys:', Object.keys(eRes), 'sample:', eRes.estimates?.[0])
  console.log('pRes keys:', Object.keys(pRes), 'sample:', pRes.profiles?.[0])
  console.log('lRes keys:', Object.keys(lRes), 'sample:', lRes.locations?.[0])
  console.log('vRes keys:', Object.keys(vRes), 'sample:', vRes.parties?.[0])
  console.log('spRes keys:', Object.keys(spRes), 'sample:', spRes.payments?.[0])
}

test()

