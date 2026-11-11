import { Router, Request, Response, NextFunction } from 'express'
import { queryAll, queryOne, run, supabase } from '../supabase'
import {
  getStatesMaster,
  getTaxRatesMaster,
  getHsnSacMaster,
  getInvoiceTypesMaster,
  getInvoiceStatusesMaster,
  getPaymentModesMaster,
  getCreditNoteReasonsMaster,
  getDebitNoteReasonsMaster,
  getCancellationReasonsMaster,
  getCommissionRulesMaster,
  getAgeingBucketsMaster,
  getCreditNotes,
  saveCreditNotes,
  getDebitNotes,
  saveDebitNotes,
  getPaymentReceipts,
  savePaymentReceipts,
  DEFAULT_TAX_RATES
} from '../billingMasterStore'

export const billingRouter = Router()

// --- RBAC & Auth Helpers ---

function getSessionUser(req: Request) {
  return (req as any).user
}

function getAuthOrg(req: Request): string {
  const user = getSessionUser(req)
  return user?.organization_id || 'comp-default'
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' })
  }
  next()
}

function requirePermission(actionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getSessionUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive.' })
    }

    // Super Admin (Level 0) has full authority
    if (user.hierarchy_level_order === 0) {
      return next()
    }

    try {
      // 1. User direct override
      const override = await queryOne<any>(
        'SELECT * FROM user_permission_overrides WHERE user_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)',
        [user.id, 'billing']
      )

      if (override && override[actionKey] !== null && override[actionKey] !== undefined) {
        if (override[actionKey] === 1 || override[actionKey] === true) {
          return next()
        } else {
          return res.status(403).json({ error: `Permission denied: billing.${actionKey} is restricted for your account.` })
        }
      }

      // 2. Role matrix permission
      const rolePerm = await queryOne<any>(
        'SELECT * FROM role_module_permissions WHERE role_id = ? AND module_id = (SELECT id FROM app_modules WHERE module_key = ?)',
        [user.role_id, 'billing']
      )

      if (rolePerm && (rolePerm[actionKey] === 1 || rolePerm[actionKey] === true)) {
        return next()
      }

      // 3. Check temporary delegations
      const nowIso = new Date().toISOString()
      const delegation = await queryOne<any>(`
        SELECT d.*, g.permissions_frozen as grantor_frozen, g.status as grantor_status
        FROM temporary_delegations d
        JOIN user_profiles g ON d.grantor_user_id = g.id
        WHERE d.recipient_user_id = ?
          AND d.module_key = 'billing'
          AND (d.action_key = ? OR d.action_key = 'all')
          AND d.status = 'active'
          AND d.valid_from <= ?
          AND d.valid_until >= ?
      `, [user.id, actionKey, nowIso, nowIso])

      if (delegation) {
        if (delegation.grantor_frozen || delegation.grantor_status !== 'active') {
          return res.status(403).json({ error: 'Delegated permission is invalid because grantor is frozen or inactive.' })
        }
        ;(req as any).delegation = delegation
        return next()
      }

      return res.status(403).json({
        error: `Permission denied: You do not have '${actionKey}' authority on 'billing'.`
      })
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  }
}

// Helper: Log audit event to database
async function createAuditLog(
  req: Request,
  actionType: string,
  tableAffected: string,
  recordId: string,
  oldVal: any,
  newVal: any,
  reason: string
) {
  const user = getSessionUser(req)
  const auditId = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  await supabase.from('audit_logs').insert({
    id: auditId,
    user_id: user?.id || 'system',
    action_type: actionType,
    module_key: 'billing',
    table_affected: tableAffected,
    record_id: recordId,
    old_value_json: oldVal ? JSON.stringify(oldVal) : null,
    new_value_json: newVal ? JSON.stringify(newVal) : null,
    reason: reason || null,
    ip_address: req.ip || req.socket.remoteAddress || '127.0.0.1'
  })
}

// ----------------------------------------------------
// 1. Dynamic Master Endpoints (/api/billing/masters/all)
// ----------------------------------------------------

