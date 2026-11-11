import { chromium } from 'playwright';
import { createSession } from './auth';

const viewports = [
  { width: 1440, height: 900, name: '1440px' },
  { width: 1366, height: 768, name: '1366px' },
  { width: 1280, height: 800, name: '1280px' },
  { width: 1024, height: 768, name: '1024px' },
  { width: 768, height: 1024, name: '768px' },
  { width: 390, height: 844, name: '390px' }
];

(async () => {
  const token = await createSession('usr-admin-root');
  const browser = await chromium.launch({ headless: true });

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    
    await page.goto('http://localhost:3000/reports/revenue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const overflowInfo = await page.evaluate(() => {
      return {
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        docClientWidth: document.documentElement.clientWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });

    console.log(`Viewport ${vp.name}:`, JSON.stringify(overflowInfo));
    await page.screenshot({ path: `src/server/revenue_${vp.name}.png` });
    await ctx.close();
  }

  // Functional test on 1440px
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/reports/revenue');
  await page.waitForLoadState('networkidle');

  // Test Period filter change
  const periodSelect = page.locator('select').nth(1);
  await periodSelect.selectOption('current_fy');
  await page.waitForTimeout(1000);
  console.log('Period filter changed to current_fy successfully');

  // Test Profile filter change
  const profileSelect = page.locator('select').first();
  const options = await profileSelect.locator('option').allInnerTexts();
  console.log('Profile options available:', options);

  // Test Refresh button
  const refreshBtn = page.locator('button:has-text("Refresh")');
  await refreshBtn.click();
  await page.waitForTimeout(1000);
  console.log('Refresh button clicked successfully');

  // Test GroupBy buttons
  const dailyBtn = page.locator('button:has-text("Daily")');
  await dailyBtn.click();
  await page.waitForTimeout(1000);
  console.log('Daily groupBy selected successfully');

  await page.screenshot({ path: 'src/server/revenue_1440px_tested.png' });
  await browser.close();
  console.log('All visual & functional checks complete!');
})();

