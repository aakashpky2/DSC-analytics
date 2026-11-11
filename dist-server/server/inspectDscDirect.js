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
    // Navigate to /dsc/direct
    await page.goto('http://localhost:3000/dsc/direct');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Take screenshot of default tab (Applications Register)
    await page.screenshot({ path: 'src/server/dsc_direct_tab1.png' });
    // Click Operational Reports tab
    const reportsTab = page.locator('button:has-text("Operational Reports")');
    if (await reportsTab.count() > 0) {
        await reportsTab.click();
        await page.waitForTimeout(1500);
    }
    // Take screenshot of Operational Reports tab
    await page.screenshot({ path: 'src/server/dsc_direct_tab_reports.png' });
    // Inspect elements on page
    const selectElements = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll('select, input'));
        return selects.map(s => ({
            tagName: s.tagName,
            className: s.className,
            value: s.value,
            outerHTML: s.outerHTML.slice(0, 150),
            computedBg: window.getComputedStyle(s).backgroundColor,
            computedColor: window.getComputedStyle(s).color,
        }));
    });
    console.log('Select/Input elements:', JSON.stringify(selectElements, null, 2));
    await browser.close();
})();
