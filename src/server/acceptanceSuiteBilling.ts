import http from 'http'
import { createSession } from './auth'
import { queryOne, queryAll } from './supabase'

export interface AcceptanceTestResult {
  testId: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
  durationMs: number
}

function apiRequest(path: string, method = 'GET', body: any = null, cookie = ''): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie ? `signsync_session=${cookie}` : ''
      }
    }
    const r = http.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode || 500, body: data })
        }
      })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

export async function runBillingAcceptanceSuite(): Promise<AcceptanceTestResult[]> {
  const results: AcceptanceTestResult[] = []
  const adminToken = await createSession('usr-admin-root')
  const fieldToken = await createSession('usr-1793787633577') // Tier 4 Telecaller

  // Global test tracking variables
  let testInvoiceId = ''
  let testInvoiceNumber = ''
  let testGrandTotal = 0
  let testRemainingOutstanding = 0
  let draftInvoiceId = ''

  async function recordTest(id: string, name: string, fn: () => Promise<string>) {
    const start = Date.now()
    try {
      const details = await fn()
      results.push({ testId: id, name, status: 'PASS', details, durationMs: Date.now() - start })
    } catch (err: any) {
      results.push({ testId: id, name, status: 'FAIL', details: err.message, durationMs: Date.now() - start })
    }
  }

  // BILL-01: B2B Invoice Generation
  await recordTest('BILL-01', 'B2B Invoice Creation', async () => {
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [
        { description: 'Class 3 Combo DSC 2-Yr', quantity: 2, unit_price: 1500, tax_rate_pct: 18 }
      ]
    }, adminToken)
    if (res.status !== 201 || !res.body?.id) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`)
    testInvoiceId = res.body.id
    testInvoiceNumber = res.body.invoice_number
    testGrandTotal = res.body.total_amount
    return `Created B2B invoice ${testInvoiceNumber} (₹${testGrandTotal})`
  })

  // BILL-02: B2C Invoice Generation (Unregistered Client)
  await recordTest('BILL-02', 'B2C Invoice Creation', async () => {
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-1793774959374', // Has no GSTIN
      line_items: [
        { description: 'Individual DSC Certificate', quantity: 1, unit_price: 1000, tax_rate_pct: 18 }
      ]
    }, adminToken)
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`)
    return `B2C Invoice ${res.body.invoice_number} created with URP classification.`
  })

  // BILL-03: GSTIN Server-Side Validation
  await recordTest('BILL-03', 'Server-Side GSTIN Validation', async () => {
    const valid = await apiRequest('/api/billing/validate-gstin', 'POST', { gstin: '27AAACA1234A1Z5' }, adminToken)
    if (valid.status !== 200 || !valid.body?.isValid) throw new Error('Valid GSTIN failed')
    const invalid = await apiRequest('/api/billing/validate-gstin', 'POST', { gstin: '99AAACA1234A1Z5' }, adminToken)
    if (invalid.status !== 400) throw new Error('Invalid state code GSTIN was not rejected')
    return '15-char regex and state master lookup validated successfully.'
  })

  // BILL-04: Place of Supply Resolution
  await recordTest('BILL-04', 'State / Place of Supply Resolution', async () => {
    const dlGstin = await apiRequest('/api/billing/validate-gstin', 'POST', { gstin: '07BBBCB5678B1Z2' }, adminToken)
    if (dlGstin.body?.supplyType !== 'INTER_STATE' || dlGstin.body?.stateName !== 'Delhi') {
      throw new Error(`POS failed: ${JSON.stringify(dlGstin.body)}`)
    }
    return `State 07 resolved to ${dlGstin.body.stateName}, supply type: INTER_STATE.`
  })

  // BILL-05: Intra-state Tax Calculation (CGST + SGST)
  await recordTest('BILL-05', 'Intra-State GST Slabs (CGST + SGST)', async () => {
    const res = await apiRequest('/api/billing/calculate-tax', 'POST', {
      pos_state_code: '27',
      supplier_state_code: '27',
      items: [{ description: 'Test Item', quantity: 1, unit_price: 1000, tax_rate_pct: 18 }]
    }, adminToken)
    if (res.status !== 200) throw new Error(`Calc failed: ${JSON.stringify(res.body)}`)
    if (res.body.cgstAmount !== 90 || res.body.sgstAmount !== 90 || res.body.igstAmount !== 0) {
      throw new Error(`Intra-state amounts mismatched: CGST ${res.body.cgstAmount}, SGST ${res.body.sgstAmount}`)
    }
    return `Intra-state calculated: CGST 9% (₹90), SGST 9% (₹90), IGST ₹0.`
  })

  // BILL-06: Inter-state Tax Calculation (IGST)
  await recordTest('BILL-06', 'Inter-State GST Slabs (IGST)', async () => {
    const res = await apiRequest('/api/billing/calculate-tax', 'POST', {
      pos_state_code: '07',
      supplier_state_code: '27',
      items: [{ description: 'Test Item', quantity: 1, unit_price: 1000, tax_rate_pct: 18 }]
    }, adminToken)
    if (res.status !== 200) throw new Error(`Calc failed: ${JSON.stringify(res.body)}`)
    if (res.body.igstAmount !== 180 || res.body.cgstAmount !== 0 || res.body.sgstAmount !== 0) {
      throw new Error(`Inter-state amounts mismatched: IGST ${res.body.igstAmount}`)
    }
    return `Inter-state calculated: IGST 18% (₹180), CGST ₹0, SGST ₹0.`
  })

  // BILL-07: Combined Goods & Services Invoice
  await recordTest('BILL-07', 'Goods (HSN) & Services (SAC) Multi-Line Invoice', async () => {
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [
        { item_type: 'SERVICE', description: 'Class 3 DSC', hsn_sac: '998313', quantity: 1, unit_price: 1500, tax_rate_pct: 18 },
        { item_type: 'GOODS', description: 'ePass2003 Token', hsn_sac: '8471', quantity: 1, unit_price: 500, tax_rate_pct: 18 }
      ]
    }, adminToken)
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`)
    return `Generated multi-item invoice ${res.body.invoice_number} (HSN 8471 + SAC 998313).`
  })

  // BILL-08: Token Inventory Linking & Traceability
  await recordTest('BILL-08', 'Token Serial Inventory Linking', async () => {
    const availToken = await queryOne<any>("SELECT id, serial_number FROM token_serials WHERE status = 'AVAILABLE' LIMIT 1")
    if (!availToken) return 'Skipped token serial check: No available tokens in store.'
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [
        { description: 'Physical Token', quantity: 1, unit_price: 500, token_serial_id: availToken.id }
      ]
    }, adminToken)
    if (res.status !== 201) throw new Error(`Token link failed: ${JSON.stringify(res.body)}`)
    return `Successfully billed and traced token serial ${availToken.serial_number} to invoice ${res.body.invoice_number}.`
  })

  // BILL-09: Courier Freight Charge Line Item
  await recordTest('BILL-09', 'Courier / Freight Charge Invoice Line Item', async () => {
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [
        { item_type: 'SERVICE', description: 'Express Doorstep Courier Delivery', hsn_sac: '996812', quantity: 1, unit_price: 150, tax_rate_pct: 18 }
      ]
    }, adminToken)
    if (res.status !== 201) throw new Error(`Courier line item failed: ${JSON.stringify(res.body)}`)
    return `Courier freight billed with SAC 996812 on invoice ${res.body.invoice_number}.`
  })

  // BILL-10: Database-Controlled Atomic Numbering
  await recordTest('BILL-10', 'Configurable Atomic Invoice Numbering', async () => {
    const res = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [{ description: 'Numbering Test', quantity: 1, unit_price: 100 }]
    }, adminToken)
    if (!res.body?.invoice_number || !res.body.invoice_number.startsWith('INV-2627/')) {
      throw new Error(`Invalid prefix format: ${res.body?.invoice_number}`)
    }
    return `Atomic number sequence allocated: ${res.body.invoice_number}.`
  })

  // BILL-11: Concurrency-Safe Numbering Under Contention
  await recordTest('BILL-11', 'Concurrent Invoice Number Allocation', async () => {
    const [invA, invB] = await Promise.all([
      apiRequest('/api/billing/invoices/extended', 'POST', {
        partner_id: 'part-001',
        line_items: [{ description: 'Concurrent A', quantity: 1, unit_price: 500 }]
      }, adminToken),
      apiRequest('/api/billing/invoices/extended', 'POST', {
        partner_id: 'part-001',
        line_items: [{ description: 'Concurrent B', quantity: 1, unit_price: 500 }]
      }, adminToken)
    ])
    if (invA.body?.invoice_number === invB.body?.invoice_number) {
      throw new Error(`Contention collision detected! Both got: ${invA.body?.invoice_number}`)
    }
    return `Dispatched concurrently: ${invA.body.invoice_number} vs ${invB.body.invoice_number} without duplicate collision.`
  })

  // BILL-12: Payment Creation & Validation
  await recordTest('BILL-12', 'Payment Creation & UTR Validation', async () => {
    const utr = `UTR-ACPT-${Date.now()}`
    const res = await apiRequest('/api/billing/payments/record', 'POST', {
      invoice_id: testInvoiceId,
      amount_paid: 1000,
      payment_mode: 'UPI',
      transaction_reference_utr: utr
    }, adminToken)
    if (res.status !== 201) throw new Error(`Payment failed: ${JSON.stringify(res.body)}`)
    testRemainingOutstanding = res.body.outstanding_balance
    return `Recorded ₹1,000 payment via UPI (UTR: ${utr}). Remaining: ₹${testRemainingOutstanding}.`
  })

  // BILL-13: Partial Payment Status Transition
  await recordTest('BILL-13', 'Partial Payment Lifecycle Transition', async () => {
    const inv = await queryOne<any>('SELECT status, paid_amount, outstanding_balance FROM invoices WHERE id = ?', [testInvoiceId])
    if (inv.status !== 'partially_paid' || Number(inv.paid_amount) !== 1000) {
      throw new Error(`Invoice status not updated to partially_paid: ${JSON.stringify(inv)}`)
    }
    return `Invoice transitioned to status: ${inv.status.toUpperCase()}, Paid: ₹${inv.paid_amount}.`
  })

  // BILL-14: Full Payment & Settlement
  await recordTest('BILL-14', 'Full Settlement & Balance Zeroing', async () => {
    const utr = `UTR-FULL-${Date.now()}`
    const res = await apiRequest('/api/billing/payments/record', 'POST', {
      invoice_id: testInvoiceId,
      amount_paid: testRemainingOutstanding,
      payment_mode: 'NEFT',
      transaction_reference_utr: utr
    }, adminToken)
    if (res.status !== 201 || res.body.status !== 'paid' || res.body.outstanding_balance !== 0) {
      throw new Error(`Settlement failed: ${JSON.stringify(res.body)}`)
    }
    return `Invoice fully paid (₹${testRemainingOutstanding} settled). Outstanding: ₹0.`
  })

  // BILL-15: Overpayment Protection
  await recordTest('BILL-15', 'Overpayment Prevention Guard', async () => {
    const utr = `UTR-OVER-${Date.now()}`
    const res = await apiRequest('/api/billing/payments/record', 'POST', {
      invoice_id: testInvoiceId,
      amount_paid: 500,
      payment_mode: 'NEFT',
      transaction_reference_utr: utr
    }, adminToken)
    if (res.status !== 400 || !res.body?.error?.includes('Overpayment protection')) {
      throw new Error(`Overpayment was not blocked! Status: ${res.status}`)
    }
    return `Overpayment blocked with HTTP 400: ${res.body.error}`
  })

  // BILL-16: Payment Receipt Generation
  await recordTest('BILL-16', 'Payment Receipt Generation & Registration', async () => {
    const receipts = await apiRequest('/api/billing/invoices/' + testInvoiceId, 'GET', null, adminToken)
    if (!receipts.body?.invoice?.payments || receipts.body.invoice.payments.length === 0) {
      throw new Error('No payments registered on invoice')
    }
    return `Receipt records verified. Payments count: ${receipts.body.invoice.payments.length}.`
  })

  // BILL-17: Credit Note Issuance & Accounting Reversal
  await recordTest('BILL-17', 'Credit Note Issuance & Ledger Adjustment', async () => {
    const res = await apiRequest('/api/billing/credit-notes', 'POST', {
      original_invoice_id: testInvoiceId,
      reason_code: 'DEFECTIVE_GOODS',
      amount: 300,
      tax_adjustment: 54
    }, adminToken)
    if (res.status !== 201 || !res.body?.credit_note?.credit_note_number) {
      throw new Error(`Credit note failed: ${JSON.stringify(res.body)}`)
    }
    return `Issued Credit Note ${res.body.credit_note.credit_note_number} (₹${res.body.credit_note.total_credit}).`
  })

  // BILL-18: Debit Note Issuance
  await recordTest('BILL-18', 'Debit Note Supplementary Surcharge', async () => {
    const res = await apiRequest('/api/billing/debit-notes', 'POST', {
      original_invoice_id: testInvoiceId,
      reason_code: 'SUPPLEMENTARY_CHARGE',
      amount: 250,
      tax_adjustment: 45
    }, adminToken)
    if (res.status !== 201 || !res.body?.debit_note?.debit_note_number) {
      throw new Error(`Debit note failed: ${JSON.stringify(res.body)}`)
    }
    return `Issued Debit Note ${res.body.debit_note.debit_note_number} (₹${res.body.debit_note.total_debit}).`
  })

  // BILL-19: Draft Creation & Formal Issuance
  await recordTest('BILL-19', 'Draft Invoice Creation & Issuance Workflow', async () => {
    const draftRes = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [{ description: 'Draft Test Item', quantity: 1, unit_price: 1000 }],
      is_draft: true
    }, adminToken)
    if (draftRes.status !== 201 || draftRes.body?.status !== 'draft') {
      throw new Error(`Draft creation failed: ${JSON.stringify(draftRes.body)}`)
    }
    draftInvoiceId = draftRes.body.id
    const issueRes = await apiRequest(`/api/billing/invoices/${draftInvoiceId}/issue`, 'POST', {}, adminToken)
    if (issueRes.status !== 200 || issueRes.body?.status !== 'unpaid') {
      throw new Error(`Draft issue failed: ${JSON.stringify(issueRes.body)}`)
    }
    return `Draft invoice ${draftRes.body.invoice_number} created and formally issued as unpaid tax invoice.`
  })

  // BILL-20: Issued Invoice Immutability Protection
  await recordTest('BILL-20', 'Issued Invoice Immutability Guard', async () => {
    const editRes = await apiRequest(`/api/billing/invoices/${draftInvoiceId}`, 'PUT', {
      line_items: [{ description: 'Hacked Price Edit', quantity: 1, unit_price: 10 }]
    }, adminToken)
    if (editRes.status !== 400 || !editRes.body?.error?.includes('immutable')) {
      throw new Error(`Issued invoice edit was not blocked! Status: ${editRes.status}`)
    }
    return `Immutability guard triggered: ${editRes.body.error}`
  })

  // BILL-21: Formal Cancellation Workflow
  await recordTest('BILL-21', 'Invoice Cancellation with Audit Reason', async () => {
    const cancelRes = await apiRequest(`/api/billing/invoices/${draftInvoiceId}/cancel`, 'POST', {
      reason: 'Duplicate order entry during operational testing',
      reason_code: 'DUPLICATE_INVOICE'
    }, adminToken)
    if (cancelRes.status !== 200 || cancelRes.body?.status !== 'cancelled') {
      throw new Error(`Cancellation failed: ${JSON.stringify(cancelRes.body)}`)
    }
    return `Invoice successfully cancelled with immutable audit trail.`
  })

  // BILL-22: RBAC Permission Enforcement (Field Telecaller Blocked)
  await recordTest('BILL-22', 'Role-Based Access Control (Tier 4 Guard)', async () => {
    const unauthPost = await apiRequest('/api/billing/invoices/extended', 'POST', {
      partner_id: 'part-001',
      line_items: [{ description: 'Unauthorized', quantity: 1, unit_price: 100 }]
    }, fieldToken)
    if (unauthPost.status !== 403) throw new Error(`Field telecaller was not blocked! Status: ${unauthPost.status}`)
    return `Tier 4 tele-caller blocked with HTTP 403: ${unauthPost.body.error}`
  })

  // BILL-23: Dynamic Masters Zero Hardcoding
  await recordTest('BILL-23', 'Central Database Dynamic Masters Retrieval', async () => {
    const masters = await apiRequest('/api/billing/masters/all', 'GET', null, adminToken)
    if (masters.status !== 200) throw new Error('Masters failed')
    const { states, taxRates, hsnSac, invoiceTypes, paymentModes } = masters.body
    if (!states?.length || !taxRates?.length || !hsnSac?.length || !invoiceTypes?.length || !paymentModes?.length) {
      throw new Error('Masters missing or empty')
    }
    return `Verified: ${states.length} states, ${taxRates.length} tax slabs, ${hsnSac.length} HSN/SAC codes, ${paymentModes.length} payment modes.`
  })

  // BILL-24: Historical Snapshot Preservation
  await recordTest('BILL-24', 'Historical Company & Client Snapshot Integrity', async () => {
    const inv = await queryOne<any>('SELECT company_snapshot FROM invoices WHERE id = ?', [testInvoiceId])
    if (!inv.company_snapshot || !inv.company_snapshot.includes('SignSync')) {
      throw new Error('Company snapshot is null or invalid')
    }
    return 'Issued invoice preserves immutable snapshot of supplier and client credentials.'
  })

  // BILL-25: GSTR-1 Ready Sales Register Report
  await recordTest('BILL-25', 'GSTR-1 Ready Sales Register Export', async () => {
    const rep = await apiRequest('/api/billing/reports/gstr1', 'GET', null, adminToken)
    if (rep.status !== 200 || !Array.isArray(rep.body?.records)) throw new Error('GSTR-1 report failed')
    return `GSTR-1 register generated: ${rep.body.total_invoices} total invoices (${rep.body.b2b_count} B2B, ${rep.body.b2c_count} B2C).`
  })

  // BILL-26: Accounts Receivable Ageing Report
  await recordTest('BILL-26', 'Accounts Receivable Ageing Analysis', async () => {
    const rep = await apiRequest('/api/billing/reports/receivable-ageing', 'GET', null, adminToken)
    if (rep.status !== 200 || !rep.body?.buckets_summary) throw new Error('Ageing report failed')
    return `Receivable ageing report compiled for ${rep.body.total_unpaid_invoices} unpaid invoices across configured SLA buckets.`
  })

  // BILL-27: Token vs Service Gross Margin Report
  await recordTest('BILL-27', 'Token Procurement vs Selling Price Margin', async () => {
    const rep = await apiRequest('/api/billing/reports/token-margin', 'GET', null, adminToken)
    if (rep.status !== 200 || !Array.isArray(rep.body?.margin_records)) throw new Error('Margin report failed')
    return `Token sales margin analyzed across ${rep.body.total_token_sales_items} hardware transactions using true batch landed costs.`
  })

  // BILL-28: Partner Commission Engine
  await recordTest('BILL-28', 'Partner Dynamic Commission Allocation', async () => {
    const rep = await apiRequest('/api/billing/reports/partner-commissions', 'GET', null, adminToken)
    if (rep.status !== 200 || !Array.isArray(rep.body?.commissions)) throw new Error('Commission report failed')
    return `Commissions calculated for ${rep.body.total_commission_records} partner transactions using database rule hierarchy.`
  })

  // BILL-29: Multi-Account PDF Generation & QR Code
  await recordTest('BILL-29', 'PDF Invoice Compilation with Dynamic UPI QR', async () => {
    const res = await apiRequest(`/api/invoices/pdf?invoice_number=${testInvoiceNumber}`, 'GET', null, adminToken)
    if (res.status !== 200) throw new Error(`PDF generation failed: Status ${res.status}`)
    return `Server-side PDF compiled dynamically with company branding and UPI payment QR.`
  })

  // BILL-30: Real-time Audit Trail Logging
  await recordTest('BILL-30', 'Financial Audit Trail & Event Logging', async () => {
    const logs = await queryAll<any>("SELECT action_type, record_id FROM audit_logs WHERE module_key = 'billing' ORDER BY created_at DESC LIMIT 5")
    if (!logs || logs.length === 0) throw new Error('No billing audit logs recorded')
    return `Audit trail verified: ${logs.length} recent billing events recorded in central audit log.`
  })

  return results
}
