import fs from 'fs'

const content = fs.readFileSync('src/components/ShellLayout.tsx', 'utf8')

// Check lines containing <main
const lines = content.split('\n')
lines.forEach((l, idx) => {
  if (l.includes('<main') || l.includes('main className')) {
    console.log(`${idx + 1}: ${l}`)
  }
})

