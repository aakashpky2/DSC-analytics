import { chromium } from 'playwright'
import { createSession } from './auth'

async function checkShellWidth() {
  const token = await createSession('usr-admin-root')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()

  await page.goto('http://localhost:3000/billing/invoices/new', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(2000)

  const widths = await page.evaluate(() => {
    const main = document.querySelector('main')
    const outerContainer = document.querySelector('main > div')
    return {
      windowWidth: window.innerWidth,
      mainClientWidth: main?.clientWidth,
      outerContainerClientWidth: outerContainer?.clientWidth
    }
  })

  console.log('Available widths in shell:', widths)
  await browser.close()
}

checkShellWidth().catch(console.error)

