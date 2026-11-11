import { chromium } from 'playwright';
import { createSession } from './auth';

const pagesToTest = [
  { url: 'http://localhost:3000/reports/revenue', name: 'reports_revenue' },
  { url: 'http://localhost:3000/dsc/direct', name: 'dsc_direct' },
  { url: 'http://localhost:3000/dsc/issuance', name: 'dsc_issuance' },
  { url: 'http://localhost:3000/inventory/procurement', name: 'inventory_procurement' },
  { url: 'http://localhost:3000/billing/invoices/new', name: 'billing_invoices_new' },
  { url: 'http://localhost:3000/billing/invoices', name: 'billing_invoices' },
  { url: 'http://localhost:3000/crm/leads', name: 'crm_leads' },
  { url: 'http://localhost:3000/admin/settings', name: 'admin_settings' },
];

const resolutions = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1280, height: 720, name: '1280x720' },
  { width: 1024, height: 768, name: '1024x768' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 390, height: 844, name: '390x844' },
];

(async () => {
  const token = await createSession('usr-admin-root');
  const browser = await chromium.launch({ headless: true });

  console.log('Testing global scrollbar styling across pages...');

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();

  for (const p of pagesToTest) {
    await page.goto(p.url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const scrollbarInfo = await page.evaluate(() => {
      // Check main element or root scrollability
      const main = document.querySelector('main');
      const mainScroll = main ? {
        scrollHeight: main.scrollHeight,
        clientHeight: main.clientHeight,
        hasVerticalScroll: main.scrollHeight > main.clientHeight,
        scrollWidth: main.scrollWidth,
        clientWidth: main.clientWidth,
        hasHorizontalScroll: main.scrollWidth > main.clientWidth,
      } : null;

      const bodyScroll = {
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        hasVerticalScroll: document.body.scrollHeight > document.body.clientHeight,
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        hasHorizontalScroll: document.body.scrollWidth > document.body.clientWidth,
      };

      return { mainScroll, bodyScroll };
    });

    console.log(`Page: ${p.name}`, JSON.stringify(scrollbarInfo));
    await page.screenshot({ path: `src/server/scrollbar_${p.name}.png` });
  }

  // Check resolutions on /reports/revenue and /inventory/procurement
  for (const res of resolutions) {
    await page.setViewportSize({ width: res.width, height: res.height });
    await page.goto('http://localhost:3000/reports/revenue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    console.log(`Revenue at ${res.name}: horizontal overflow = ${hasHorizontalOverflow}`);
  }

  await browser.close();
  console.log('All scrollbar tests completed successfully.');
})();

