import { Router, Request, Response } from 'express'
import { queryAll, queryOne, run, supabase } from '../supabase'
import {
  getTokenCompanies,
  getTokenProducts,
  getTokenVersions
} from '../dscMasterStore'
import {
  validatePoTemplateHtml,
  renderPoHtml,
  getSamplePreviewContext,
  PoTemplateContext
} from '../poTemplateEngine'
import {
  getPartyCreditConfig,
  savePartyCreditConfig,
  getBillCreditOverride,
  saveBillCreditOverride,
  getBillCreditOverrides
} from '../tokenSalesStore'

export const procurementRouter = Router()

// Organization resolution guard
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

function requireProcurementAccess(req: Request, res: Response, next: any) {
  const user = (req as any).user
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.hierarchy_level_order > 3) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to access Token Procurement and Purchase Orders.' })
  }
  next()
}

procurementRouter.use(requireAuth, requireProcurementAccess)

// RBAC Guards
function requirePermission(moduleKey: string, actionKey: string) {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    // Super-admin (Level 0) or Admin (Level 1) or specific role rights
    if (user.hierarchy_level_order <= 1) {
      return next()
    }
    return res.status(403).json({ error: `Permission denied: ${moduleKey}.${actionKey} is restricted for your account.` })
  }
}

// ----------------------------------------------------------------------------
// 1. MASTER DEPENDENCIES (Vendors, Tokens, Countries, States)
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/masters', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const [tokenCompanies, tokenProducts, tokenVersions, countries, states] = await Promise.all([
      getTokenCompanies(false),
      getTokenProducts({ activeOnly: false }),
      getTokenVersions({ activeOnly: false }),
      queryAll('SELECT * FROM master_countries WHERE organization_id = ? ORDER BY priority ASC, country_name ASC', [orgId]),
      queryAll('SELECT * FROM master_states WHERE organization_id = ? ORDER BY state_name ASC', [orgId]),
    ])

    return res.json({
      tokenCompanies,
      tokenProducts,
      tokenVersions,
      countries,
      states,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 2. VENDORS / PURCHASING PARTIES
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/parties', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const activeOnly = req.query.activeOnly === 'true'
    let sql = 'SELECT * FROM token_purchase_parties WHERE organization_id = ?'
    const params: any[] = [orgId]

    if (activeOnly) {
      sql += ' AND is_active = true'
    }
    sql += ' ORDER BY party_name ASC'

    const parties = await queryAll(sql, params)
    const enrichedParties = await Promise.all(parties.map(async (p: any) => {
      const cfg = await getPartyCreditConfig(orgId, p.id)
      return {
        ...p,
        credit_period_days: cfg ? cfg.credit_period_days : (Number(p.credit_period_days) || 0)
      }
    }))
    return res.json({ parties: enrichedParties })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.post('/token-procurement/parties', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      party_name,
      contact_person,
      country_id,
      state_id,
      street_address,
      city,
      district,
      pincode,
      country_code,
      mobile,
      email,
      gstin,
      pan,
      is_active,
      active_from,
      active_to,
      credit_period_days
    } = req.body

    if (!party_name || !party_name.trim()) {
      return res.status(400).json({ error: 'Party/Vendor name is required.' })
    }

    const id = `ven-party-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { error: insErr } = await supabase.from('token_purchase_parties').insert({
      id,
      organization_id: orgId,
      party_name: party_name.trim(),
      contact_person: contact_person || null,
      country_id: country_id || null,
      state_id: state_id || null,
      street_address: street_address || null,
      city: city || null,
      district: district || null,
      pincode: pincode || null,
      country_code: country_code || '+91',
      mobile: mobile || null,
      email: email || null,
      gstin: gstin || null,
      pan: pan || null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      active_from: active_from || new Date().toISOString().slice(0, 10),
      active_to: active_to || null,
      created_by: user.id
    })

    if (insErr) throw insErr

    const days = Math.max(0, parseInt(credit_period_days, 10) || 0)
    await savePartyCreditConfig({
      party_id: id,
      party_type: 'VENDOR',
      organization_id: orgId,
      credit_period_days: days,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })

    const created = await queryOne('SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.status(201).json({ success: true, party: { ...created, credit_period_days: days } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.put('/token-procurement/parties/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const id = String(req.params.id)
    const {
      party_name,
      contact_person,
      country_id,
      state_id,
      street_address,
      city,
      district,
      pincode,
      country_code,
      mobile,
      email,
      gstin,
      pan,
      is_active,
      active_from,
      active_to,
      credit_period_days
    } = req.body

    const existing = await queryOne('SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?', [id, orgId])
    if (!existing) {
      return res.status(404).json({ error: 'Vendor party not found.' })
    }

    const { error: updErr } = await supabase.from('token_purchase_parties').update({
      party_name: party_name !== undefined ? party_name.trim() : existing.party_name,
      contact_person: contact_person !== undefined ? contact_person : existing.contact_person,
      country_id: country_id !== undefined ? country_id : existing.country_id,
      state_id: state_id !== undefined ? state_id : existing.state_id,
      street_address: street_address !== undefined ? street_address : existing.street_address,
      city: city !== undefined ? city : existing.city,
      district: district !== undefined ? district : existing.district,
      pincode: pincode !== undefined ? pincode : existing.pincode,
      country_code: country_code !== undefined ? country_code : existing.country_code,
      mobile: mobile !== undefined ? mobile : existing.mobile,
      email: email !== undefined ? email : existing.email,
      gstin: gstin !== undefined ? gstin : existing.gstin,
      pan: pan !== undefined ? pan : existing.pan,
      is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
      active_from: active_from !== undefined ? active_from : existing.active_from,
      active_to: active_to !== undefined ? active_to : existing.active_to,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('organization_id', orgId)

    if (updErr) throw updErr

    let days = existing.credit_period_days || 0
    if (credit_period_days !== undefined) {
      days = Math.max(0, parseInt(credit_period_days, 10) || 0)
      await savePartyCreditConfig({
        party_id: id,
        party_type: 'VENDOR',
        organization_id: orgId,
        credit_period_days: days,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
    } else {
      const curCfg = await getPartyCreditConfig(orgId, id)
      if (curCfg) days = curCfg.credit_period_days
    }

    const updated = await queryOne('SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.json({ success: true, party: { ...updated, credit_period_days: days } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 3. VENDOR QUOTES & QUANTITY SLABS
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/quotes', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const partyId = req.query.party_id as string
    const status = req.query.status as string

    let sql = `
      SELECT q.*, p.party_name, p.contact_person, p.mobile, p.email
      FROM token_vendor_quotes q
      JOIN token_purchase_parties p ON q.party_id = p.id
      WHERE q.organization_id = ?
    `
    const params: any[] = [orgId]

    if (partyId) {
      sql += ' AND q.party_id = ?'
      params.push(partyId)
    }
    if (status) {
      sql += ' AND q.status = ?'
      params.push(status)
    }

    sql += ' ORDER BY q.valid_from DESC, q.created_at DESC'
    const quotes = await queryAll(sql, params)

    const quoteIds = quotes.map((q: any) => q.id)
    let slabsByQuote: Record<string, any[]> = {}
    if (quoteIds.length > 0) {
      const allSlabs = await queryAll(
        'SELECT * FROM token_vendor_quote_slabs WHERE organization_id = ? ORDER BY min_quantity ASC',
        [orgId]
      )
      allSlabs.forEach((s: any) => {
        if (!slabsByQuote[s.quote_id]) slabsByQuote[s.quote_id] = []
        slabsByQuote[s.quote_id].push(s)
      })
    }

    const result = quotes.map((q: any) => ({
      ...q,
      slabs: slabsByQuote[q.id] || []
    }))

    return res.json({ quotes: result })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.post('/token-procurement/quotes', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      party_id,
      quote_number,
      quote_date,
      valid_from,
      valid_to,
      status,
      token_company_id,
      token_product_id,
      token_version_id,
      remarks,
      slabs
    } = req.body

    if (!party_id || !quote_number || !valid_from) {
      return res.status(400).json({ error: 'party_id, quote_number, and valid_from are required.' })
    }

    // Validate slabs overlap before inserting
    if (Array.isArray(slabs) && slabs.length > 0) {
      for (const s of slabs) {
        if (s.max_quantity !== null && s.max_quantity !== undefined && s.max_quantity !== '') {
          if (Number(s.max_quantity) < Number(s.min_quantity)) {
            return res.status(400).json({ error: `Invalid range in slab: maximum quantity (${s.max_quantity}) cannot be less than minimum quantity (${s.min_quantity}).` })
          }
        }
      }

      const sortedSlabs = [...slabs].sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity))
      for (let i = 0; i < sortedSlabs.length - 1; i++) {
        const current = sortedSlabs[i]
        const next = sortedSlabs[i + 1]
        const curMax = current.max_quantity !== null && current.max_quantity !== undefined && current.max_quantity !== ''
          ? Number(current.max_quantity)
          : Infinity

        if (curMax >= Number(next.min_quantity)) {
          return res.status(400).json({
            error: `Overlapping slabs detected: Slab [${current.min_quantity}-${current.max_quantity || 'unlimited'}] overlaps with Slab [${next.min_quantity}-${next.max_quantity || 'unlimited'}].`
          })
        }
      }
    }

    const quoteId = `qte-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { error: qErr } = await supabase.from('token_vendor_quotes').insert({
      id: quoteId,
      organization_id: orgId,
      party_id,
      quote_number: quote_number.trim(),
      quote_date: quote_date || new Date().toISOString().slice(0, 10),
      valid_from,
      valid_to: valid_to || null,
      status: status || 'ACTIVE',
      token_company_id: token_company_id || null,
      token_product_id: token_product_id || null,
      token_version_id: token_version_id || null,
      remarks: remarks || null,
      created_by: user.id
    })

    if (qErr) throw qErr

    if (Array.isArray(slabs) && slabs.length > 0) {
      const slabRows = slabs.map((slab: any) => {
        const unitRate = parseFloat(slab.unit_rate) || 0
        const gstPct = parseFloat(slab.gst_percentage) || 18
        const gstAmt = (unitRate * gstPct) / 100
        return {
          id: `slab-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          organization_id: orgId,
          quote_id: quoteId,
          min_quantity: parseInt(slab.min_quantity, 10),
          max_quantity: slab.max_quantity ? parseInt(slab.max_quantity, 10) : null,
          unit_rate: unitRate,
          gst_type: slab.gst_type || 'PERCENTAGE',
          gst_percentage: gstPct,
          gst_amount: gstAmt,
          other_charges: parseFloat(slab.other_charges) || 0
        }
      })
      const { error: sErr } = await supabase.from('token_vendor_quote_slabs').insert(slabRows)
      if (sErr) throw sErr
    }

    const created = await queryOne('SELECT * FROM token_vendor_quotes WHERE id = ? AND organization_id = ?', [quoteId, orgId])
    const createdSlabs = await queryAll('SELECT * FROM token_vendor_quote_slabs WHERE quote_id = ? AND organization_id = ? ORDER BY min_quantity ASC', [quoteId, orgId])

    return res.status(201).json({ success: true, quote: { ...created, slabs: createdSlabs } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 4. ESTIMATE CALCULATOR ENGINE
// ----------------------------------------------------------------------------
procurementRouter.post('/token-procurement/estimate/calculate', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      party_id,
      token_company_id,
      token_product_id,
      token_version_id,
      quantity,
      estimate_date
    } = req.body

    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Valid positive quantity is required.' })
    }
    if (!party_id) {
      return res.status(400).json({ error: 'party_id is required.' })
    }

    const targetDate = estimate_date || new Date().toISOString().slice(0, 10)

    let quoteSql = `
      SELECT q.*, p.party_name, p.gstin as vendor_gstin, p.street_address, p.city, p.district, p.state_id, p.pincode
      FROM token_vendor_quotes q
      JOIN token_purchase_parties p ON q.party_id = p.id
      WHERE q.organization_id = ?
        AND q.party_id = ?
        AND q.status = 'ACTIVE'
        AND q.valid_from <= ?
        AND (q.valid_to IS NULL OR q.valid_to >= ?)
    `
    const quoteParams: any[] = [orgId, party_id, targetDate, targetDate]

    if (token_product_id) {
      quoteSql += ' AND (q.token_product_id = ? OR q.token_product_id IS NULL)'
      quoteParams.push(token_product_id)
    }

    quoteSql += ' ORDER BY q.valid_from DESC LIMIT 1'
    const quote = await queryOne(quoteSql, quoteParams)

    if (!quote) {
      return res.status(404).json({
        error: `No active quotation found for this vendor on date ${targetDate} matching the token configuration.`
      })
    }

    const slabs = await queryAll(`
      SELECT * FROM token_vendor_quote_slabs
      WHERE organization_id = ? AND quote_id = ?
      ORDER BY min_quantity ASC
    `, [orgId, quote.id])

    if (slabs.length === 0) {
      return res.status(404).json({ error: 'Selected quotation has no configured quantity slabs.' })
    }

    const applicableSlab = slabs.find((s: any) => {
      const minOk = qty >= s.min_quantity
      const maxOk = s.max_quantity === null || s.max_quantity === undefined || qty <= s.max_quantity
      return minOk && maxOk
    })

    if (!applicableSlab) {
      return res.status(400).json({
        error: `Quantity ${qty} does not fall within any configured slab for Quote ${quote.quote_number}. Slabs range: ${slabs.map((s: any) => `[${s.min_quantity}-${s.max_quantity || 'unlimited'}]`).join(', ')}`
      })
    }

    const unitRate = Number(applicableSlab.unit_rate)
    const baseAmount = Number((unitRate * qty).toFixed(2))
    const gstPercentage = Number(applicableSlab.gst_percentage || 18)
    const gstAmount = Number(((baseAmount * gstPercentage) / 100).toFixed(2))
    const otherCharges = Number(applicableSlab.other_charges || 0)
    const grandTotal = Number((baseAmount + gstAmount + otherCharges).toFixed(2))

    return res.json({
      success: true,
      calculation: {
        vendor: {
          id: quote.party_id,
          name: quote.party_name,
          gstin: quote.vendor_gstin
        },
        quote: {
          id: quote.id,
          quote_number: quote.quote_number,
          valid_from: quote.valid_from,
          valid_to: quote.valid_to,
        },
        slab: {
          id: applicableSlab.id,
          min_quantity: applicableSlab.min_quantity,
          max_quantity: applicableSlab.max_quantity,
          label: `${applicableSlab.min_quantity} – ${applicableSlab.max_quantity || 'Unlimited'}`
        },
        token_configuration: {
          company_id: token_company_id || quote.token_company_id,
          product_id: token_product_id || quote.token_product_id,
          version_id: token_version_id || quote.token_version_id,
        },
        quantity: qty,
        unit_rate: unitRate,
        base_amount: baseAmount,
        gst_percentage: gstPercentage,
        gst_amount: gstAmount,
        other_charges: otherCharges,
        grand_total: grandTotal,
        estimate_date: targetDate
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 5. ESTIMATES MANAGEMENT
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/estimates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const estimates = await queryAll(`
      SELECT e.*, p.party_name, q.quote_number
      FROM token_purchase_estimates e
      JOIN token_purchase_parties p ON e.party_id = p.id
      LEFT JOIN token_vendor_quotes q ON e.quote_id = q.id
      WHERE e.organization_id = ?
      ORDER BY e.created_at DESC
    `, [orgId])

    return res.json({ estimates })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.post('/token-procurement/estimates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      party_id,
      quote_id,
      token_company_id,
      token_product_id,
      token_version_id,
      quantity,
      estimate_date,
      calculation
    } = req.body

    const qty = parseInt(quantity, 10)
    if (!qty || qty <= 0 || !party_id) {
      return res.status(400).json({ error: 'party_id and valid positive quantity are required.' })
    }

    const estNumber = await queryOne<{ num: string }>(
      "SELECT public.next_procurement_number(?, 'EST', 'EST') AS num",
      [orgId]
    ).then(r => r?.num || `EST/${Date.now()}`)

    const id = `est-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const estDate = estimate_date || new Date().toISOString().slice(0, 10)

    const baseAmount = Number(calculation.base_amount || 0)
    const gstAmount = Number(calculation.gst_amount || 0)
    const otherCharges = Number(calculation.other_charges || 0)
    const grandTotal = Number(calculation.grand_total || (baseAmount + gstAmount + otherCharges))

    const { error: insErr } = await supabase.from('token_purchase_estimates').insert({
      id,
      organization_id: orgId,
      estimate_number: estNumber,
      estimate_date: estDate,
      party_id,
      quote_id: quote_id || null,
      token_company_id: token_company_id || null,
      token_product_id: token_product_id || null,
      token_version_id: token_version_id || null,
      quantity: qty,
      base_amount: baseAmount,
      gst_amount: gstAmount,
      other_charges: otherCharges,
      grand_total: grandTotal,
      status: 'CALCULATED',
      pricing_snapshot: calculation || {},
      created_by: user.id
    })

    if (insErr) throw insErr

    const created = await queryOne('SELECT * FROM token_purchase_estimates WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.status(201).json({ success: true, estimate: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 6. INTERNAL PURCHASING PROFILES & DELIVERY LOCATIONS
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/internal-profiles', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const profiles = await queryAll(
      'SELECT * FROM purchase_internal_profiles WHERE organization_id = ? ORDER BY is_default DESC, legal_name ASC',
      [orgId]
    )
    return res.json({ profiles })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.post('/token-procurement/internal-profiles', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      legal_name,
      trade_name,
      address_line,
      city,
      district,
      state_id,
      country_id,
      pincode,
      gst_registered,
      gstin,
      pan,
      email,
      mobile,
      contact_person,
      is_default,
      is_active
    } = req.body

    if (!legal_name || !legal_name.trim()) {
      return res.status(400).json({ error: 'legal_name is required.' })
    }
    if (gst_registered && (!gstin || !gstin.trim())) {
      return res.status(400).json({ error: 'GSTIN is mandatory when profile is GST registered.' })
    }

    const id = `prof-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    if (is_default) {
      await supabase.from('purchase_internal_profiles').update({ is_default: false }).eq('organization_id', orgId)
    }

    const { error: insErr } = await supabase.from('purchase_internal_profiles').insert({
      id,
      organization_id: orgId,
      legal_name: legal_name.trim(),
      trade_name: trade_name || null,
      address_line: address_line || null,
      city: city || null,
      district: district || null,
      state_id: state_id || null,
      country_id: country_id || null,
      pincode: pincode || null,
      gst_registered: Boolean(gst_registered),
      gstin: gst_registered ? (gstin?.trim() || null) : null,
      pan: pan?.trim() || null,
      email: email || null,
      mobile: mobile || null,
      contact_person: contact_person || null,
      is_default: Boolean(is_default),
      is_active: is_active !== undefined ? Boolean(is_active) : true
    })

    if (insErr) throw insErr

    const created = await queryOne('SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.status(201).json({ success: true, profile: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.get('/token-procurement/delivery-locations', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const locations = await queryAll(
      'SELECT * FROM purchase_delivery_locations WHERE organization_id = ? ORDER BY is_default DESC, location_name ASC',
      [orgId]
    )
    return res.json({ locations })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.post('/token-procurement/delivery-locations', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const {
      location_name,
      contact_person,
      mobile,
      email,
      address_line,
      city,
      district,
      state_id,
      country_id,
      pincode,
      gstin,
      is_default,
      is_active,
      active_from,
      active_to,
      credit_period_days
    } = req.body

    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ error: 'location_name is required.' })
    }

    if (is_default) {
      await supabase.from('purchase_delivery_locations').update({ is_default: false }).eq('organization_id', orgId)
    }

    const id = `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { error: insErr } = await supabase.from('purchase_delivery_locations').insert({
      id,
      organization_id: orgId,
      location_name: location_name.trim(),
      contact_person: contact_person || null,
      mobile: mobile || null,
      email: email || null,
      address_line: address_line || null,
      city: city || null,
      district: district || null,
      state_id: state_id || null,
      country_id: country_id || null,
      pincode: pincode || null,
      gstin: gstin || null,
      is_default: Boolean(is_default),
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      active_from: active_from || new Date().toISOString().slice(0, 10),
      active_to: active_to || null
    })

    if (insErr) throw insErr

    const created = await queryOne('SELECT * FROM purchase_delivery_locations WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.status(201).json({ success: true, location: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 7. PURCHASE ORDER HTML TEMPLATES (Master Management + RBAC)
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const templates = await queryAll(
      'SELECT id, organization_id, template_name, template_code, description, is_active, is_default, effective_from, effective_to, created_at, updated_at FROM purchase_order_html_templates WHERE organization_id = ? ORDER BY is_default DESC, template_name ASC',
      [orgId]
    )
    return res.json({ templates })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.get('/token-procurement/templates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const template = await queryOne(
      'SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!template) {
      return res.status(404).json({ error: 'Purchase Order template not found in your organization.' })
    }
    return res.json({ template })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Template Preview Endpoint (Uses sample preview context without saving fake data)
procurementRouter.post('/token-procurement/templates/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { html_content } = req.body
    const validation = validatePoTemplateHtml(html_content)
    if (!validation.valid) {
      return res.status(400).json({ error: 'Template validation failed.', errors: validation.errors })
    }

    const sampleContext = getSamplePreviewContext()
    const renderedHtml = renderPoHtml(html_content, sampleContext)
    return res.json({ success: true, renderedHtml })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Create / Add Template (Protected by RBAC)
procurementRouter.post('/token-procurement/templates', requireAuth, requirePermission('procurement', 'can_edit_po_template'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      template_name,
      template_code,
      description,
      html_content,
      css_content,
      is_active,
      is_default,
      effective_from,
      effective_to
    } = req.body

    if (!template_name || !template_code || !html_content) {
      return res.status(400).json({ error: 'template_name, template_code, and html_content are required.' })
    }

    const cleanCode = template_code.trim().toUpperCase()

    // Validate unique template_code within this organization
    const existing = await queryOne(
      'SELECT id FROM purchase_order_html_templates WHERE organization_id = ? AND template_code = ?',
      [orgId, cleanCode]
    )
    if (existing) {
      return res.status(400).json({ error: `Template code '${cleanCode}' is already in use within your organization.` })
    }

    // Validate HTML security and syntax
    const validation = validatePoTemplateHtml(html_content)
    if (!validation.valid) {
      return res.status(400).json({ error: 'Template validation failed.', errors: validation.errors })
    }

    // If setting default, unset existing default for this organization
    if (is_default) {
      await supabase.from('purchase_order_html_templates').update({ is_default: false }).eq('organization_id', orgId)
    }

    const id = `tmpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { error: insErr } = await supabase.from('purchase_order_html_templates').insert({
      id,
      organization_id: orgId,
      template_name: template_name.trim(),
      template_code: cleanCode,
      description: description || null,
      html_content,
      css_content: css_content || null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      is_default: Boolean(is_default),
      effective_from: effective_from || new Date().toISOString().slice(0, 10),
      effective_to: effective_to || null,
      created_by: user.id,
      updated_by: user.id
    })

    if (insErr) throw insErr

    const created = await queryOne('SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.status(201).json({ success: true, template: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Edit / Update Template (Protected by RBAC)
procurementRouter.put('/token-procurement/templates/:id', requireAuth, requirePermission('procurement', 'can_edit_po_template'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { id } = req.params
    const {
      template_name,
      description,
      html_content,
      css_content,
      is_active,
      is_default,
      effective_from,
      effective_to
    } = req.body

    const existing = await queryOne(
      'SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!existing) {
      return res.status(404).json({ error: 'Template not found in your organization.' })
    }

    if (html_content) {
      const validation = validatePoTemplateHtml(html_content)
      if (!validation.valid) {
        return res.status(400).json({ error: 'Template validation failed.', errors: validation.errors })
      }
    }

    if (is_default) {
      await supabase.from('purchase_order_html_templates').update({ is_default: false }).eq('organization_id', orgId)
    }

    const { error: updErr } = await supabase.from('purchase_order_html_templates').update({
      template_name: template_name !== undefined ? template_name.trim() : existing.template_name,
      description: description !== undefined ? description : existing.description,
      html_content: html_content !== undefined ? html_content : existing.html_content,
      css_content: css_content !== undefined ? css_content : existing.css_content,
      is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
      is_default: is_default !== undefined ? Boolean(is_default) : existing.is_default,
      effective_from: effective_from !== undefined ? effective_from : existing.effective_from,
      effective_to: effective_to !== undefined ? effective_to : existing.effective_to,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('organization_id', orgId)

    if (updErr) throw updErr

    const updated = await queryOne('SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?', [id, orgId])
    return res.json({ success: true, template: updated })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ----------------------------------------------------------------------------
// 8. PURCHASE ORDERS (Direct Issue, Cancellation, Immutable Rendering)
// ----------------------------------------------------------------------------
procurementRouter.get('/token-procurement/purchase-orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const pos = await queryAll(`
      SELECT po.*,
             p.party_name as current_party_name,
             prof.legal_name as current_profile_name,
             loc.location_name as current_location_name
      FROM token_purchase_orders po
      LEFT JOIN token_purchase_parties p ON po.party_id = p.id
      LEFT JOIN purchase_internal_profiles prof ON po.internal_profile_id = prof.id
      LEFT JOIN purchase_delivery_locations loc ON po.delivery_location_id = loc.id
      WHERE po.organization_id = ?
      ORDER BY po.created_at DESC
    `, [orgId])

    return res.json({ purchase_orders: pos })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

procurementRouter.get('/token-procurement/purchase-orders/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const po = await queryOne(
      'SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found.' })
    }

    const items = await queryAll(
      'SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?',
      [id, orgId]
    )

    return res.json({ purchase_order: { ...po, items } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Printable A4 PO Render Endpoint
procurementRouter.get('/token-procurement/purchase-orders/:id/render-html', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const po = await queryOne('SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?', [id, orgId])
    if (!po) return res.status(404).send('Purchase Order not found.')

    // 1. If PO is already ISSUED and has immutable rendered_html, return that exact historical document!
    if (po.status === 'ISSUED' && po.rendered_html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send(po.rendered_html)
    }

    // 2. Otherwise resolve template: use template_id or active default template for org
    const targetDate = po.po_date || new Date().toISOString().slice(0, 10)
    let template: any = null

    if (po.template_id) {
      template = await queryOne('SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?', [po.template_id, orgId])
    }

    if (!template) {
      // Find active default template for org valid on targetDate
      template = await queryOne(`
        SELECT * FROM purchase_order_html_templates
        WHERE organization_id = ?
          AND is_active = true
          AND is_default = true
          AND effective_from <= ?
          AND (effective_to IS NULL OR effective_to >= ?)
        LIMIT 1
      `, [orgId, targetDate, targetDate])
    }

    if (!template) {
      template = await queryOne(`
        SELECT * FROM purchase_order_html_templates
        WHERE organization_id = ? AND is_active = true
        ORDER BY is_default DESC, created_at DESC LIMIT 1
      `, [orgId])
    }

    if (!template) {
      return res.status(404).send('No active Purchase Order template configured for this organization.')
    }

    // 3. Build PO Context
    const items = await queryAll('SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?', [id, orgId])
    const profile = po.internal_profile_snapshot || {}
    const vendor = po.vendor_snapshot || {}
    const delivery = po.delivery_location_snapshot || {}

    // Resolve token company names from masters
    const companies = await getTokenCompanies(false)
    const companyMap: Record<string, string> = {}
    companies.forEach((c: any) => { companyMap[c.id] = c.company_name })

    const poContext: PoTemplateContext = {
      buyer: {
        legal_name: profile.legal_name || 'Buyer Entity',
        trade_name: profile.trade_name || '',
        gstin: profile.gstin || 'N/A',
        pan: profile.pan || 'N/A',
        address: profile.address_line || '',
        city: profile.city || '',
        district: profile.district || '',
        state: profile.state_id || '',
        country: 'India',
        pincode: profile.pincode || '',
        contact_person: profile.contact_person || '',
        mobile: profile.mobile || '',
        email: profile.email || ''
      },
      vendor: {
        party_name: vendor.party_name || 'Vendor',
        contact_person: vendor.contact_person || '',
        address: vendor.street_address || '',
        city: vendor.city || '',
        district: vendor.district || '',
        state: vendor.state_id || '',
        country: 'India',
        pincode: vendor.pincode || '',
        gstin: vendor.gstin || 'Unregistered',
        pan: vendor.pan || 'N/A',
        mobile: vendor.mobile ? `${vendor.country_code || '+91'} ${vendor.mobile}` : '',
        email: vendor.email || ''
      },
      po: {
        number: po.po_number,
        date: po.po_date,
        status: po.status,
        currency: 'INR',
        subtotal: Number(po.subtotal).toFixed(2),
        gst_amount: Number(po.gst_amount).toFixed(2),
        other_charges: Number(po.other_charges || 0).toFixed(2),
        grand_total: Number(po.grand_total).toFixed(2),
        payment_terms: po.payment_terms || 'Advance',
        delivery_terms: po.delivery_terms || 'Door delivery',
        validity_terms: po.validity_terms || '15 days',
        inspection_terms: po.inspection_terms || 'RMA warranty',
        remarks: po.remarks || ''
      },
      delivery: {
        location_name: delivery.location_name || 'Warehouse',
        address: delivery.address_line || '',
        city: delivery.city || '',
        district: delivery.district || '',
        state: delivery.state_id || '',
        country: 'India',
        pincode: delivery.pincode || '',
        contact_person: delivery.contact_person || '',
        mobile: delivery.mobile || '',
        email: delivery.email || ''
      },
      items: items.map((it: any, i: number) => {
        const snap = it.token_snapshot || {}
        return {
          index: i + 1,
          description: it.description || 'Cryptographic Token',
          company: companyMap[it.token_company_id] || snap.company || 'Security Token',
          product: snap.product || it.token_product_id || 'Hardware Token',
          version: snap.version || it.token_version_id || 'Standard',
          quantity: it.quantity,
          unit_rate: Number(it.unit_rate).toFixed(2),
          taxable_amount: Number(it.taxable_amount).toFixed(2),
          gst_percentage: it.gst_percentage || 18,
          gst_amount: Number(it.gst_amount).toFixed(2),
          other_charges: Number(it.other_charges || 0).toFixed(2),
          total_amount: Number(it.total_amount).toFixed(2)
        }
      })
    }

    const rendered = renderPoHtml(template.html_content, poContext)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(rendered)
  } catch (err: any) {
    return res.status(500).send(`Rendering error: ${err.message}`)
  }
})

// Create PO (Initial Status: DRAFT)
procurementRouter.post('/token-procurement/purchase-orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      estimate_id,
      internal_profile_id,
      party_id,
      delivery_location_id,
      template_id,
      po_date,
      payment_terms,
      delivery_terms,
      validity_terms,
      inspection_terms,
      remarks,
      items
    } = req.body

    if (!internal_profile_id || !party_id || !delivery_location_id) {
      return res.status(400).json({ error: 'internal_profile_id, party_id, and delivery_location_id are required.' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one purchase order item is required.' })
    }

    const [profile, vendor, location] = await Promise.all([
      queryOne('SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?', [internal_profile_id, orgId]),
      queryOne('SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?', [party_id, orgId]),
      queryOne('SELECT * FROM purchase_delivery_locations WHERE id = ? AND organization_id = ?', [delivery_location_id, orgId])
    ])

    if (!profile) return res.status(404).json({ error: 'Internal purchase profile not found.' })
    if (!vendor) return res.status(404).json({ error: 'Vendor party not found.' })
    if (!location) return res.status(404).json({ error: 'Delivery location not found.' })

    const poNumber = await queryOne<{ num: string }>(
      "SELECT public.next_procurement_number(?, 'PO', 'PO') AS num",
      [orgId]
    ).then(r => r?.num || `PO/${Date.now()}`)

    const poId = `po-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const orderDate = po_date || new Date().toISOString().slice(0, 10)

    let subtotal = 0
    let totalGst = 0
    let totalOther = 0

    const processedItems = items.map((item: any) => {
      const q = parseInt(item.quantity, 10) || 1
      const rate = parseFloat(item.unit_rate) || 0
      const taxable = Number((q * rate).toFixed(2))
      const gstPct = parseFloat(item.gst_percentage) || 18
      const gstAmt = Number(((taxable * gstPct) / 100).toFixed(2))
      const other = parseFloat(item.other_charges) || 0
      const total = Number((taxable + gstAmt + other).toFixed(2))

      subtotal += taxable
      totalGst += gstAmt
      totalOther += other

      return {
        ...item,
        quantity: q,
        unit_rate: rate,
        taxable_amount: taxable,
        gst_percentage: gstPct,
        gst_amount: gstAmt,
        other_charges: other,
        total_amount: total
      }
    })

    const grandTotal = Number((subtotal + totalGst + totalOther).toFixed(2))

    const { error: poErr } = await supabase.from('token_purchase_orders').insert({
      id: poId,
      organization_id: orgId,
      po_number: poNumber,
      po_date: orderDate,
      estimate_id: estimate_id || null,
      internal_profile_id,
      party_id,
      delivery_location_id,
      template_id: template_id || null,
      subtotal,
      gst_amount: totalGst,
      other_charges: totalOther,
      grand_total: grandTotal,
      status: 'DRAFT',
      payment_terms: payment_terms || '100% advance against Proforma Invoice',
      delivery_terms: delivery_terms || 'Door delivery within 5-7 working days',
      validity_terms: validity_terms || 'Quotation and pricing valid for 15 days from PO date',
      inspection_terms: inspection_terms || 'Defective tokens subject to instant RMA warranty replacement',
      remarks: remarks || null,
      internal_profile_snapshot: profile,
      vendor_snapshot: vendor,
      delivery_location_snapshot: location,
      created_by: user.id
    })

    if (poErr) throw poErr

    for (const item of processedItems) {
      const itemId = `poi-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      await supabase.from('token_purchase_order_items').insert({
        id: itemId,
        organization_id: orgId,
        purchase_order_id: poId,
        token_company_id: item.token_company_id || null,
        token_product_id: item.token_product_id || null,
        token_version_id: item.token_version_id || null,
        description: item.description || 'Cryptographic USB Token',
        quantity: item.quantity,
        unit_rate: item.unit_rate,
        taxable_amount: item.taxable_amount,
        gst_percentage: item.gst_percentage,
        gst_amount: item.gst_amount,
        other_charges: item.other_charges,
        total_amount: item.total_amount,
        token_snapshot: item.token_snapshot || {}
      })
    }

    if (estimate_id) {
      await supabase.from('token_purchase_estimates').update({
        status: 'CONVERTED_TO_PO',
        updated_at: new Date().toISOString()
      }).eq('id', estimate_id).eq('organization_id', orgId)
    }

    const createdPO = await queryOne('SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?', [poId, orgId])
    const createdItems = await queryAll('SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?', [poId, orgId])

    return res.status(201).json({
      success: true,
      purchase_order: { ...createdPO, items: createdItems }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// DIRECT PO ISSUE (NO APPROVAL WORKFLOW - DRAFT -> ISSUED)
procurementRouter.post('/token-procurement/purchase-orders/:id/issue', requireAuth, requirePermission('procurement', 'can_issue'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const po = await queryOne('SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?', [id, orgId])
    if (!po) return res.status(404).json({ error: 'Purchase Order not found in your organization.' })

    if (po.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cancelled Purchase Orders cannot be issued.' })
    }
    if (po.status === 'ISSUED') {
      return res.status(400).json({ error: 'Purchase Order is already issued.' })
    }

    // Resolve template to snapshot
    let template = null
    if (po.template_id) {
      template = await queryOne('SELECT * FROM purchase_order_html_templates WHERE id = ? AND organization_id = ?', [po.template_id, orgId])
    }
    if (!template) {
      template = await queryOne(`
        SELECT * FROM purchase_order_html_templates
        WHERE organization_id = ? AND is_active = true
        ORDER BY is_default DESC, created_at DESC LIMIT 1
      `, [orgId])
    }

    // Build context and pre-render immutable HTML snapshot
    const items = await queryAll('SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?', [id, orgId])
    const profile = po.internal_profile_snapshot || {}
    const vendor = po.vendor_snapshot || {}
    const delivery = po.delivery_location_snapshot || {}

    const companies = await getTokenCompanies(false)
    const companyMap: Record<string, string> = {}
    companies.forEach((c: any) => { companyMap[c.id] = c.company_name })

    const poContext: PoTemplateContext = {
      buyer: {
        legal_name: profile.legal_name || 'Buyer Entity',
        trade_name: profile.trade_name || '',
        gstin: profile.gstin || 'N/A',
        pan: profile.pan || 'N/A',
        address: profile.address_line || '',
        city: profile.city || '',
        district: profile.district || '',
        state: profile.state_id || '',
        country: 'India',
        pincode: profile.pincode || '',
        contact_person: profile.contact_person || '',
        mobile: profile.mobile || '',
        email: profile.email || ''
      },
      vendor: {
        party_name: vendor.party_name || 'Vendor',
        contact_person: vendor.contact_person || '',
        address: vendor.street_address || '',
        city: vendor.city || '',
        district: vendor.district || '',
        state: vendor.state_id || '',
        country: 'India',
        pincode: vendor.pincode || '',
        gstin: vendor.gstin || 'Unregistered',
        pan: vendor.pan || 'N/A',
        mobile: vendor.mobile ? `${vendor.country_code || '+91'} ${vendor.mobile}` : '',
        email: vendor.email || ''
      },
      po: {
        number: po.po_number,
        date: po.po_date,
        status: 'ISSUED',
        currency: 'INR',
        subtotal: Number(po.subtotal).toFixed(2),
        gst_amount: Number(po.gst_amount).toFixed(2),
        other_charges: Number(po.other_charges || 0).toFixed(2),
        grand_total: Number(po.grand_total).toFixed(2),
        payment_terms: po.payment_terms || 'Advance',
        delivery_terms: po.delivery_terms || 'Door delivery',
        validity_terms: po.validity_terms || '15 days',
        inspection_terms: po.inspection_terms || 'RMA warranty',
        remarks: po.remarks || ''
      },
      delivery: {
        location_name: delivery.location_name || 'Warehouse',
        address: delivery.address_line || '',
        city: delivery.city || '',
        district: delivery.district || '',
        state: delivery.state_id || '',
        country: 'India',
        pincode: delivery.pincode || '',
        contact_person: delivery.contact_person || '',
        mobile: delivery.mobile || '',
        email: delivery.email || ''
      },
      items: items.map((it: any, i: number) => {
        const snap = it.token_snapshot || {}
        return {
          index: i + 1,
          description: it.description || 'Cryptographic Token',
          company: companyMap[it.token_company_id] || snap.company || 'Security Token',
          product: snap.product || it.token_product_id || 'Hardware Token',
          version: snap.version || it.token_version_id || 'Standard',
          quantity: it.quantity,
          unit_rate: Number(it.unit_rate).toFixed(2),
          taxable_amount: Number(it.taxable_amount).toFixed(2),
          gst_percentage: it.gst_percentage || 18,
          gst_amount: Number(it.gst_amount).toFixed(2),
          other_charges: Number(it.other_charges || 0).toFixed(2),
          total_amount: Number(it.total_amount).toFixed(2)
        }
      })
    }

    const renderedHtml = template ? renderPoHtml(template.html_content, poContext) : ''

    const { error: updErr } = await supabase.from('token_purchase_orders').update({
      status: 'ISSUED',
      template_id: template?.id || null,
      template_version: template?.template_code || 'PO_STANDARD',
      template_snapshot: template || {},
      rendered_html: renderedHtml,
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('organization_id', orgId)

    if (updErr) throw updErr

    return res.json({
      success: true,
      message: `Purchase Order ${po.po_number} directly issued to vendor with immutable historical snapshot.`,
      status: 'ISSUED'
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// CANCEL PURCHASE ORDER (With Mandatory Reason)
procurementRouter.post('/token-procurement/purchase-orders/:id/cancel', requireAuth, requirePermission('procurement', 'can_cancel'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { id } = req.params
    const { reason, reason_description } = req.body

    const po = await queryOne('SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?', [id, orgId])
    if (!po) return res.status(404).json({ error: 'Purchase Order not found in your organization.' })

    if (po.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Purchase Order is already cancelled.' })
    }

    // Cancellation reason is mandatory
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Cancellation reason is mandatory.' })
    }

    const fullReason = reason === 'Other'
      ? `Other: ${reason_description?.trim() || 'No description provided'}`
      : reason.trim()

    const { error: cancelErr } = await supabase.from('token_purchase_orders').update({
      status: 'CANCELLED',
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: fullReason,
      updated_at: new Date().toISOString()
    }).eq('id', id).eq('organization_id', orgId)

    if (cancelErr) throw cancelErr

    return res.json({
      success: true,
      message: `Purchase Order ${po.po_number} cancelled successfully.`,
      status: 'CANCELLED'
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// 9. PURCHASE / PROCUREMENT ENTRIES (GRN / Receipt against ISSUED PO)
// ============================================================================

// List Purchase Entries
procurementRouter.get('/token-procurement/purchase-receipts', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { po_id } = req.query

    let query = `
      SELECT pr.*,
             po.po_number,
             p.party_name as vendor_name,
             prof.legal_name as buyer_legal_name,
             (SELECT COUNT(*) FROM courier_dispatches cd WHERE cd.purchase_receipt_id = pr.id) as dispatch_count
      FROM token_purchase_receipts pr
      LEFT JOIN token_purchase_orders po ON pr.purchase_order_id = po.id
      LEFT JOIN token_purchase_parties p ON pr.vendor_party_id = p.id
      LEFT JOIN purchase_internal_profiles prof ON pr.internal_profile_id = prof.id
      WHERE pr.organization_id = ?
    `
    const params: any[] = [orgId]

    if (po_id) {
      query += ' AND pr.purchase_order_id = ?'
      params.push(String(po_id))
    }

    query += ' ORDER BY pr.purchase_datetime DESC'

    const receipts = await queryAll(query, params)
    return res.json({ receipts })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Get Single Purchase Entry with Items
procurementRouter.get('/token-procurement/purchase-receipts/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const receipt = await queryOne(`
      SELECT pr.*,
             po.po_number,
             po.po_date,
             po.issued_at as po_issued_at,
             p.party_name as vendor_name,
             prof.legal_name as buyer_legal_name
      FROM token_purchase_receipts pr
      LEFT JOIN token_purchase_orders po ON pr.purchase_order_id = po.id
      LEFT JOIN token_purchase_parties p ON pr.vendor_party_id = p.id
      LEFT JOIN purchase_internal_profiles prof ON pr.internal_profile_id = prof.id
      WHERE pr.id = ? AND pr.organization_id = ?
    `, [id, orgId])

    if (!receipt) {
      return res.status(404).json({ error: 'Purchase receipt not found.' })
    }

    const items = await queryAll(`
      SELECT pri.*
      FROM token_purchase_receipt_items pri
      WHERE pri.purchase_receipt_id = ? AND pri.organization_id = ?
      ORDER BY pri.created_at ASC
    `, [id, orgId])

    const dispatches = await queryAll(`
      SELECT cd.*,
             cp.company_name as courier_partner_name,
             cp.tracking_url_template
      FROM courier_dispatches cd
      LEFT JOIN courier_partners cp ON cd.courier_partner_id = cp.id
      WHERE cd.purchase_receipt_id = ? AND cd.organization_id = ?
      ORDER BY cd.dispatched_at DESC
    `, [id, orgId])

    return res.json({ receipt: { ...receipt, items, dispatches } })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Create Purchase Entry against ISSUED PO
procurementRouter.post('/token-procurement/purchase-receipts', requireAuth, requirePermission('procurement', 'can_create_purchase'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      purchase_order_id,
      purchase_date,
      purchase_datetime,
      items,
      notes
    } = req.body

    if (!purchase_order_id) {
      return res.status(400).json({ error: 'purchase_order_id is required.' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one receipt item is required.' })
    }

    // Verify PO exists, is scoped to this org, and is ISSUED
    const po = await queryOne<any>(
      'SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?',
      [purchase_order_id, orgId]
    )
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found in your organization.' })
    }
    if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_RECEIVED') {
      return res.status(400).json({ error: `Cannot record purchase entry against PO in '${po.status}' status. PO must be ISSUED.` })
    }

    // Load PO items and already-received quantities across existing receipts
    const poItems = await queryAll<any>(
      'SELECT * FROM token_purchase_order_items WHERE purchase_order_id = ? AND organization_id = ?',
      [purchase_order_id, orgId]
    )
    const poItemMap: Record<string, any> = {}
    poItems.forEach(pi => { poItemMap[pi.id] = pi })

    const existingReceiptItems = await queryAll<any>(`
      SELECT pri.purchase_order_item_id, SUM(pri.quantity_received) as total_received
      FROM token_purchase_receipt_items pri
      JOIN token_purchase_receipts pr ON pri.purchase_receipt_id = pr.id
      WHERE pr.purchase_order_id = ? AND pr.organization_id = ? AND pr.status != 'CANCELLED'
      GROUP BY pri.purchase_order_item_id
    `, [purchase_order_id, orgId])

    const receivedMap: Record<string, number> = {}
    existingReceiptItems.forEach(er => {
      receivedMap[er.purchase_order_item_id] = Number(er.total_received) || 0
    })

    // Process and validate receipt items
    let receiptSubtotal = 0
    let receiptGst = 0
    let receiptOther = 0

    const processedItems: any[] = []

    for (const item of items) {
      const poItem = poItemMap[item.purchase_order_item_id]
      if (!poItem) {
        return res.status(400).json({ error: `Invalid purchase_order_item_id: ${item.purchase_order_item_id}` })
      }

      const orderedQty = poItem.quantity
      const priorReceived = receivedMap[poItem.id] || 0
      const remainingQty = orderedQty - priorReceived
      const receivedQty = parseInt(item.quantity_received, 10)

      if (isNaN(receivedQty) || receivedQty <= 0) {
        return res.status(400).json({ error: `Quantity received must be a positive integer for item ${poItem.id}.` })
      }

      if (receivedQty > remainingQty) {
        return res.status(400).json({
          error: `Received quantity (${receivedQty}) exceeds remaining unfulfilled balance (${remainingQty}) for item. (Ordered: ${orderedQty}, Already Received: ${priorReceived})`
        })
      }

      // Preserve historical commercial values from PO item
      const unitRate = Number(poItem.unit_rate)
      const gstPct = Number(poItem.gst_percentage || 18)
      const taxableVal = Number((receivedQty * unitRate).toFixed(2))
      const gstAmt = Number(((taxableVal * gstPct) / 100).toFixed(2))
      const otherCharges = Number(item.other_charges || 0)
      const lineTotal = Number((taxableVal + gstAmt + otherCharges).toFixed(2))

      receiptSubtotal += taxableVal
      receiptGst += gstAmt
      receiptOther += otherCharges

      processedItems.push({
        purchase_order_item_id: poItem.id,
        token_company_id: poItem.token_company_id,
        token_product_id: poItem.token_product_id,
        token_version_id: poItem.token_version_id,
        description: poItem.description,
        quantity_ordered: orderedQty,
        quantity_received: receivedQty,
        unit_rate: unitRate,
        taxable_value: taxableVal,
        gst_percentage: gstPct,
        gst_amount: gstAmt,
        other_charges: otherCharges,
        total_amount: lineTotal,
        token_snapshot: poItem.token_snapshot || {}
      })
    }

    const receiptTotal = Number((receiptSubtotal + receiptGst + receiptOther).toFixed(2))

    // Generate receipt number
    const receiptNum = await queryOne<{ num: string }>(
      "SELECT public.next_procurement_number(?, 'REC', 'REC') AS num",
      [orgId]
    ).then(r => r?.num || `REC/${Date.now()}`)

    const receiptId = `pr-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const nowIso = new Date().toISOString()
    const pDatetime = purchase_datetime || nowIso
    const pDate = purchase_date || pDatetime.slice(0, 10)

    const { error: insErr } = await supabase.from('token_purchase_receipts').insert({
      id: receiptId,
      organization_id: orgId,
      purchase_receipt_number: receiptNum,
      purchase_order_id,
      vendor_party_id: po.party_id,
      internal_profile_id: po.internal_profile_id,
      purchase_date: pDate,
      purchase_datetime: pDatetime,
      subtotal: receiptSubtotal,
      gst_amount: receiptGst,
      other_charges: receiptOther,
      total_amount: receiptTotal,
      status: 'RECORDED',
      notes: notes || null,
      vendor_snapshot: po.vendor_snapshot || {},
      internal_profile_snapshot: po.internal_profile_snapshot || {},
      created_by: user.id,
      created_at: nowIso,
      updated_at: nowIso
    })

    if (insErr) throw insErr

    // Insert receipt line items
    for (const pItem of processedItems) {
      const priId = `pri-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      await supabase.from('token_purchase_receipt_items').insert({
        id: priId,
        organization_id: orgId,
        purchase_receipt_id: receiptId,
        ...pItem,
        created_at: nowIso
      })
    }

    // Check if PO is now FULLY_RECEIVED or PARTIALLY_RECEIVED
    let totalPoOrdered = 0
    poItems.forEach(pi => { totalPoOrdered += Number(pi.quantity) })

    let totalPoReceivedSoFar = 0
    poItems.forEach(pi => {
      const prior = receivedMap[pi.id] || 0
      const current = processedItems.find(p => p.purchase_order_item_id === pi.id)?.quantity_received || 0
      totalPoReceivedSoFar += (prior + current)
    })

    const newPoStatus = totalPoReceivedSoFar >= totalPoOrdered ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
    await supabase.from('token_purchase_orders').update({
      status: newPoStatus,
      updated_at: nowIso
    }).eq('id', purchase_order_id).eq('organization_id', orgId)

    const createdReceipt = await queryOne('SELECT * FROM token_purchase_receipts WHERE id = ? AND organization_id = ?', [receiptId, orgId])
    const createdItems = await queryAll('SELECT * FROM token_purchase_receipt_items WHERE purchase_receipt_id = ? AND organization_id = ?', [receiptId, orgId])

    return res.status(201).json({
      success: true,
      receipt: { ...createdReceipt, items: createdItems, po_status: newPoStatus }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// 10. FREIGHT / COURIER INWARD & DELIVERY TRACKING
// ============================================================================

// List Courier Dispatches / Inwards
procurementRouter.get('/token-procurement/courier-inwards', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { receipt_id, po_id, status } = req.query

    let sql = `
      SELECT cd.*,
             cp.company_name as courier_name,
             cp.tracking_url_template,
             po.po_number,
             pr.purchase_receipt_number,
             p.party_name as vendor_name
      FROM courier_dispatches cd
      LEFT JOIN courier_partners cp ON cd.courier_partner_id = cp.id
      LEFT JOIN token_purchase_orders po ON cd.purchase_order_id = po.id
      LEFT JOIN token_purchase_receipts pr ON cd.purchase_receipt_id = pr.id
      LEFT JOIN token_purchase_parties p ON po.party_id = p.id
      WHERE cd.organization_id = ?
    `
    const params: any[] = [orgId]

    if (receipt_id) {
      sql += ' AND cd.purchase_receipt_id = ?'
      params.push(String(receipt_id))
    }
    if (po_id) {
      sql += ' AND cd.purchase_order_id = ?'
      params.push(String(po_id))
    }
    if (status) {
      sql += ' AND cd.current_status = ?'
      params.push(String(status))
    }

    sql += ' ORDER BY cd.dispatched_at DESC'

    const inwards = await queryAll(sql, params)
    return res.json({ inwards })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Create Freight / Courier Inward
procurementRouter.post('/token-procurement/courier-inwards', requireAuth, requirePermission('procurement', 'can_create_inward'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      purchase_receipt_id,
      courier_partner_id,
      tracking_number,
      dispatch_datetime,
      expected_delivery_datetime,
      courier_charge,
      freight_rate,
      charge_currency,
      current_location,
      notes
    } = req.body

    if (!purchase_receipt_id || !courier_partner_id || !tracking_number) {
      return res.status(400).json({ error: 'purchase_receipt_id, courier_partner_id, and tracking_number are required.' })
    }

    // Verify purchase receipt exists in org
    const receipt = await queryOne<any>(
      'SELECT * FROM token_purchase_receipts WHERE id = ? AND organization_id = ?',
      [purchase_receipt_id, orgId]
    )
    if (!receipt) {
      return res.status(404).json({ error: 'Purchase receipt not found in your organization.' })
    }

    // Verify courier partner exists and is active
    const courier = await queryOne<any>(
      'SELECT * FROM courier_partners WHERE id = ? AND organization_id = ?',
      [courier_partner_id, orgId]
    )
    if (!courier) {
      return res.status(404).json({ error: 'Courier partner not found.' })
    }

    // Check duplicate tracking number within active inward dispatches
    const cleanTracking = tracking_number.trim()
    const dupCheck = await queryOne<any>(
      'SELECT id FROM courier_dispatches WHERE organization_id = ? AND tracking_number = ?',
      [orgId, cleanTracking]
    )
    if (dupCheck) {
      return res.status(409).json({ error: `Tracking / Consignment number '${cleanTracking}' is already in use for shipment ${dupCheck.id}.` })
    }

    // Fetch PO details and destination delivery location
    const po = await queryOne<any>(
      'SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?',
      [receipt.purchase_order_id, orgId]
    )
    const delLoc = po?.delivery_location_snapshot || {}

    const dispatchId = `disp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const dispatchNumber = `INW-${Date.now().toString().slice(-6)}`
    const nowIso = new Date().toISOString()
    const dDatetime = dispatch_datetime || nowIso
    const expDatetime = expected_delivery_datetime || null
    const initialLocation = current_location?.trim() || 'Vendor Origin Hub'

    const { error: insErr } = await supabase.from('courier_dispatches').insert({
      id: dispatchId,
      organization_id: orgId,
      dispatch_number: dispatchNumber,
      carrier_name: courier.company_name,
      awb_number: cleanTracking,
      tracking_number: cleanTracking,
      purchase_order_id: receipt.purchase_order_id,
      purchase_receipt_id,
      courier_partner_id,
      recipient_name: po?.internal_profile_snapshot?.legal_name || 'Central Store',
      recipient_phone: delLoc.mobile || po?.internal_profile_snapshot?.mobile || '0000000000',
      shipping_address: delLoc.address_line || 'Main Warehouse',
      package_contents: 'Cryptographic USB Tokens',
      status: 'DISPATCHED',
      current_status: 'DISPATCHED',
      current_location: initialLocation,
      dispatched_at: dDatetime,
      dispatch_datetime: dDatetime,
      expected_delivery_datetime: expDatetime,
      courier_charge: Number(courier_charge || 0),
      freight_rate: Number(freight_rate || 0),
      charge_currency: charge_currency || 'INR',
      destination_city: delLoc.city || null,
      destination_district: delLoc.district || null,
      destination_state_id: delLoc.state_id || null,
      destination_country_id: delLoc.country_id || 'IN',
      destination_pincode: delLoc.pincode || null,
      notes: notes || null,
      created_at: nowIso,
      updated_at: nowIso
    })

    if (insErr) throw insErr

    // Record initial immutable tracking event
    const historyId = `csh-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    await supabase.from('courier_dispatch_status_history').insert({
      id: historyId,
      organization_id: orgId,
      courier_dispatch_id: dispatchId,
      status: 'DISPATCHED',
      status_datetime: dDatetime,
      current_location: initialLocation,
      expected_delivery_datetime: expDatetime,
      delay_reason: null,
      notes: 'Consignment manifested and handed over to courier.',
      created_by: user.id,
      created_at: nowIso
    })

    // Update receipt status
    await supabase.from('token_purchase_receipts').update({
      status: 'INWARD_CREATED',
      updated_at: nowIso
    }).eq('id', purchase_receipt_id).eq('organization_id', orgId)

    const createdInward = await queryOne('SELECT * FROM courier_dispatches WHERE id = ?', [dispatchId])
    return res.status(201).json({ success: true, inward: createdInward })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Add Tracking Update (Creates immutable courier_dispatch_status_history record)
procurementRouter.post('/token-procurement/courier-inwards/:id/status-update', requireAuth, requirePermission('procurement', 'can_update_tracking'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { id } = req.params
    const {
      status,
      current_location,
      status_datetime,
      expected_delivery_datetime,
      delay_reason,
      notes
    } = req.body

    const validStatuses = ['DISPATCHED', 'IN_TRANSIT', 'DELAYED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }

    const dispatch = await queryOne<any>(
      'SELECT * FROM courier_dispatches WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!dispatch) {
      return res.status(404).json({ error: 'Shipment inward not found in your organization.' })
    }

    if (dispatch.current_status === 'DELIVERED') {
      return res.status(400).json({ error: 'Consignment is already DELIVERED. Status is final and cannot be modified.' })
    }

    const nowIso = new Date().toISOString()
    const sDatetime = status_datetime || nowIso
    const newLocation = current_location?.trim() || dispatch.current_location
    const newExpected = expected_delivery_datetime || dispatch.expected_delivery_datetime

    // Insert immutable history record
    const historyId = `csh-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { error: histErr } = await supabase.from('courier_dispatch_status_history').insert({
      id: historyId,
      organization_id: orgId,
      courier_dispatch_id: id,
      status,
      status_datetime: sDatetime,
      current_location: newLocation,
      expected_delivery_datetime: newExpected,
      delay_reason: delay_reason || null,
      notes: notes || null,
      created_by: user.id,
      created_at: nowIso
    })

    if (histErr) throw histErr

    // Update parent dispatch record with latest status, location, and revision
    const updatePayload: any = {
      status,
      current_status: status,
      current_location: newLocation,
      expected_delivery_datetime: newExpected,
      updated_at: nowIso
    }
    if (status === 'DELIVERED') {
      updatePayload.actual_delivery_datetime = sDatetime
      updatePayload.delivered_at = sDatetime
    }

    await supabase.from('courier_dispatches').update(updatePayload).eq('id', id).eq('organization_id', orgId)

    return res.json({ success: true, message: `Status updated to ${status}.`, current_location: newLocation })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Mark Consignment as Delivered
procurementRouter.post('/token-procurement/courier-inwards/:id/deliver', requireAuth, requirePermission('procurement', 'can_mark_delivered'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { id } = req.params
    const { actual_delivery_datetime, notes } = req.body

    const dispatch = await queryOne<any>(
      'SELECT * FROM courier_dispatches WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!dispatch) {
      return res.status(404).json({ error: 'Shipment inward not found in your organization.' })
    }

    if (dispatch.current_status === 'DELIVERED') {
      return res.status(400).json({ error: 'Shipment is already marked as DELIVERED.' })
    }

    const nowIso = new Date().toISOString()
    const deliveryDt = actual_delivery_datetime || nowIso

    // 1. Insert immutable history event
    const historyId = `csh-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    await supabase.from('courier_dispatch_status_history').insert({
      id: historyId,
      organization_id: orgId,
      courier_dispatch_id: id,
      status: 'DELIVERED',
      status_datetime: deliveryDt,
      current_location: 'Destination Warehouse (Delivered)',
      expected_delivery_datetime: dispatch.expected_delivery_datetime,
      delay_reason: null,
      notes: notes || 'Consignment delivered and verified at destination warehouse.',
      created_by: user.id,
      created_at: nowIso
    })

    // 2. Update dispatch
    await supabase.from('courier_dispatches').update({
      status: 'DELIVERED',
      current_status: 'DELIVERED',
      current_location: 'Destination Warehouse (Delivered)',
      actual_delivery_datetime: deliveryDt,
      delivered_at: deliveryDt,
      updated_at: nowIso
    }).eq('id', id).eq('organization_id', orgId)

    // 3. Update purchase receipt status if linked
    if (dispatch.purchase_receipt_id) {
      await supabase.from('token_purchase_receipts').update({
        status: 'DELIVERED',
        updated_at: nowIso
      }).eq('id', dispatch.purchase_receipt_id).eq('organization_id', orgId)
    }

    return res.json({ success: true, message: 'Consignment successfully marked as DELIVERED.', delivered_at: deliveryDt })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Get Shipment Tracking Timeline / History
procurementRouter.get('/token-procurement/courier-inwards/:id/tracking', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { id } = req.params

    const dispatch = await queryOne<any>(`
      SELECT cd.*,
             cp.company_name as courier_name,
             cp.tracking_url_template,
             po.po_number,
             po.issued_at as po_issued_at,
             pr.purchase_receipt_number,
             pr.purchase_datetime
      FROM courier_dispatches cd
      LEFT JOIN courier_partners cp ON cd.courier_partner_id = cp.id
      LEFT JOIN token_purchase_orders po ON cd.purchase_order_id = po.id
      LEFT JOIN token_purchase_receipts pr ON cd.purchase_receipt_id = pr.id
      WHERE cd.id = ? AND cd.organization_id = ?
    `, [id, orgId])

    if (!dispatch) {
      return res.status(404).json({ error: 'Shipment not found.' })
    }

    const history = await queryAll(`
      SELECT *
      FROM courier_dispatch_status_history
      WHERE courier_dispatch_id = ? AND organization_id = ?
      ORDER BY status_datetime ASC
    `, [id, orgId])

    // Precision turnaround calculations
    let transitTimeHours: number | null = null
    let totalProcurementHours: number | null = null
    let delayHours: number | null = null

    if (dispatch.actual_delivery_datetime && dispatch.dispatch_datetime) {
      const actualMs = new Date(dispatch.actual_delivery_datetime).getTime()
      const dispatchMs = new Date(dispatch.dispatch_datetime).getTime()
      transitTimeHours = Number(((actualMs - dispatchMs) / (1000 * 60 * 60)).toFixed(2))

      if (dispatch.expected_delivery_datetime) {
        const expectedMs = new Date(dispatch.expected_delivery_datetime).getTime()
        delayHours = Number(((actualMs - expectedMs) / (1000 * 60 * 60)).toFixed(2))
      }

      if (dispatch.po_issued_at) {
        const poIssuedMs = new Date(dispatch.po_issued_at).getTime()
        totalProcurementHours = Number(((actualMs - poIssuedMs) / (1000 * 60 * 60)).toFixed(2))
      }
    }

    return res.json({
      dispatch,
      history,
      turnaround: {
        transit_time_hours: transitTimeHours,
        total_procurement_hours: totalProcurementHours,
        delay_hours: delayHours
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// 11. COURIER MASTERS & DESTINATION-BASED PERFORMANCE ANALYTICS
// ============================================================================

// List Courier Masters
procurementRouter.get('/token-procurement/couriers', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const couriers = await queryAll(
      'SELECT * FROM courier_partners WHERE organization_id = ? ORDER BY is_active DESC, company_name ASC',
      [orgId]
    )
    return res.json({ couriers })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Quick Create Courier Partner
procurementRouter.post('/token-procurement/couriers', requireAuth, requirePermission('procurement', 'can_create_courier'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_name, tracking_url_template, support_phone, is_active } = req.body

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'company_name is required.' })
    }

    const cleanName = company_name.trim()
    const existing = await queryOne(
      'SELECT id FROM courier_partners WHERE organization_id = ? AND company_name = ?',
      [orgId, cleanName]
    )
    if (existing) {
      return res.status(400).json({ error: `Courier partner '${cleanName}' already exists.` })
    }

    const id = `cp-${Date.now()}`
    const { error: insErr } = await supabase.from('courier_partners').insert({
      id,
      organization_id: orgId,
      company_name: cleanName,
      tracking_url_template: tracking_url_template?.trim() || null,
      support_phone: support_phone?.trim() || null,
      is_active: is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1
    })

    if (insErr) throw insErr

    const created = await queryOne('SELECT * FROM courier_partners WHERE id = ?', [id])
    return res.status(201).json({ success: true, courier: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Courier Performance Analytics & Destination Recommendations
procurementRouter.get('/token-procurement/analytics/courier-performance', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { pincode, city, state_id, country_id } = req.query

    // Retrieve all completed or dispatched inward shipments for this organization
    const shipments = await queryAll<any>(`
      SELECT cd.*,
             cp.company_name as courier_name
      FROM courier_dispatches cd
      JOIN courier_partners cp ON cd.courier_partner_id = cp.id
      WHERE cd.organization_id = ?
        AND cd.dispatch_datetime IS NOT NULL
    `, [orgId])

    // Overall courier performance breakdown
    const courierMap: Record<string, {
      courier_id: string
      courier_name: string
      total_shipments: number
      delivered_shipments: number
      delayed_shipments: number
      returned_shipments: number
      total_transit_hours: number
      total_delay_hours: number
    }> = {}

    shipments.forEach(s => {
      if (!courierMap[s.courier_partner_id]) {
        courierMap[s.courier_partner_id] = {
          courier_id: s.courier_partner_id,
          courier_name: s.courier_name,
          total_shipments: 0,
          delivered_shipments: 0,
          delayed_shipments: 0,
          returned_shipments: 0,
          total_transit_hours: 0,
          total_delay_hours: 0
        }
      }

      const cm = courierMap[s.courier_partner_id]
      cm.total_shipments++

      if (s.current_status === 'DELIVERED' || s.status === 'DELIVERED') {
        cm.delivered_shipments++
        if (s.actual_delivery_datetime && s.dispatch_datetime) {
          const transitH = (new Date(s.actual_delivery_datetime).getTime() - new Date(s.dispatch_datetime).getTime()) / (1000 * 60 * 60)
          if (transitH >= 0) cm.total_transit_hours += transitH
        }
        if (s.actual_delivery_datetime && s.expected_delivery_datetime) {
          const delayH = (new Date(s.actual_delivery_datetime).getTime() - new Date(s.expected_delivery_datetime).getTime()) / (1000 * 60 * 60)
          if (delayH > 0) {
            cm.delayed_shipments++
            cm.total_delay_hours += delayH
          }
        }
      } else if (s.current_status === 'RETURNED' || s.status === 'RETURNED' || s.status === 'RETURNED_TO_OFFICE') {
        cm.returned_shipments++
      }
    })

    const courierStats = Object.values(courierMap).map(c => {
      const avgTransitDays = c.delivered_shipments > 0 ? (c.total_transit_hours / (c.delivered_shipments * 24)) : 0
      const avgDelayHours = c.delayed_shipments > 0 ? (c.total_delay_hours / c.delayed_shipments) : 0
      const successRate = c.total_shipments > 0 ? (c.delivered_shipments / c.total_shipments) * 100 : 0
      const returnRate = c.total_shipments > 0 ? (c.returned_shipments / c.total_shipments) * 100 : 0

      return {
        ...c,
        avg_transit_days: Number(avgTransitDays.toFixed(1)),
        avg_delay_hours: Number(avgDelayHours.toFixed(1)),
        delivery_success_rate: Number(successRate.toFixed(1)),
        return_rate: Number(returnRate.toFixed(1))
      }
    })

    // Destination-based recommendation engine (Hierarchical: Pincode -> City -> State -> Country)
    let recommendation: any = null
    const targetPin = pincode ? String(pincode).trim() : null
    const targetCity = city ? String(city).trim().toLowerCase() : null
    const targetState = state_id ? String(state_id).trim().toUpperCase() : null

    let destinationMatches: any[] = []
    let granularity = 'NONE'

    if (targetPin) {
      destinationMatches = shipments.filter(s => s.destination_pincode && s.destination_pincode.trim() === targetPin && s.current_status === 'DELIVERED')
      if (destinationMatches.length >= 3) granularity = 'PINCODE'
    }

    if (destinationMatches.length < 3 && targetCity) {
      destinationMatches = shipments.filter(s => s.destination_city && s.destination_city.trim().toLowerCase() === targetCity && s.current_status === 'DELIVERED')
      if (destinationMatches.length >= 3) granularity = 'CITY'
    }

    if (destinationMatches.length < 3 && targetState) {
      destinationMatches = shipments.filter(s => s.destination_state_id && s.destination_state_id.trim().toUpperCase() === targetState && s.current_status === 'DELIVERED')
      if (destinationMatches.length >= 3) granularity = 'STATE'
    }

    if (destinationMatches.length >= 3) {
      // Aggregate by courier
      const destCourierMap: Record<string, { courier_name: string; count: number; total_hours: number; on_time_count: number }> = {}
      destinationMatches.forEach(s => {
        if (!destCourierMap[s.courier_partner_id]) {
          destCourierMap[s.courier_partner_id] = { courier_name: s.courier_name, count: 0, total_hours: 0, on_time_count: 0 }
        }
        const dc = destCourierMap[s.courier_partner_id]
        dc.count++
        if (s.actual_delivery_datetime && s.dispatch_datetime) {
          const h = (new Date(s.actual_delivery_datetime).getTime() - new Date(s.dispatch_datetime).getTime()) / (1000 * 60 * 60)
          dc.total_hours += h
        }
        if (s.actual_delivery_datetime && s.expected_delivery_datetime) {
          if (new Date(s.actual_delivery_datetime).getTime() <= new Date(s.expected_delivery_datetime).getTime()) {
            dc.on_time_count++
          }
        }
      })

      // Pick top courier by lowest average transit time
      const ranked = Object.entries(destCourierMap)
        .map(([id, data]) => ({
          courier_id: id,
          courier_name: data.courier_name,
          deliveries_count: data.count,
          avg_transit_days: Number((data.total_hours / (data.count * 24)).toFixed(1)),
          on_time_rate: Number(((data.on_time_count / data.count) * 100).toFixed(1))
        }))
        .sort((a, b) => a.avg_transit_days - b.avg_transit_days)

      if (ranked.length > 0) {
        recommendation = {
          has_data: true,
          granularity,
          recommended_courier: ranked[0],
          details: `Based on ${ranked[0].deliveries_count} delivered shipments to ${granularity}: Average transit ${ranked[0].avg_transit_days} days with ${ranked[0].on_time_rate}% on-time performance.`
        }
      }
    }

    if (!recommendation) {
      recommendation = {
        has_data: false,
        message: 'Insufficient historical data for this destination.'
      }
    }

    return res.json({
      courier_performance: courierStats,
      destination_recommendation: recommendation
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// 12. PURCHASE BILLS / INWARD VOUCHERS (Mandatory Company Profile + Stock Posting)
// ============================================================================

// List Purchase Bills
procurementRouter.get('/token-procurement/purchase-bills', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id, status } = req.query

    let sql = `
      SELECT pb.*,
             prof.legal_name as company_name,
             prof.gstin as company_gstin,
             p.party_name as vendor_name,
             po.po_number
      FROM token_purchase_bills pb
      LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
      LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
      LEFT JOIN token_purchase_orders po ON pb.purchase_order_id = po.id
      WHERE pb.organization_id = ?
    `
    const params: any[] = [orgId]

    if (company_profile_id) {
      sql += ' AND pb.company_profile_id = ?'
      params.push(String(company_profile_id))
    }
    if (status) {
      sql += ' AND pb.status = ?'
      params.push(String(status))
    }

    sql += ' ORDER BY pb.accounting_date DESC, pb.created_at DESC'

    const bills = await queryAll(sql, params)
    const overrides = await getBillCreditOverrides(orgId)
    const enrichedBills = bills.map((b: any) => {
      const ovr = overrides.find(o => o.bill_id === b.id)
      return {
        ...b,
        credit_period_days: ovr ? ovr.credit_period_days : 0,
        due_date: ovr ? ovr.due_date : (b.accounting_date || b.created_at?.slice(0, 10)),
        paid_amount: ovr ? ovr.paid_amount : 0,
        outstanding_balance: ovr ? ovr.outstanding_balance : Number(b.grand_total || 0)
      }
    })
    return res.json({ purchase_bills: enrichedBills })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Get Single Purchase Bill with Items
procurementRouter.get('/token-procurement/purchase-bills/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const id = String(req.params.id)

    const bill = await queryOne<any>(`
      SELECT pb.*,
             prof.legal_name as company_name,
             prof.trade_name as company_trade_name,
             prof.gstin as company_gstin,
             prof.gst_registered as company_gst_registered,
             p.party_name as vendor_name,
             po.po_number,
             po.po_date
      FROM token_purchase_bills pb
      LEFT JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
      LEFT JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
      LEFT JOIN token_purchase_orders po ON pb.purchase_order_id = po.id
      WHERE pb.id = ? AND pb.organization_id = ?
    `, [id, orgId])

    if (!bill) {
      return res.status(404).json({ error: 'Purchase Bill not found in your organization.' })
    }

    const items = await queryAll(
      'SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id = ? AND organization_id = ? ORDER BY created_at ASC',
      [id, orgId]
    )

    const ovr = await getBillCreditOverride(orgId, id)
    return res.json({
      purchase_bill: {
        ...bill,
        credit_period_days: ovr ? ovr.credit_period_days : 0,
        due_date: ovr ? ovr.due_date : (bill.accounting_date || bill.created_at?.slice(0, 10)),
        paid_amount: ovr ? ovr.paid_amount : 0,
        outstanding_balance: ovr ? ovr.outstanding_balance : Number(bill.grand_total || 0),
        items
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Create Purchase Bill (Initial status: DRAFT)
procurementRouter.post('/token-procurement/purchase-bills', requireAuth, requirePermission('procurement', 'can_create_purchase'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      company_profile_id,
      supplier_invoice_number,
      accounting_date,
      supplier_invoice_date,
      vendor_party_id,
      courier_dispatch_id,
      freight_amount,
      purchase_order_id,
      purchase_receipt_id,
      items,
      other_charges,
      notes,
      credit_period_days,
      due_date
    } = req.body

    // 1. Mandatory Profile Rule
    if (!company_profile_id || !company_profile_id.trim()) {
      return res.status(400).json({ error: 'company_profile_id is strictly mandatory. Every Purchase Bill must belong to exactly one company profile.' })
    }
    if (!supplier_invoice_number || !supplier_invoice_number.trim()) {
      return res.status(400).json({ error: 'supplier_invoice_number is required.' })
    }
    if (!vendor_party_id) {
      return res.status(400).json({ error: 'vendor_party_id is required.' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one bill line item is required.' })
    }

    // 2. Profile Security: Validate profile exists in authenticated organization
    const profile = await queryOne<any>(
      'SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?',
      [company_profile_id.trim(), orgId]
    )
    if (!profile) {
      return res.status(403).json({ error: 'Permission denied: Specified company profile does not exist in your organization.' })
    }

    // 3. Vendor Security
    const vendor = await queryOne<any>(
      'SELECT * FROM token_purchase_parties WHERE id = ? AND organization_id = ?',
      [vendor_party_id, orgId]
    )
    if (!vendor) {
      return res.status(403).json({ error: 'Permission denied: Specified vendor does not exist in your organization.' })
    }

    // 4. Optional PO linking validation
    let poRecord: any = null
    if (purchase_order_id) {
      poRecord = await queryOne<any>(
        'SELECT * FROM token_purchase_orders WHERE id = ? AND organization_id = ?',
        [purchase_order_id, orgId]
      )
      if (!poRecord) {
        return res.status(404).json({ error: 'Linked Purchase Order not found in your organization.' })
      }
      if (poRecord.status !== 'ISSUED' && poRecord.status !== 'PARTIALLY_RECEIVED' && poRecord.status !== 'FULLY_RECEIVED') {
        return res.status(400).json({ error: `Cannot bill against Purchase Order in status '${poRecord.status}'. PO must be ISSUED.` })
      }
    }

    // 5. Line Item Validation & Strict Single Profile Enforcement
    let billSubtotal = 0
    let billCgst = 0
    let billSgst = 0
    let billIgst = 0
    let billTotalTax = 0

    const isInterstate = Boolean(
      vendor.state_id && profile.state_id &&
      vendor.state_id.trim().toUpperCase() !== profile.state_id.trim().toUpperCase()
    )
    const isGstRegistered = Boolean(profile.gst_registered && profile.gstin)

    const processedItems: any[] = []

    for (const item of items) {
      // Rule 8 & 9: Verify line item profile equals header profile
      if (item.company_profile_id && item.company_profile_id !== company_profile_id) {
        return res.status(400).json({
          error: `Cross-profile bill forbidden: Line item specifies profile '${item.company_profile_id}', but header profile is '${company_profile_id}'. All items must share the header profile.`
        })
      }

      const q = parseInt(item.quantity, 10)
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive integer.' })
      }
      const rate = parseFloat(item.unit_rate) || 0
      const taxable = Number((q * rate).toFixed(2))

      // Tax calculation respecting company profile's GST registration status
      let gstRate = 0
      let cgst = 0
      let sgst = 0
      let igst = 0
      let totalTax = 0

      if (isGstRegistered) {
        gstRate = parseFloat(item.gst_rate) || 18.00
        if (isInterstate) {
          igst = Number(((taxable * gstRate) / 100).toFixed(2))
          totalTax = igst
        } else {
          cgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2))
          sgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2))
          totalTax = Number((cgst + sgst).toFixed(2))
        }
      }

      const lineOther = parseFloat(item.other_charges) || 0
      const lineTotal = Number((taxable + totalTax + lineOther).toFixed(2))

      billSubtotal += taxable
      billCgst += cgst
      billSgst += sgst
      billIgst += igst
      billTotalTax += totalTax

      processedItems.push({
        company_profile_id,
        purchase_order_item_id: item.purchase_order_item_id || null,
        token_model_id: item.token_model_id || null,
        token_company_id: item.token_company_id || null,
        token_product_id: item.token_product_id || null,
        token_version_id: item.token_version_id || null,
        description: item.description || 'Cryptographic USB Token',
        quantity: q,
        unit_rate: rate,
        taxable_value: taxable,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_tax: totalTax,
        other_charges: lineOther,
        line_total: lineTotal,
        token_snapshot: item.token_snapshot || {}
      })
    }

    // --- FREIGHT / COURIER INWARD ALLOCATION & LANDED COST ARITHMETIC ---
    let freightCharge = parseFloat(freight_amount) || 0
    let linkedDispatchId: string | null = courier_dispatch_id || null

    if (linkedDispatchId) {
      const dispatchRecord = await queryOne<any>(
        'SELECT * FROM courier_dispatches WHERE id = ? AND organization_id = ?',
        [linkedDispatchId, orgId]
      )
      if (dispatchRecord && (!freight_amount || freightCharge === 0)) {
        freightCharge = parseFloat(dispatchRecord.courier_charge) || 0
      }
    }

    const totalBillQuantity = processedItems.reduce((sum, it) => sum + it.quantity, 0)
    let allocatedFreightSum = 0

    if (totalBillQuantity > 0 && freightCharge > 0) {
      processedItems.forEach((it, index) => {
        if (index === processedItems.length - 1) {
          // Last item absorbs any rounding discrepancy
          it.freight_allocation = Number((freightCharge - allocatedFreightSum).toFixed(2))
        } else {
          const itemFreight = Number(((freightCharge * it.quantity) / totalBillQuantity).toFixed(2))
          it.freight_allocation = itemFreight
          allocatedFreightSum += itemFreight
        }
        it.landed_total_value = Number((it.taxable_value + it.freight_allocation).toFixed(2))
        it.landed_cost = Number((it.landed_total_value / it.quantity).toFixed(2))
      })
    } else {
      processedItems.forEach(it => {
        it.freight_allocation = 0.00
        it.landed_total_value = it.taxable_value
        it.landed_cost = it.unit_rate
      })
    }

    const billOtherCharges = parseFloat(other_charges) || 0
    const grandTotal = Number((billSubtotal + billTotalTax + billOtherCharges).toFixed(2))

    // 6. Concurrency-safe, FY-aware Internal Voucher Number
    const voucherNumber = await queryOne<{ num: string }>(
      "SELECT public.next_procurement_number(?, 'PB', 'PB') AS num",
      [orgId]
    ).then(r => r?.num || `PB/${Date.now()}`)

    const billId = `pb-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const nowIso = new Date().toISOString()
    const aDate = accounting_date || nowIso.slice(0, 10)
    const sDate = supplier_invoice_date || aDate

    // 7. Insert Purchase Bill (Status: DRAFT)
    const { error: insErr } = await supabase.from('token_purchase_bills').insert({
      id: billId,
      organization_id: orgId,
      company_profile_id,
      voucher_number: voucherNumber,
      supplier_invoice_number: supplier_invoice_number.trim(),
      accounting_date: aDate,
      supplier_invoice_date: sDate,
      purchase_order_id: purchase_order_id || null,
      purchase_receipt_id: purchase_receipt_id || null,
      vendor_party_id,
      place_of_supply: profile.state_id || null,
      vendor_gstin: vendor.gstin || null,
      vendor_state: vendor.state_id || null,
      vendor_state_code: vendor.state_id || null,
      subtotal: billSubtotal,
      cgst_amount: billCgst,
      sgst_amount: billSgst,
      igst_amount: billIgst,
      gst_amount: billTotalTax,
      other_charges: billOtherCharges,
      courier_dispatch_id: linkedDispatchId,
      freight_amount: freightCharge,
      round_off: 0.00,
      grand_total: grandTotal,
      status: 'DRAFT',
      notes: notes || null,
      company_profile_snapshot: profile,
      vendor_snapshot: vendor,
      created_by: user.id,
      created_at: nowIso,
      updated_at: nowIso
    })

    if (insErr) throw insErr

    // Insert line items with mandatory company_profile_id
    for (const it of processedItems) {
      const itId = `pbi-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      await supabase.from('token_purchase_bill_items').insert({
        id: itId,
        organization_id: orgId,
        purchase_bill_id: billId,
        ...it,
        created_at: nowIso
      })
    }

    // Credit period snapshot and due date automation
    const vendorCreditCfg = await getPartyCreditConfig(orgId, vendor_party_id)
    const effectiveCreditDays = credit_period_days !== undefined
      ? Math.max(0, parseInt(credit_period_days, 10) || 0)
      : (vendorCreditCfg ? vendorCreditCfg.credit_period_days : (Number(vendor.credit_period_days) || 0))
    const billDueDate = due_date || new Date(new Date(aDate).getTime() + (effectiveCreditDays * 86400000)).toISOString().slice(0, 10)

    await saveBillCreditOverride({
      bill_id: billId,
      organization_id: orgId,
      company_profile_id,
      credit_period_days: effectiveCreditDays,
      due_date: billDueDate,
      paid_amount: 0.00,
      outstanding_balance: grandTotal
    })

    const createdBill = await queryOne('SELECT * FROM token_purchase_bills WHERE id = ?', [billId])
    const createdItems = await queryAll('SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id = ?', [billId])

    return res.status(201).json({
      success: true,
      purchase_bill: {
        ...createdBill,
        credit_period_days: effectiveCreditDays,
        due_date: billDueDate,
        paid_amount: 0.00,
        outstanding_balance: grandTotal,
        items: createdItems
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Post Purchase Bill (Transitions DRAFT -> POSTED, Updates Profile Stock Automatically)
procurementRouter.post('/token-procurement/purchase-bills/:id/post', requireAuth, requirePermission('procurement', 'can_create_purchase'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const { id } = req.params

    const bill = await queryOne<any>(
      'SELECT * FROM token_purchase_bills WHERE id = ? AND organization_id = ?',
      [id, orgId]
    )
    if (!bill) {
      return res.status(404).json({ error: 'Purchase Bill not found in your organization.' })
    }

    if (bill.status === 'POSTED') {
      return res.status(400).json({ error: 'Purchase Bill is already POSTED / accounted.' })
    }
    if (bill.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cancelled Purchase Bills cannot be posted.' })
    }

    const items = await queryAll<any>(
      'SELECT * FROM token_purchase_bill_items WHERE purchase_bill_id = ? AND organization_id = ?',
      [id, orgId]
    )

    const nowIso = new Date().toISOString()

    // Automatic Stock Posting per Company Profile with Landed Cost
    for (const it of items) {
      const modelId = it.token_model_id || 'tm-1'
      const modelName = it.description || 'Cryptographic USB Token'
      const qty = it.quantity
      const rate = it.unit_rate
      const landedUnit = parseFloat(it.landed_cost) || rate
      const landedTotal = parseFloat(it.landed_total_value) || Number((qty * landedUnit).toFixed(2))

      // Upsert profile stock
      const existingStock = await queryOne<any>(
        'SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?',
        [orgId, bill.company_profile_id, modelId]
      )

      if (existingStock) {
        const curOnHand = Number(existingStock.quantity_on_hand || 0)
        const curLandedVal = parseFloat(existingStock.total_landed_valuation) || Number((curOnHand * (parseFloat(existingStock.landed_cost) || rate)).toFixed(2))
        const newOnHand = curOnHand + qty
        const newTotalValuation = Number((curLandedVal + landedTotal).toFixed(2))
        const weightedLandedCost = newOnHand > 0 ? Number((newTotalValuation / newOnHand).toFixed(2)) : landedUnit

        await supabase.from('token_profile_stocks').update({
          purchased_quantity: Number(existingStock.purchased_quantity || 0) + qty,
          quantity_on_hand: newOnHand,
          last_purchase_rate: rate,
          landed_cost: weightedLandedCost,
          total_landed_valuation: newTotalValuation,
          last_updated_at: nowIso
        }).eq('id', existingStock.id)
      } else {
        const stockId = `tps-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        await supabase.from('token_profile_stocks').insert({
          id: stockId,
          organization_id: orgId,
          company_profile_id: bill.company_profile_id,
          token_model_id: modelId,
          model_name: modelName,
          opening_quantity: 0,
          purchased_quantity: qty,
          issued_quantity: 0,
          quantity_on_hand: qty,
          last_purchase_rate: rate,
          landed_cost: landedUnit,
          total_landed_valuation: landedTotal,
          last_updated_at: nowIso
        })
      }
    }

    // Transition Bill to POSTED
    const { error: postErr } = await supabase.from('token_purchase_bills').update({
      status: 'POSTED',
      posted_by: user.id,
      posted_at: nowIso,
      updated_at: nowIso
    }).eq('id', id).eq('organization_id', orgId)

    if (postErr) throw postErr

    return res.json({
      success: true,
      message: `Purchase Bill ${bill.voucher_number} successfully posted. Profile inventory updated.`,
      status: 'POSTED',
      posted_at: nowIso
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// 13. OPENING STOCK MASTER & PROFILE STOCK LEDGER
// ============================================================================

// List Opening Stock entries
procurementRouter.get('/token-procurement/opening-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id } = req.query

    let sql = `
      SELECT os.*,
             prof.legal_name as company_name,
             tm.model_name
      FROM token_opening_stock os
      LEFT JOIN purchase_internal_profiles prof ON os.company_profile_id = prof.id
      LEFT JOIN token_models tm ON os.token_model_id = tm.id
      WHERE os.organization_id = ?
    `
    const params: any[] = [orgId]

    if (company_profile_id) {
      sql += ' AND os.company_profile_id = ?'
      params.push(String(company_profile_id))
    }

    sql += ' ORDER BY os.opening_date DESC, os.created_at DESC'

    const entries = await queryAll(sql, params)
    return res.json({ opening_stocks: entries })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Record Opening Stock (Does NOT create vendor payable, invoice, or PO)
procurementRouter.post('/token-procurement/opening-stock', requireAuth, requirePermission('procurement', 'can_create_purchase'), async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const user = (req as any).user
    const {
      company_profile_id,
      opening_date,
      token_model_id,
      token_company_id,
      token_product_id,
      token_version_id,
      item_description,
      quantity,
      purchase_rate,
      notes
    } = req.body

    if (!company_profile_id || !company_profile_id.trim()) {
      return res.status(400).json({ error: 'company_profile_id is required. Opening stock belongs to exactly one company profile.' })
    }

    const profile = await queryOne<any>(
      'SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?',
      [company_profile_id.trim(), orgId]
    )
    if (!profile) {
      return res.status(403).json({ error: 'Permission denied: Specified company profile does not exist in your organization.' })
    }

    const q = parseInt(quantity, 10)
    if (isNaN(q) || q < 0) {
      return res.status(400).json({ error: 'Quantity must be zero or a positive integer.' })
    }

    const rate = parseFloat(purchase_rate) || 0
    const valuation = Number((q * rate).toFixed(2))

    const id = `os-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const oDate = opening_date || new Date().toISOString().slice(0, 10)
    const modelId = token_model_id || 'tm-1'
    const desc = item_description?.trim() || 'ePass2003 Auto Cryptographic Token'
    const nowIso = new Date().toISOString()

    const { error: insErr } = await supabase.from('token_opening_stock').insert({
      id,
      organization_id: orgId,
      company_profile_id,
      opening_date: oDate,
      token_model_id: modelId,
      token_company_id: token_company_id || null,
      token_product_id: token_product_id || null,
      token_version_id: token_version_id || null,
      item_description: desc,
      quantity: q,
      purchase_rate: rate,
      total_valuation: valuation,
      notes: notes || null,
      created_by: user.id,
      created_at: nowIso,
      updated_at: nowIso
    })

    if (insErr) throw insErr

    // Update or insert into token_profile_stocks
    const existingStock = await queryOne<any>(
      'SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?',
      [orgId, company_profile_id, modelId]
    )

    if (existingStock) {
      await supabase.from('token_profile_stocks').update({
        opening_quantity: Number(existingStock.opening_quantity || 0) + q,
        quantity_on_hand: Number(existingStock.quantity_on_hand || 0) + q,
        last_updated_at: nowIso
      }).eq('id', existingStock.id)
    } else {
      const stockId = `tps-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      await supabase.from('token_profile_stocks').insert({
        id: stockId,
        organization_id: orgId,
        company_profile_id,
        token_model_id: modelId,
        model_name: desc,
        opening_quantity: q,
        purchased_quantity: 0,
        issued_quantity: 0,
        quantity_on_hand: q,
        last_purchase_rate: rate,
        last_updated_at: nowIso
      })
    }

    const created = await queryOne('SELECT * FROM token_opening_stock WHERE id = ?', [id])
    return res.status(201).json({ success: true, opening_stock: created })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Get Profile-Specific Stock Inventory Ledger
procurementRouter.get('/token-procurement/profile-stocks', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getAuthOrg(req)
    const { company_profile_id } = req.query

    let sql = `
      SELECT tps.*,
             prof.legal_name as company_name,
             prof.gstin as company_gstin
      FROM token_profile_stocks tps
      JOIN purchase_internal_profiles prof ON tps.company_profile_id = prof.id
      WHERE tps.organization_id = ?
    `
    const params: any[] = [orgId]

    if (company_profile_id) {
      sql += ' AND tps.company_profile_id = ?'
      params.push(String(company_profile_id))
    }

    sql += ' ORDER BY model_name ASC'

    const stocks = await queryAll(sql, params)
    return res.json({ profile_stocks: stocks })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})


