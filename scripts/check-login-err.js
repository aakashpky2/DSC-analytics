const { chromium } = require('playwright');
async function testErr() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@signsync.io');
  await page.fill('input[type="password"]', 'WrongPass123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  const errBox = await page.$('.text-red-400');
  console.log('Error box text:', errBox ? await errBox.textContent() : 'NOT FOUND');
  await browser.close();
}
testErr();

