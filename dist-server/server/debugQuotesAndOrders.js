"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function debugQuotesAndOrders() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click Vendor Quotes
    console.log('Testing Quotes:');
    const qBtn = page.locator('button:has-text("Vendor Quotes")').first();
    console.log('qBtn text:', await qBtn.innerText());
    await qBtn.click();
    await page.waitForTimeout(500);
    const quotesTable = await page.locator('table').count();
    console.log('Quotes tables found:', quotesTable);
    // Click Purchase Orders
    console.log('Testing Orders:');
    const oBtn = page.locator('button:has-text("Purchase Orders")').first();
    console.log('oBtn text:', await oBtn.innerText());
    await oBtn.click();
    await page.waitForTimeout(500);
    const ordersTable = await page.locator('table').count();
    console.log('Orders tables found:', ordersTable);
    await browser.close();
}
debugQuotesAndOrders().catch(console.error);
