import { Router, Request, Response, NextFunction } from 'express'
import {
  DocumentType,
  validateDocumentTemplateHtml,
  renderDocumentHtml,
  getDefaultTemplateHtmlForType,
  UnifiedDocumentContext,
  DocumentItemContext
} from '../documentTemplateEngine'
import {
  getDocumentTemplates,
  getDocumentTemplateById,
  saveDocumentTemplate,
  resolveActiveDocumentTemplate,
  DocumentHtmlTemplate
} from '../documentTemplateStore'
import {
  getDocumentNumberingSeries,
  saveDocumentNumberingSeries,
  getDocumentNumberingRules,
  saveDocumentNumberingRule,
  evaluateSmartSeriesRule,
  allocateNextDocumentNumber
} from '../documentNumberingEngine'
import {
  generateTokenRegisterReport,
  getTokenDetailMovement,
  getTokenMonthlyReconciliation
} from '../tokenRegisterReportEngine'
import {
  TokenSalesRate,
  CustomerPricingCategory,
  CustomerCategoryAssignment,
  CustomerLevel,
  CustomerLevelRule,
  CustomerLevelAssignment,
  getSalesRates,
  saveSalesRate,
  deleteSalesRate,
  getPricingCategories,
  savePricingCategory,
  deletePricingCategory,
  getCustomerCategoryAssignments,
  saveCustomerCategoryAssignment,
  deleteCustomerCategoryAssignment,
  getCustomerLevels,
  saveCustomerLevel,
  deleteCustomerLevel,
  getCustomerLevelRules,
  saveCustomerLevelRule,
  deleteCustomerLevelRule,
  getCustomerLevelAssignments,
  saveCustomerLevelAssignment
} from '../tokenPricingStore'
import { resolveSalesPrice, evaluateCustomerLevel } from '../tokenPricingEngine'
import { queryOne, queryAll } from '../supabase'
import { getRelationalStore } from '../dscMasterStore'
import { TokenSalesInvoice } from '../tokenSalesStore'

export const tokenModuleRouter = Router()

function getAuthOrg(req: Request): string {
  const user = (req as any).user
  if (!user || !user.organization_id) {
    throw new Error('Authentication required. Missing organization boundary.')
  }
  return user.organization_id
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive.' })
  }
  next()
}

function requireTokenModuleAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive.' })
  }
  if (user.hierarchy_level_order > 3) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to manage Hardware Token Stock or Pricing.' })
  }
  next()
}

tokenModuleRouter.use('/token-', requireAuth, requireTokenModuleAccess)
tokenModuleRouter.use('/pricing-categories', requireAuth, requireTokenModuleAccess)
tokenModuleRouter.use('/customer-category-assignments', requireAuth, requireTokenModuleAccess)
tokenModuleRouter.use('/customer-levels', requireAuth, requireTokenModuleAccess)
tokenModuleRouter.use('/customer-level-rules', requireAuth, requireTokenModuleAccess)
tokenModuleRouter.use('/customer-level-assignments', requireAuth, requireTokenModuleAccess)

// ============================================================================
// PART A: DOCUMENT TEMPLATES API
// ============================================================================

function requireAdminOrSettings(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.role_name === 'Super Administrator' || user.role_id === 'role-super-admin' || user.hierarchy_level_order === 0) {
    return next()
  }
  return res.status(403).json({ error: 'Permission denied: Administrator authority required for master settings.' })
}