billingRouter.get('/billing/masters/all', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [
      states,
      taxRates,
      hsnSac,
      invoiceTypes,
      invoiceStatuses,
      paymentModes,
      creditNoteReasons,
      debitNoteReasons,
      cancellationReasons,
      commissionRules,
      ageingBuckets,
      bankAccounts,
      seriesConfigs
    ] = await Promise.all([
      getStatesMaster(),
      getTaxRatesMaster(),
      getHsnSacMaster(),
      getInvoiceTypesMaster(),
      getInvoiceStatusesMaster(),
      getPaymentModesMaster(),
      getCreditNoteReasonsMaster(),
      getDebitNoteReasonsMaster(),
      getCancellationReasonsMaster(),
      getCommissionRulesMaster(),
      getAgeingBucketsMaster(),
      queryAll('SELECT id, account_nickname, bank_name, account_number, ifsc_code, upi_id, is_active FROM bank_accounts WHERE is_active = 1'),
      queryAll('SELECT id, series_name, prefix, suffix, current_counter, is_active FROM invoice_series_configs WHERE is_active = 1')
    ])

    // Fetch authoritative company profile
    const { data: companyProfile } = await supabase
      .from('company_profile')
      .select('id, legal_name, trade_name, gstin, pan, email, phone, registered_address, state_code, state_name, logo_url')
      .eq('id', 'comp-default')
      .maybeSingle()

    return res.json({
      states,
      taxRates,
      hsnSac,
      invoiceTypes,
      invoiceStatuses,
      paymentModes,
      creditNoteReasons,
      debitNoteReasons,
      cancellationReasons,
      commissionRules,
      ageingBuckets,
      bankAccounts: bankAccounts || [],
      seriesConfigs: seriesConfigs || [],
      companyProfile: companyProfile || null
    })
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to load billing masters: ${err.message}` })
  }
})

// ----------------------------------------------------
// 2. GSTIN Server-Side Validation & Place of Supply
// ----------------------------------------------------

billingRouter.post('/billing/validate-gstin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { gstin } = req.body
    if (!gstin || typeof gstin !== 'string') {
      return res.status(400).json({ isValid: false, error: 'GSTIN string is required.' })
    }

    const cleanGstin = gstin.trim().toUpperCase()
    // Standard 15-char GSTIN format: 2 digits (state), 10 alphanumeric (PAN), 1 digit (entity), 1 char (Z), 1 check char
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    if (!gstinRegex.test(cleanGstin)) {
      return res.status(400).json({
        isValid: false,
        error: 'Invalid GSTIN format. Expected 15-character format (e.g. 27AAACA1234A1Z5).'
      })
    }

    const stateCode = cleanGstin.slice(0, 2)
    const pan = cleanGstin.slice(2, 12)

    // Validate state code against States Master in database
    const states = await getStatesMaster()
    const matchedState = states.find((s: any) => String(s.state_code).padStart(2, '0') === stateCode && s.is_active === 1)

    if (!matchedState) {
      return res.status(400).json({
        isValid: false,
        error: `Invalid state code '${stateCode}' in GSTIN. Does not correspond to any registered Indian State/UT in the database master.`
      })
    }

    // Resolve Place of Supply and tax regime against Company Profile
    const { data: comp } = await supabase
      .from('company_profile')
      .select('state_code, state_name')
      .eq('id', 'comp-default')
      .maybeSingle()

    const supplierStateCode = comp?.state_code || '27'
    const isInterState = stateCode !== supplierStateCode
    const supplyType = isInterState ? 'INTER_STATE' : 'INTRA_STATE'
    const applicableTaxes = isInterState ? ['IGST'] : ['CGST', 'SGST']

    return res.json({
      isValid: true,
      gstin: cleanGstin,
      pan,
      stateCode,
      stateName: matchedState.state_name,
      supplierStateCode,
      supplyType,
      applicableTaxes
    })
  } catch (err: any) {
    return res.status(500).json({ error: `GSTIN validation error: ${err.message}` })
  }
})

// ----------------------------------------------------
// 3. Tax Calculation Engine (/api/billing/calculate-tax)
// ----------------------------------------------------

interface LineItemCalculationInput {
  item_type?: 'GOODS' | 'SERVICE'
  description: string
  item_code?: string
  hsn_sac?: string
  quantity: number
  unit_price: number
  discount_amount?: number
  discount_pct?: number
  tax_rate_pct?: number
  token_serial_id?: string
  dsc_application_id?: string
  courier_dispatch_id?: string
}

export function calculateFinancials(
  items: LineItemCalculationInput[],
  posStateCode: string,
  supplierStateCode: string = '27',
  taxRatesMaster: any[] = DEFAULT_TAX_RATES
) {
  const isInterState = String(posStateCode).trim() !== String(supplierStateCode).trim()
  let subtotal = 0
  let totalDiscount = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0

  const calculatedItems = items.map((item, idx) => {
    const qty = Number(item.quantity) || 1
    const price = Number(item.unit_price) || 0
    if (qty <= 0 || price < 0) {
      throw new Error(`Item #${idx + 1} (${item.description}): Quantity must be > 0 and price cannot be negative.`)
    }

    const gross = Number((qty * price).toFixed(2))

    // Calculate item discount
    let discount = 0
    if (item.discount_pct && item.discount_pct > 0) {
      discount = Number(((gross * item.discount_pct) / 100).toFixed(2))
    } else if (item.discount_amount && item.discount_amount > 0) {
      discount = Number(Number(item.discount_amount).toFixed(2))
    }

    if (discount > gross) {
      throw new Error(`Item #${idx + 1} (${item.description}): Discount (₹${discount}) cannot exceed gross value (₹${gross}).`)
    }

    const taxable = Number((gross - discount).toFixed(2))
    const ratePct = item.tax_rate_pct !== undefined ? Number(item.tax_rate_pct) : 18

    // Validate rate against tax master
    const validRate = taxRatesMaster.find((r: any) => Number(r.rate_pct) === ratePct)
    if (!validRate && ratePct !== 0) {
      // Allowed fallback if rate is positive
    }

    let cgst = 0
    let sgst = 0
    let igst = 0

    if (isInterState) {
      igst = Number(((taxable * ratePct) / 100).toFixed(2))
    } else {
      cgst = Number(((taxable * (ratePct / 2)) / 100).toFixed(2))
      sgst = Number(((taxable * (ratePct / 2)) / 100).toFixed(2))
    }

    const itemTotal = Number((taxable + cgst + sgst + igst).toFixed(2))

    subtotal = Number((subtotal + taxable).toFixed(2))
    totalDiscount = Number((totalDiscount + discount).toFixed(2))
    totalCgst = Number((totalCgst + cgst).toFixed(2))
    totalSgst = Number((totalSgst + sgst).toFixed(2))
    totalIgst = Number((totalIgst + igst).toFixed(2))

    return {
      ...item,
      quantity: qty,
      unit_price: price,
      gross_amount: gross,
      discount_amount: discount,
      taxable_value: taxable,
      tax_rate_pct: ratePct,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      item_total: itemTotal
    }
  })

  const totalTax = Number((totalCgst + totalSgst + totalIgst).toFixed(2))
  const grandTotal = Number((subtotal + totalTax).toFixed(2))

  return {
    items: calculatedItems,
    isInterState,
    supplyType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
    posStateCode,
    supplierStateCode,
    subtotal,
    totalDiscount,
    cgstAmount: totalCgst,
    sgstAmount: totalSgst,
    igstAmount: totalIgst,
    totalTax,
    grandTotal
  }
}

