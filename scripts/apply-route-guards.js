const fs = require('fs');
let api = fs.readFileSync('src/server/routes/api.ts', 'utf8');

const replacements = [
  // Partners
  ["apiRouter.get('/partners', async", "apiRouter.get('/partners', requirePermission('partners', 'can_view'), async"],
  ["apiRouter.get('/partners/:id', async", "apiRouter.get('/partners/:id', requirePermission('partners', 'can_view'), async"],
  ["apiRouter.post('/partners', async", "apiRouter.post('/partners', requirePermission('partners', 'can_create'), async"],

  // DSC
  ["apiRouter.get('/dsc/catalog', async", "apiRouter.get('/dsc/catalog', requireAuth, async"],
  ["apiRouter.get('/dsc/applications', async", "apiRouter.get('/dsc/applications', requirePermission('dsc', 'can_view'), async"],
  ["apiRouter.post('/dsc/applications', async", "apiRouter.post('/dsc/applications', requirePermission('dsc', 'can_create'), async"],
  ["apiRouter.patch('/dsc/applications/:id/stage', async", "apiRouter.patch('/dsc/applications/:id/stage', requirePermission('dsc', 'can_edit'), async"],

  // Inventory
  ["apiRouter.get('/inventory/batches', async", "apiRouter.get('/inventory/batches', requirePermission('inventory', 'can_view'), async"],
  ["apiRouter.get('/inventory/branches', async", "apiRouter.get('/inventory/branches', requirePermission('inventory', 'can_view'), async"],
  ["apiRouter.get('/inventory/transfers', async", "apiRouter.get('/inventory/transfers', requirePermission('inventory', 'can_view'), async"],
  ["apiRouter.get('/inventory/transfers/pdf', async", "apiRouter.get('/inventory/transfers/pdf', requirePermission('inventory', 'can_view'), async"],

  // CRM
  ["apiRouter.get('/crm/leads', async", "apiRouter.get('/crm/leads', requirePermission('crm', 'can_view'), async"],
  ["apiRouter.post('/crm/leads/check-duplicate', async", "apiRouter.post('/crm/leads/check-duplicate', requirePermission('crm', 'can_view'), async"],
  ["apiRouter.post('/crm/leads', async", "apiRouter.post('/crm/leads', requirePermission('crm', 'can_create'), async"],
  ["apiRouter.put('/crm/leads/:id', async", "apiRouter.put('/crm/leads/:id', requirePermission('crm', 'can_edit'), async"],
  ["apiRouter.get('/crm/follow-ups', async", "apiRouter.get('/crm/follow-ups', requirePermission('crm', 'can_view'), async"],
  ["apiRouter.get('/crm/lead-sources', async", "apiRouter.get('/crm/lead-sources', requireAuth, async"],

  // Services
  ["apiRouter.get('/services/orders', async", "apiRouter.get('/services/orders', requirePermission('services', 'can_view'), async"],
  ["apiRouter.post('/services/orders', async", "apiRouter.post('/services/orders', requirePermission('services', 'can_create'), async"],

  // Billing
  ["apiRouter.get('/billing/accounts', async", "apiRouter.get('/billing/accounts', requirePermission('billing', 'can_view'), async"],
  ["apiRouter.get('/billing/series', async", "apiRouter.get('/billing/series', requirePermission('billing', 'can_view'), async"],
  ["apiRouter.get('/billing/invoices', async", "apiRouter.get('/billing/invoices', requirePermission('billing', 'can_view'), async"],
  ["apiRouter.get('/billing/payments/queue', async", "apiRouter.get('/billing/payments/queue', requirePermission('billing', 'can_view'), async"],

  // Courier
  ["apiRouter.get('/courier/dispatches', async", "apiRouter.get('/courier/dispatches', requirePermission('courier', 'can_view'), async"],
  ["apiRouter.post('/courier/dispatches', async", "apiRouter.post('/courier/dispatches', requirePermission('courier', 'can_create'), async"],
  ["apiRouter.patch('/courier/dispatches/:id/status', async", "apiRouter.patch('/courier/dispatches/:id/status', requirePermission('courier', 'can_edit'), async"],

  // Admin masters/settings GET
  ["apiRouter.get('/admin/settings/company', async", "apiRouter.get('/admin/settings/company', requireAuth, async"],
  ["apiRouter.get('/admin/settings/tokens', async", "apiRouter.get('/admin/settings/tokens', requireAuth, async"],
  ["apiRouter.get('/admin/settings/couriers', async", "apiRouter.get('/admin/settings/couriers', requireAuth, async"],
  ["apiRouter.get('/admin/settings/services', async", "apiRouter.get('/admin/settings/services', requireAuth, async"],
  ["apiRouter.get('/admin/masters/ca', async", "apiRouter.get('/admin/masters/ca', requireAuth, async"],
  ["apiRouter.get('/admin/masters/vendors', async", "apiRouter.get('/admin/masters/vendors', requireAuth, async"],
  ["apiRouter.get('/admin/masters/reasons', async", "apiRouter.get('/admin/masters/reasons', requireAuth, async"],
  ["apiRouter.get('/admin/branches', async", "apiRouter.get('/admin/branches', requireAuth, async"]
];

let applied = 0;
for (const [target, repl] of replacements) {
  if (api.includes(target)) {
    api = api.replace(target, repl);
    applied++;
  } else {
    console.log('Target not found:', target);
  }
}

fs.writeFileSync('src/server/routes/api.ts', api, 'utf8');
console.log('Applied ' + applied + ' / ' + replacements.length + ' route protections.');

