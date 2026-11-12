import { Router, Request, Response, NextFunction } from 'express'
import {
  getAssociatePartners,
  getAssociatePartnerByPartnerId,
  saveAssociatePartner,
  deleteAssociatePartner,
  getDscDirectRateCards,
  saveDscDirectRateCard,
  deleteDscDirectRateCard,
  getDscWorkflowStages,
  saveDscWorkflowStage,
  getDscDocumentRequirements,
  saveDscDocumentRequirement,
  getDscEstimates,
  saveDscEstimate,
  getDscApplications,
  saveDscApplication,
  getDscStageHistory,
  addDscStageHistory,
  DscIssuanceApplication,
  DscIssuanceEstimate,
} from '../dscDirectIssuanceStore'
import {
  resolveDirectDscPricing,
  PricingResolutionRequest,
} from '../dscDirectPricingEngine'
import { queryAll, queryOne, supabase } from '../supabase'
import { getDscCompanies, getDscProducts, getDscClasses, getValidities } from '../dscMasterStore'

export const dscDirectIssuanceRouter = Router()

function getSessionUser(req: Request) {
  return (req as any).user
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Please enter your email and password to sign in.' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' })
  }
  next()
}

// Admin-Only Guard for Rate Cards, Workflow Stages, Requirements, and Associate Partner Config
function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' })
  }
  const isSuperAdmin = user.hierarchy_level_order === 0
  const isPartnerAdmin = user.hierarchy_level_order === 1
  if (!isSuperAdmin && !isPartnerAdmin) {
    return res.status(403).json({
      error: 'Permission denied: Only Administrators and Super Administrators can manage DSC rate cards and workflow configurations.',
    })
  }
  next()
}

// Guard: Level 4 cannot access Direct Issuance Hub
function requireDirectIssuanceAccess(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' })
  }
  if (user.hierarchy_level_order > 3) {
    return res.status(403).json({ error: 'Access denied. You do not have permission to access Direct Issuance Hub.' })
  }
  next()
}

