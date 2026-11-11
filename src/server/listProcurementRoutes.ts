import fs from 'fs'

const content = fs.readFileSync('src/server/routes/tokenProcurement.ts', 'utf8')
const lines = content.split('\n')

const regex = /procurementRouter\.(get|post|put|delete)\(['"]([^'"]+)['"]/
lines.forEach((l, idx) => {
  const match = regex.exec(l)
  if (match) {
    console.log(`${match[1].toUpperCase()} ${match[2]}`)
  }
})

