const fs = require('fs');
const content = fs.readFileSync('src/server/routes/api.ts', 'utf8');
const endpoints = ['/partners', '/dsc/applications', '/crm/leads', '/admin/users', '/billing/invoices', '/courier/dispatches', '/billing/payments/queue', '/services/orders'];

for (const ep of endpoints) {
  const needle = "apiRouter.get('" + ep + "'";
  const idx = content.indexOf(needle);
  if (idx !== -1) {
    const chunk = content.slice(idx, idx + 800);
    console.log('=== ' + ep + ' ===');
    const maskLines = chunk.split('\n').filter(l => l.includes('mask') || l.includes('applyPiiMasking'));
    console.log(maskLines.join('\n') || 'NO MASKING LOGIC');
  } else {
    console.log('=== ' + ep + ' === NOT FOUND');
  }
}