// 1. List Templates (Filtered by doc_type and company_profile_id)
tokenModuleRouter.get('/token-templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const docType = req.query.document_type as DocumentType | undefined
    const profileId = req.query.company_profile_id as string | undefined

    const templates = await getDocumentTemplates(orgId, docType, profileId)
    return res.json({ templates })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 2. Get Template by ID
tokenModuleRouter.get('/token-templates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const template = await getDocumentTemplateById(orgId, String(req.params.id))
    if (!template) {
      return res.status(404).json({ error: 'Template not found in your organization.' })
    }
    return res.json({ template })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 3. Save / Create Template
tokenModuleRouter.post('/token-templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      document_type,
      template_name,
      template_code,
      description,
      html_content,
      css_content,
      is_active = true,
      is_default = false,
      effective_from,
      effective_to
    } = req.body

    if (!document_type || !template_name || !template_code || !html_content) {
      return res.status(400).json({ error: 'document_type, template_name, template_code, and html_content are required.' })
    }

    const validation = validateDocumentTemplateHtml(html_content, document_type)
    if (!validation.valid) {
      return res.status(400).json({ error: 'Template validation failed.', errors: validation.errors })
    }

    const templateId = id || `tmpl-${document_type.toLowerCase()}-${Date.now()}`
    const tmpl: DocumentHtmlTemplate = {
      id: templateId,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      document_type,
      template_name: template_name.trim(),
      template_code: template_code.trim().toUpperCase(),
      description: description || null,
      html_content,
      css_content: css_content || null,
      is_active: Boolean(is_active),
      is_default: Boolean(is_default),
      effective_from: effective_from || '2026-04-01',
      effective_to: effective_to || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveDocumentTemplate(tmpl)
    return res.json({ success: true, template: tmpl })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 4. Render / Preview Document HTML
tokenModuleRouter.post('/token-templates/render', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      document_type,
      document_id,
      company_profile_id,
      template_id
    } = req.body

    if (!document_type || !document_id) {
      return res.status(400).json({ error: 'document_type and document_id are required.' })
    }

    // Resolve template
    const template = await resolveActiveDocumentTemplate(orgId, document_type, company_profile_id, template_id)
    if (!template) {
      return res.status(404).json({ error: 'No active template found for this document.' })
    }

    // Build context based on document_type
    let context: UnifiedDocumentContext | null = null

    if (document_type === 'SALES_ESTIMATE') {
      const estimates = await getRelationalStore<any>('token_sales_estimates')
      const est = estimates.find(e => e.id === document_id && e.organization_id === orgId)
      if (!est) return res.status(404).json({ error: 'Estimate not found.' })

      context = {
        document_type: 'SALES_ESTIMATE',
        company: est.company_profile_snapshot || {},
        party: est.customer_snapshot || {},
        document: {
          number: est.estimate_number,
          date: est.estimate_date,
          valid_until: est.valid_until,
          expected_closure_date: est.expected_closure_date,
          status: est.status,
          currency: 'INR',
          subtotal: est.subtotal,
          gst_amount: est.tax_amount,
          grand_total: est.grand_total,
          assigned_to: est.assigned_to,
          notes: est.notes
        },
        items: (est.items || []).map((it: any, idx: number): DocumentItemContext => ({
          index: idx + 1,
          description: it.model_name || 'Cryptographic USB Token',
          quantity: it.quantity,
          unit_rate: it.unit_price,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_rate,
          gst_amount: it.tax_amount,
          total_amount: it.total_amount
        }))
      }
    } else if (document_type === 'SALES_INVOICE') {
      const invoices = await getRelationalStore<TokenSalesInvoice>('token_sales_invoices')
      const inv = invoices.find(i => i.id === document_id && i.organization_id === orgId)
      if (!inv) return res.status(404).json({ error: 'Sales invoice not found.' })

      context = {
        document_type: 'SALES_INVOICE',
        company: inv.company_profile_snapshot || {},
        party: inv.customer_snapshot || {},
        document: {
          number: inv.invoice_number,
          date: inv.invoice_date,
          due_date: inv.due_date || undefined,
          status: inv.status,
          currency: 'INR',
          subtotal: inv.subtotal,
          gst_amount: inv.total_tax,
          cgst_amount: inv.cgst_amount,
          sgst_amount: inv.sgst_amount,
          igst_amount: inv.igst_amount,
          grand_total: inv.grand_total,
          paid_amount: inv.paid_amount,
          outstanding_balance: inv.outstanding_balance,
          place_of_supply: inv.place_of_supply || undefined,
          payment_terms: `${inv.credit_period_days || 0} Days Credit`
        },
        items: (inv.items || []).map((it: any, idx: number): DocumentItemContext => ({
          index: idx + 1,
          description: it.model_name || 'Token',
          quantity: it.quantity,
          unit_rate: it.unit_price,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_rate,
          cgst_amount: it.cgst_amount || 0,
          sgst_amount: it.sgst_amount || 0,
          igst_amount: it.igst_amount || 0,
          total_amount: it.total_amount,
          hsn_sac: '852352'
        }))
      }
    } else if (document_type === 'PURCHASE_BILL') {
      const bill = await queryOne<any>(`
        SELECT pb.*,
               prof.legal_name as company_name,
               prof.registered_address as company_address,
               prof.gstin as company_gstin,
               prof.pan as company_pan,
               p.party_name as vendor_name,
               p.address as vendor_address,
               p.city as vendor_city,
               p.gstin as vendor_gstin,
               p.pan as vendor_pan,
               p.contact_person as vendor_contact,
               p.mobile as vendor_mobile,
               p.email as vendor_email,
               po.po_number
        FROM token_purchase_bills pb
        LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
        LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
        LEFT JOIN token_purchase_orders po ON pb.purchase_order_id = po.id
        WHERE pb.id = ? AND pb.organization_id = ?
      `, [document_id, orgId])

      if (!bill) return res.status(404).json({ error: 'Purchase bill not found.' })

      const billItems = await queryAll<any>(
        'SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id = ? AND organization_id = ? ORDER BY created_at ASC',
        [document_id, orgId]
      )

      context = {
        document_type: 'PURCHASE_BILL',
        company: {
          legal_name: bill.company_name || 'DBIZ ERP Company Profile',
          registered_address: bill.company_address || '',
          gstin: bill.company_gstin || '',
          pan: bill.company_pan || ''
        },
        party: {
          party_name: bill.vendor_name || 'Vendor',
          address: bill.vendor_address || '',
          city: bill.vendor_city || '',
          gstin: bill.vendor_gstin || '',
          pan: bill.vendor_pan || '',
          contact_person: bill.vendor_contact || '',
          mobile: bill.vendor_mobile || '',
          email: bill.vendor_email || ''
        },
        document: {
          number: bill.voucher_number,
          date: bill.accounting_date,
          due_date: bill.due_date || bill.accounting_date,
          status: bill.status,
          currency: 'INR',
          subtotal: bill.subtotal,
          gst_amount: bill.tax_amount,
          freight_amount: bill.freight_amount || 0,
          grand_total: bill.grand_total,
          paid_amount: bill.paid_amount || 0,
          outstanding_balance: bill.outstanding_balance || bill.grand_total,
          supplier_invoice_number: bill.supplier_invoice_number,
          supplier_invoice_date: bill.supplier_invoice_date,
          po_reference: bill.po_number,
          place_of_supply: bill.place_of_supply
        },
        items: billItems.map((it: any, idx: number) => ({
          index: idx + 1,
          description: it.description || 'Token Model',
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          taxable_amount: it.taxable_value,
          gst_percentage: it.gst_rate,
          gst_amount: it.gst_amount,
          landed_cost: it.landed_cost,
          total_amount: it.line_total
        }))
      }
    } else if (document_type === 'PURCHASE_ORDER') {
      const po = await queryOne<any>(`
        SELECT po.*,
               prof.legal_name as buyer_legal_name,
               prof.trade_name as buyer_trade_name,
               prof.gstin as buyer_gstin,
               prof.pan as buyer_pan,
               prof.registered_address as buyer_address,
               p.party_name as vendor_name,
               p.contact_person as vendor_contact,
               p.address as vendor_address,
               p.city as vendor_city,
               p.district as vendor_district,
               p.state as vendor_state,
               p.country as vendor_country,
               p.pincode as vendor_pincode,
               p.email as vendor_email,
               p.mobile as vendor_mobile,
               p.gstin as vendor_gstin,
               p.pan as vendor_pan
        FROM token_purchase_orders po
        LEFT JOIN purchase_internal_profiles prof ON po.company_profile_id = prof.id
        LEFT JOIN token_purchase_parties p ON po.party_id = p.id
        WHERE po.id = ? AND po.organization_id = ?
      `, [document_id, orgId])

      if (!po) return res.status(404).json({ error: 'Purchase Order not found.' })

      const items = await queryAll<any>(
        'SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?',
        [document_id, orgId]
      )

      context = {
        document_type: 'PURCHASE_ORDER',
        company: {
          legal_name: po.buyer_legal_name || 'DBIZ ERP Buyer Profile',
          trade_name: po.buyer_trade_name,
          gstin: po.buyer_gstin,
          pan: po.buyer_pan,
          address: po.buyer_address
        },
        party: {
          party_name: po.vendor_name,
          contact_person: po.vendor_contact,
          address: po.vendor_address,
          city: po.vendor_city,
          gstin: po.vendor_gstin,
          email: po.vendor_email,
          mobile: po.vendor_mobile
        },
        delivery: {
          location_name: po.destination_location_name || 'Central Warehouse',
          address: po.destination_address || '',
          city: po.destination_city || '',
          pincode: po.destination_pincode || '',
          contact_person: po.delivery_contact_person || '',
          mobile: po.delivery_contact_mobile || ''
        },
        document: {
          number: po.po_number,
          date: po.po_date,
          status: po.status,
          currency: 'INR',
          subtotal: po.subtotal,
          gst_amount: po.gst_amount,
          grand_total: po.grand_total,
          payment_terms: po.payment_terms,
          delivery_terms: po.delivery_terms
        },
        items: items.map((it: any, idx: number) => ({
          index: idx + 1,
          description: it.description || 'Token Model',
          company: it.token_company,
          product: it.token_product,
          version: it.token_version,
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_percentage,
          gst_amount: it.gst_amount,
          total_amount: it.total_amount
        }))
      }
    }

    if (!context) {
      return res.status(400).json({ error: 'Unsupported document type.' })
    }

    const renderedHtml = renderDocumentHtml(template.html_content, context)
    return res.json({
      success: true,
      template_id: template.id,
      template_name: template.template_name,
      renderedHtml
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 4b. GET direct printable HTML document view for any document type:
// GET /api/token-documents/:type/:id/view-html
tokenModuleRouter.get('/token-documents/:type/:id/view-html', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const docType = String(req.params.type).toUpperCase() as DocumentType
    const docId = String(req.params.id)
    const profileId = req.query.company_profile_id as string | undefined

    // 1. Resolve active template
    const template = await resolveActiveDocumentTemplate(orgId, docType, profileId)
    if (!template) {
      return res.status(404).send('<h1>No active template configured for this document type.</h1>')
    }

    let context: UnifiedDocumentContext | null = null

    if (docType === 'SALES_ESTIMATE') {
      const estimates = await getRelationalStore<any>('token_sales_estimates')
      const est = estimates.find(e => e.id === docId && e.organization_id === orgId)
      if (!est) return res.status(404).send('Sales estimate not found.')

      context = {
        document_type: 'SALES_ESTIMATE',
        company: est.company_profile_snapshot || {},
        party: est.customer_snapshot || {},
        document: {
          number: est.estimate_number,
          date: est.estimate_date,
          valid_until: est.valid_until,
          expected_closure_date: est.expected_closure_date,
          status: est.status,
          currency: 'INR',
          subtotal: est.subtotal,
          gst_amount: est.tax_amount,
          grand_total: est.grand_total,
          assigned_to: est.assigned_to,
          notes: est.notes
        },
        items: (est.items || []).map((it: any, idx: number): DocumentItemContext => ({
          index: idx + 1,
          description: it.model_name || 'Cryptographic USB Token',
          quantity: it.quantity,
          unit_rate: it.unit_price,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_rate,
          gst_amount: it.tax_amount,
          total_amount: it.total_amount
        }))
      }
    } else if (docType === 'SALES_INVOICE') {
      const invoices = await getRelationalStore<TokenSalesInvoice>('token_sales_invoices')
      const inv = invoices.find(i => i.id === docId && i.organization_id === orgId)
      if (!inv) return res.status(404).send('Sales invoice not found.')

      context = {
        document_type: 'SALES_INVOICE',
        company: inv.company_profile_snapshot || {},
        party: inv.customer_snapshot || {},
        document: {
          number: inv.invoice_number,
          date: inv.invoice_date,
          due_date: inv.due_date || undefined,
          status: inv.status,
          currency: 'INR',
          subtotal: inv.subtotal,
          gst_amount: inv.total_tax,
          cgst_amount: inv.cgst_amount,
          sgst_amount: inv.sgst_amount,
          igst_amount: inv.igst_amount,
          grand_total: inv.grand_total,
          paid_amount: inv.paid_amount,
          outstanding_balance: inv.outstanding_balance,
          place_of_supply: inv.place_of_supply || undefined,
          payment_terms: `${inv.credit_period_days || 0} Days Credit`
        },
        items: (inv.items || []).map((it: any, idx: number): DocumentItemContext => ({
          index: idx + 1,
          description: it.model_name || 'Token',
          quantity: it.quantity,
          unit_rate: it.unit_price,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_rate,
          cgst_amount: it.cgst_amount || 0,
          sgst_amount: it.sgst_amount || 0,
          igst_amount: it.igst_amount || 0,
          total_amount: it.total_amount,
          hsn_sac: '852352'
        }))
      }
    } else if (docType === 'PURCHASE_BILL') {
      const bill = await queryOne<any>(`
        SELECT pb.*,
               prof.legal_name as company_name,
               prof.registered_address as company_address,
               prof.gstin as company_gstin,
               prof.pan as company_pan,
               p.party_name as vendor_name,
               p.address as vendor_address,
               p.city as vendor_city,
               p.gstin as vendor_gstin,
               p.pan as vendor_pan,
               p.contact_person as vendor_contact
        FROM token_purchase_bills pb
        LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
        LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
        WHERE pb.id = ? AND pb.organization_id = ?
      `, [docId, orgId])

      if (!bill) return res.status(404).send('Purchase Bill not found.')

      const billItems = await queryAll<any>(
        'SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id = ? AND organization_id = ?',
        [docId, orgId]
      )

      context = {
        document_type: 'PURCHASE_BILL',
        company: {
          legal_name: bill.company_name || 'Buyer Legal Entity',
          gstin: bill.company_gstin || '27AAAPL1234A1Z5',
          pan: bill.company_pan || 'AAAPL1234A',
          address: bill.company_address || 'Registered Corporate Office'
        },
        party: {
          party_name: bill.vendor_name || 'Vendor Entity',
          contact_person: bill.vendor_contact,
          gstin: bill.vendor_gstin,
          pan: bill.vendor_pan,
          address: bill.vendor_address || '',
          city: bill.vendor_city || ''
        },
        document: {
          number: bill.voucher_number || bill.id,
          date: bill.accounting_date,
          status: bill.status,
          currency: 'INR',
          subtotal: bill.subtotal,
          gst_amount: bill.gst_amount,
          grand_total: bill.grand_total,
          supplier_invoice_number: bill.supplier_invoice_number,
          supplier_invoice_date: bill.supplier_invoice_date,
          po_reference: bill.po_number,
          place_of_supply: bill.place_of_supply
        },
        items: billItems.map((it: any, idx: number) => ({
          index: idx + 1,
          description: it.description || 'Token Model',
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          taxable_amount: it.taxable_value,
          gst_percentage: it.gst_rate,
          gst_amount: it.gst_amount,
          landed_cost: it.landed_cost,
          total_amount: it.line_total
        }))
      }
    } else if (docType === 'PURCHASE_ORDER') {
      const po = await queryOne<any>(`
        SELECT po.*,
               prof.legal_name as buyer_legal_name,
               prof.trade_name as buyer_trade_name,
               prof.gstin as buyer_gstin,
               prof.pan as buyer_pan,
               prof.registered_address as buyer_address,
               p.party_name as vendor_name,
               p.contact_person as vendor_contact,
               p.address as vendor_address,
               p.city as vendor_city,
               p.district as vendor_district,
               p.state as vendor_state,
               p.country as vendor_country,
               p.pincode as vendor_pincode,
               p.email as vendor_email,
               p.mobile as vendor_mobile,
               p.gstin as vendor_gstin,
               p.pan as vendor_pan
        FROM token_purchase_orders po
        LEFT JOIN purchase_internal_profiles prof ON po.company_profile_id = prof.id
        LEFT JOIN token_purchase_parties p ON po.party_id = p.id
        WHERE po.id = ? AND po.organization_id = ?
      `, [docId, orgId])

      if (!po) return res.status(404).send('Purchase Order not found.')

      const items = await queryAll<any>(
        'SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?',
        [docId, orgId]
      )

      context = {
        document_type: 'PURCHASE_ORDER',
        company: {
          legal_name: po.buyer_legal_name || 'DBIZ ERP Buyer Profile',
          trade_name: po.buyer_trade_name,
          gstin: po.buyer_gstin,
          pan: po.buyer_pan,
          address: po.buyer_address
        },
        party: {
          party_name: po.vendor_name,
          contact_person: po.vendor_contact,
          address: po.vendor_address,
          city: po.vendor_city,
          gstin: po.vendor_gstin,
          email: po.vendor_email,
          mobile: po.vendor_mobile
        },
        delivery: {
          location_name: po.destination_location_name || 'Central Warehouse',
          address: po.destination_address || '',
          city: po.destination_city || '',
          pincode: po.destination_pincode || '',
          contact_person: po.delivery_contact_person || '',
          mobile: po.delivery_contact_mobile || ''
        },
        document: {
          number: po.po_number,
          date: po.po_date,
          status: po.status,
          currency: 'INR',
          subtotal: po.subtotal,
          gst_amount: po.gst_amount,
          grand_total: po.grand_total,
          payment_terms: po.payment_terms,
          delivery_terms: po.delivery_terms
        },
        items: items.map((it: any, idx: number) => ({
          index: idx + 1,
          description: it.description || 'Token Model',
          company: it.token_company,
          product: it.token_product,
          version: it.token_version,
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          taxable_amount: it.taxable_amount,
          gst_percentage: it.gst_percentage,
          gst_amount: it.gst_amount,
          total_amount: it.total_amount
        }))
      }
    }

    if (!context) {
      return res.status(400).send('Invalid document type.')
    }

    const renderedHtml = renderDocumentHtml(template.html_content, context)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(renderedHtml)
  } catch (err: any) {
    return res.status(500).send(`Server error: ${err.message}`)
  }
})

// ============================================================================
// PART B: DOCUMENT NUMBERING MASTER & SMART RULES API
// ============================================================================

// 5. Get Numbering Series
tokenModuleRouter.get('/token-numbering/series', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const profileId = req.query.company_profile_id as string | undefined
    const docType = req.query.document_type as DocumentType | undefined

    const series = await getDocumentNumberingSeries(orgId, profileId, docType)
    return res.json({ series })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6. Save / Configure Numbering Series
tokenModuleRouter.post('/token-numbering/series', requireAuth, requireAdminOrSettings, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      document_type,
      series_name,
      prefix,
      suffix = '',
      starting_number = 1001,
      current_counter,
      padding_length = 4,
      effective_from = '2026-04-01',
      effective_to = null,
      is_active = true,
      is_default = false,
      allow_reuse_on_cancellation = false
    } = req.body

    if (!company_profile_id || !document_type || !series_name || !prefix) {
      return res.status(400).json({ error: 'company_profile_id, document_type, series_name, and prefix are required.' })
    }

    const seriesId = id || `series-${document_type.toLowerCase()}-${Date.now()}`
    const seriesObj = {
      id: seriesId,
      organization_id: orgId,
      company_profile_id,
      document_type,
      series_name: series_name.trim(),
      prefix: prefix.trim(),
      suffix: suffix.trim(),
      starting_number: Number(starting_number),
      current_counter: current_counter !== undefined ? Number(current_counter) : Number(starting_number) - 1,
      padding_length: Number(padding_length),
      effective_from,
      effective_to,
      is_active: Boolean(is_active),
      is_default: Boolean(is_default),
      allow_reuse_on_cancellation: Boolean(allow_reuse_on_cancellation)
    }

    await saveDocumentNumberingSeries(seriesObj)
    return res.json({ success: true, series: seriesObj })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 7. Get Numbering Rules
tokenModuleRouter.get('/token-numbering/rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const profileId = req.query.company_profile_id as string | undefined
    const docType = req.query.document_type as DocumentType | undefined

    const rules = await getDocumentNumberingRules(orgId, profileId, docType)
    return res.json({ rules })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 8. Save / Configure Numbering Rule
tokenModuleRouter.post('/token-numbering/rules', requireAuth, requireAdminOrSettings, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      document_type,
      series_id,
      rule_name,
      priority = 1,
      field,
      operator = 'EQUALS',
      value,
      is_active = true
    } = req.body

    if (!company_profile_id || !document_type || !series_id || !rule_name || !field) {
      return res.status(400).json({ error: 'company_profile_id, document_type, series_id, rule_name, and field are required.' })
    }

    const ruleId = id || `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const ruleObj = {
      id: ruleId,
      organization_id: orgId,
      company_profile_id,
      document_type,
      series_id,
      rule_name: rule_name.trim(),
      priority: Number(priority),
      field,
      operator,
      value: String(value),
      is_active: Boolean(is_active)
    }

    await saveDocumentNumberingRule(ruleObj)
    return res.json({ success: true, rule: ruleObj })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 9. Evaluate Smart Series for Customer (Transparent Explanation)
tokenModuleRouter.post('/token-numbering/evaluate-series', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      company_profile_id,
      document_type,
      customer_id,
      document_date,
      place_of_supply
    } = req.body

    if (!company_profile_id || !document_type) {
      return res.status(400).json({ error: 'company_profile_id and document_type are required.' })
    }

    let customer: any = null
    if (customer_id) {
      customer = await queryOne('SELECT * FROM partners WHERE id = ?', [customer_id])
    }

    const evaluation = await evaluateSmartSeriesRule(orgId, company_profile_id, document_type, {
      customer,
      document_date,
      place_of_supply
    })

    return res.json({ success: true, evaluation })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// PART C: TOKEN REGISTER & PROFIT REPORTING API
// ============================================================================

// 10. Master Token Register Report
tokenModuleRouter.get('/token-register/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      company_profile_id,
      from_date,
      to_date,
      period_type = 'custom',
      token_model_id
    } = req.query

    const targetFrom = (from_date as string) || '2026-04-01'
    const targetTo = (to_date as string) || new Date().toISOString().slice(0, 10)

    const report = await generateTokenRegisterReport(orgId, {
      company_profile_id: company_profile_id as string | undefined,
      from_date: targetFrom,
      to_date: targetTo,
      period_type: period_type as any,
      token_model_id: token_model_id as string | undefined
    })

    return res.json(report)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 11. Individual Token Detailed Movement Drill-Down
tokenModuleRouter.get('/token-register/token-detail/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const modelId = String(req.params.id)
    const {
      company_profile_id,
      from_date,
      to_date
    } = req.query

    const targetFrom = (from_date as string) || '2026-04-01'
    const targetTo = (to_date as string) || new Date().toISOString().slice(0, 10)

    const detail = await getTokenDetailMovement(orgId, modelId, {
      company_profile_id: company_profile_id as string | undefined,
      from_date: targetFrom,
      to_date: targetTo
    })

    return res.json(detail)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 12. Token Monthly Reconciliation View
tokenModuleRouter.get('/token-register/token-monthly/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const modelId = String(req.params.id)
    const fyYearStart = parseInt(req.query.fy_start as string, 10) || 2026
    const profileId = req.query.company_profile_id as string | undefined

    const monthly = await getTokenMonthlyReconciliation(orgId, modelId, fyYearStart, profileId)
    return res.json({
      token_model_id: modelId,
      fy_start: fyYearStart,
      company_profile_id: profileId,
      monthly
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// PART D: TOKEN SALES RATE MASTER & CUSTOMER PRICING APIS
// ============================================================================

// 1. Sales Rates: List
tokenModuleRouter.get('/token-sales-rates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { profile_id, token_model_id, customer_category_id, active_only } = req.query
    const rates = await getSalesRates(orgId, {
      profileId: profile_id !== undefined ? (profile_id as string) : undefined,
      tokenModelId: token_model_id as string | undefined,
      customerCategoryId: customer_category_id !== undefined ? (customer_category_id as string) : undefined,
      activeOnly: active_only === 'true'
    })
    return res.json({ rates })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 2. Sales Rates: Save (Create / Update)
tokenModuleRouter.post('/token-sales-rates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      token_company,
      token_product,
      token_model_id,
      model_name,
      customer_category_id,
      customer_id,
      rate_type = 'FIXED',
      rate,
      quantity_slabs = [],
      effective_from,
      effective_to,
      is_active = true,
      priority = 10,
      notes
    } = req.body

    if (!token_model_id) {
      return res.status(400).json({ error: 'Token model is required.' })
    }
    if (rate === undefined || rate === null || Number(rate) < 0) {
      return res.status(400).json({ error: 'Valid rate is required.' })
    }

    const rateRecord: TokenSalesRate = {
      id: id || `tsr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      token_company: token_company || null,
      token_product: token_product || null,
      token_model_id,
      model_name: model_name || undefined,
      customer_category_id: customer_category_id || null,
      customer_id: customer_id || null,
      rate_type,
      rate: Number(rate),
      quantity_slabs,
      effective_from: effective_from || new Date().toISOString().slice(0, 10),
      effective_to: effective_to || null,
      is_active: Boolean(is_active),
      priority: Number(priority) || 10,
      notes: notes || null,
      created_by: (req as any).user?.email || (req as any).user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveSalesRate(rateRecord)
    return res.json({ success: true, rate: rateRecord })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// 3. Sales Rates: Delete
tokenModuleRouter.delete('/token-sales-rates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    await deleteSalesRate(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 4. Customer Pricing Categories: List
tokenModuleRouter.get('/pricing-categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const profileId = req.query.company_profile_id as string | undefined
    const categories = await getPricingCategories(orgId, profileId)
    return res.json({ categories })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 5. Customer Pricing Categories: Save
tokenModuleRouter.post('/pricing-categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      category_name,
      category_code,
      description,
      priority = 50,
      is_active = true,
      effective_from,
      effective_to
    } = req.body

    if (!category_name || !category_code) {
      return res.status(400).json({ error: 'Category name and code are required.' })
    }

    const catRecord: CustomerPricingCategory = {
      id: id || `cpc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      category_name: category_name.trim(),
      category_code: category_code.trim().toUpperCase(),
      description: description || null,
      priority: Number(priority) || 50,
      is_active: Boolean(is_active),
      effective_from: effective_from || null,
      effective_to: effective_to || null,
      created_by: (req as any).user?.email || (req as any).user?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await savePricingCategory(catRecord)
    return res.json({ success: true, category: catRecord })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// 6. Customer Pricing Categories: Delete
tokenModuleRouter.delete('/pricing-categories/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    await deletePricingCategory(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 7. Customer Category Assignments: List
tokenModuleRouter.get('/customer-category-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const customerId = req.query.customer_id as string | undefined
    const assignments = await getCustomerCategoryAssignments(orgId, customerId)
    return res.json({ assignments })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 8. Customer Category Assignments: Save
tokenModuleRouter.post('/customer-category-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      customer_id,
      customer_category_id,
      assignment_type = 'PERMANENT',
      effective_from,
      effective_to,
      is_active = true,
      notes
    } = req.body

    if (!customer_id || !customer_category_id) {
      return res.status(400).json({ error: 'Customer and Pricing Category are required.' })
    }

    const assignRecord: CustomerCategoryAssignment = {
      id: id || `cca-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      customer_id,
      customer_category_id,
      assignment_type,
      effective_from: effective_from || new Date().toISOString().slice(0, 10),
      effective_to: effective_to || null,
      is_active: Boolean(is_active),
      assigned_by: (req as any).user?.email || (req as any).user?.id,
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveCustomerCategoryAssignment(assignRecord)
    return res.json({ success: true, assignment: assignRecord })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// 9. Customer Category Assignments: Delete
tokenModuleRouter.delete('/customer-category-assignments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    await deleteCustomerCategoryAssignment(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 10. Customer Levels: List
tokenModuleRouter.get('/customer-levels', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const levels = await getCustomerLevels(orgId)
    return res.json({ levels })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 11. Customer Levels: Save
tokenModuleRouter.post('/customer-levels', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      level_name,
      level_code,
      description,
      priority = 10,
      is_active = true,
      assignment_mode = 'AUTOMATIC',
      effective_from,
      effective_to
    } = req.body

    if (!level_name || !level_code) {
      return res.status(400).json({ error: 'Level name and code are required.' })
    }

    const lvlRecord: CustomerLevel = {
      id: id || `cl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      level_name: level_name.trim(),
      level_code: level_code.trim().toUpperCase(),
      description: description || null,
      priority: Number(priority) || 10,
      is_active: Boolean(is_active),
      assignment_mode,
      effective_from: effective_from || null,
      effective_to: effective_to || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveCustomerLevel(lvlRecord)
    return res.json({ success: true, level: lvlRecord })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// 12. Customer Levels: Delete
tokenModuleRouter.delete('/customer-levels/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    await deleteCustomerLevel(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 13. Customer Level Rules: List
tokenModuleRouter.get('/customer-level-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const rules = await getCustomerLevelRules(orgId)
    return res.json({ rules })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 14. Customer Level Rules: Save
tokenModuleRouter.post('/customer-level-rules', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      id,
      company_profile_id,
      customer_level_id,
      period_type = 'MONTHLY',
      custom_period_from,
      custom_period_to,
      min_purchase_volume,
      is_active = true,
      priority = 10,
      description
    } = req.body

    if (!customer_level_id || min_purchase_volume === undefined) {
      return res.status(400).json({ error: 'Customer level and minimum purchase volume are required.' })
    }

    const ruleRecord: CustomerLevelRule = {
      id: id || `clr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      company_profile_id: company_profile_id || null,
      customer_level_id,
      period_type,
      custom_period_from: custom_period_from || null,
      custom_period_to: custom_period_to || null,
      min_purchase_volume: Number(min_purchase_volume),
      is_active: Boolean(is_active),
      priority: Number(priority) || 10,
      description: description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveCustomerLevelRule(ruleRecord)
    return res.json({ success: true, rule: ruleRecord })
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})

// 15. Customer Level Rules: Delete
tokenModuleRouter.delete('/customer-level-rules/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    await deleteCustomerLevelRule(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 16. Customer Level Assignments: List & History
tokenModuleRouter.get('/customer-level-assignments', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const customerId = req.query.customer_id as string | undefined
    const assignments = await getCustomerLevelAssignments(orgId, customerId)
    return res.json({ assignments })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 17. Evaluate Customer Level
tokenModuleRouter.post('/customer-levels/evaluate', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { customer_id, evaluation_date } = req.body
    if (!customer_id) {
      return res.status(400).json({ error: 'Customer ID is required.' })
    }
    const result = await evaluateCustomerLevel(orgId, customer_id, evaluation_date)
    return res.json(result)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 18. Manual Customer Level Override
tokenModuleRouter.post('/customer-levels/override', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { customer_id, level_id, reason, effective_from, effective_to } = req.body
    if (!customer_id || !level_id || !reason) {
      return res.status(400).json({ error: 'Customer ID, level ID, and override reason are required.' })
    }

    const existing = await getCustomerLevelAssignments(orgId, customer_id)
    const prev = existing[0]

    const overrideAssignment: CustomerLevelAssignment = {
      id: `cla-override-${customer_id}`,
      organization_id: orgId,
      company_profile_id: null,
      customer_id,
      current_level_id: level_id,
      previous_level_id: prev?.current_level_id || null,
      assignment_type: 'MANUAL_OVERRIDE',
      override_by: (req as any).user?.email || (req as any).user?.id,
      override_date: new Date().toISOString(),
      override_reason: reason,
      effective_from: effective_from || new Date().toISOString().slice(0, 10),
      effective_to: effective_to || null,
      calculated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await saveCustomerLevelAssignment(overrideAssignment)
    return res.json({ success: true, assignment: overrideAssignment })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 19. Smart Sales Pricing Resolution & Test Rate Tool
tokenModuleRouter.post('/token-pricing/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      company_profile_id,
      customer_id,
      token_model_id,
      quantity,
      date,
      override_rate,
      override_reason
    } = req.body

    if (!customer_id || !token_model_id || quantity === undefined) {
      return res.status(400).json({ error: 'Customer, token model, and quantity are required.' })
    }

    const resolution = await resolveSalesPrice({
      organization_id: orgId,
      company_profile_id,
      customer_id,
      token_model_id,
      quantity: Number(quantity),
      date,
      override_rate: override_rate !== undefined && override_rate !== null ? Number(override_rate) : undefined,
      override_by: (req as any).user?.email || (req as any).user?.id,
      override_reason
    })

    return res.json(resolution)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
})
