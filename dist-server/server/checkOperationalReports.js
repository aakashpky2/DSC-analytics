"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function checkOperationalReports() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/dsc/direct', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    // Click on Operational Reports tab
    await page.click('button:has-text("Operational Reports")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'uat_screenshots/dsc_direct_operational_reports_dark_fixed.png', fullPage: true });
    console.log('Saved dsc_direct_operational_reports_dark_fixed.png');
    await browser.close();
}
checkOperationalReports().catch(console.error);
