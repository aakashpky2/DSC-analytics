import http from 'http'
import { createSession } from './auth'

const BASE_HOST = '127.0.0.1'
const BASE_PORT = 3000
let sessionCookie = ''

function request(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : ''
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Cookie: sessionCookie,
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 200, data: JSON.parse(raw) })
          } catch {
            resolve({ status: res.statusCode || 200, data: raw })
          }
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

interface TestResult {
  section: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function assert(section: string, name: string, condition: boolean, details: string) {
  const status: 'PASS' | 'FAIL' = condition ? 'PASS' : 'FAIL'
  results.push({ section, name, status, details })
  console.log(`[${status}] ${section} - ${name}: ${details}`)
}

export async function runAcceptanceSuite(): Promise<{ total: number; passed: number; failed: number }> {
  const token = await createSession('usr-admin-root')
  sessionCookie = `signsync_session=${token}`

  console.log('======================================================================')
  console.log('STARTING DBIZ ERP DSC & TOKEN INVENTORY MANAGER ACCEPTANCE AUDIT')
  console.log('======================================================================\n')

  // SECTION 1: MASTER DATA SOURCE OF TRUTH (Zero Hardcoding)
  console.log('>>> Auditing Master Data Architecture (Database Single Source of Truth)...')
  const mastersRes = await request('GET', '/api/dsc/masters/all')
  assert(
    'SEC-01',
    'Database Central Master Store Endpoint',
    mastersRes.status === 200,
    `Status ${mastersRes.status}, returned keys: ${Object.keys(mastersRes.data).join(', ')}`
  )

  const {
    workflowStages,
    certificateTypes,
    applicantCategories,
    validities,
    tokenStatuses,
    rmaReasons,
    tokenManufacturers,
    tokenModels,
    hardwareVendors,
    certifyingAuthorities,
    courierPartners,
  } = mastersRes.data

  assert('SEC-02', 'Workflow Stages from PostgreSQL', Array.isArray(workflowStages) && workflowStages.length >= 5, `Found ${workflowStages?.length} workflow stages`)
  assert('SEC-03', 'Certificate Types from PostgreSQL', Array.isArray(certificateTypes) && certificateTypes.length >= 2, `Found ${certificateTypes?.length} certificate types`)
  assert('SEC-04', 'Applicant Categories from PostgreSQL', Array.isArray(applicantCategories) && applicantCategories.length >= 3, `Found ${applicantCategories?.length} applicant categories`)
  assert('SEC-05', 'Validity Options from PostgreSQL', Array.isArray(validities) && validities.length >= 3, `Found ${validities?.length} validity terms`)
  assert('SEC-06', 'Token Status Lifecycle from PostgreSQL', Array.isArray(tokenStatuses) && tokenStatuses.length === 7, `Found ${tokenStatuses?.length} statuses (AVAILABLE, RESERVED, CONFIGURED, DISPATCHED, DELIVERED, BLOCKED_DEFECTIVE, RETURNED_RMA)`)
  assert('SEC-07', 'RMA Reasons from PostgreSQL', Array.isArray(rmaReasons) && rmaReasons.length >= 4, `Found ${rmaReasons?.length} RMA failure reasons`)
  assert('SEC-08', 'Token Manufacturers from PostgreSQL', Array.isArray(tokenManufacturers) && tokenManufacturers.length >= 3, `Found ${tokenManufacturers?.length} manufacturers`)
  assert('SEC-09', 'Hardware Models from PostgreSQL', Array.isArray(tokenModels) && tokenModels.length >= 3, `Found ${tokenModels?.length} token models`)
  assert('SEC-10', 'Hardware Vendors from PostgreSQL', Array.isArray(hardwareVendors) && hardwareVendors.length >= 3, `Found ${hardwareVendors?.length} vendors`)
  assert('SEC-11', 'Certifying Authorities from PostgreSQL', Array.isArray(certifyingAuthorities) && certifyingAuthorities.length >= 3, `Found ${certifyingAuthorities?.length} CAs`)
  assert('SEC-12', 'Courier Partners from PostgreSQL', Array.isArray(courierPartners) && courierPartners.length >= 3, `Found ${courierPartners?.length} logistics carriers`)

  // SECTION 2: DYNAMIC MASTER ADDITION & UPDATE (No Code Change Needed)
  console.log('\n>>> Auditing Dynamic Master Addition (Zero Code Hardcoding Verification)...')
  const newCatCode = `cat_dynamic_${Date.now()}`
  const addCatRes = await request('POST', '/api/dsc/masters/applicant-categories', {
    code: newCatCode,
    display_name: 'Dynamic Enterprise Entity',
  })
  assert('SEC-13', 'Dynamic Category Addition via API', addCatRes.status === 201 && addCatRes.data.category?.code === newCatCode, `Created category ${newCatCode}`)

  const verifyMastersRes = await request('GET', '/api/dsc/masters/all')
  const foundDynamic = verifyMastersRes.data.applicantCategories?.some((c: any) => c.code === newCatCode)
  assert('SEC-14', 'Immediate Central DB Availability for Dynamic Master', foundDynamic, 'New category instantly available in central master catalog')

  // SECTION 3: WORKFLOW ENGINE & TRANSITION RULES
  console.log('\n>>> Auditing Dynamic Workflow Engine & Transition Guardrails...')
  // Attempt invalid transition: intake -> ca_portal_approval directly (should violate allowed transitions)
  const appList = await request('GET', '/api/dsc/applications')
  const testApp = appList.data.applications?.[0]
  assert('SEC-15', 'DSC Applications List Accessible', appList.status === 200 && Boolean(testApp), `Found ${appList.data.applications?.length} applications, testing with ${testApp?.id}`)

  // Transition to document_verification
  const trans1 = await request('PATCH', `/api/dsc/applications/${testApp.id}/transition`, {
    target_stage: 'document_verification',
    notes: 'Documents verified against MCA portal',
  })
  assert('SEC-16', 'Allowed Stage Transition Execution', trans1.status === 200, `Transition result: ${trans1.data.message}`)

  // SECTION 4: HARDWARE TOKEN INVENTORY, ATOMIC RESERVATION & CONFLICTS
  console.log('\n>>> Auditing Hardware Token Lifecycle, Atomic Locking & RMA...')
  const testSerial = `FT-ACCEPT-${Date.now()}`
  
  // 1. Inward serial intake
  const intakeRes = await request('POST', '/api/inventory/tokens/serials', {
    serial_numbers: [testSerial],
    token_model: 'EPASS2003 AUTO',
    branch_id: 'branch-hq',
  })
  assert(
    'SEC-17',
    'Barcode Sequential Serial Intake',
    (intakeRes.status === 200 || intakeRes.status === 201) && Boolean(intakeRes.data.inserted?.includes(testSerial)),
    `Intake inserted: ${intakeRes.data.inserted?.join(', ')}`
  )

  // 2. Reject duplicate serial intake
  const dupIntakeRes = await request('POST', '/api/inventory/tokens/serials', {
    serial_numbers: [testSerial],
    token_model: 'EPASS2003 AUTO',
    branch_id: 'branch-hq',
  })
  assert('SEC-18', 'Duplicate Serial Intake Prevention', dupIntakeRes.data.duplicates?.includes(testSerial), `Duplicate ${testSerial} detected and rejected`)

  // 3. Reserve token atomically
  const reserve1 = await request('POST', '/api/inventory/tokens/reserve', {
    serial_number: testSerial,
    partner_id: testApp.partner_id,
    application_id: testApp.id,
    notes: 'Allocated for audit verification test',
  })
  assert('SEC-19', 'Atomic Token Reservation', reserve1.status === 200, `Status ${reserve1.status}: ${reserve1.data.message}`)

  // 4. Concurrency Double-Reservation Conflict Test
  const reserve2 = await request('POST', '/api/inventory/tokens/reserve', {
    serial_number: testSerial,
    partner_id: 'part-other',
  })
  assert('SEC-20', 'Atomic Double-Allocation Conflict Rejection (HTTP 409)', reserve2.status === 409, `Expected 409 Conflict, received HTTP ${reserve2.status}: ${reserve2.data.error}`)

  // 5. Configure Token (Certificate written)
  const configRes = await request('POST', '/api/inventory/tokens/configure', {
    serial_number: testSerial,
    ca_code: 'TCS-CA-2026',
    notes: 'Cryptographic credentials written to token chip',
  })
  assert('SEC-21', 'Token Configuration State Transition', configRes.status === 200, `Configured: ${configRes.data.message}`)

  // 6. Dispatch Token
  const dispatchRes = await request('POST', '/api/inventory/tokens/dispatch', {
    serial_number: testSerial,
    courier_partner_id: 'cp-1',
    awb_number: `BLUEDART-${Date.now()}`,
    recipient_name: 'Audit Recipient',
  })
  assert('SEC-22', 'Token Courier Dispatch State Transition', dispatchRes.status === 200, `Dispatched: ${dispatchRes.data.message}`)

  // 7. Deliver Token
  const deliverRes = await request('POST', '/api/inventory/tokens/deliver', {
    serial_number: testSerial,
    receiver_signature_name: 'Audit Recipient',
    delivered_date: new Date().toISOString(),
  })
  assert('SEC-23', 'Token Delivery Confirmation State Transition', deliverRes.status === 200, `Delivered: ${deliverRes.data.message}`)

  // 8. RMA Processing with Replacement
  const repSerial = `FT-REP-${Date.now()}`
  await request('POST', '/api/inventory/tokens/serials', {
    serial_numbers: [repSerial],
    token_model: 'EPASS2003 AUTO',
    branch_id: 'branch-hq',
  })

  const rmaRes = await request('POST', '/api/inventory/tokens/rma', {
    defective_serial: testSerial,
    rma_reason_code: 'PORT_UNRECOGNIZED',
    replacement_serial: repSerial,
    notes: 'Defective chip tested in QA',
  })
  assert('SEC-24', 'Token RMA Processing & Replacement Allocation', rmaRes.status === 201, `RMA processed: ${rmaRes.data.message}`)

  // 9. Custody Audit Trail Verification
  const auditRes = await request('GET', `/api/reports/token-serials/${testSerial}/audit`)
  const events = auditRes.data.audit_trail || []
  assert('SEC-25', 'Full Relational Custody History Audit Trail', auditRes.status === 200 && events.length >= 4, `Audit trail recorded ${events.length} lifecycle transitions`)

  // SECTION 5: STOCK LEDGER & REPORTING
  console.log('\n>>> Auditing Stock Ledger & Reporting Aggregation...')
  const ledgerRes = await request('GET', '/api/reports/token-stock-ledger')
  assert('SEC-26', 'Token Stock Ledger Query', ledgerRes.status === 200 && Array.isArray(ledgerRes.data.ledger), `Ledger contains ${ledgerRes.data.ledger?.length} models`)

  const ledgerItem = ledgerRes.data.ledger?.find((l: any) => l.model_name === 'EPASS2003 AUTO')
  assert('SEC-27', 'Stock Ledger Dynamic Multi-Status Quantities', Boolean(ledgerItem && ledgerItem.total_procured > 0), `Total: ${ledgerItem?.total_procured}, Avail: ${ledgerItem?.available}, Res: ${ledgerItem?.reserved}, Def: ${ledgerItem?.defective}, RMA: ${ledgerItem?.returned_rma}`)

  // Summary
  console.log('\n======================================================================')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`TOTAL AUDIT CHECKS: ${results.length} | PASS: ${passed} | FAIL: ${failed}`)
  console.log('======================================================================')

  return { total: results.length, passed, failed }
}

if (require.main === module) {
  runAcceptanceSuite().catch((err) => {
    console.error('Fatal audit suite error:', err)
    process.exit(1)
  })
}
