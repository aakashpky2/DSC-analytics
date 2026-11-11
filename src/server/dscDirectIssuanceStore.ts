import { getRelationalStore, saveRelationalStore } from './dscMasterStore'

// Store table names in relational persistence
export const STORE_DSC_ASSOCIATE_PARTNERS = 'dsc_associate_partners'
export const STORE_DSC_DIRECT_RATE_CARDS = 'dsc_direct_rate_cards'
export const STORE_DSC_WORKFLOW_STAGES = 'dsc_issuance_workflow_stages'
export const STORE_DSC_DOCUMENT_REQUIREMENTS = 'dsc_issuance_document_requirements'
export const STORE_DSC_ESTIMATES = 'dsc_issuance_estimates'
export const STORE_DSC_APPLICATIONS = 'dsc_issuance_applications'
export const STORE_DSC_STAGE_HISTORY = 'dsc_issuance_stage_history'

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------

export interface DscAssociatePartnerConfig {
  id: string
  organization_id: string
  partner_id: string // Foreign key reference to partners.id
  is_active: boolean
  commission_percentage?: number // For Commission-based model
  default_fulfillment_model: 'COMMISSION' | 'RESELLING_B2B'
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscDirectRateCard {
  id: string
  organization_id: string
  rate_card_type: 'GENERAL' | 'DIRECT_RETAIL' | 'ASSOCIATE_PARTNER'
  company_profile_id?: string | null // Null means all profiles
  company_id: string // Certifying Authority / Provider
  product_id: string // DSC Product
  class_id?: string | null
  validity_id?: string | null
  rate: number // Base selling price
  effective_from: string // YYYY-MM-DD
  effective_to?: string | null // YYYY-MM-DD
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscIssuanceWorkflowStage {
  id: string
  organization_id: string
  stage_key: string
  stage_name: string
  stage_order: number
  description?: string
  color?: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscIssuanceDocumentRequirement {
  id: string
  organization_id: string
  stage_id: string // Stage where this requirement applies
  name: string
  field_type: 'DOCUMENT' | 'TEXT' | 'NUMBER' | 'EMAIL' | 'PHONE'
  is_mandatory: boolean
  is_active: boolean
  description?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscIssuanceEstimate {
  id: string
  organization_id: string
  company_profile_id: string
  estimate_number: string
  estimate_date: string
  client_id: string // Party ID (Customer or Associate)
  fulfillment_channel: 'DIRECT_SALE' | 'ASSOCIATE_PARTNER'
  associate_partner_id?: string | null
  fulfillment_model?: 'COMMISSION' | 'RESELLING_B2B' | null
  billing_party_id: string
  company_id: string
  product_id: string
  class_id?: string | null
  validity_id?: string | null
  quantity: number
  rate_card_id?: string | null
  base_rate: number
  base_amount: number
  gst_rate: number
  gst_amount: number
  total_amount: number
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED'
  converted_application_id?: string | null
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscIssuanceApplication {
  id: string
  organization_id: string
  company_profile_id: string
  application_number: string
  application_date: string
  estimate_id?: string | null
  is_direct_transaction: boolean
  client_id: string
  billing_party_id: string
  fulfillment_channel: 'DIRECT_SALE' | 'ASSOCIATE_PARTNER'
  associate_partner_id?: string | null
  fulfillment_model?: 'COMMISSION' | 'RESELLING_B2B' | null
  associate_commission_amount?: number | null
  company_id: string
  product_id: string
  class_id?: string | null
  validity_id?: string | null
  quantity: number
  rate_card_id?: string | null
  rate_card_type: 'GENERAL' | 'DIRECT_RETAIL' | 'ASSOCIATE_PARTNER'
  base_rate: number
  base_amount: number
  gst_rate: number
  gst_amount: number
  total_amount: number
  current_stage_id: string
  status: 'IN_PROGRESS' | 'DOCS_PENDING' | 'PAYMENT_PENDING' | 'TOKEN_PENDING' | 'ISSUED' | 'COMPLETED' | 'CANCELLED'
  // Token Allocation Fields
  is_token_allocated: boolean
  token_model_id?: string | null
  token_serial_numbers?: string[] | null
  token_allocated_date?: string | null
  token_allocated_by?: string | null
  // Frozen historical snapshot
  snapshot_data?: any
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DscIssuanceStageHistory {
  id: string
  organization_id: string
  application_id: string
  stage_id: string
  stage_name: string
  completed_by_user_id: string
  completed_by_user_name: string
  completed_at: string
  documents_submitted: Array<{
    requirement_id: string
    requirement_name: string
    file_url?: string
    file_name?: string
    text_value?: string
  }>
  notes?: string
}

// ----------------------------------------------------------------------------
// Default Seed Workflow Stages & Document Requirements
// ----------------------------------------------------------------------------

export const DEFAULT_WORKFLOW_STAGES = [
  { stage_key: 'APPL_RCVD', stage_name: 'Application Received', stage_order: 1, color: 'blue', description: 'Application initiated' },
  { stage_key: 'DOCS_PEND', stage_name: 'Documents Verification', stage_order: 2, color: 'amber', description: 'Collecting and verifying KYC documents' },
  { stage_key: 'PAY_CONF', stage_name: 'Payment Confirmed', stage_order: 3, color: 'indigo', description: 'Payment received and verified' },
  { stage_key: 'DSC_PROC', stage_name: 'DSC Processing / CA Verification', stage_order: 4, color: 'purple', description: 'CA video verification and approval' },
  { stage_key: 'TOK_ALLOC', stage_name: 'Token Allocation', stage_order: 5, color: 'cyan', description: 'Physical USB hardware token allocation from inventory' },
  { stage_key: 'DSC_ISSUED', stage_name: 'DSC Issued & Dispatched', stage_order: 6, color: 'emerald', description: 'Digital certificate issued and dispatched' },
  { stage_key: 'COMPLETED', stage_name: 'Completed', stage_order: 7, color: 'slate', description: 'Lifecycle finalized' },
]

export const DEFAULT_DOCUMENT_REQUIREMENTS = [
  { stage_key: 'DOCS_PEND', name: 'Applicant PAN Card', field_type: 'DOCUMENT' as const, is_mandatory: true },
  { stage_key: 'DOCS_PEND', name: 'Aadhaar / Address Proof', field_type: 'DOCUMENT' as const, is_mandatory: true },
  { stage_key: 'DOCS_PEND', name: 'Passport Size Photograph', field_type: 'DOCUMENT' as const, is_mandatory: false },
  { stage_key: 'DOCS_PEND', name: 'Organization Authorization Letter', field_type: 'DOCUMENT' as const, is_mandatory: false },
]

// ----------------------------------------------------------------------------
// 1. Associate Partner Master Accessors
// ----------------------------------------------------------------------------

export async function getAssociatePartners(orgId: string): Promise<DscAssociatePartnerConfig[]> {
  const all = await getRelationalStore<DscAssociatePartnerConfig>(STORE_DSC_ASSOCIATE_PARTNERS)
  return all.filter((r) => r.organization_id === orgId)
}

export async function getAssociatePartnerByPartnerId(orgId: string, partnerId: string): Promise<DscAssociatePartnerConfig | null> {
  const all = await getAssociatePartners(orgId)
  return all.find((r) => r.partner_id === partnerId) || null
}

export async function saveAssociatePartner(config: DscAssociatePartnerConfig): Promise<boolean> {
  const all = await getRelationalStore<DscAssociatePartnerConfig>(STORE_DSC_ASSOCIATE_PARTNERS)
  const idx = all.findIndex((r) => r.id === config.id && r.organization_id === config.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...config, updated_at: new Date().toISOString() }
  } else {
    all.push(config)
  }
  return await saveRelationalStore(STORE_DSC_ASSOCIATE_PARTNERS, all)
}

export async function deleteAssociatePartner(orgId: string, id: string): Promise<boolean> {
  const all = await getRelationalStore<DscAssociatePartnerConfig>(STORE_DSC_ASSOCIATE_PARTNERS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  return await saveRelationalStore(STORE_DSC_ASSOCIATE_PARTNERS, filtered)
}

// ----------------------------------------------------------------------------
// 2. Direct DSC Rate Cards Accessors
// ----------------------------------------------------------------------------

export async function getDscDirectRateCards(orgId: string, filter?: {
  rateCardType?: 'GENERAL' | 'DIRECT_RETAIL' | 'ASSOCIATE_PARTNER'
  companyProfileId?: string | null
  companyId?: string
  productId?: string
  activeOnly?: boolean
}): Promise<DscDirectRateCard[]> {
  const all = await getRelationalStore<DscDirectRateCard>(STORE_DSC_DIRECT_RATE_CARDS)
  return all.filter((r) => {
    if (r.organization_id !== orgId) return false
    if (filter?.rateCardType && r.rate_card_type !== filter.rateCardType) return false
    if (filter?.companyProfileId && r.company_profile_id && r.company_profile_id !== filter.companyProfileId) return false
    if (filter?.companyId && r.company_id !== filter.companyId) return false
    if (filter?.productId && r.product_id !== filter.productId) return false
    if (filter?.activeOnly && !r.is_active) return false
    return true
  })
}

export async function saveDscDirectRateCard(card: DscDirectRateCard): Promise<boolean> {
  const all = await getRelationalStore<DscDirectRateCard>(STORE_DSC_DIRECT_RATE_CARDS)
  const idx = all.findIndex((r) => r.id === card.id && r.organization_id === card.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...card, updated_at: new Date().toISOString() }
  } else {
    all.push(card)
  }
  return await saveRelationalStore(STORE_DSC_DIRECT_RATE_CARDS, all)
}

export async function deleteDscDirectRateCard(orgId: string, id: string): Promise<boolean> {
  const all = await getRelationalStore<DscDirectRateCard>(STORE_DSC_DIRECT_RATE_CARDS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  return await saveRelationalStore(STORE_DSC_DIRECT_RATE_CARDS, filtered)
}

// ----------------------------------------------------------------------------
// 3. Workflow Stages & Document Requirements Accessors
// ----------------------------------------------------------------------------

export async function getDscWorkflowStages(orgId: string): Promise<DscIssuanceWorkflowStage[]> {
  const all = await getRelationalStore<DscIssuanceWorkflowStage>(STORE_DSC_WORKFLOW_STAGES)
  let orgStages = all.filter((r) => r.organization_id === orgId)
  if (orgStages.length === 0) {
    // Seed default stages for organization
    const seeded: DscIssuanceWorkflowStage[] = DEFAULT_WORKFLOW_STAGES.map((s, idx) => ({
      id: `stg-def-${idx + 1}`,
      organization_id: orgId,
      stage_key: s.stage_key,
      stage_name: s.stage_name,
      stage_order: s.stage_order,
      color: s.color,
      description: s.description,
      is_active: true,
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    await saveRelationalStore(STORE_DSC_WORKFLOW_STAGES, [...all, ...seeded])
    orgStages = seeded
  }
  return orgStages.sort((a, b) => a.stage_order - b.stage_order)
}

export async function saveDscWorkflowStage(stage: DscIssuanceWorkflowStage): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceWorkflowStage>(STORE_DSC_WORKFLOW_STAGES)
  const idx = all.findIndex((r) => r.id === stage.id && r.organization_id === stage.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...stage, updated_at: new Date().toISOString() }
  } else {
    all.push(stage)
  }
  return await saveRelationalStore(STORE_DSC_WORKFLOW_STAGES, all)
}

export async function getDscDocumentRequirements(orgId: string, stageId?: string): Promise<DscIssuanceDocumentRequirement[]> {
  const all = await getRelationalStore<DscIssuanceDocumentRequirement>(STORE_DSC_DOCUMENT_REQUIREMENTS)
  let orgReqs = all.filter((r) => r.organization_id === orgId)
  if (orgReqs.length === 0) {
    // Seed default document requirements linked to stages
    const stages = await getDscWorkflowStages(orgId)
    const docsStage = stages.find((s) => s.stage_key === 'DOCS_PEND') || stages[1] || stages[0]
    const seeded: DscIssuanceDocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS.map((d, idx) => ({
      id: `doc-req-${idx + 1}`,
      organization_id: orgId,
      stage_id: docsStage.id,
      name: d.name,
      field_type: d.field_type,
      is_mandatory: d.is_mandatory,
      is_active: true,
      description: `Required verification: ${d.name}`,
      created_by: 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    await saveRelationalStore(STORE_DSC_DOCUMENT_REQUIREMENTS, [...all, ...seeded])
    orgReqs = seeded
  }
  if (stageId) {
    return orgReqs.filter((r) => r.stage_id === stageId)
  }
  return orgReqs
}

export async function saveDscDocumentRequirement(req: DscIssuanceDocumentRequirement): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceDocumentRequirement>(STORE_DSC_DOCUMENT_REQUIREMENTS)
  const idx = all.findIndex((r) => r.id === req.id && r.organization_id === req.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...req, updated_at: new Date().toISOString() }
  } else {
    all.push(req)
  }
  return await saveRelationalStore(STORE_DSC_DOCUMENT_REQUIREMENTS, all)
}

// ----------------------------------------------------------------------------
// 4. DSC Issuance Estimates Accessors
// ----------------------------------------------------------------------------

export async function getDscEstimates(orgId: string, filter?: {
  companyProfileId?: string
  clientId?: string
  status?: string
}): Promise<DscIssuanceEstimate[]> {
  const all = await getRelationalStore<DscIssuanceEstimate>(STORE_DSC_ESTIMATES)
  return all.filter((r) => {
    if (r.organization_id !== orgId) return false
    if (filter?.companyProfileId && r.company_profile_id !== filter.companyProfileId) return false
    if (filter?.clientId && r.client_id !== filter.clientId) return false
    if (filter?.status && r.status !== filter.status) return false
    return true
  })
}

export async function saveDscEstimate(est: DscIssuanceEstimate): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceEstimate>(STORE_DSC_ESTIMATES)
  const idx = all.findIndex((r) => r.id === est.id && r.organization_id === est.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...est, updated_at: new Date().toISOString() }
  } else {
    all.push(est)
  }
  return await saveRelationalStore(STORE_DSC_ESTIMATES, all)
}

export async function deleteDscEstimate(orgId: string, id: string): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceEstimate>(STORE_DSC_ESTIMATES)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  return await saveRelationalStore(STORE_DSC_ESTIMATES, filtered)
}

// ----------------------------------------------------------------------------
// 5. DSC Issuance Applications Accessors
// ----------------------------------------------------------------------------

export async function getDscApplications(orgId: string, filter?: {
  companyProfileId?: string
  clientId?: string
  stageId?: string
  status?: string
  associatePartnerId?: string
}): Promise<DscIssuanceApplication[]> {
  const all = await getRelationalStore<DscIssuanceApplication>(STORE_DSC_APPLICATIONS)
  return all.filter((r) => {
    if (r.organization_id !== orgId) return false
    if (filter?.companyProfileId && r.company_profile_id !== filter.companyProfileId) return false
    if (filter?.clientId && r.client_id !== filter.clientId) return false
    if (filter?.stageId && r.current_stage_id !== filter.stageId) return false
    if (filter?.status && r.status !== filter.status) return false
    if (filter?.associatePartnerId && r.associate_partner_id !== filter.associatePartnerId) return false
    return true
  })
}

export async function saveDscApplication(app: DscIssuanceApplication): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceApplication>(STORE_DSC_APPLICATIONS)
  const idx = all.findIndex((r) => r.id === app.id && r.organization_id === app.organization_id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...app, updated_at: new Date().toISOString() }
  } else {
    all.push(app)
  }
  return await saveRelationalStore(STORE_DSC_APPLICATIONS, all)
}

export async function deleteDscApplication(orgId: string, id: string): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceApplication>(STORE_DSC_APPLICATIONS)
  const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId))
  return await saveRelationalStore(STORE_DSC_APPLICATIONS, filtered)
}

// ----------------------------------------------------------------------------
// 6. Application Stage History Accessors
// ----------------------------------------------------------------------------

export async function getDscStageHistory(orgId: string, applicationId: string): Promise<DscIssuanceStageHistory[]> {
  const all = await getRelationalStore<DscIssuanceStageHistory>(STORE_DSC_STAGE_HISTORY)
  return all
    .filter((r) => r.organization_id === orgId && r.application_id === applicationId)
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
}

export async function addDscStageHistory(history: DscIssuanceStageHistory): Promise<boolean> {
  const all = await getRelationalStore<DscIssuanceStageHistory>(STORE_DSC_STAGE_HISTORY)
  all.push(history)
  return await saveRelationalStore(STORE_DSC_STAGE_HISTORY, all)
}

