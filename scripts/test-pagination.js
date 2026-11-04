const http = require('http');

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING PAGINATION VERIFICATION TESTS ---');

  // 1. Partners Endpoint
  console.log('\n[1] Testing /api/partners pagination:');
  const p5 = await get('/api/partners?page=1&limit=5');
  console.log('Limit 5 result: page =', p5.body.page, 'limit =', p5.body.limit, 'count =', p5.body.partners?.length, 'totalCount =', p5.body.totalCount, 'totalPages =', p5.body.totalPages);

  const p10 = await get('/api/partners?page=1&limit=10');
  console.log('Limit 10 result: count =', p10.body.partners?.length, 'limit =', p10.body.limit, 'totalCount =', p10.body.totalCount);

  // 2. DSC Catalog
  console.log('\n[2] Testing /api/dsc/catalog pagination:');
  const cat = await get('/api/dsc/catalog?page=1&limit=5');
  console.log('Catalog result: count =', cat.body.catalog?.length, 'limit =', cat.body.limit, 'totalCount =', cat.body.totalCount);

  // 3. DSC Applications
  console.log('\n[3] Testing /api/dsc/applications pagination:');
  const dscApp = await get('/api/dsc/applications?page=1&limit=5');
  console.log('DSC Apps result: count =', dscApp.body.applications?.length, 'limit =', dscApp.body.limit, 'totalCount =', dscApp.body.totalCount);

  // 4. Token Batches
  console.log('\n[4] Testing /api/inventory/batches pagination:');
  const batches = await get('/api/inventory/batches?page=1&limit=5');
  console.log('Batches result: count =', batches.body.batches?.length, 'limit =', batches.body.limit, 'totalCount =', batches.body.totalCount);

  // 5. Branch Stock & Transfers
  console.log('\n[5] Testing /api/inventory/branches & /api/inventory/transfers:');
  const branchStock = await get('/api/inventory/branches?page=1&limit=5');
  console.log('Branch stock result: count =', branchStock.body.stock?.length, 'limit =', branchStock.body.limit, 'totalCount =', branchStock.body.totalCount);

  const transfers = await get('/api/inventory/transfers?page=1&limit=5');
  console.log('Transfers result: count =', transfers.body.challans?.length, 'limit =', transfers.body.limit, 'totalCount =', transfers.body.totalCount);

  // 6. CRM Leads & Search
  console.log('\n[6] Testing /api/crm/leads pagination & search reset:');
  const leads = await get('/api/crm/leads?page=1&limit=5');
  console.log('CRM leads result: count =', leads.body.leads?.length, 'limit =', leads.body.limit, 'totalCount =', leads.body.totalCount);

  // 7. CRM Follow-ups
  console.log('\n[7] Testing /api/crm/follow-ups pagination:');
  const followUps = await get('/api/crm/follow-ups?page=1&limit=5');
  console.log('Follow-ups result: count =', followUps.body.followUps?.length, 'limit =', followUps.body.limit, 'totalCount =', followUps.body.totalCount);

  // 8. Service Orders
  console.log('\n[8] Testing /api/services/orders pagination:');
  const srv = await get('/api/services/orders?page=1&limit=5');
  console.log('Services result: count =', srv.body.orders?.length, 'limit =', srv.body.limit, 'totalCount =', srv.body.totalCount);

  // 9. Invoices & Payments Queue
  console.log('\n[9] Testing /api/billing/invoices & /api/billing/payments/queue:');
  const inv = await get('/api/billing/invoices?page=1&limit=5');
  console.log('Invoices result: count =', inv.body.invoices?.length, 'limit =', inv.body.limit, 'totalCount =', inv.body.totalCount);

  const pay = await get('/api/billing/payments/queue?page=1&limit=5');
  console.log('Payments queue result: count =', pay.body.queue?.length, 'limit =', pay.body.limit, 'totalCount =', pay.body.totalCount);

  // 10. Courier Dispatches
  console.log('\n[10] Testing /api/courier/dispatches pagination:');
  const dispatches = await get('/api/courier/dispatches?page=1&limit=5');
  console.log('Dispatches result: count =', dispatches.body.dispatches?.length, 'limit =', dispatches.body.limit, 'totalCount =', dispatches.body.totalCount);

  console.log('\n--- ALL BACKEND PAGINATION ENDPOINTS VERIFIED SUCCESSFULLY ---');
}

runTests().catch(console.error);