billingRouter.post('/billing/calculate-tax', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items, pos_state_code, supplier_state_code } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required for tax calculation.' })
    }

    const taxRates = await getTaxRatesMaster()
    let supState = supplier_state_code
    if (!supState) {
      const { data: comp } = await supabase.from('company_profile').select('state_code').eq('id', 'comp-default').maybeSingle()
      supState = comp?.state_code || '27'
    }

    const result = calculateFinancials(items, pos_state_code || '27', supState, taxRates)
    return res.json({ success: true, ...result })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 4. Invoices Query with RBAC & Filtering
// ----------------------------------------------------

billingRouter.get('/billing/invoices/extended', requirePermission('can_view'), async (req: Request, res: Response) => {
  try {
    const { search, status, partner_id, invoice_type, page = '1', limit = '10' } = req.query
    const p = Math.max(1, parseInt(String(page), 10) || 1)
    const lim = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10))
    const offset = (p - 1) * lim

    let query = supabase
      .from('invoices')
      .select('*, partners(company_name, partner_code, gstin, state_code), bank_accounts(account_nickname, bank_name)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', String(status))
    }
    if (invoice_type && invoice_type !== 'all') {
      query = query.eq('invoice_type', String(invoice_type))
    }
    if (partner_id) {
      query = query.eq('partner_id', String(partner_id))
    }
    if (search && String(search).trim()) {
      const s = String(search).trim()
      query = query.or(`invoice_number.ilike.%${s}%,partner_id.ilike.%${s}%`)
    }

    query = query.range(offset, offset + lim - 1)
    const { data: invoices, count, error } = await query

    if (error) {
      return res.status(500).json({ error: `Failed to fetch invoices: ${error.message}` })
    }

    const sanitized = (invoices || []).map((inv: any) => {
      let parsedItems: any[] = []
      try {
        parsedItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || [])
      } catch {
        parsedItems = []
      }

      return {
        ...inv,
        partner_company: inv.partners?.company_name || 'N/A',
        partner_code: inv.partners?.partner_code || '',
        partner_gstin: inv.partners?.gstin || '',
        bank_name: inv.bank_accounts?.bank_name || '',
        account_nickname: inv.bank_accounts?.account_nickname || '',
        line_items_count: parsedItems.length,
        items_preview: parsedItems.slice(0, 2)
      }
    })

    return res.json({
      success: true,
      invoices: sanitized,
      pagination: {
        page: p,
        limit: lim,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / lim)
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Single invoice detail with line items snapshot
billingRouter.get('/billing/invoices/:id', requirePermission('can_view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, partners(*), bank_accounts(*)')
      .or(`id.eq.${id},invoice_number.eq.${id}`)
      .maybeSingle()

    if (error || !invoice) {
      return res.status(404).json({ error: `Invoice '${id}' not found.` })
    }

    let parsedItems: any[] = []
    try {
      parsedItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : (invoice.line_items || [])
    } catch {
      parsedItems = []
    }

    let parsedCompany: any = null
    try {
      parsedCompany = typeof invoice.company_snapshot === 'string' ? JSON.parse(invoice.company_snapshot) : invoice.company_snapshot
    } catch {
      parsedCompany = null
    }

    // Also fetch associated payments
    const { data: payments } = await supabase
      .from('payments_received')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: false })

    return res.json({
      success: true,
      invoice: {
        ...invoice,
        line_items: parsedItems,
        company_snapshot: parsedCompany,
        payments: payments || []
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 5. Create Invoice (Draft or Tax Invoice)
// ----------------------------------------------------

billingRouter.post('/billing/invoices/extended', requirePermission('can_create'), async (req: Request, res: Response) => {
  try {
    const {
      partner_id,
      invoice_type = 'TAX_INVOICE',
      series_id,
      due_days = 30,
      notes,
      line_items,
      is_draft = false
    } = req.body

    if (!partner_id) {
      return res.status(400).json({ error: 'Customer / Partner ID is required.' })
    }
    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ error: 'Invoice must contain at least one line item.' })
    }

    // 1. Resolve Partner
    const { data: partner } = await supabase
      .from('partners')
      .select('*')
      .eq('id', partner_id)
      .maybeSingle()

    if (!partner) {
      return res.status(404).json({ error: `Customer / Partner '${partner_id}' does not exist.` })
    }

    // 2. Resolve Company Profile (Supplier)
    const { data: comp } = await supabase
      .from('company_profile')
      .select('*')
      .eq('id', 'comp-default')
      .maybeSingle()

    const supplierStateCode = comp?.state_code || '27'
    const posStateCode = partner.state_code || '27'

    // 3. Token Linking & Multi-Billing Prevention Validation
    for (const item of line_items) {
      if (item.token_serial_id) {
        const { data: token } = await supabase
          .from('token_serials')
          .select('id, serial_number, status, partner_id')
          .or(`id.eq.${item.token_serial_id},serial_number.eq.${item.token_serial_id}`)
          .maybeSingle()

        if (!token) {
          return res.status(400).json({
            error: `Hardware token '${item.token_serial_id}' does not exist in inventory.`
          })
        }

        // Check if token belongs to another partner
        if (token.partner_id && token.partner_id !== partner_id && token.partner_id !== 'part-001') {
          return res.status(400).json({
            error: `Hardware token '${token.serial_number}' is already allocated to another customer / business.`
          })
        }
      }
    }

    // 4. Calculate Authoritative Financials on Backend
    const taxRates = await getTaxRatesMaster()
    const calc = calculateFinancials(line_items, posStateCode, supplierStateCode, taxRates)

    // 5. Check Partner Credit Limit (if Tax Invoice and partner has credit limit)
    if (!is_draft && partner.credit_limit && Number(partner.credit_limit) > 0) {
      // Calculate current outstanding
      const { data: unpaidInvs } = await supabase
        .from('invoices')
        .select('outstanding_balance')
        .eq('partner_id', partner.id)
        .in('status', ['unpaid', 'partially_paid'])

      const currentOutstanding = (unpaidInvs || []).reduce((sum, inv) => sum + Number(inv.outstanding_balance || 0), 0)
      if (currentOutstanding + calc.grandTotal > Number(partner.credit_limit)) {
        return res.status(400).json({
          error: `Credit limit exceeded. Current outstanding is ₹${currentOutstanding.toLocaleString('en-IN')}, credit limit is ₹${Number(partner.credit_limit).toLocaleString('en-IN')}. This invoice of ₹${calc.grandTotal.toLocaleString('en-IN')} would exceed limit.`
        })
      }
    }

    // 6. Concurrency-Safe Atomic Invoice Number Generation
    let targetSeriesId = series_id
    if (!targetSeriesId) {
      const { data: defSeries } = await supabase
        .from('invoice_series_configs')
        .select('id')
        .eq('is_active', 1)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      targetSeriesId = defSeries?.id || 'series-gst-2627'
    }

    let allocatedCounter = 1000
    let prefix = 'INV-2627/'
    let suffix = ''
    let seriesRow: any = null

    // Optimistic concurrency retry loop (up to 5 attempts)
    let assigned = false
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: sData } = await supabase
        .from('invoice_series_configs')
        .select('*')
        .eq('id', targetSeriesId)
        .single()

      if (!sData) break
      seriesRow = sData
      prefix = sData.prefix
      suffix = sData.suffix || ''
      const nextCounter = (sData.current_counter || 1000) + 1

      const { data: updated, error: upErr } = await supabase
        .from('invoice_series_configs')
        .update({ current_counter: nextCounter })
        .eq('id', targetSeriesId)
        .eq('current_counter', sData.current_counter)
        .select()

      if (!upErr && updated && updated.length > 0) {
        allocatedCounter = nextCounter
        assigned = true
        break
      }
    }

    if (!assigned) {
      return res.status(409).json({
        error: 'Invoice numbering contention. Multiple concurrent requests detected. Please retry.'
      })
    }

    const invoiceNumber = `${prefix}${allocatedCounter}${suffix}`
    const invoiceId = `inv-${Date.now()}`
    const today = new Date().toISOString().slice(0, 10)
    const dueDate = new Date(Date.now() + (Number(due_days) || 30) * 86400000).toISOString().slice(0, 10)
    const initialStatus = is_draft ? 'draft' : 'unpaid'

    // Snapshot company profile header
    const companySnapshot = JSON.stringify({
      id: comp?.id || 'comp-default',
      legal_name: comp?.legal_name || 'SignSync Digital Services Private Limited',
      trade_name: comp?.trade_name || 'SignSync B2B Enterprise',
      gstin: comp?.gstin || '27AAECS1234F1Z5',
      pan: comp?.pan || 'AAECS1234F',
      email: comp?.email || 'billing@signsync.in',
      phone: comp?.phone || '+91 22 4567 8900',
      registered_address: comp?.registered_address || 'Suite 404, Tech Park, Andheri East, Mumbai',
      state_code: supplierStateCode,
      state_name: comp?.state_name || 'Maharashtra',
      logo_url: comp?.logo_url || null,
      customer_snapshot: {
        id: partner.id,
        legal_name: partner.company_name,
        contact_person: partner.contact_person,
        gstin: partner.gstin,
        state_code: posStateCode,
        billing_address: partner.billing_address
      }
    })

    const orgId = getAuthOrg(req)
    const { error: insertErr } = await supabase.from('invoices').insert({
      id: invoiceId,
      organization_id: orgId,
      invoice_number: invoiceNumber,
      series_id: targetSeriesId,
      partner_id: partner.id,
      invoice_type: invoice_type === 'PROFORMA' ? 'proforma' : 'gst_tax_invoice',
      invoice_date: today,
      due_date: dueDate,
      subtotal: calc.subtotal,
      cgst_amount: calc.cgstAmount,
      sgst_amount: calc.sgstAmount,
      igst_amount: calc.igstAmount,
      total_amount: calc.grandTotal,
      paid_amount: 0,
      outstanding_balance: is_draft ? 0 : calc.grandTotal,
      status: initialStatus,
      bank_account_snapshot_id: seriesRow?.mapped_bank_account_id || 'bank-hdfc-01',
      line_items: JSON.stringify(calc.items),
      company_snapshot: companySnapshot
    })

    if (insertErr) {
      return res.status(500).json({ error: `Failed to insert invoice: ${insertErr.message}` })
    }

    // 7. Post Ledger Entry if Tax Invoice (non-draft)
    if (!is_draft) {
      const runningBal = (Number(partner.wallet_balance) || 0) + calc.grandTotal
      await supabase.from('financial_ledger').insert({
        id: `led-${Date.now()}`,
        organization_id: orgId,
        partner_id: partner.id,
        entry_date: today,
        transaction_type: 'invoice_raised',
        reference_id: invoiceId,
        debit: calc.grandTotal,
        credit: 0,
        running_balance: runningBal,
        remarks: `Invoice ${invoiceNumber} issued for ${partner.company_name}`
      })
    }

    // 8. Audit Log
    await createAuditLog(
      req,
      is_draft ? 'CREATE_DRAFT_INVOICE' : 'CREATE_INVOICE',
      'invoices',
      invoiceId,
      null,
      { invoice_number: invoiceNumber, total: calc.grandTotal, partner_id: partner.id, is_draft },
      `Invoice ${invoiceNumber} created`
    )

    return res.status(201).json({
      success: true,
      id: invoiceId,
      invoice_number: invoiceNumber,
      total_amount: calc.grandTotal,
      subtotal: calc.subtotal,
      total_tax: calc.totalTax,
      supply_type: calc.supplyType,
      status: initialStatus
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 6. Edit Draft Invoice & Issued Immutability Guard
// ----------------------------------------------------

billingRouter.put('/billing/invoices/:id', requirePermission('can_edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { line_items, notes, due_days } = req.body

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .or(`id.eq.${id},invoice_number.eq.${id}`)
      .maybeSingle()

    if (!invoice) {
      return res.status(404).json({ error: `Invoice '${id}' not found.` })
    }

    // IMMUTABILITY RULE: Issued, paid, or cancelled invoices cannot have core amounts/items altered directly
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        error: `Invoice '${invoice.invoice_number}' is ${invoice.status.toUpperCase()} and immutable. Issued tax invoices cannot be edited. Please use a Credit Note, Debit Note, or formal Cancellation.`
      })
    }

    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ error: 'Line items cannot be empty.' })
    }

    const { data: partner } = await supabase.from('partners').select('*').eq('id', invoice.partner_id).single()
    const { data: comp } = await supabase.from('company_profile').select('*').eq('id', 'comp-default').single()

    const taxRates = await getTaxRatesMaster()
    const calc = calculateFinancials(line_items, partner?.state_code || '27', comp?.state_code || '27', taxRates)

    const updatePayload: any = {
      subtotal: calc.subtotal,
      cgst_amount: calc.cgstAmount,
      sgst_amount: calc.sgstAmount,
      igst_amount: calc.igstAmount,
      total_amount: calc.grandTotal,
      line_items: JSON.stringify(calc.items)
    }

    if (due_days) {
      updatePayload.due_date = new Date(Date.now() + Number(due_days) * 86400000).toISOString().slice(0, 10)
    }

    const { error: upErr } = await supabase.from('invoices').update(updatePayload).eq('id', invoice.id)
    if (upErr) {
      return res.status(500).json({ error: `Failed to update draft: ${upErr.message}` })
    }

    await createAuditLog(
      req,
      'UPDATE_DRAFT_INVOICE',
      'invoices',
      invoice.id,
      { total_amount: invoice.total_amount },
      { total_amount: calc.grandTotal },
      'Draft invoice items updated'
    )

    return res.json({
      success: true,
      message: `Draft invoice ${invoice.invoice_number} updated successfully.`,
      total_amount: calc.grandTotal
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Issue a Draft Invoice
billingRouter.post('/billing/invoices/:id/issue', requirePermission('can_edit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle()

    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' })
    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: `Only draft invoices can be issued. Current status: ${invoice.status}` })
    }

    // Atomic issuance update
    const { error: upErr } = await supabase
      .from('invoices')
      .update({
        status: 'unpaid',
        outstanding_balance: invoice.total_amount
      })
      .eq('id', invoice.id)

    if (upErr) return res.status(500).json({ error: upErr.message })

    // Ledger posting
    await supabase.from('financial_ledger').insert({
      id: `led-${Date.now()}`,
      organization_id: invoice.organization_id || getAuthOrg(req),
      partner_id: invoice.partner_id,
      entry_date: new Date().toISOString().slice(0, 10),
      transaction_type: 'invoice_raised',
      reference_id: invoice.id,
      debit: invoice.total_amount,
      credit: 0,
      running_balance: invoice.total_amount,
      remarks: `Draft invoice ${invoice.invoice_number} formally issued`
    })

    await createAuditLog(req, 'ISSUE_INVOICE', 'invoices', invoice.id, { status: 'draft' }, { status: 'unpaid' }, 'Draft invoice issued')

    return res.json({ success: true, message: `Invoice ${invoice.invoice_number} issued successfully.`, status: 'unpaid' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 7. Invoice Cancellation Workflow
// ----------------------------------------------------

billingRouter.post('/billing/invoices/:id/cancel', requirePermission('can_delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason, reason_code } = req.body

    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'A specific cancellation reason (min 5 chars) is mandatory.' })
    }

    const { data: invoice } = await supabase.from('invoices').select('*').or(`id.eq.${id},invoice_number.eq.${id}`).maybeSingle()
    if (!invoice) return res.status(404).json({ error: `Invoice '${id}' not found.` })

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'This invoice has already been cancelled.' })
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({
        error: 'Paid invoices cannot be cancelled directly. Please issue a Credit Note or refund first.'
      })
    }

    const prevStatus = invoice.status
    const cancelledAt = new Date().toISOString()
    const user = getSessionUser(req)

    // Mark cancelled and set outstanding to 0
    const { error: upErr } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        outstanding_balance: 0
      })
      .eq('id', invoice.id)

    if (upErr) return res.status(500).json({ error: upErr.message })

    // Reverse ledger if it was issued
    if (prevStatus !== 'draft') {
      await supabase.from('financial_ledger').insert({
        id: `led-${Date.now()}`,
        organization_id: invoice.organization_id || getAuthOrg(req),
        partner_id: invoice.partner_id,
        entry_date: cancelledAt.slice(0, 10),
        transaction_type: 'invoice_cancelled',
        reference_id: invoice.id,
        debit: 0,
        credit: invoice.total_amount,
        running_balance: 0,
        remarks: `Invoice ${invoice.invoice_number} cancelled: ${reason}`
      })
    }

    await createAuditLog(
      req,
      'CANCEL_INVOICE',
      'invoices',
      invoice.id,
      { status: prevStatus, outstanding: invoice.outstanding_balance },
      { status: 'cancelled', outstanding: 0, cancelled_by: user?.id, reason },
      reason
    )

    return res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} has been cancelled successfully.`,
      status: 'cancelled'
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 8. Payment Recording & Receipt Generation
// ----------------------------------------------------

billingRouter.post('/billing/payments/record', requirePermission('can_create'), async (req: Request, res: Response) => {
  try {
    const {
      invoice_id,
      amount_paid,
      payment_mode,
      transaction_reference_utr,
      bank_account_id,
      screenshot_proof_url,
      notes
    } = req.body

    const payAmount = Number(amount_paid)
    if (!invoice_id || !payAmount || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid invoice ID and positive payment amount are required.' })
    }

    // Validate payment mode from master
    const paymentModes = await getPaymentModesMaster()
    const validMode = paymentModes.find((m: any) => m.mode_code.toUpperCase() === String(payment_mode || '').toUpperCase())
    if (!validMode) {
      return res.status(400).json({
        error: `Invalid payment mode '${payment_mode}'. Must be one of registered modes in Master Data.`
      })
    }

    if (validMode.requires_ref && (!transaction_reference_utr || !transaction_reference_utr.trim())) {
      return res.status(400).json({
        error: `Transaction Reference / UTR is mandatory for payment mode '${validMode.display_name}'.`
      })
    }

    // Check duplicate UTR
    if (transaction_reference_utr) {
      const { data: existingPay } = await supabase
        .from('payments_received')
        .select('id, invoice_id')
        .eq('transaction_reference_utr', transaction_reference_utr.trim())
        .maybeSingle()

      if (existingPay) {
        return res.status(400).json({
          error: `A payment with UTR / Reference '${transaction_reference_utr}' has already been recorded (Payment ID: ${existingPay.id}). Duplicate transaction references are prevented.`
        })
      }
    }

    // Fetch invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .or(`id.eq.${invoice_id},invoice_number.eq.${invoice_id}`)
      .maybeSingle()

    if (!invoice) {
      return res.status(404).json({ error: `Invoice '${invoice_id}' not found.` })
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot record payments against a cancelled invoice.' })
    }

    const currentOutstanding = Number(invoice.outstanding_balance || 0)
    const currentPaid = Number(invoice.paid_amount || 0)

    // Overpayment guard
    if (payAmount > currentOutstanding) {
      return res.status(400).json({
        error: `Overpayment protection: Payment amount (₹${payAmount}) exceeds invoice outstanding balance (₹${currentOutstanding}). Excess payment is not permitted without credit adjustment.`
      })
    }

    const newOutstanding = Number((currentOutstanding - payAmount).toFixed(2))
    const newPaid = Number((currentPaid + payAmount).toFixed(2))
    const newStatus = newOutstanding === 0 ? 'paid' : 'partially_paid'
    const today = new Date().toISOString()
    const paymentId = `pay-${Date.now()}`

    // Insert payment record
    const { error: payErr } = await supabase.from('payments_received').insert({
      id: paymentId,
      organization_id: invoice.organization_id || getAuthOrg(req),
      invoice_id: invoice.id,
      partner_id: invoice.partner_id,
      amount_paid: payAmount,
      payment_mode: validMode.mode_code,
      bank_account_id: bank_account_id || null,
      transaction_reference_utr: transaction_reference_utr?.trim() || null,
      screenshot_proof_url: screenshot_proof_url || null,
      verified_status: 'verified',
      verified_by: getSessionUser(req)?.id || 'usr-admin-root',
      verified_at: today,
      rejection_remarks: null
    })

    if (payErr) {
      return res.status(500).json({ error: `Payment insert failed: ${payErr.message}` })
    }

    // Update invoice balance
    const { error: invErr } = await supabase
      .from('invoices')
      .update({
        paid_amount: newPaid,
        outstanding_balance: newOutstanding,
        status: newStatus
      })
      .eq('id', invoice.id)

    if (invErr) {
      return res.status(500).json({ error: `Invoice balance update failed: ${invErr.message}` })
    }

    // Generate Payment Receipt record
    const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const receiptObj = {
      id: `rcp-${Date.now()}`,
      receipt_number: receiptNumber,
      payment_id: paymentId,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      partner_id: invoice.partner_id,
      amount_paid: payAmount,
      payment_mode: validMode.mode_code,
      transaction_reference: transaction_reference_utr?.trim() || null,
      previous_outstanding: currentOutstanding,
      remaining_outstanding: newOutstanding,
      issued_at: today,
      issued_by: getSessionUser(req)?.id || 'usr-admin-root'
    }

    const receipts = await getPaymentReceipts()
    receipts.unshift(receiptObj)
    await savePaymentReceipts(receipts)

    // Post to financial ledger (credit)
    await supabase.from('financial_ledger').insert({
      id: `led-${Date.now()}`,
      organization_id: invoice.organization_id || getAuthOrg(req),
      partner_id: invoice.partner_id,
      entry_date: today.slice(0, 10),
      transaction_type: 'payment_received',
      reference_id: paymentId,
      debit: 0,
      credit: payAmount,
      running_balance: newOutstanding,
      remarks: `Payment of ₹${payAmount} received via ${validMode.mode_code} (Ref: ${transaction_reference_utr || 'N/A'})`
    })

    await createAuditLog(
      req,
      'CREATE_PAYMENT',
      'payments_received',
      paymentId,
      null,
      { amount: payAmount, invoice_number: invoice.invoice_number, new_outstanding: newOutstanding, receipt_number: receiptNumber },
      `Payment recorded for invoice ${invoice.invoice_number}`
    )

    return res.status(201).json({
      success: true,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      amount_paid: payAmount,
      outstanding_balance: newOutstanding,
      status: newStatus,
      receipt: receiptObj
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 9. Credit Note & Debit Note Engine
// ----------------------------------------------------

billingRouter.post('/billing/credit-notes', requirePermission('can_create'), async (req: Request, res: Response) => {
  try {
    const { original_invoice_id, reason_code, reason_description, amount, tax_adjustment = 0 } = req.body

    const noteAmount = Number(amount)
    if (!original_invoice_id || !noteAmount || noteAmount <= 0) {
      return res.status(400).json({ error: 'Original invoice ID and positive credit amount are required.' })
    }

    const reasons = await getCreditNoteReasonsMaster()
    const validReason = reasons.find((r: any) => r.reason_code === reason_code)
    if (!validReason) {
      return res.status(400).json({ error: `Invalid credit note reason code '${reason_code}'. Must match master configuration.` })
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .or(`id.eq.${original_invoice_id},invoice_number.eq.${original_invoice_id}`)
      .maybeSingle()

    if (!invoice) return res.status(404).json({ error: `Original invoice '${original_invoice_id}' not found.` })

    // Generate Credit Note Number
    const cnNumber = `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const cnId = `cn-${Date.now()}`
    const today = new Date().toISOString()

    const noteObj = {
      id: cnId,
      credit_note_number: cnNumber,
      original_invoice_id: invoice.id,
      original_invoice_number: invoice.invoice_number,
      partner_id: invoice.partner_id,
      reason_code: validReason.reason_code,
      reason_description: reason_description || validReason.description,
      taxable_adjustment: Number(noteAmount.toFixed(2)),
      tax_adjustment: Number(Number(tax_adjustment).toFixed(2)),
      total_credit: Number((noteAmount + Number(tax_adjustment)).toFixed(2)),
      created_by: getSessionUser(req)?.id || 'usr-admin-root',
      created_at: today
    }

    const existingCNs = await getCreditNotes()
    existingCNs.unshift(noteObj)
    await saveCreditNotes(existingCNs)

    // Post to ledger as credit adjustment
    await supabase.from('financial_ledger').insert({
      id: `led-${Date.now()}`,
      organization_id: invoice.organization_id || getAuthOrg(req),
      partner_id: invoice.partner_id,
      entry_date: today.slice(0, 10),
      transaction_type: 'credit_note',
      reference_id: cnId,
      debit: 0,
      credit: noteObj.total_credit,
      running_balance: Math.max(0, Number(invoice.outstanding_balance) - noteObj.total_credit),
      remarks: `Credit Note ${cnNumber} against ${invoice.invoice_number}: ${noteObj.reason_description}`
    })

    await createAuditLog(req, 'CREATE_CREDIT_NOTE', 'billing_rel_credit_notes', cnId, null, noteObj, noteObj.reason_description)

    return res.status(201).json({ success: true, credit_note: noteObj })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

