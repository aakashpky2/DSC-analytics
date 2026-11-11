"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const auth_1 = require("./auth");
async function debugActiveText() {
    const token = await (0, auth_1.createSession)('usr-admin-root');
    const browser = await playwright_1.chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Click More Modules
    await page.click('button:has-text("More Modules")');
    await page.waitForTimeout(200);
    // Click Sales Estimates
    await page.click('div.shadow-2xl button:has-text("Sales Estimates")');
    await page.waitForTimeout(500);
    const activeBadge = await page.locator('div.border-b span:has-text("Active:")').innerText().catch(e => e.message);
    console.log('Active Badge Text:', activeBadge);
    const wholeActiveDiv = await page.locator('div:has-text("Active:")').first().innerText().catch(e => e.message);
    console.log('Whole Active Div:', wholeActiveDiv);
    await browser.close();
}
debugActiveText().catch(console.error);
