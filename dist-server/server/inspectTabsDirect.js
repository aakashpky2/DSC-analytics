"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function inspectTabsDirect() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Find all buttons in the tab container
    const tabButtons = await page.$$eval('div.border-b button', els => els.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()));
    console.log(`Live Tab Buttons (${tabButtons.length}):`);
    tabButtons.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));
    await browser.close();
}
inspectTabsDirect().catch(console.error);
