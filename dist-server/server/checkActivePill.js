"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function checkActivePill() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click More Modules -> Profile Stock Ledger
    await page.click('button:has-text("More Modules")');
    await page.waitForTimeout(200);
    await page.click('div.shadow-2xl button:has-text("Profile Stock Ledger")');
    await page.waitForTimeout(500);
    // Find all elements containing text 'Active:'
    const activeEls = await page.$$eval('div', els => els.map(e => e.innerText).filter(t => t.includes('Active:')));
    console.log('Active elements found:', activeEls);
    await browser.close();
}
checkActivePill().catch(console.error);
