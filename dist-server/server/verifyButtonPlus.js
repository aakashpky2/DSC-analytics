"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
(async () => {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Click Purchase Bills tab
    const billsTab = page.locator('button:has-text("Purchase Bills")');
    await billsTab.click();
    await page.waitForTimeout(500);
    // Take screenshot of Purchase Bills tab
    await page.screenshot({ path: 'src/server/purchase_bills_single_plus.png' });
    console.log('Screenshot captured successfully');
    await browser.close();
})();
