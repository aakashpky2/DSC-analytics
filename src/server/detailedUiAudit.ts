import { chromium } from 'playwright'
import { createSession } from './auth'

async function detailedAudit() {
  const token = await createSession('usr-admin-root')
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies([{ name: 'signsync_session', value: token, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()

  const auditRoutes = [
    { name: 'Revenue Dashboard', url: 'http://localhost:3000/reports/revenue' },
    { name: 'DSC Issuance', url: 'http://localhost:3000/dsc/issuance' },
    { name: 'DSC Direct & Associates', url: 'http://localhost:3000/dsc/direct' },
    { name: 'DSC Commissions', url: 'http://localhost:3000/dsc/commissions' },
    { name: 'Token Procurement', url: 'http://localhost:3000/inventory/procurement' },
    { name: 'Stock Register', url: 'http://localhost:3000/inventory/tokens' },
    { name: 'Partner Directory', url: 'http://localhost:3000/partners' },
    { name: 'Billing Invoices', url: 'http://localhost:3000/billing/invoices' },
    { name: 'Billing Ledger', url: 'http://localhost:3000/billing/ledger' },
    { name: 'CRM Calling Queue', url: 'http://localhost:3000/crm/calling-queue' },
    { name: 'CRM Lead Manager', url: 'http://localhost:3000/crm/leads' },
    { name: 'Admin Settings', url: 'http://localhost:3000/admin/settings' },
    { name: 'Admin Users', url: 'http://localhost:3000/admin/users' },
    { name: 'Admin Roles', url: 'http://localhost:3000/admin/roles' }
  ]

  const findings: any[] = []

  for (const item of auditRoutes) {
    await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(500)

    const metrics = await page.evaluate((pageName) => {
      const issues: any[] = []

      // 1. Table Numeric Alignment check
      const tables = document.querySelectorAll('table')
      tables.forEach((table, tIdx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => (th.textContent || '').toLowerCase().trim())
        const rows = table.querySelectorAll('tbody tr')

        headers.forEach((hText, colIdx) => {
          const isNumericHeader = ['qty', 'quantity', 'rate', 'price', 'amount', 'tax', 'profit', 'balance', 'outstanding', 'stock', 'payout', 'commission', 'total'].some(k => hText.includes(k))
          if (isNumericHeader) {
            rows.forEach((r, rIdx) => {
              const cells = r.querySelectorAll('td')
              if (cells[colIdx]) {
                const align = window.getComputedStyle(cells[colIdx]).textAlign
                if (align !== 'right' && align !== 'end') {
                  issues.push({
                    type: 'TABLE_NUMERIC_ALIGNMENT',
                    detail: `Column "${hText}" in table ${tIdx} (row ${rIdx}) is "${align}" instead of right-aligned`
                  })
                }
              }
            })
          }
        })
      })

      // 2. Buttons without accessible names or inconsistent styling
      const buttons = document.querySelectorAll('button')
      buttons.forEach(btn => {
        const text = (btn.textContent || '').trim()
        const ariaLabel = btn.getAttribute('aria-label')
        if (!text && !ariaLabel && !btn.querySelector('svg')) {
          issues.push({ type: 'EMPTY_BUTTON', detail: 'Button has no text, aria-label, or icon' })
        }
      })

      return { pageName, issues: issues.slice(0, 5) }
    }, item.name)

    if (metrics.issues.length > 0) {
      findings.push(metrics)
    }
  }

  await browser.close()
  console.log('Detailed Findings count:', findings.length)
  console.log(JSON.stringify(findings, null, 2))
}

detailedAudit().catch(console.error)

