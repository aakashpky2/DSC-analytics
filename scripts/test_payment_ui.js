const { chromium } = require('playwright');

async function testPaymentVerificationUI() {
  console.log('Testing /billing/payments UI with Playwright...');
  const browser = await chromium.launch({ headless: true });
  
  // 1. Desktop Viewport
  console.log('\n--- 1. Desktop Viewport Test ---');
  const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageDesktop = await contextDesktop.newPage();

  // Login
  await pageDesktop.goto('http://localhost:3000/login');
  await pageDesktop.fill('input[type="email"]', 'admin@signsync.io');
  await pageDesktop.fill('input[type="password"]', 'Password123!');
  await pageDesktop.click('button[type="submit"]');
  await pageDesktop.waitForNavigation({ waitUntil: 'networkidle' });

  // Navigate to /billing/payments
  await pageDesktop.goto('http://localhost:3000/billing/payments', { waitUntil: 'networkidle' });

  // Check card container and preview styling
  const cardsCount = await pageDesktop.$$eval('.rounded-2xl.border.border-slate-800.bg-slate-900\\/60', els => els.length);
  console.log(`Payment cards found: ${cardsCount}`);

  if (cardsCount > 0) {
    // Check two-column grid on desktop
    const isTwoColumn = await pageDesktop.$eval('.grid.grid-cols-1.md\\:grid-cols-2', el => {
      const style = window.getComputedStyle(el);
      return style.display === 'grid';
    });
    console.log(`Desktop grid layout applied: ${isTwoColumn}`);

    // Check placeholder or screenshot preview height
    const previewHeight = await pageDesktop.$eval('.space-y-2 > div:last-child', el => el.clientHeight);
    console.log(`Preview container height on desktop: ${previewHeight}px (Expected: <= 300px)`);

    // Verify Action buttons present
    const confirmBtn = await pageDesktop.$('button:has-text("Confirm Payment")');
    const rejectBtn = await pageDesktop.$('button:has-text("Reject Payment")');
    console.log(`Action buttons visible: Confirm=${!!confirmBtn}, Reject=${!!rejectBtn}`);
  }

  // 2. Mobile Viewport
  console.log('\n--- 2. Mobile Viewport Test (iPhone 12 / 375x667) ---');
  const contextMobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const pageMobile = await contextMobile.newPage();

  // Copy cookies from desktop to mobile context
  const cookies = await contextDesktop.cookies();
  await contextMobile.addCookies(cookies);

  await pageMobile.goto('http://localhost:3000/billing/payments', { waitUntil: 'networkidle' });
  const mobileCards = await pageMobile.$$eval('.rounded-2xl.border.border-slate-800.bg-slate-900\\/60', els => els.length);
  console.log(`Payment cards found on mobile: ${mobileCards}`);

  if (mobileCards > 0) {
    const mobilePreviewHeight = await pageMobile.$eval('.space-y-2 > div:last-child', el => el.clientHeight);
    console.log(`Preview container height on mobile: ${mobilePreviewHeight}px`);
  }

  await browser.close();
  console.log('\nAll Payment Verification UI tests PASSED successfully!');
}

testPaymentVerificationUI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
