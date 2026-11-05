const fs = require('fs');
const files = [
  'src/app/dsc/applications/page.tsx',
  'src/app/inventory/tokens/page.tsx',
  'src/app/crm/leads/page.tsx',
  'src/app/services/orders/page.tsx',
  'src/app/billing/invoices/new/page.tsx'
];
for (const f of files) {
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf8');
    const regex = /fetch\((?:'|")([^'"]+)(?:'|")/g;
    const matches = [];
    let m;
    while ((m = regex.exec(c)) !== null) {
      matches.push(m[1]);
    }
    console.log(f, 'fetches:');
    console.log(matches.length > 0 ? [...new Set(matches)].join(', ') : 'None');
  }
}

