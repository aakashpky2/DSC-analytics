import { chromium } from 'playwright'
import { createSession } from './auth'

async function checkInvoiceLayout() {
  const token = await createSession('usr-admin-root')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()

  await page.goto('http://localhost:3000/billing/invoices/new', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(2000)

  // Check scrollWidth vs clientWidth of line items container
  const tableContainer = page.locator('div:has(table):has-text("Commercial Line Items") div.overflow-x-auto, div.overflow-x-auto').first()
  const scrollInfo = await tableContainer.evaluate(el => {
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      hasScroll: el.scrollWidth > el.clientWidth
    }
  }).catch(e => ({ error: e.message }))

  console.log('Line Items Container Scroll Info at 1440px:', scrollInfo)

  const pageScrollInfo = await page.evaluate(() => {
    return {
      windowInnerWidth: window.innerWidth,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      hasPageOverflow: document.documentElement.scrollWidth > window.innerWidth
    }
  })
  console.log('Page-level Scroll Info:', pageScrollInfo)

  await page.screenshot({ path: 'uat_screenshots/invoice_builder_before_fix.png', fullPage: false })

  await browser.close()
}

checkInvoiceLayout().catch(console.error)

