"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function loginAndInspect() {
    const browser = await playwright_1.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000/login');
    await page.fill('#email', 'admin@signsync.io');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => { });
    await page.waitForTimeout(2000);
    console.log('After login URL:', page.url());
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('Procurement URL:', page.url());
    // Look for tab container
    const tabTexts = await page.$$eval('div.border-b button', els => els.map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()));
    console.log(`Found ${tabTexts.length} tabs:`);
    tabTexts.forEach((t, i) => console.log(` [${i + 1}] ${t}`));
    await browser.close();
}
loginAndInspect().catch(console.error);
