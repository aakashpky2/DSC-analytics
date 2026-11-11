"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function debugSalesEstimates() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click More Modules
    await page.click('button:has-text("More Modules")');
    await page.waitForTimeout(500);
    // Find Sales Estimates button inside menu
    const btn = page.locator('div.absolute button:has-text("Sales Estimates")').first();
    console.log('Button count:', await btn.count());
    await btn.click();
    await page.waitForTimeout(1000);
    // Check what is rendered on the page
    const text = await page.innerText('body');
    console.log('Contains Token Sales Estimates?:', text.includes('Token Sales Estimates'));
    console.log('Active tab indicator:', await page.locator('div:has-text("Active:")').innerText().catch(() => 'None'));
    await browser.close();
}
debugSalesEstimates().catch(console.error);
