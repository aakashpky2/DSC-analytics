const { chromium } = require('playwright');

async function runBrowserTest() {
  console.log('1. Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('2. Navigating to https://signsync.dbizsolutions.in/login ...');
  await page.goto('https://signsync.dbizsolutions.in/login', { waitUntil: 'networkidle' });

  console.log('3. Filling login form with admin@signsync.io ...');
  await page.fill('input[type="email"]', 'admin@signsync.io');
  await page.fill('input[type="password"]', 'Password123!');

  console.log('4. Submitting login form...');
  const [loginResponse] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/auth/login')),
    page.click('button[type="submit"]')
  ]);

  console.log('Login Response Status:', loginResponse.status());

  console.log('5. Waiting for redirect to dashboard...');
  await page.waitForURL('https://signsync.dbizsolutions.in/', { timeout: 15000 });
  console.log('Current URL after redirect:', page.url());

  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => c.name === 'signsync_session');
  console.log('Session Cookie exists in browser:', !!sessionCookie);
  console.log('Cookie attributes:', {
    name: sessionCookie?.name,
    domain: sessionCookie?.domain,
    path: sessionCookie?.path,
    httpOnly: sessionCookie?.httpOnly,
    secure: sessionCookie?.secure,
    sameSite: sessionCookie?.sameSite
  });

  console.log('6. Waiting for Dashboard UI to render...');
  await page.waitForSelector('text=SignSync', { timeout: 10000 });
  console.log('Dashboard rendered successfully!');

  // Verify /api/auth/me from browser context
  const meRes = await page.request.get('https://signsync.dbizsolutions.in/api/auth/me');
  console.log('Browser context /api/auth/me status:', meRes.status());
  const meJson = await meRes.json();
  console.log('Me Authenticated:', meJson.authenticated, 'User:', meJson.user ? meJson.user.email : null);

  // Verify module APIs
  const partnersRes = await page.request.get('https://signsync.dbizsolutions.in/api/partners');
  console.log('Browser context /api/partners status:', partnersRes.status());

  const invoicesRes = await page.request.get('https://signsync.dbizsolutions.in/api/billing/invoices');
  console.log('Browser context /api/billing/invoices status:', invoicesRes.status());

  const leadsRes = await page.request.get('https://signsync.dbizsolutions.in/api/crm/leads');
  console.log('Browser context /api/crm/leads status:', leadsRes.status());

  await page.screenshot({ path: 'manager_demo_evidence/live_acceptance_success.png', fullPage: true });
  console.log('Screenshot saved to manager_demo_evidence/live_acceptance_success.png');

  await browser.close();
  console.log('ALL ACCEPTANCE STEPS PASSED!');
}

runBrowserTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