dscDirectIssuanceRouter.use('/dsc/direct', requireAuth, requireDirectIssuanceAccess)
dscDirectIssuanceRouter.get('/dsc/direct/init-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    // Fetch master lookups
    const [
      profiles,
      allParties,
      assocConfigs,
      companies,
      products,
      classes,
      validities,
      stages,
      docReqs,
      tokenModels,
    ] = await Promise.all([
      queryAll<any>('SELECT id, legal_name, trade_name, is_default FROM purchase_internal_profiles WHERE organization_id = ? AND is_active = true', [orgId]),
      queryAll<any>('SELECT id, partner_code, company_name, contact_person, email, phone, is_dsc_partner, is_token_customer, type, status FROM partners WHERE organization_id = ? AND status = \'active\'', [orgId]),
      getAssociatePartners(orgId),
      getDscCompanies(),
      getDscProducts(),
      getDscClasses(),
      getValidities(),
      getDscWorkflowStages(orgId),
      getDscDocumentRequirements(orgId),
      queryAll<any>('SELECT id, model_name, manufacturer FROM token_models WHERE organization_id = ? AND is_active = 1', [orgId]),
    ])

    // Build Associate Partners list (parties that have an active AssociatePartner config)
    const assocPartnerIds = new Set(assocConfigs.filter((c: any) => c.is_active).map((c: any) => c.partner_id))
    const associatePartners = allParties
      .filter((p: any) => assocPartnerIds.has(p.id))
      .map((p: any) => {
        const conf = assocConfigs.find((c: any) => c.partner_id === p.id)
        return {
          ...p,
          associate_config: conf,
        }
      })

    // Customers list for Direct Sale
    const customers = allParties

    return res.json({
      profiles,
      customers,
      associatePartners,
      companies,
      products,
      classes,
      validities,
      stages,
      documentRequirements: docReqs,
      tokenModels,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 2. PRICING RESOLUTION (/api/dsc/direct/resolve-pricing)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.post('/dsc/direct/resolve-pricing', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      fulfillment_channel = 'DIRECT_SALE',
      associate_partner_id,
      fulfillment_model = 'COMMISSION',
      quantity = 1,
      date,
    } = req.body

    if (!company_id || !product_id) {
      return res.status(400).json({ error: 'company_id (CA) and product_id are required to resolve pricing.' })
    }

    if (fulfillment_channel === 'ASSOCIATE_PARTNER' && !associate_partner_id) {
      return res.status(400).json({ error: 'associate_partner_id is required when fulfillment channel is ASSOCIATE_PARTNER.' })
    }

    // Verify Associate Partner eligibility if chosen
    if (fulfillment_channel === 'ASSOCIATE_PARTNER' && associate_partner_id) {
      const assoc = await getAssociatePartnerByPartnerId(orgId, associate_partner_id)
      if (!assoc || !assoc.is_active) {
        return res.status(400).json({
          error: 'The selected party is not registered as an active Associate Partner in the system.',
        })
      }
    }

    const resolution = await resolveDirectDscPricing({
      organizationId: orgId,
      companyProfileId: company_profile_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id,
      validityId: validity_id,
      fulfillmentChannel: fulfillment_channel,
      associatePartnerId: associate_partner_id,
      fulfillmentModel: fulfillment_model,
      quantity: Number(quantity) || 1,
      date: date || new Date().toISOString().split('T')[0],
    })

    if (!resolution.success) {
      return res.status(400).json({ error: resolution.error || 'Failed to resolve pricing.' })
    }

    return res.json(resolution)
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 3. ASSOCIATE PARTNER MANAGEMENT (Admin Only)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/associate-partners', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const configs = await getAssociatePartners(orgId)
    const partners = await queryAll<any>('SELECT id, partner_code, company_name, contact_person, email, phone FROM partners WHERE organization_id = ?', [orgId])
    const partnerMap = new Map(partners.map((p) => [p.id, p]))

    const enriched = configs.map((c) => ({
      ...c,
      partner: partnerMap.get(c.partner_id) || null,
    }))

    return res.json({ associatePartners: enriched })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.post('/dsc/direct/associate-partners', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      partner_id,
      commission_percentage = 10,
      default_fulfillment_model = 'COMMISSION',
      notes,
    } = req.body

    if (!partner_id) {
      return res.status(400).json({ error: 'partner_id is required.' })
    }

    const party = await queryOne<any>('SELECT id, company_name FROM partners WHERE id = ? AND organization_id = ?', [partner_id, orgId])
    if (!party) {
      return res.status(404).json({ error: 'Selected partner does not exist.' })
    }

    const id = `assoc-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newConfig = {
      id,
      organization_id: orgId,
      partner_id,
      is_active: true,
      commission_percentage: Number(commission_percentage),
      default_fulfillment_model,
      notes,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveAssociatePartner(newConfig)
    return res.status(201).json({ success: true, associatePartner: newConfig })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.put('/dsc/direct/associate-partners/:id', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { is_active, commission_percentage, default_fulfillment_model, notes } = req.body

    const all = await getAssociatePartners(orgId)
    const existing = all.find((c) => c.id === req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Associate Partner configuration not found.' })
    }

    const updated = {
      ...existing,
      is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
      commission_percentage: commission_percentage !== undefined ? Number(commission_percentage) : existing.commission_percentage,
      default_fulfillment_model: default_fulfillment_model || existing.default_fulfillment_model,
      notes: notes !== undefined ? notes : existing.notes,
      updated_at: new Date().toISOString(),
    }

    await saveAssociatePartner(updated)
    return res.json({ success: true, associatePartner: updated })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 4. RATE CARDS MANAGEMENT (Admin Only)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/rate-cards', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const cards = await getDscDirectRateCards(orgId)
    return res.json({ rateCards: cards })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.post('/dsc/direct/rate-cards', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      rate_card_type,
      company_profile_id,
      company_id,
      product_id,
      class_id,
      validity_id,
      rate,
      effective_from,
      effective_to,
    } = req.body

    if (!rate_card_type || !company_id || !product_id || rate === undefined || !effective_from) {
      return res.status(400).json({
        error: 'rate_card_type, company_id, product_id, rate, and effective_from are required.',
      })
    }

    const id = `rc-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newCard = {
      id,
      organization_id: orgId,
      rate_card_type,
      company_profile_id: company_profile_id || null,
      company_id,
      product_id,
      class_id: class_id || null,
      validity_id: validity_id || null,
      rate: Number(rate),
      effective_from,
      effective_to: effective_to || null,
      is_active: true,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveDscDirectRateCard(newCard)
    return res.status(201).json({ success: true, rateCard: newCard })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.delete('/dsc/direct/rate-cards/:id', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    await deleteDscDirectRateCard(orgId, String(req.params.id))
    return res.json({ success: true })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 5. WORKFLOW STAGES & DOCUMENT REQUIREMENTS (Admin Only for Mutation)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/stages', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const stages = await getDscWorkflowStages(orgId)
    const reqs = await getDscDocumentRequirements(orgId)
    return res.json({ stages, documentRequirements: reqs })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.post('/dsc/direct/stages', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { stage_key, stage_name, stage_order, color, description } = req.body

    if (!stage_key || !stage_name || stage_order === undefined) {
      return res.status(400).json({ error: 'stage_key, stage_name, and stage_order are mandatory.' })
    }

    const id = `stg-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newStage = {
      id,
      organization_id: orgId,
      stage_key,
      stage_name,
      stage_order: Number(stage_order),
      color: color || 'indigo',
      description,
      is_active: true,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveDscWorkflowStage(newStage)
    return res.status(201).json({ success: true, stage: newStage })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.post('/dsc/direct/document-requirements', requireAuth, requireAdminRole, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { stage_id, name, field_type = 'DOCUMENT', is_mandatory = true, description } = req.body

    if (!stage_id || !name) {
      return res.status(400).json({ error: 'stage_id and name are mandatory.' })
    }

    const id = `dreq-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const newReq = {
      id,
      organization_id: orgId,
      stage_id,
      name,
      field_type,
      is_mandatory: Boolean(is_mandatory),
      is_active: true,
      description,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveDscDocumentRequirement(newReq)
    return res.status(201).json({ success: true, requirement: newReq })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 6. ESTIMATE CREATION, SENDING, & CONVERSION
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/estimates', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { company_profile_id, client_id, status } = req.query
    const estimates = await getDscEstimates(orgId, {
      companyProfileId: company_profile_id as string,
      clientId: client_id as string,
      status: status as string,
    })
    return res.json({ estimates })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.post('/dsc/direct/estimates', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      client_id,
      fulfillment_channel = 'DIRECT_SALE',
      associate_partner_id,
      fulfillment_model = 'COMMISSION',
      company_id,
      product_id,
      class_id,
      validity_id,
      quantity = 1,
      estimate_date,
      notes,
    } = req.body

    if (!company_profile_id || !client_id || !company_id || !product_id) {
      return res.status(400).json({
        error: 'company_profile_id, client_id, company_id, and product_id are mandatory.',
      })
    }

    // Resolve pricing
    const pricing = await resolveDirectDscPricing({
      organizationId: orgId,
      companyProfileId: company_profile_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id,
      validityId: validity_id,
      fulfillmentChannel: fulfillment_channel,
      associatePartnerId: associate_partner_id,
      fulfillmentModel: fulfillment_model,
      quantity: Number(quantity) || 1,
      date: estimate_date || new Date().toISOString().split('T')[0],
    })

    if (!pricing.success) {
      return res.status(400).json({ error: pricing.error })
    }

    const billingPartyId =
      pricing.billingPartyRole === 'ASSOCIATE_PARTNER' && associate_partner_id
        ? associate_partner_id
        : client_id

    const id = `est-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const estNum = `EST-DSC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`

    const estimate: DscIssuanceEstimate = {
      id,
      organization_id: orgId,
      company_profile_id,
      estimate_number: estNum,
      estimate_date: estimate_date || new Date().toISOString().split('T')[0],
      client_id,
      fulfillment_channel,
      associate_partner_id: fulfillment_channel === 'ASSOCIATE_PARTNER' ? associate_partner_id : null,
      fulfillment_model: fulfillment_channel === 'ASSOCIATE_PARTNER' ? fulfillment_model : null,
      billing_party_id: billingPartyId,
      company_id,
      product_id,
      class_id: class_id || null,
      validity_id: validity_id || null,
      quantity: Number(quantity) || 1,
      rate_card_id: pricing.rateCardId,
      base_rate: pricing.baseUnitRate,
      base_amount: pricing.baseTotalAmount,
      gst_rate: pricing.gstRate,
      gst_amount: pricing.gstAmount,
      total_amount: pricing.totalAmount,
      status: 'DRAFT',
      notes,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveDscEstimate(estimate)
    return res.status(201).json({ success: true, estimate })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// Convert Estimate to DSC Application
dscDirectIssuanceRouter.post('/dsc/direct/estimates/:id/convert', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    const all = await getDscEstimates(orgId)
    const estimate = all.find((e) => e.id === req.params.id)
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found.' })
    }

    if (estimate.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Estimate has already been converted to an application.' })
    }

    // Fetch initial workflow stage
    const stages = await getDscWorkflowStages(orgId)
    const initialStage = stages[0]

    const appId = `app-dir-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const appNum = `DSC-APP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`

    const application: DscIssuanceApplication = {
      id: appId,
      organization_id: orgId,
      company_profile_id: estimate.company_profile_id,
      application_number: appNum,
      application_date: new Date().toISOString().split('T')[0],
      estimate_id: estimate.id,
      is_direct_transaction: false,
      client_id: estimate.client_id,
      billing_party_id: estimate.billing_party_id,
      fulfillment_channel: estimate.fulfillment_channel,
      associate_partner_id: estimate.associate_partner_id,
      fulfillment_model: estimate.fulfillment_model,
      company_id: estimate.company_id,
      product_id: estimate.product_id,
      class_id: estimate.class_id,
      validity_id: estimate.validity_id,
      quantity: estimate.quantity,
      rate_card_id: estimate.rate_card_id,
      rate_card_type: (estimate.fulfillment_channel === 'ASSOCIATE_PARTNER' ? 'ASSOCIATE_PARTNER' : 'DIRECT_RETAIL') as any,
      base_rate: estimate.base_rate,
      base_amount: estimate.base_amount,
      gst_rate: estimate.gst_rate,
      gst_amount: estimate.gst_amount,
      total_amount: estimate.total_amount,
      current_stage_id: initialStage.id,
      status: 'IN_PROGRESS',
      is_token_allocated: false,
      notes: `Converted from Estimate #${estimate.estimate_number}`,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Update estimate status
    estimate.status = 'CONVERTED'
    estimate.converted_application_id = appId
    await saveDscEstimate(estimate)
    await saveDscApplication(application)

    // Record initial stage history
    await addDscStageHistory({
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      application_id: appId,
      stage_id: initialStage.id,
      stage_name: initialStage.stage_name,
      completed_by_user_id: user.id,
      completed_by_user_name: user.full_name || user.email,
      completed_at: new Date().toISOString(),
      documents_submitted: [],
      notes: 'Application initialized from accepted Estimate',
    })

    return res.status(201).json({ success: true, application })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 7. DIRECT DSC APPLICATION CREATION (Bypass Estimate)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.post('/dsc/direct/applications', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      client_id,
      fulfillment_channel = 'DIRECT_SALE',
      associate_partner_id,
      fulfillment_model = 'COMMISSION',
      company_id,
      product_id,
      class_id,
      validity_id,
      quantity = 1,
      application_date,
      notes,
    } = req.body

    if (!company_profile_id || !client_id || !company_id || !product_id) {
      return res.status(400).json({
        error: 'company_profile_id, client_id, company_id, and product_id are mandatory.',
      })
    }

    // Verify Associate Partner eligibility if chosen
    if (fulfillment_channel === 'ASSOCIATE_PARTNER' && associate_partner_id) {
      const assoc = await getAssociatePartnerByPartnerId(orgId, associate_partner_id)
      if (!assoc || !assoc.is_active) {
        return res.status(400).json({
          error: 'The selected party is not registered as an active Associate Partner in the system.',
        })
      }
    }

    const pricing = await resolveDirectDscPricing({
      organizationId: orgId,
      companyProfileId: company_profile_id,
      companyId: company_id,
      productId: product_id,
      classId: class_id,
      validityId: validity_id,
      fulfillmentChannel: fulfillment_channel,
      associatePartnerId: associate_partner_id,
      fulfillmentModel: fulfillment_model,
      quantity: Number(quantity) || 1,
      date: application_date || new Date().toISOString().split('T')[0],
    })

    if (!pricing.success) {
      return res.status(400).json({ error: pricing.error })
    }

    const billingPartyId =
      pricing.billingPartyRole === 'ASSOCIATE_PARTNER' && associate_partner_id
        ? associate_partner_id
        : client_id

    const stages = await getDscWorkflowStages(orgId)
    const initialStage = stages[0]

    const appId = `app-dir-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const appNum = `DSC-DIR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`

    const application: DscIssuanceApplication = {
      id: appId,
      organization_id: orgId,
      company_profile_id,
      application_number: appNum,
      application_date: application_date || new Date().toISOString().split('T')[0],
      estimate_id: null,
      is_direct_transaction: true,
      client_id,
      billing_party_id: billingPartyId,
      fulfillment_channel,
      associate_partner_id: fulfillment_channel === 'ASSOCIATE_PARTNER' ? associate_partner_id : null,
      fulfillment_model: fulfillment_channel === 'ASSOCIATE_PARTNER' ? fulfillment_model : null,
      associate_commission_amount: pricing.associateCommissionAmount || 0,
      company_id,
      product_id,
      class_id: class_id || null,
      validity_id: validity_id || null,
      quantity: Number(quantity) || 1,
      rate_card_id: pricing.rateCardId,
      rate_card_type: pricing.rateCardType,
      base_rate: pricing.baseUnitRate,
      base_amount: pricing.baseTotalAmount,
      gst_rate: pricing.gstRate,
      gst_amount: pricing.gstAmount,
      total_amount: pricing.totalAmount,
      current_stage_id: initialStage.id,
      status: 'IN_PROGRESS',
      is_token_allocated: false,
      notes,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await saveDscApplication(application)

    // Stage history
    await addDscStageHistory({
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      application_id: appId,
      stage_id: initialStage.id,
      stage_name: initialStage.stage_name,
      completed_by_user_id: user.id,
      completed_by_user_name: user.full_name || user.email,
      completed_at: new Date().toISOString(),
      documents_submitted: [],
      notes: 'Direct application created',
    })

    return res.status(201).json({ success: true, application })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 8. APPLICATION QUERY & DETAIL
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/applications', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { company_profile_id, client_id, stage_id, status, associate_partner_id } = req.query

    const apps = await getDscApplications(orgId, {
      companyProfileId: company_profile_id as string,
      clientId: client_id as string,
      stageId: stage_id as string,
      status: status as string,
      associatePartnerId: associate_partner_id as string,
    })

    // Fetch parties and profiles for lookup
    const [parties, profiles, stages] = await Promise.all([
      queryAll<any>('SELECT id, company_name, partner_code, email, phone FROM partners WHERE organization_id = ?', [orgId]),
      queryAll<any>('SELECT id, legal_name FROM purchase_internal_profiles WHERE organization_id = ?', [orgId]),
      getDscWorkflowStages(orgId),
    ])

    const partyMap = new Map(parties.map((p) => [p.id, p]))
    const profileMap = new Map(profiles.map((pr) => [pr.id, pr]))
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    const enriched = apps.map((app) => ({
      ...app,
      client: partyMap.get(app.client_id) || null,
      billing_party: partyMap.get(app.billing_party_id) || null,
      associate_partner: app.associate_partner_id ? partyMap.get(app.associate_partner_id) : null,
      profile: profileMap.get(app.company_profile_id) || null,
      current_stage: stageMap.get(app.current_stage_id) || null,
    }))

    return res.json({ applications: enriched })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

dscDirectIssuanceRouter.get('/dsc/direct/applications/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    const apps = await getDscApplications(orgId)
    const app = apps.find((a) => a.id === req.params.id)
    if (!app) {
      return res.status(404).json({ error: 'DSC Application not found.' })
    }

    const [history, stages, requirements] = await Promise.all([
      getDscStageHistory(orgId, app.id),
      getDscWorkflowStages(orgId),
      getDscDocumentRequirements(orgId),
    ])

    return res.json({
      application: app,
      stageHistory: history,
      stages,
      documentRequirements: requirements,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 9. STAGE PROGRESSION & DOCUMENT VERIFICATION GUARD
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.post('/dsc/direct/applications/:id/transition', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { target_stage_id, documents_submitted = [], notes } = req.body

    if (!target_stage_id) {
      return res.status(400).json({ error: 'target_stage_id is required.' })
    }

    const apps = await getDscApplications(orgId)
    const app = apps.find((a) => a.id === req.params.id)
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' })
    }

    const stages = await getDscWorkflowStages(orgId)
    const currentStage = stages.find((s) => s.id === app.current_stage_id)
    const nextStage = stages.find((s) => s.id === target_stage_id)

    if (!nextStage) {
      return res.status(400).json({ error: 'Target stage does not exist.' })
    }

    // Check mandatory document requirements for current stage
    const currentReqs = await getDscDocumentRequirements(orgId, target_stage_id)
    const mandatoryReqs = currentReqs.filter((r) => r.is_mandatory && r.is_active)

    const submittedMap = new Map((documents_submitted as any[]).map((d) => [d.requirement_id, d]))
    for (const reqItem of mandatoryReqs) {
      const sub = submittedMap.get(reqItem.id)
      const hasValue = sub && (sub.file_url || sub.text_value)
      if (!hasValue) {
        return res.status(400).json({
          error: `Mandatory document/requirement '${reqItem.name}' is missing. All mandatory requirements must be completed before progressing.`,
        })
      }
    }

    // Update application stage
    app.current_stage_id = nextStage.id
    if (nextStage.stage_key === 'DSC_ISSUED') {
      app.status = 'ISSUED'
    } else if (nextStage.stage_key === 'COMPLETED') {
      app.status = 'COMPLETED'
    }

    await saveDscApplication(app)

    // Record stage history
    await addDscStageHistory({
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organization_id: orgId,
      application_id: app.id,
      stage_id: nextStage.id,
      stage_name: nextStage.stage_name,
      completed_by_user_id: user.id,
      completed_by_user_name: user.full_name || user.email,
      completed_at: new Date().toISOString(),
      documents_submitted: documents_submitted || [],
      notes: notes || `Progressed to ${nextStage.stage_name}`,
    })

    return res.json({ success: true, application: app })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 10. PHYSICAL TOKEN ALLOCATION FROM REAL STOCK
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.post('/dsc/direct/applications/:id/allocate-token', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const { token_model_id, serial_numbers } = req.body

    if (!token_model_id) {
      return res.status(400).json({ error: 'token_model_id is mandatory for token allocation.' })
    }

    const apps = await getDscApplications(orgId)
    const app = apps.find((a) => a.id === req.params.id)
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' })
    }

    if (app.is_token_allocated) {
      return res.status(400).json({ error: 'A hardware token has already been allocated to this DSC application.' })
    }

    const reqQty = app.quantity || 1

    // Check available physical token stock in token_profile_stocks
    const stock = await queryOne<any>(
      'SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?',
      [orgId, app.company_profile_id, token_model_id]
    )

    const availableQty = stock ? Number(stock.quantity_on_hand || 0) : 0
    if (availableQty < reqQty) {
      return res.status(400).json({
        error: `Insufficient physical token inventory for this profile. Available: ${availableQty}, Required: ${reqQty}.`,
      })
    }

    // Deduct stock atomically
    const newQty = availableQty - reqQty
    const newIssued = Number(stock?.issued_quantity || 0) + reqQty
    await supabase.from('token_profile_stocks').update({
      quantity_on_hand: newQty,
      issued_quantity: newIssued,
      updated_at: new Date().toISOString(),
    }).eq('id', stock.id)

    // Mark application token allocated
    app.is_token_allocated = true
    app.token_model_id = token_model_id
    app.token_serial_numbers = Array.isArray(serial_numbers) ? serial_numbers : []
    app.token_allocated_date = new Date().toISOString()
    app.token_allocated_by = user.id
    app.updated_at = new Date().toISOString()

    await saveDscApplication(app)

    return res.json({
      success: true,
      message: `Successfully allocated ${reqQty} token(s) from stock.`,
      application: app,
      remainingStock: newQty,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 11. FINAL DSC ISSUANCE & SNAPSHOT FREEZING
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.post('/dsc/direct/applications/:id/issue', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'

    const apps = await getDscApplications(orgId)
    const app = apps.find((a) => a.id === req.params.id)
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' })
    }

    if (app.status === 'ISSUED' || app.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This certificate has already been finalized and issued.' })
    }

    // Freeze snapshot data permanently
    app.snapshot_data = {
      issued_at: new Date().toISOString(),
      issued_by: user.id,
      client_id: app.client_id,
      company_profile_id: app.company_profile_id,
      company_id: app.company_id,
      product_id: app.product_id,
      class_id: app.class_id,
      validity_id: app.validity_id,
      quantity: app.quantity,
      rate_card_type: app.rate_card_type,
      rate_card_id: app.rate_card_id,
      base_rate: app.base_rate,
      base_amount: app.base_amount,
      gst_rate: app.gst_rate,
      gst_amount: app.gst_amount,
      total_amount: app.total_amount,
      fulfillment_channel: app.fulfillment_channel,
      associate_partner_id: app.associate_partner_id,
      fulfillment_model: app.fulfillment_model,
      associate_commission_amount: app.associate_commission_amount,
      is_token_allocated: app.is_token_allocated,
      token_model_id: app.token_model_id,
      token_serial_numbers: app.token_serial_numbers,
    }

    app.status = 'ISSUED'
    app.updated_at = new Date().toISOString()
    await saveDscApplication(app)

    return res.json({
      success: true,
      message: 'DSC certificate issued successfully. Commercial and technical state frozen permanently.',
      application: app,
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})

// ----------------------------------------------------------------------------
// 12. OPERATIONAL REPORTING & DASHBOARD (/api/dsc/direct/reports)
// ----------------------------------------------------------------------------
dscDirectIssuanceRouter.get('/dsc/direct/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = getSessionUser(req)
    const orgId = user.organization_id || 'comp-default'
    const {
      company_profile_id,
      period = 'current_month',
      from_date,
      to_date,
    } = req.query

    let apps = await getDscApplications(orgId)

    // Filter profile if specified and not ALL
    if (company_profile_id && company_profile_id !== 'ALL' && company_profile_id !== 'all') {
      apps = apps.filter((a) => a.company_profile_id === company_profile_id)
    }

    // Filter by dates
    const now = new Date()
    let startDate = from_date as string
    let endDate = to_date as string

    if (period === 'current_month') {
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      startDate = `${year}-${month}-01`
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    } else if (period === 'fy') {
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1
      startDate = `${fyStart}-04-01`
      endDate = `${fyStart + 1}-03-31`
    }

    if (startDate) {
      apps = apps.filter((a) => a.application_date >= startDate)
    }
    if (endDate) {
      apps = apps.filter((a) => a.application_date <= endDate)
    }

    // Fetch master names
    const [parties, profiles, stages] = await Promise.all([
      queryAll<any>('SELECT id, company_name, partner_code FROM partners WHERE organization_id = ?', [orgId]),
      queryAll<any>('SELECT id, legal_name FROM purchase_internal_profiles WHERE organization_id = ?', [orgId]),
      getDscWorkflowStages(orgId),
    ])

    const partyMap = new Map(parties.map((p) => [p.id, p]))
    const profileMap = new Map(profiles.map((pr) => [pr.id, pr]))
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    // 1. Overall Metrics
    let totalCerts = 0
    let totalBaseSales = 0
    let totalGst = 0
    let totalGrossSales = 0
    let totalAssociateCommissions = 0
    let totalResellingSales = 0

    for (const a of apps) {
      const q = a.quantity || 1
      totalCerts += q
      totalBaseSales += Number(a.base_amount || 0)
      totalGst += Number(a.gst_amount || 0)
      totalGrossSales += Number(a.total_amount || 0)
      if (a.fulfillment_channel === 'ASSOCIATE_PARTNER') {
        if (a.fulfillment_model === 'COMMISSION') {
          totalAssociateCommissions += Number(a.associate_commission_amount || 0)
        } else if (a.fulfillment_model === 'RESELLING_B2B') {
          totalResellingSales += Number(a.total_amount || 0)
        }
      }
    }

    // 2. Application Pipeline by Stage
    const pipelineMap = new Map<string, any>()
    for (const s of stages) {
      pipelineMap.set(s.id, {
        stage_id: s.id,
        stage_name: s.stage_name,
        stage_order: s.stage_order,
        count: 0,
        certificates: 0,
      })
    }
    for (const a of apps) {
      const entry = pipelineMap.get(a.current_stage_id)
      if (entry) {
        entry.count += 1
        entry.certificates += a.quantity || 1
      }
    }

    // 3. Associate Partner Performance
    const associateMap = new Map<string, any>()
    for (const a of apps) {
      if (a.fulfillment_channel === 'ASSOCIATE_PARTNER' && a.associate_partner_id) {
        const id = a.associate_partner_id
        if (!associateMap.has(id)) {
          const pt = partyMap.get(id)
          associateMap.set(id, {
            partner_id: id,
            partner_name: pt ? pt.company_name : id,
            certificates: 0,
            revenue: 0,
            commission: 0,
            reselling_b2b_value: 0,
          })
        }
        const entry = associateMap.get(id)
        entry.certificates += a.quantity || 1
        entry.revenue += Number(a.total_amount || 0)
        if (a.fulfillment_model === 'COMMISSION') {
          entry.commission += Number(a.associate_commission_amount || 0)
        } else {
          entry.reselling_b2b_value += Number(a.total_amount || 0)
        }
      }
    }

    // 4. Provider / Product Breakdown
    const providerMap = new Map<string, any>()
    for (const a of apps) {
      const key = `${a.company_id}_${a.product_id}`
      if (!providerMap.has(key)) {
        providerMap.set(key, {
          company_id: a.company_id,
          product_id: a.product_id,
          class_id: a.class_id,
          validity_id: a.validity_id,
          quantity: 0,
          revenue: 0,
        })
      }
      const entry = providerMap.get(key)
      entry.quantity += a.quantity || 1
      entry.revenue += Number(a.total_amount || 0)
    }

    // 5. Profile Breakdown
    const profileBreakdownMap = new Map<string, any>()
    for (const a of apps) {
      const profId = a.company_profile_id || 'default'
      if (!profileBreakdownMap.has(profId)) {
        const pr = profileMap.get(profId)
        profileBreakdownMap.set(profId, {
          profile_id: profId,
          profile_name: pr ? pr.legal_name : profId,
          certificates: 0,
          revenue: 0,
        })
      }
      const entry = profileBreakdownMap.get(profId)
      entry.certificates += a.quantity || 1
      entry.revenue += Number(a.total_amount || 0)
    }

    return res.json({
      summary: {
        total_certificates: totalCerts,
        total_applications: apps.length,
        total_base_sales: Number(totalBaseSales.toFixed(2)),
        total_gst: Number(totalGst.toFixed(2)),
        total_gross_sales: Number(totalGrossSales.toFixed(2)),
        total_associate_commissions: Number(totalAssociateCommissions.toFixed(2)),
        total_reselling_sales: Number(totalResellingSales.toFixed(2)),
      },
      pipeline: Array.from(pipelineMap.values()).sort((a, b) => a.stage_order - b.stage_order),
      associate_performance: Array.from(associateMap.values()),
      provider_product_breakdown: Array.from(providerMap.values()),
      profile_breakdown: Array.from(profileBreakdownMap.values()),
    })
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message })
  }
})
