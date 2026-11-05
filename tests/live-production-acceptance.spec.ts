import { test, expect } from '@playwright/test';

test.describe('Live Production Acceptance Test', () => {
  test('Full Login, Session Persistence, and Navigation Verification', async ({ page }) => {
    // 1. Navigate to login
    console.log('Navigating to login page...');
    await page.goto('https://signsync.dbizsolutions.in/login', { waitUntil: 'networkidle' });

    // 2. Fill credentials
    await page.fill('input[type="email"]', 'admin@signsync.io');
    await page.fill('input[type="password"]', 'Password123!');

    // 3. Submit
    console.log('Submitting login form...');
    const [loginResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/auth/login')),
      page.click('button[type="submit"]')
    ]);

    console.log('Login Response Status:', loginResponse.status());
    expect(loginResponse.status()).toBe(200);

    // 4. Wait for redirect to /
    console.log('Waiting for URL redirect to / ...');
    await page.waitForURL('https://signsync.dbizsolutions.in/', { timeout: 15000 });

    // 5. Check cookies in browser
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'signsync_session');
    console.log('Session Cookie exists in browser:', !!sessionCookie);
    expect(sessionCookie).toBeDefined();

    // 6. Verify dashboard content
    await page.waitForSelector('text=SignSync', { timeout: 10000 });
    console.log('Dashboard rendered successfully!');

    // 7. Verify /api/auth/me returns 200
    const meRes = await page.request.get('https://signsync.dbizsolutions.in/api/auth/me');
    console.log('Browser context /api/auth/me status:', meRes.status());
    expect(meRes.status()).toBe(200);

    // 8. Verify module requests
    const partnersRes = await page.request.get('https://signsync.dbizsolutions.in/api/partners');
    console.log('/api/partners status:', partnersRes.status());
    expect(partnersRes.status()).toBe(200);

    // 9. Take proof screenshot
    await page.screenshot({ path: 'manager_demo_evidence/live_acceptance_success.png', fullPage: true });
    console.log('Screenshot saved!');
  });
});

