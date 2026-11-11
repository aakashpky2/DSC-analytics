import { runFullLiveUat } from './acceptanceSuiteUatLive'
import fs from 'fs'

async function main() {
  try {
    const results = await runFullLiveUat()
    console.log('\n======================================================')
    console.log('              LIVE UAT SUMMARY RESULTS                ')
    console.log('======================================================')
    let passCount = 0
    for (const r of results) {
      console.log(`[${r.status}] ${r.step} - ${r.title}`)
      if (r.status === 'PASS') passCount++
    }
    console.log(`TOTAL: ${results.length} | PASS: ${passCount} | FAIL: ${results.length - passCount}`)
    fs.writeFileSync('uat_results.json', JSON.stringify(results, null, 2))
    process.exit(results.length === passCount ? 0 : 1)
  } catch (err) {
    console.error('UAT Execution failed:', err)
    process.exit(1)
  }
}

main()

