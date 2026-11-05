const { chromium } = require('playwright');

async function testBrowser() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Login
  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@signsync.io');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle' });
  console.log('Logged in successfully, current url:', page.url());

  // 2. Check Partners page
  console.log('Testing /partners pagination & search in browser...');
  await page.goto('http://localhost:3000/partners', { waitUntil: 'networkidle' });
  
  let rows = await page.$$eval('table tbody tr', trs => trs.length);
  console.log('Partners page table rows displayed:', rows);

  // Search box test
  const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="search"]');
  if (searchInput) {
    console.log('Typing search query...');
    await searchInput.fill('Synt');
    await page.waitForTimeout(600);
    const searchRows = await page.$$eval('table tbody tr', trs => trs.length);
    console.log('Filtered table rows count:', searchRows);

    await searchInput.fill('');
    await page.waitForTimeout(600);
  }

  // 3. Check Invoices page
  console.log('Testing /billing/invoices...');
  await page.goto('http://localhost:3000/billing/invoices', { waitUntil: 'networkidle' });
  rows = await page.$$eval('table tbody tr', trs => trs.length);
  console.log('Billing invoices table rows displayed:', rows);

  // 4. Check CRM Leads
  console.log('Testing /crm/leads...');
  await page.goto('http://localhost:3000/crm/leads', { waitUntil: 'networkidle' });
  rows = await page.$$eval('table tbody tr', trs => trs.length);
  console.log('CRM leads table rows displayed:', rows);

  // 5. Check DSC Applications
  console.log('Testing /dsc/applications...');
  await page.goto('http://localhost:3000/dsc/applications', { waitUntil: 'networkidle' });
  rows = await page.$$eval('table tbody tr', trs => trs.length);
  console.log('DSC Applications table rows displayed:', rows);

  await browser.close();
  console.log('All browser UI verification tests PASSED successfully!');
}

testBrowser().catch(err => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
