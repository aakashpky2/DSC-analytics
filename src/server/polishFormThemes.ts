import fs from 'fs'

function cleanFile(filePath: string) {
  let c = fs.readFileSync(filePath, 'utf8')
  c = c.replace(/bg-slate-950 bg-slate-950/g, 'bg-slate-950')
  c = c.replace(/border-purple-800\/60/g, 'border-slate-800 bg-slate-950')
  c = c.replace(/border-amber-300/g, 'border-slate-800 bg-slate-950')

  // In <select ...>, ensure it always has: bg-slate-950 text-white border border-slate-800
  c = c.replace(/<select\b([^>]*?)className="([^"]*?)"/g, (match, before, classes) => {
    let cls = classes
    if (!cls.includes('bg-slate-950')) cls += ' bg-slate-950'
    if (!cls.includes('text-white') && !cls.includes('text-slate-')) cls += ' text-white'
    if (!cls.includes('border-slate-800')) cls += ' border border-slate-800'
    return `<select${before}className="${cls}"`
  })

  // In <option ...>, ensure dark styling
  c = c.replace(/<option\b(?![^>]*className=)/g, '<option className="bg-slate-950 text-white"')

  fs.writeFileSync(filePath, c)
  console.log('Polished:', filePath)
}

cleanFile('src/app/dsc/direct/page.tsx')
cleanFile('src/app/dsc/issuance/page.tsx')
cleanFile('src/app/reports/revenue/page.tsx')

