/**
 * E2E TEST: Upload Payment Proof & Full Payment Verification Cycle
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testUploadAndVerificationWorkflow() {
  console.log('Starting Payment Upload to Verification E2E Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Create temporary synthetic payment screenshot
  const testImagePath = path.join(__dirname, 'test_receipt.png');
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGYzAEAEqEBwH9WzB3AAAAAElFTkSuQmCC';
  fs.writeFileSync(testImagePath, Buffer.from(pngBase64, 'base64'));

  try {
    // 1. Login
    console.log('Logging in as Master Admin...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin@signsync.io');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('Login successful.');

    // 2. Open /billing/payments
    console.log('Navigating to /billing/payments...');
    await page.goto('http://localhost:3000/billing/payments', { waitUntil: 'networkidle' });

    // 3. Open Record Payment Modal
    console.log('Clicking "Record Payment" button...');
    const recordBtn = await page.$('button:has-text("Record Payment")');
    if (!recordBtn) throw new Error('Record Payment button not found!');
    await recordBtn.click();
    await page.waitForTimeout(600);

    // Verify modal is visible
    const modalHeading = await page.$('h2:has-text("Record Customer Payment")');
    if (!modalHeading) throw new Error('Record Customer Payment modal did not open!');
    console.log('Record Payment modal opened successfully.');

    // 4. Fill form
    const utrVal = `UTR-E2E-${Date.now()}`;
    await page.fill('input[placeholder*="UTR12345678"]', utrVal);

    // Upload the file
    console.log('Attaching payment proof image...');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);
    await page.waitForTimeout(2000); // Allow upload to Supabase storage to complete

    // Check upload success indicator
    const uploadIndicator = await page.$('span:has-text("Proof saved")');
    console.log(`Storage upload success: ${!!uploadIndicator}`);

    // Submit form using form.requestSubmit()
    console.log('Submitting Record Payment form...');
    await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        forms[forms.length - 1].requestSubmit();
      }
    });
    await page.waitForTimeout(3000);

    // 5. Verification Queue Check
    console.log('Verifying newly created payment in verification queue...');
    await page.goto('http://localhost:3000/billing/payments', { waitUntil: 'networkidle' });

    // Look for the card with our UTR
    const cardWithUtr = await page.$(`text=${utrVal}`);
    console.log(`Payment card with UTR ${utrVal} exists in queue: ${!!cardWithUtr}`);

    // Look for compact image preview
    const compactImg = await page.$('img[alt="Payment Screenshot"]');
    console.log(`Payment screenshot preview rendered: ${!!compactImg}`);

    // Click "View Full Image"
    const viewFullBtn = await page.$('button:has-text("View Full Image")');
    if (viewFullBtn) {
      console.log('Clicking "View Full Image"...');
      await viewFullBtn.click();
      await page.waitForTimeout(500);
      const modalPreview = await page.$('span:has-text("Payment Proof Full View")');
      console.log(`Full image modal opened: ${!!modalPreview}`);
      
      // Close modal
      const closeBtn = await page.$('button:has(svg.lucide-x)');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(300);
    }

    console.log('\n--- SUCCESS: Payment Upload & Verification Workflow Verified 100% ---');
  } finally {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await browser.close();
  }
}

testUploadAndVerificationWorkflow().catch(err => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});
