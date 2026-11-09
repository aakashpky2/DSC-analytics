import { Router, Request, Response } from 'express'
import { queryAll, queryOne, supabase } from '../supabase'
import {
  getSalesEstimates,
  saveSalesEstimate,
  getSalesEstimateById,
  getSalesInvoices,
  saveSalesInvoice,
  getSalesInvoiceById,
  getSalesPayments,
  saveSalesPayment,
  getVendorPayments,
  saveVendorPayment,
  getPartyCreditConfig,
  savePartyCreditConfig,
  getBillCreditOverride,
  saveBillCreditOverride,
  getBillCreditOverrides,
  TokenSalesEstimate,
  TokenSalesInvoice,
  TokenSalesPayment,
  TokenVendorPayment,
  TokenPartyCreditConfig,
  TokenBillCreditOverride
} from '../tokenSalesStore'

export const reportsAndLedgersRouter = Router()

function getAuthOrg(req: Request): string {
  const user = (req as any).user
  if (!user || !user.organization_id) {
    throw new Error('Authentication required. Missing organization boundary.')
  }
  return user.organization_id
}

function requireAuth(req: Request, res: Response, next: any) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  next()
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getFinancialYearDates(fyString?: string): { startDate: string; endDate: string } {
  if (fyString && fyString.includes('-')) {
    const startYear = parseInt(fyString.split('-')[0], 10)
    return {
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`
    }
  }
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startYear = month >= 4 ? year : year - 1
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`
  }
}

// ----------------------------------------------------------------------------
// 1. CREDIT TERMS CONFIGURATION (Vendors & Customers)
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/parties/credit-terms', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { party_id, party_type } = req.query
    if (!party_id) {
      return res.status(400).json({ error: 'party_id is required' })
    }

    const cfg = await getPartyCreditConfig(orgId, String(party_id))
    let creditPeriodDays = cfg ? cfg.credit_period_days : 0

    if (!cfg) {
      if (party_type === 'CUSTOMER') {
        const cust = await queryOne<any>('SELECT credit_period_days FROM partners WHERE id = ?', [party_id])
        if (cust && cust.credit_period_days !== undefined && cust.credit_period_days !== null) {
          creditPeriodDays = Number(cust.credit_period_days)
        }
      } else {
        const vend = await queryOne<any>('SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?', [party_id, orgId])
        if (vend && vend.credit_period_days !== undefined && vend.credit_period_days !== null) {
          creditPeriodDays = Number(vend.credit_period_days)
        }
      }
    }

    return res.json({
      party_id,
      party_type: party_type || 'VENDOR',
      credit_period_days: creditPeriodDays,
      is_nil: creditPeriodDays === 0
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

reportsAndLedgersRouter.post('/reports/parties/credit-terms', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { party_id, party_type, credit_period_days, credit_limit } = req.body

    if (!party_id || credit_period_days === undefined) {
      return res.status(400).json({ error: 'party_id and credit_period_days are required' })
    }

    const days = Math.max(0, parseInt(credit_period_days, 10) || 0)
    const pType = party_type === 'CUSTOMER' ? 'CUSTOMER' : 'VENDOR'

    await savePartyCreditConfig({
      party_id: String(party_id),
      party_type: pType,
      organization_id: orgId,
      credit_period_days: days,
      credit_limit: credit_limit !== undefined ? Number(credit_limit) : undefined,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })

    if (pType === 'CUSTOMER') {
      await supabase.from('partners').update({ credit_period_days: days }).eq('id', party_id)
    }

    return res.json({
      success: true,
      message: `Credit period updated to ${days} days for ${pType} ${party_id}. Existing bills and invoices maintain their original historical due dates.`,
      credit_period_days: days
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 2. VENDOR PAYMENTS (Record & List)
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/vendor-payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { bill_id, vendor_party_id } = req.query
    let list = await getVendorPayments(orgId, bill_id ? String(bill_id) : undefined)
    if (vendor_party_id) {
      list = list.filter(p => p.vendor_party_id === vendor_party_id)
    }
    return res.json({ payments: list })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

reportsAndLedgersRouter.post('/reports/vendor-payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      purchase_bill_id,
      payment_date,
      amount,
      payment_mode,
      transaction_reference_utr,
      proof_url,
      notes
    } = req.body

    const payAmount = Number(amount)
    if (!purchase_bill_id || isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'purchase_bill_id and positive payment amount are required.' })
    }

    const bill = await queryOne<any>(
      'SELECT * FROM token_purchase_bills WHERE id = ? AND organization_id = ?',
      [purchase_bill_id, orgId]
    )
    if (!bill) {
      return res.status(404).json({ error: 'Purchase Bill not found in your organization.' })
    }

    // UTR Duplicate Check
    if (transaction_reference_utr && transaction_reference_utr.trim()) {
      const existingPayments = await getVendorPayments(orgId)
      const dup = existingPayments.find(p => p.transaction_reference_utr?.trim().toLowerCase() === transaction_reference_utr.trim().toLowerCase())
      if (dup) {
        return res.status(409).json({ error: `Vendor payment with UTR / Reference '${transaction_reference_utr}' has already been recorded.` })
      }
    }

    const billGrand = Number(bill.grand_total || 0)
    const curOverride = await getBillCreditOverride(orgId, purchase_bill_id)
    const curPaid = curOverride ? curOverride.paid_amount : 0
    const curOutstanding = curOverride ? curOverride.outstanding_balance : billGrand

    let shortage = 0
    let excess = 0
    if (payAmount < curOutstanding) {
      shortage = Number((curOutstanding - payAmount).toFixed(2))
    } else if (payAmount > curOutstanding) {
      excess = Number((payAmount - curOutstanding).toFixed(2))
    }

    const newPaid = Number((curPaid + payAmount).toFixed(2))
    const newOutstanding = Math.max(0, Number((curOutstanding - payAmount).toFixed(2)))
    const paymentId = `tvp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const nowIso = new Date().toISOString()
    const pDate = payment_date || nowIso.slice(0, 10)

    const payment: TokenVendorPayment = {
      id: paymentId,
      organization_id: orgId,
      company_profile_id: bill.company_profile_id,
      purchase_bill_id,
      vendor_party_id: bill.vendor_party_id,
      payment_number: `VPAY-${Date.now().toString().slice(-6)}`,
      payment_date: pDate,
      amount: payAmount,
      payment_mode: payment_mode || 'NEFT',
      transaction_reference_utr: transaction_reference_utr?.trim() || null,
      proof_url: proof_url || null,
      notes: notes || null,
      shortage_amount: shortage,
      excess_amount: excess,
      receipt_number: `VREC-${Date.now().toString().slice(-6)}`,
      created_by: user.id,
      created_at: nowIso
    }

    await saveVendorPayment(payment)

    const creditDays = curOverride ? curOverride.credit_period_days : 0
    const dueDate = curOverride ? curOverride.due_date : (bill.accounting_date || pDate)

    await saveBillCreditOverride({
      bill_id: purchase_bill_id,
      organization_id: orgId,
      company_profile_id: bill.company_profile_id,
      credit_period_days: creditDays,
      due_date: dueDate,
      paid_amount: newPaid,
      outstanding_balance: newOutstanding
    })

    return res.status(201).json({
      success: true,
      payment,
      bill_summary: {
        purchase_bill_id,
        grand_total: billGrand,
        paid_amount: newPaid,
        outstanding_balance: newOutstanding,
        status: newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID'
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 3. CHRONOLOGICAL PARTY LEDGERS (Vendor & Customer)
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/party-ledger', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { party_type, party_id, company_profile_id, start_date, end_date } = req.query

    if (!party_type || !party_id) {
      return res.status(400).json({ error: 'party_type (VENDOR | CUSTOMER) and party_id are required.' })
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const pType = String(party_type).toUpperCase()

    if (pType === 'VENDOR') {
      const vendor = await queryOne<any>(
        'SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?',
        [party_id, orgId]
      )
      if (!vendor) return res.status(404).json({ error: 'Vendor party not found in your organization.' })

      const creditCfg = await getPartyCreditConfig(orgId, String(party_id))
      const masterCreditDays = creditCfg ? creditCfg.credit_period_days : Number(vendor.credit_period_days || 0)

      let billsSql = `
        SELECT pb.*, prof.legal_name as company_name
        FROM token_purchase_bills pb
        LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
        WHERE pb.organization_id = ? AND pb.vendor_party_id = ? AND pb.status IN ('POSTED', 'DRAFT')
      `
      const billParams: any[] = [orgId, party_id]
      if (company_profile_id) {
        billsSql += ' AND pb.company_profile_id = ?'
        billParams.push(String(company_profile_id))
      }
      billsSql += ' ORDER BY pb.accounting_date ASC, pb.created_at ASC'

      const allBills = await queryAll(billsSql, billParams)
      const overrides = await getBillCreditOverrides(orgId)
      const payments = await getVendorPayments(orgId)

      // Build unified transaction list
      type LedgerItem = {
        date: string
        created_at: string
        type: 'PURCHASE_BILL' | 'PAYMENT'
        voucher_number: string
        reference: string
        debit: number // Payment made to vendor
        credit: number // Bill from vendor (liability)
        credit_period_days: number
        due_date: string
        status: string
        days_overdue: number
        notes?: string
      }

      const rawItems: LedgerItem[] = []

      for (const b of allBills) {
        const ovr = overrides.find(o => o.bill_id === b.id)
        const creditDays = ovr ? ovr.credit_period_days : masterCreditDays
        const dueDate = ovr ? ovr.due_date : addDaysToDate(b.accounting_date || b.created_at.slice(0, 10), creditDays)
        const billPayments = payments.filter(p => p.purchase_bill_id === b.id)
        const paidSum = billPayments.reduce((s, p) => s + p.amount, 0)
        const grand = Number(b.grand_total || 0)
        const outBal = Math.max(0, grand - paidSum)

        let status = 'OUTSTANDING'
        if (paidSum >= grand && grand > 0) {
          status = 'PAID'
        } else if (paidSum > 0) {
          status = 'PARTIALLY_PAID'
        }

        const daysOver = dueDate && dueDate < todayStr && outBal > 0
          ? Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0

        if (daysOver > 0 && status !== 'PAID') {
          status = 'OVERDUE'
        }

        rawItems.push({
          date: b.accounting_date || b.created_at.slice(0, 10),
          created_at: b.created_at,
          type: 'PURCHASE_BILL',
          voucher_number: b.voucher_number || b.id,
          reference: b.supplier_invoice_number || b.voucher_number || '',
          debit: 0,
          credit: grand,
          credit_period_days: creditDays,
          due_date: dueDate,
          status,
          days_overdue: daysOver,
          notes: b.notes || undefined
        })
      }

      for (const p of payments.filter(p => p.vendor_party_id === party_id)) {
        if (company_profile_id && p.company_profile_id !== company_profile_id) continue

        rawItems.push({
          date: p.payment_date,
          created_at: p.created_at,
          type: 'PAYMENT',
          voucher_number: p.payment_number,
          reference: p.transaction_reference_utr || p.receipt_number || '',
          debit: p.amount,
          credit: 0,
          credit_period_days: 0,
          due_date: p.payment_date,
          status: 'SETTLED',
          days_overdue: 0,
          notes: `Payment via ${p.payment_mode}`
        })
      }

      // Sort chronologically
      rawItems.sort((a, b) => {
        if (a.date === b.date) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        return a.date.localeCompare(b.date)
      })

      // Calculate Running Balance & Filter Date Window
      let runningBalance = 0 // For vendor: balance > 0 means payable liability
      let openingBalance = 0
      const statementItems: any[] = []

      for (const item of rawItems) {
        const netEffect = item.credit - item.debit // credit increases payable, debit decreases
        if (start_date && item.date < String(start_date)) {
          openingBalance += netEffect
          runningBalance += netEffect
        } else if (!end_date || item.date <= String(end_date)) {
          runningBalance += netEffect
          statementItems.push({
            ...item,
            running_balance: Number(runningBalance.toFixed(2))
          })
        }
      }

      const totalCredits = statementItems.reduce((s, it) => s + it.credit, 0)
      const totalDebits = statementItems.reduce((s, it) => s + it.debit, 0)
      const closingBalance = openingBalance + totalCredits - totalDebits

      return res.json({
        party_type: 'VENDOR',
        party: vendor,
        master_credit_period_days: masterCreditDays,
        filter: {
          start_date: start_date || null,
          end_date: end_date || null,
          company_profile_id: company_profile_id || null
        },
        opening_balance: Number(openingBalance.toFixed(2)),
        closing_balance: Number(closingBalance.toFixed(2)),
        total_billed: Number(totalCredits.toFixed(2)),
        total_paid: Number(totalDebits.toFixed(2)),
        net_outstanding_payable: Number(closingBalance.toFixed(2)),
        statement: statementItems
      })
    } else {
      // CUSTOMER LEDGER
      const customer = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [party_id])
      if (!customer) return res.status(404).json({ error: 'Customer not found.' })

      const creditCfg = await getPartyCreditConfig(orgId, String(party_id))
      const masterCreditDays = creditCfg ? creditCfg.credit_period_days : Number(customer.credit_period_days || 0)

      const allInvoices = await getSalesInvoices(orgId, company_profile_id ? String(company_profile_id) : undefined)
      const custInvoices = allInvoices.filter(i => i.customer_id === party_id && i.status !== 'CANCELLED')
      const allPayments = await getSalesPayments(orgId)
      const custPayments = allPayments.filter(p => p.customer_id === party_id)

      type CustomerLedgerItem = {
        date: string
        created_at: string
        type: 'SALES_INVOICE' | 'PAYMENT_RECEIVED'
        voucher_number: string
        reference: string
        debit: number // Invoice raised (receivable increase)
        credit: number // Payment received (receivable decrease)
        credit_period_days: number
        due_date: string
        status: string
        days_overdue: number
        notes?: string
      }

      const rawItems: CustomerLedgerItem[] = []

      for (const inv of custInvoices) {
        const creditDays = inv.credit_period_days !== undefined ? inv.credit_period_days : masterCreditDays
        const dueDate = inv.due_date || addDaysToDate(inv.invoice_date, creditDays)
        const grand = inv.grand_total
        const outBal = inv.outstanding_balance

        let status = inv.status === 'PAID' ? 'PAID' : (inv.paid_amount > 0 ? 'PARTIALLY_PAID' : 'UNPAID')
        const daysOver = dueDate && dueDate < todayStr && outBal > 0
          ? Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
          : 0

        if (daysOver > 0 && status !== 'PAID') {
          status = 'OVERDUE'
        }

        rawItems.push({
          date: inv.invoice_date,
          created_at: inv.created_at,
          type: 'SALES_INVOICE',
          voucher_number: inv.invoice_number,
          reference: inv.estimate_id ? `Est #${inv.estimate_id}` : 'Direct Sale',
          debit: grand,
          credit: 0,
          credit_period_days: creditDays,
          due_date: dueDate,
          status,
          days_overdue: daysOver,
          notes: `Landed gross profit: ₹${inv.total_profit}`
        })
      }

      for (const pay of custPayments) {
        if (company_profile_id && pay.company_profile_id !== company_profile_id) continue

        rawItems.push({
          date: pay.payment_date,
          created_at: pay.created_at,
          type: 'PAYMENT_RECEIVED',
          voucher_number: pay.payment_number,
          reference: pay.transaction_reference_utr || pay.receipt_number || '',
          debit: 0,
          credit: pay.amount,
          credit_period_days: 0,
          due_date: pay.payment_date,
          status: 'VERIFIED',
          days_overdue: 0,
          notes: `Payment via ${pay.payment_mode}`
        })
      }

      // Chronological sort
      rawItems.sort((a, b) => {
        if (a.date === b.date) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        return a.date.localeCompare(b.date)
      })

      let runningBalance = 0 // Customer balance: > 0 means receivable from customer
      let openingBalance = 0
      const statementItems: any[] = []

      for (const item of rawItems) {
        const netEffect = item.debit - item.credit // debit increases receivable, credit decreases
        if (start_date && item.date < String(start_date)) {
          openingBalance += netEffect
          runningBalance += netEffect
        } else if (!end_date || item.date <= String(end_date)) {
          runningBalance += netEffect
          statementItems.push({
            ...item,
            running_balance: Number(runningBalance.toFixed(2))
          })
        }
      }

      const totalDebits = statementItems.reduce((s, it) => s + it.debit, 0)
      const totalCredits = statementItems.reduce((s, it) => s + it.credit, 0)
      const closingBalance = openingBalance + totalDebits - totalCredits

      return res.json({
        party_type: 'CUSTOMER',
        party: customer,
        master_credit_period_days: masterCreditDays,
        filter: {
          start_date: start_date || null,
          end_date: end_date || null,
          company_profile_id: company_profile_id || null
        },
        opening_balance: Number(openingBalance.toFixed(2)),
        closing_balance: Number(closingBalance.toFixed(2)),
        total_invoiced: Number(totalDebits.toFixed(2)),
        total_collected: Number(totalCredits.toFixed(2)),
        net_outstanding_receivable: Number(closingBalance.toFixed(2)),
        statement: statementItems
      })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 4. OUTSTANDING & AGEING REPORTS (Receivables & Payables)
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/outstanding', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { type, company_profile_id } = req.query
    const targetType = String(type || 'RECEIVABLES').toUpperCase()
    const todayStr = new Date().toISOString().slice(0, 10)

    if (targetType === 'RECEIVABLES') {
      const invoices = await getSalesInvoices(orgId, company_profile_id ? String(company_profile_id) : undefined)
      const unpaidInvoices = invoices.filter(i => i.status !== 'CANCELLED' && i.outstanding_balance > 0)
      const customers = await queryAll('SELECT id, company_name, phone, email, credit_period_days FROM partners')
      const custMap = new Map<string, any>()
      customers.forEach(c => custMap.set(c.id, c))

      let totalOutstanding = 0
      let totalNotDue = 0
      let b1to30 = 0
      let b31to60 = 0
      let b61to90 = 0
      let bAbove90 = 0

      const rows = unpaidInvoices.map(inv => {
        const cust = custMap.get(inv.customer_id)
        const creditDays = inv.credit_period_days !== undefined ? inv.credit_period_days : (cust?.credit_period_days || 0)
        const dueDate = inv.due_date || addDaysToDate(inv.invoice_date, creditDays)
        const outBal = inv.outstanding_balance
        totalOutstanding += outBal

        let daysOverdue = 0
        let bucket = 'Not Due'

        if (dueDate < todayStr) {
          daysOverdue = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        }

        if (daysOverdue === 0) {
          bucket = 'Not Due'
          totalNotDue += outBal
        } else if (daysOverdue <= 30) {
          bucket = '1–30 Days'
          b1to30 += outBal
        } else if (daysOverdue <= 60) {
          bucket = '31–60 Days'
          b31to60 += outBal
        } else if (daysOverdue <= 90) {
          bucket = '61–90 Days'
          b61to90 += outBal
        } else {
          bucket = 'Above 90 Days'
          bAbove90 += outBal
        }

        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          due_date: dueDate,
          credit_period_days: creditDays,
          customer_id: inv.customer_id,
          customer_name: cust?.company_name || inv.customer_snapshot?.company_name || 'Customer',
          grand_total: inv.grand_total,
          paid_amount: inv.paid_amount,
          outstanding_balance: outBal,
          days_overdue: daysOverdue,
          ageing_bucket: bucket,
          status: daysOverdue > 0 ? 'OVERDUE' : (inv.paid_amount > 0 ? 'PARTIALLY_PAID' : 'UNPAID')
        }
      })

      // Sort by days overdue descending
      rows.sort((a, b) => b.days_overdue - a.days_overdue)

      return res.json({
        report_type: 'RECEIVABLES',
        summary: {
          total_outstanding: Number(totalOutstanding.toFixed(2)),
          not_due: Number(totalNotDue.toFixed(2)),
          bucket_1_to_30: Number(b1to30.toFixed(2)),
          bucket_31_to_60: Number(b31to60.toFixed(2)),
          bucket_61_to_90: Number(b61to90.toFixed(2)),
          bucket_above_90: Number(bAbove90.toFixed(2)),
          invoice_count: rows.length
        },
        items: rows
      })
    } else {
      // PAYABLES (Vendors)
      let billsSql = `
        SELECT pb.*, p.party_name as vendor_name, p.credit_period_days as vendor_credit_days
        FROM token_purchase_bills pb
        LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
        WHERE pb.organization_id = ? AND pb.status IN ('POSTED', 'DRAFT')
      `
      const billParams: any[] = [orgId]
      if (company_profile_id) {
        billsSql += ' AND pb.company_profile_id = ?'
        billParams.push(String(company_profile_id))
      }
      const bills = await queryAll(billsSql, billParams)
      const overrides = await getBillCreditOverrides(orgId)
      const payments = await getVendorPayments(orgId)

      let totalOutstanding = 0
      let totalNotDue = 0
      let b1to30 = 0
      let b31to60 = 0
      let b61to90 = 0
      let bAbove90 = 0

      const rows: any[] = []

      for (const b of bills) {
        const ovr = overrides.find(o => o.bill_id === b.id)
        const creditDays = ovr ? ovr.credit_period_days : Number(b.vendor_credit_days || 0)
        const dueDate = ovr ? ovr.due_date : addDaysToDate(b.accounting_date || b.created_at.slice(0, 10), creditDays)
        const billPayments = payments.filter(p => p.purchase_bill_id === b.id)
        const paidSum = billPayments.reduce((s, p) => s + p.amount, 0)
        const grand = Number(b.grand_total || 0)
        const outBal = Math.max(0, grand - paidSum)

        if (outBal <= 0) continue // Skip fully paid bills

        totalOutstanding += outBal

        let daysOverdue = 0
        let bucket = 'Not Due'

        if (dueDate < todayStr) {
          daysOverdue = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        }

        if (daysOverdue === 0) {
          bucket = 'Not Due'
          totalNotDue += outBal
        } else if (daysOverdue <= 30) {
          bucket = '1–30 Days'
          b1to30 += outBal
        } else if (daysOverdue <= 60) {
          bucket = '31–60 Days'
          b31to60 += outBal
        } else if (daysOverdue <= 90) {
          bucket = '61–90 Days'
          b61to90 += outBal
        } else {
          bucket = 'Above 90 Days'
          bAbove90 += outBal
        }

        rows.push({
          bill_id: b.id,
          voucher_number: b.voucher_number || b.id,
          supplier_invoice_number: b.supplier_invoice_number,
          accounting_date: b.accounting_date,
          due_date: dueDate,
          credit_period_days: creditDays,
          vendor_party_id: b.vendor_party_id,
          vendor_name: b.vendor_name || 'Vendor',
          grand_total: grand,
          paid_amount: paidSum,
          outstanding_balance: outBal,
          days_overdue: daysOverdue,
          ageing_bucket: bucket,
          status: daysOverdue > 0 ? 'OVERDUE' : (paidSum > 0 ? 'PARTIALLY_PAID' : 'OUTSTANDING')
        })
      }

      rows.sort((a, b) => b.days_overdue - a.days_overdue)

      return res.json({
        report_type: 'PAYABLES',
        summary: {
          total_outstanding: Number(totalOutstanding.toFixed(2)),
          not_due: Number(totalNotDue.toFixed(2)),
          bucket_1_to_30: Number(b1to30.toFixed(2)),
          bucket_31_to_60: Number(b31to60.toFixed(2)),
          bucket_61_to_90: Number(b61to90.toFixed(2)),
          bucket_above_90: Number(bAbove90.toFixed(2)),
          bill_count: rows.length
        },
        items: rows
      })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 5. PERIODIC SALES & FINANCIAL REPORTS (Indian FY: 1 April – 31 March)
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/sales-monthly', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { financial_year, company_profile_id, token_model_id } = req.query
    const { startDate, endDate } = getFinancialYearDates(financial_year ? String(financial_year) : undefined)

    const invoices = await getSalesInvoices(orgId, company_profile_id ? String(company_profile_id) : undefined)
    const payments = await getSalesPayments(orgId)

    const filtered = invoices.filter(inv => {
      const matchDate = inv.invoice_date >= startDate && inv.invoice_date <= endDate
      const notCancelled = inv.status !== 'CANCELLED'
      const matchModel = !token_model_id || inv.items.some(it => it.token_model_id === token_model_id)
      return matchDate && notCancelled && matchModel
    })

    // Group by Month (12 months of Indian FY: Apr, May, ..., Mar)
    const monthKeys = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03']
    const monthNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']
    const startYr = parseInt(startDate.slice(0, 4), 10)

    const monthlyMap = new Map<string, {
      month_name: string
      year: number
      tokens_sold: number
      gross_sales: number
      taxable_sales: number
      gst_collected: number
      collections: number
      outstanding: number
      actual_landed_cost: number
      gross_profit: number
      invoice_count: number
    }>()

    monthKeys.forEach((m, idx) => {
      const yr = idx < 9 ? startYr : startYr + 1
      const key = `${yr}-${m}`
      monthlyMap.set(key, {
        month_name: `${monthNames[idx]} ${yr}`,
        year: yr,
        tokens_sold: 0,
        gross_sales: 0,
        taxable_sales: 0,
        gst_collected: 0,
        collections: 0,
        outstanding: 0,
        actual_landed_cost: 0,
        gross_profit: 0,
        invoice_count: 0
      })
    })

    filtered.forEach(inv => {
      const ym = inv.invoice_date.slice(0, 7)
      const mData = monthlyMap.get(ym)
      if (mData) {
        const qty = inv.items
          .filter(it => !token_model_id || it.token_model_id === token_model_id)
          .reduce((sum, it) => sum + (it.quantity || 0), 0)

        mData.tokens_sold += qty
        mData.gross_sales += inv.grand_total
        mData.taxable_sales += inv.subtotal
        mData.gst_collected += inv.total_tax
        mData.outstanding += inv.outstanding_balance
        mData.actual_landed_cost += (inv.total_landed_cost || 0)
        mData.gross_profit += (inv.total_profit || 0)
        mData.invoice_count += 1
      }
    })

    // Add collections from payment records
    payments.forEach(p => {
      const ym = p.payment_date.slice(0, 7)
      const mData = monthlyMap.get(ym)
      if (mData) {
        mData.collections += p.amount
      }
    })

    const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([month_key, d]) => {
      const marginPct = d.taxable_sales > 0 ? Number(((d.gross_profit / d.taxable_sales) * 100).toFixed(2)) : 0
      return {
        month_key,
        month_name: d.month_name,
        invoice_count: d.invoice_count,
        tokens_sold: d.tokens_sold,
        taxable_sales: Number(d.taxable_sales.toFixed(2)),
        gst_collected: Number(d.gst_collected.toFixed(2)),
        gross_sales: Number(d.gross_sales.toFixed(2)),
        collections: Number(d.collections.toFixed(2)),
        outstanding: Number(d.outstanding.toFixed(2)),
        actual_landed_cost: Number(d.actual_landed_cost.toFixed(2)),
        gross_profit: Number(d.gross_profit.toFixed(2)),
        gross_profit_margin_pct: marginPct
      }
    })

    // Totals
    const fyTotals = monthlyBreakdown.reduce((acc, m) => {
      acc.tokens_sold += m.tokens_sold
      acc.taxable_sales += m.taxable_sales
      acc.gst_collected += m.gst_collected
      acc.gross_sales += m.gross_sales
      acc.collections += m.collections
      acc.outstanding += m.outstanding
      acc.actual_landed_cost += m.actual_landed_cost
      acc.gross_profit += m.gross_profit
      acc.invoice_count += m.invoice_count
      return acc
    }, {
      invoice_count: 0,
      tokens_sold: 0,
      taxable_sales: 0,
      gst_collected: 0,
      gross_sales: 0,
      collections: 0,
      outstanding: 0,
      actual_landed_cost: 0,
      gross_profit: 0
    })

    const fyMarginPct = fyTotals.taxable_sales > 0 ? Number(((fyTotals.gross_profit / fyTotals.taxable_sales) * 100).toFixed(2)) : 0

    return res.json({
      financial_year: financial_year || `${startDate.slice(0, 4)}-${endDate.slice(2, 4)}`,
      date_range: { startDate, endDate },
      summary: {
        ...fyTotals,
        taxable_sales: Number(fyTotals.taxable_sales.toFixed(2)),
        gst_collected: Number(fyTotals.gst_collected.toFixed(2)),
        gross_sales: Number(fyTotals.gross_sales.toFixed(2)),
        collections: Number(fyTotals.collections.toFixed(2)),
        outstanding: Number(fyTotals.outstanding.toFixed(2)),
        actual_landed_cost: Number(fyTotals.actual_landed_cost.toFixed(2)),
        gross_profit: Number(fyTotals.gross_profit.toFixed(2)),
        gross_profit_margin_pct: fyMarginPct
      },
      monthly: monthlyBreakdown
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Annual Multi-Year Sales Comparison
reportsAndLedgersRouter.get('/reports/sales-annual', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id } = req.query
    const invoices = await getSalesInvoices(orgId, company_profile_id ? String(company_profile_id) : undefined)
    const activeInvoices = invoices.filter(i => i.status !== 'CANCELLED')

    const fyMap = new Map<string, {
      financial_year: string
      invoice_count: number
      tokens_sold: number
      taxable_sales: number
      gross_sales: number
      actual_landed_cost: number
      gross_profit: number
      outstanding: number
    }>()

    activeInvoices.forEach(inv => {
      const d = new Date(inv.invoice_date)
      const yr = d.getFullYear()
      const mo = d.getMonth() + 1
      const startYr = mo >= 4 ? yr : yr - 1
      const fyLabel = `${startYr}-${String(startYr + 1).slice(-2)}`

      let fyData = fyMap.get(fyLabel)
      if (!fyData) {
        fyData = {
          financial_year: fyLabel,
          invoice_count: 0,
          tokens_sold: 0,
          taxable_sales: 0,
          gross_sales: 0,
          actual_landed_cost: 0,
          gross_profit: 0,
          outstanding: 0
        }
        fyMap.set(fyLabel, fyData)
      }

      const qty = inv.items.reduce((sum, it) => sum + (it.quantity || 0), 0)
      fyData.tokens_sold += qty
      fyData.taxable_sales += inv.subtotal
      fyData.gross_sales += inv.grand_total
      fyData.actual_landed_cost += (inv.total_landed_cost || 0)
      fyData.gross_profit += (inv.total_profit || 0)
      fyData.outstanding += inv.outstanding_balance
      fyData.invoice_count += 1
    })

    const annualSummary = Array.from(fyMap.values()).map(d => ({
      ...d,
      taxable_sales: Number(d.taxable_sales.toFixed(2)),
      gross_sales: Number(d.gross_sales.toFixed(2)),
      actual_landed_cost: Number(d.actual_landed_cost.toFixed(2)),
      gross_profit: Number(d.gross_profit.toFixed(2)),
      outstanding: Number(d.outstanding.toFixed(2)),
      gross_profit_margin_pct: d.taxable_sales > 0 ? Number(((d.gross_profit / d.taxable_sales) * 100).toFixed(2)) : 0
    }))

    annualSummary.sort((a, b) => b.financial_year.localeCompare(a.financial_year))

    return res.json({ annual_sales: annualSummary })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Overall Purchase & Procurement Report
reportsAndLedgersRouter.get('/reports/purchase-overall', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { financial_year, company_profile_id, vendor_party_id } = req.query
    const { startDate, endDate } = getFinancialYearDates(financial_year ? String(financial_year) : undefined)

    let sql = `
      SELECT pb.*, prof.legal_name as company_name, p.party_name as vendor_name
      FROM token_purchase_bills pb
      LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
      LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
      WHERE pb.organization_id = ?
        AND pb.status = 'POSTED'
        AND pb.accounting_date >= ?
        AND pb.accounting_date <= ?
    `
    const params: any[] = [orgId, startDate, endDate]
    if (company_profile_id) {
      sql += ' AND pb.company_profile_id = ?'
      params.push(String(company_profile_id))
    }
    if (vendor_party_id) {
      sql += ' AND pb.vendor_party_id = ?'
      params.push(String(vendor_party_id))
    }
    sql += ' ORDER BY pb.accounting_date DESC'

    const bills = await queryAll(sql, params)
    const billIds = bills.map((b: any) => b.id)

    let allItems: any[] = []
    if (billIds.length > 0) {
      const placeholders = billIds.map(() => '?').join(',')
      allItems = await queryAll(`SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id IN (${placeholders})`, billIds)
    }

    const payments = await getVendorPayments(orgId)

    let totalProcuredQty = 0
    let totalTaxableSpend = 0
    let totalGstPaid = 0
    let totalFreightPaid = 0
    let totalLandedCost = 0
    let totalGrandTotal = 0
    let totalPaymentsMade = 0

    const formattedBills = bills.map((b: any) => {
      const items = allItems.filter(it => it.purchase_bill_id === b.id)
      const qty = items.reduce((s, it) => s + (it.quantity || 0), 0)
      const landed = items.reduce((s, it) => s + (parseFloat(it.landed_total_value) || 0), 0)
      const billPayments = payments.filter(p => p.purchase_bill_id === b.id)
      const paid = billPayments.reduce((s, p) => s + p.amount, 0)
      const grand = Number(b.grand_total || 0)
      const outBal = Math.max(0, grand - paid)

      totalProcuredQty += qty
      totalTaxableSpend += Number(b.subtotal || 0)
      totalGstPaid += Number(b.gst_amount || 0)
      totalFreightPaid += Number(b.freight_amount || 0)
      totalLandedCost += landed
      totalGrandTotal += grand
      totalPaymentsMade += paid

      return {
        bill_id: b.id,
        voucher_number: b.voucher_number,
        supplier_invoice_number: b.supplier_invoice_number,
        accounting_date: b.accounting_date,
        company_name: b.company_name,
        vendor_name: b.vendor_name,
        procured_quantity: qty,
        taxable_value: Number(b.subtotal || 0),
        gst_amount: Number(b.gst_amount || 0),
        freight_amount: Number(b.freight_amount || 0),
        total_landed_cost: Number(landed.toFixed(2)),
        grand_total: grand,
        paid_amount: Number(paid.toFixed(2)),
        outstanding_payable: Number(outBal.toFixed(2)),
        items_count: items.length
      }
    })

    return res.json({
      financial_year: financial_year || `${startDate.slice(0, 4)}-${endDate.slice(2, 4)}`,
      date_range: { startDate, endDate },
      summary: {
        total_bills: bills.length,
        total_procured_quantity: totalProcuredQty,
        total_taxable_spend: Number(totalTaxableSpend.toFixed(2)),
        total_gst_paid: Number(totalGstPaid.toFixed(2)),
        total_freight_paid: Number(totalFreightPaid.toFixed(2)),
        total_actual_landed_cost: Number(totalLandedCost.toFixed(2)),
        total_procurement_spend_with_gst: Number(totalGrandTotal.toFixed(2)),
        total_payments_made: Number(totalPaymentsMade.toFixed(2)),
        net_outstanding_payable: Number((totalGrandTotal - totalPaymentsMade).toFixed(2))
      },
      bills: formattedBills
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 6. OVERALL TOTALS DASHBOARD
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/dashboard-totals', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id } = req.query

    // 1. Sales metrics
    const invoices = await getSalesInvoices(orgId, company_profile_id ? String(company_profile_id) : undefined)
    const activeInvoices = invoices.filter(i => i.status !== 'CANCELLED')
    const totalSalesRevenue = activeInvoices.reduce((s, i) => s + i.grand_total, 0)
    const totalSalesTokens = activeInvoices.reduce((s, i) => s + i.items.reduce((sum, it) => sum + (it.quantity || 0), 0), 0)
    const totalSalesReceivables = activeInvoices.reduce((s, i) => s + i.outstanding_balance, 0)
    const totalGrossProfit = activeInvoices.reduce((s, i) => s + (i.total_profit || 0), 0)

    // 2. Purchase metrics
    let billsSql = `SELECT grand_total, subtotal, freight_amount FROM token_purchase_bills WHERE organization_id = ? AND status = 'POSTED'`
    const billParams: any[] = [orgId]
    if (company_profile_id) {
      billsSql += ' AND company_profile_id = ?'
      billParams.push(String(company_profile_id))
    }
    const bills = await queryAll(billsSql, billParams)
    const totalPurchaseSpend = bills.reduce((s, b) => s + Number(b.grand_total || 0), 0)
    const totalFreightPaid = bills.reduce((s, b) => s + Number(b.freight_amount || 0), 0)
    const vendorPayments = await getVendorPayments(orgId)
    const totalVendorPayments = vendorPayments.reduce((s, p) => s + p.amount, 0)
    const totalPayables = Math.max(0, totalPurchaseSpend - totalVendorPayments)

    // 3. Estimates metrics
    const estimates = await getSalesEstimates(orgId, company_profile_id ? String(company_profile_id) : undefined)
    const pendingEstimates = estimates.filter(e => !['CONVERTED', 'CANCELLED', 'EXPIRED'].includes(e.status))
    const totalPipelineValue = pendingEstimates.reduce((s, e) => s + e.grand_total, 0)
    const totalPipelineTokens = pendingEstimates.reduce((s, e) => s + e.items.reduce((sum, it) => sum + (it.quantity || 0), 0), 0)

    return res.json({
      sales: {
        total_invoices: activeInvoices.length,
        total_tokens_sold: totalSalesTokens,
        total_revenue_with_gst: Number(totalSalesRevenue.toFixed(2)),
        total_outstanding_receivable: Number(totalSalesReceivables.toFixed(2)),
        total_gross_profit: Number(totalGrossProfit.toFixed(2))
      },
      purchases: {
        total_bills: bills.length,
        total_spend_with_gst: Number(totalPurchaseSpend.toFixed(2)),
        total_freight_paid: Number(totalFreightPaid.toFixed(2)),
        total_payments_made: Number(totalVendorPayments.toFixed(2)),
        total_outstanding_payable: Number(totalPayables.toFixed(2))
      },
      pipeline: {
        active_estimates_count: pendingEstimates.length,
        total_pipeline_value: Number(totalPipelineValue.toFixed(2)),
        total_tokens_quoted: totalPipelineTokens
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 7. PENDING SALES ESTIMATES & PIPELINE REPORT
// ----------------------------------------------------------------------------
reportsAndLedgersRouter.get('/reports/pending-estimates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id, assigned_to } = req.query
    const todayStr = new Date().toISOString().slice(0, 10)

    const allEstimates = await getSalesEstimates(orgId, company_profile_id ? String(company_profile_id) : undefined)

    // Exclude CONVERTED, CANCELLED, EXPIRED
    const pendingList = allEstimates.filter(e => {
      const isExcluded = ['CONVERTED', 'CANCELLED', 'EXPIRED'].includes(e.status)
      const matchRep = !assigned_to || e.assigned_to === assigned_to
      return !isExcluded && matchRep
    })

    let countExpectedToday = 0
    let countUpcoming = 0
    let countDueForClosure = 0
    let countOverdueClosure = 0

    let valExpectedToday = 0
    let valUpcoming = 0
    let valDueForClosure = 0
    let valOverdueClosure = 0

    const items = pendingList.map(est => {
      const estDate = est.estimate_date
      const closureDate = est.expected_closure_date || est.valid_until || estDate
      const daysPending = Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(estDate).getTime()) / (1000 * 60 * 60 * 24)))

      let pipelineCategory = 'Upcoming'

      if (closureDate === todayStr) {
        pipelineCategory = 'Expected Today'
        countExpectedToday++
        valExpectedToday += est.grand_total
      } else if (closureDate > todayStr) {
        // Within 7 days is due for closure, otherwise upcoming
        const daysDiff = Math.floor((new Date(closureDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff <= 7) {
          pipelineCategory = 'Due for Closure'
          countDueForClosure++
          valDueForClosure += est.grand_total
        } else {
          pipelineCategory = 'Upcoming'
          countUpcoming++
          valUpcoming += est.grand_total
        }
      } else {
        pipelineCategory = 'Overdue Closure'
        countOverdueClosure++
        valOverdueClosure += est.grand_total
      }

      const tokenQty = est.items.reduce((s, it) => s + (it.quantity || 0), 0)

      return {
        estimate_id: est.id,
        estimate_number: est.estimate_number,
        estimate_date: est.estimate_date,
        expected_closure_date: closureDate,
        valid_until: est.valid_until,
        assigned_to: est.assigned_to || 'Unassigned',
        customer_id: est.customer_id,
        customer_name: est.customer_snapshot?.company_name || 'Customer',
        token_quantity: tokenQty,
        taxable_amount: est.subtotal,
        tax_amount: est.tax_amount,
        grand_total: est.grand_total,
        status: est.status,
        days_pending: daysPending,
        pipeline_category: pipelineCategory
      }
    })

    // Sort by expected closure date ascending
    items.sort((a, b) => a.expected_closure_date.localeCompare(b.expected_closure_date))

    return res.json({
      summary: {
        total_pending_estimates: pendingList.length,
        total_pipeline_value: Number(pendingList.reduce((s, e) => s + e.grand_total, 0).toFixed(2)),
        pipeline_breakdown: {
          expected_today: { count: countExpectedToday, value: Number(valExpectedToday.toFixed(2)) },
          upcoming: { count: countUpcoming, value: Number(valUpcoming.toFixed(2)) },
          due_for_closure: { count: countDueForClosure, value: Number(valDueForClosure.toFixed(2)) },
          overdue_closure: { count: countOverdueClosure, value: Number(valOverdueClosure.toFixed(2)) }
        }
      },
      estimates: items
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

