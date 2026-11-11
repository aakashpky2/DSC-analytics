import { chromium } from 'playwright'
import { createSession } from './auth'
import fs from 'fs'

async function captureArtifactProof() {
  const token = await createSession('usr-admin-root')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()

  await page.goto('http://localhost:3000/inventory/procurement', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(2000)

  // 1. Capture Level 1 More Modules open
  const moreBtn = page.locator('div.border-b button:has-text("More Modules")').first()
  await moreBtn.click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'uat_screenshots/two_level_nav_level1_menu.png', fullPage: false })

  // 2. Click Pricing Rules & Customer Levels
  const modBtn = page.locator('div.z-50 button:has-text("Pricing Rules & Customer Levels")').first()
  await modBtn.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'uat_screenshots/two_level_nav_workspace.png', fullPage: false })

  // Copy screenshots to artifact directory
  const artifactDir = 'C:/Users/Rahul/.gemini/antigravity/brain/930df5e0-d104-449b-a8a9-da961079cd59'
  if (fs.existsSync('uat_screenshots/two_level_nav_workspace.png')) {
    fs.copyFileSync('uat_screenshots/two_level_nav_workspace.png', `${artifactDir}/two_level_nav_workspace.png`)
  }
  if (fs.existsSync('uat_screenshots/two_level_nav_level1_menu.png')) {
    fs.copyFileSync('uat_screenshots/two_level_nav_level1_menu.png', `${artifactDir}/two_level_nav_level1_menu.png`)
  }

  console.log('Screenshots captured and saved to brain artifact folder successfully!')
  await browser.close()
}

captureArtifactProof().catch(console.error)

