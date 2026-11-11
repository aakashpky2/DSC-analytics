import { chromium } from 'playwright'
import { createSession } from './auth'
import fs from 'fs'

async function captureAllDsc() {
  const token = await createSession('usr-admin-root')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()

  if (!fs.existsSync('uat_screenshots')) {
    fs.mkdirSync('uat_screenshots', { recursive: true })
  }

  const pages = [
    { url: 'http://localhost:3000/dsc/direct', name: 'dsc_direct_dark_fixed.png' },
    { url: 'http://localhost:3000/dsc/issuance', name: 'dsc_issuance_entry_dark_fixed.png' },
    { url: 'http://localhost:3000/reports/revenue', name: 'reports_revenue_dark_fixed.png' }
  ]

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'uat_screenshots/' + p.name, fullPage: true })
    console.log('Captured', p.name)
  }

  // Also click on Issuance Register & Reports tabs on /dsc/issuance
  await page.goto('http://localhost:3000/dsc/issuance', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(1000)

  // Click Register tab
  await page.click('button:has-text("Issuance Register")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'uat_screenshots/dsc_issuance_register_dark_fixed.png', fullPage: true })
  console.log('Captured dsc_issuance_register_dark_fixed.png')

  // Click Reports tab
  await page.click('button:has-text("Performance Reports")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'uat_screenshots/dsc_issuance_reports_dark_fixed.png', fullPage: true })
  console.log('Captured dsc_issuance_reports_dark_fixed.png')

  await browser.close()
}

captureAllDsc().catch(console.error)

