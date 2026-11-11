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
    await page.goto('http://localhost:3000/reports/revenue');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'src/server/revenue_before_redesign.png', fullPage: true });
    console.log('Screenshot captured successfully');
    await browser.close();
})();