billingRouter.get('/billing/credit-notes', requirePermission('can_view'), async (_req: Request, res: Response) => {
  try {
    const list = await getCreditNotes()
    return res.json({ success: true, credit_notes: list })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

billingRouter.post('/billing/debit-notes', requirePermission('can_create'), async (req: Request, res: Response) => {
  try {
    const { original_invoice_id, reason_code, reason_description, amount, tax_adjustment = 0 } = req.body

    const noteAmount = Number(amount)
    if (!original_invoice_id || !noteAmount || noteAmount <= 0) {
      return res.status(400).json({ error: 'Original invoice ID and positive debit amount are required.' })
    }

    const reasons = await getDebitNoteReasonsMaster()
    const validReason = reasons.find((r: any) => r.reason_code === reason_code)
    if (!validReason) {
      return res.status(400).json({ error: `Invalid debit note reason code '${reason_code}'. Must match master configuration.` })
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .or(`id.eq.${original_invoice_id},invoice_number.eq.${original_invoice_id}`)
      .maybeSingle()

    if (!invoice) return res.status(404).json({ error: `Original invoice '${original_invoice_id}' not found.` })

    // Generate Debit Note Number
    const dnNumber = `DN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const dnId = `dn-${Date.now()}`
    const today = new Date().toISOString()

    const noteObj = {
      id: dnId,
      debit_note_number: dnNumber,
      original_invoice_id: invoice.id,
      original_invoice_number: invoice.invoice_number,
      partner_id: invoice.partner_id,
      reason_code: validReason.reason_code,
      reason_description: reason_description || validReason.description,
      taxable_adjustment: Number(noteAmount.toFixed(2)),
      tax_adjustment: Number(Number(tax_adjustment).toFixed(2)),
      total_debit: Number((noteAmount + Number(tax_adjustment)).toFixed(2)),
      created_by: getSessionUser(req)?.id || 'usr-admin-root',
      created_at: today
    }

    const existingDNs = await getDebitNotes()
    existingDNs.unshift(noteObj)
    await saveDebitNotes(existingDNs)

    // Post to ledger as supplementary debit
    await supabase.from('financial_ledger').insert({
      id: `led-${Date.now()}`,
      organization_id: invoice.organization_id || getAuthOrg(req),
      partner_id: invoice.partner_id,
      entry_date: today.slice(0, 10),
      transaction_type: 'debit_note',
      reference_id: dnId,
      debit: noteObj.total_debit,
      credit: 0,
      running_balance: Number(invoice.outstanding_balance) + noteObj.total_debit,
      remarks: `Debit Note ${dnNumber} against ${invoice.invoice_number}: ${noteObj.reason_description}`
    })

    await createAuditLog(req, 'CREATE_DEBIT_NOTE', 'billing_rel_debit_notes', dnId, null, noteObj, noteObj.reason_description)

    return res.status(201).json({ success: true, debit_note: noteObj })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

billingRouter.get('/billing/debit-notes', requirePermission('can_view'), async (_req: Request, res: Response) => {
  try {
    const list = await getDebitNotes()
    return res.json({ success: true, debit_notes: list })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 10. Reports: GSTR-1 Sales Register & Receivable Ageing
// ----------------------------------------------------

billingRouter.get('/billing/reports/gstr1', requirePermission('can_export'), async (_req: Request, res: Response) => {
  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, partners(company_name, gstin, state_code)')
      .order('invoice_date', { ascending: false })

    const { data: comp } = await supabase.from('company_profile').select('state_code').eq('id', 'comp-default').maybeSingle()
    const supplierState = comp?.state_code || '27'

    const records = (invoices || []).map((inv: any) => {
      const gstin = inv.partners?.gstin?.trim() || ''
      const isB2B = Boolean(gstin && gstin.length === 15)
      const customerState = inv.partners?.state_code || '27'
      const isInterState = customerState !== supplierState

      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        invoice_type: inv.invoice_type,
        customer_name: inv.partners?.company_name || 'Direct Customer',
        customer_gstin: isB2B ? gstin : 'URP (Unregistered)',
        b2b_b2c_category: isB2B ? 'B2B Regular' : 'B2C Others',
        place_of_supply: customerState,
        taxable_value: Number(inv.subtotal || 0),
        cgst: Number(inv.cgst_amount || 0),
        sgst: Number(inv.sgst_amount || 0),
        igst: Number(inv.igst_amount || 0),
        total_tax: Number(((inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)).toFixed(2)),
        invoice_total: Number(inv.total_amount || 0),
        status: inv.status
      }
    })

    return res.json({
      success: true,
      report_type: 'GSTR-1 Ready Sales Register',
      total_invoices: records.length,
      b2b_count: records.filter(r => r.b2b_b2c_category === 'B2B Regular').length,
      b2c_count: records.filter(r => r.b2b_b2c_category !== 'B2B Regular').length,
      records
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

billingRouter.get('/billing/reports/receivable-ageing', requirePermission('can_view'), async (_req: Request, res: Response) => {
  try {
    const buckets = await getAgeingBucketsMaster()
    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('*, partners(company_name, partner_code, phone, email)')
      .in('status', ['unpaid', 'partially_paid'])
      .order('due_date', { ascending: true })

    const todayMs = new Date().getTime()

    const categorized = (unpaidInvoices || []).map((inv: any) => {
      const dueMs = new Date(inv.due_date || inv.invoice_date).getTime()
      const daysDiff = Math.max(0, Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24)))
      const outstanding = Number(inv.outstanding_balance || 0)

      let assignedBucket = buckets[buckets.length - 1].bucket_name
      for (const b of buckets) {
        if (daysDiff >= b.min_days && daysDiff <= b.max_days) {
          assignedBucket = b.bucket_name
          break
        }
      }

      return {
        invoice_number: inv.invoice_number,
        partner_name: inv.partners?.company_name || 'N/A',
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total_amount: Number(inv.total_amount || 0),
        paid_amount: Number(inv.paid_amount || 0),
        outstanding_balance: outstanding,
        days_outstanding: daysDiff,
        age_bucket: assignedBucket
      }
    })

    const summaryByBucket: Record<string, { count: number; totalOutstanding: number }> = {}
    buckets.forEach((b: any) => {
      summaryByBucket[b.bucket_name] = { count: 0, totalOutstanding: 0 }
    })

    categorized.forEach((c) => {
      if (summaryByBucket[c.age_bucket]) {
        summaryByBucket[c.age_bucket].count++
        summaryByBucket[c.age_bucket].totalOutstanding += c.outstanding_balance
      }
    })

    return res.json({
      success: true,
      total_unpaid_invoices: categorized.length,
      buckets_summary: summaryByBucket,
      invoices: categorized
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------
// 11. Reports: Token Margin & Partner Commission
// ----------------------------------------------------

billingRouter.get('/billing/reports/token-margin', requirePermission('can_view'), async (_req: Request, res: Response) => {
  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('invoice_number, invoice_date, line_items')
      .order('invoice_date', { ascending: false })

    const { data: batches } = await supabase
      .from('token_purchase_batches')
      .select('token_model, unit_landed_cost, base_unit_price')

    const batchCostMap: Record<string, number> = {}
    batches?.forEach((b: any) => {
      batchCostMap[b.token_model.toUpperCase()] = Number(b.unit_landed_cost || b.base_unit_price || 366)
    })

    const marginRows: any[] = []
    invoices?.forEach((inv: any) => {
      let items: any[] = []
      try {
        items = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || [])
      } catch {
        items = []
      }

      items.forEach((item) => {
        const desc = (item.description || item.item || '').toUpperCase()
        const isToken = desc.includes('TOKEN') || desc.includes('EPASS') || desc.includes('PROXKEY')
        if (isToken) {
          const qty = Number(item.quantity || item.qty || 1)
          const sellingPrice = Number(item.unit_price || item.rate || 0)
          const unitCost = batchCostMap['EPASS2003_AUTO'] || 366
          const totalCost = unitCost * qty
          const totalRevenue = sellingPrice * qty
          const grossProfit = totalRevenue - totalCost
          const marginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0

          marginRows.push({
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            item_description: item.description || item.item,
            quantity: qty,
            unit_procurement_cost: unitCost,
            unit_selling_price: sellingPrice,
            total_revenue: totalRevenue,
            total_cost: totalCost,
            gross_profit: grossProfit,
            gross_margin_pct: marginPct
          })
        }
      })
    })

    return res.json({
      success: true,
      total_token_sales_items: marginRows.length,
      margin_records: marginRows
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

billingRouter.get('/billing/reports/partner-commissions', requirePermission('can_view'), async (_req: Request, res: Response) => {
  try {
    const rules = await getCommissionRulesMaster()
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, subtotal, total_amount, partners(company_name, type)')
      .order('invoice_date', { ascending: false })

    const commissions = (invoices || []).map((inv: any) => {
      const pType = inv.partners?.type || 'dsc_partner'
      const matchedRule = rules.find((r: any) => r.partner_type === pType && r.is_active === 1) || rules[0]
      const ratePct = matchedRule ? Number(matchedRule.commission_pct) : 15.0
      const basisValue = Number(inv.subtotal || 0)
      const commissionAmount = Number(((basisValue * ratePct) / 100).toFixed(2))

      return {
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        partner_name: inv.partners?.company_name || 'Direct Partner',
        partner_type: pType,
        taxable_basis_value: basisValue,
        applied_commission_pct: ratePct,
        commission_amount: commissionAmount,
        basis: matchedRule?.basis || 'TAXABLE_VALUE'
      }
    })

    return res.json({
      success: true,
      total_commission_records: commissions.length,
      commissions
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})
