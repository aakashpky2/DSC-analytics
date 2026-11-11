const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Set session cookie directly using createSession
  const { createSession } = require('./dist-server/server/auth');
  const token = await createSession('usr-admin-root');
  
  await context.addCookies([
    {
      name: 'signsync_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }
  ]);

  const page = await context.newPage();
  
  // Go to /dsc/direct
  await page.goto('http://localhost:3000/dsc/direct', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'src/server/inspect_direct_live.png' });
  
  // Click Operational Reports tab
  const reportsTab = page.locator('button', { hasText: 'Operational Reports' });
  if (await reportsTab.count() > 0) {
    await reportsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'src/server/inspect_reports_live.png' });
  }

  // Go to /inventory/procurement
  await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const purchaseBillsTab = page.locator('button', { hasText: 'Purchase Bills' });
  if (await purchaseBillsTab.count() > 0) {
    await purchaseBillsTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'src/server/inspect_procurement_bills_live.png' });
  }
  
  await browser.close();
  console.log('Screenshots captured successfully with session');
})().catch(err => console.error(err));
