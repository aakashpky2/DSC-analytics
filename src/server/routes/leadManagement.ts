import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import {
  loadLeadStore,
  saveLeadStore,
  LeadCategory,
  CommunicationChannel,
  TatSetting,
  UserCategoryAccess,
  PartnerMatchReview,
  LeadInteraction,
  LeadServiceTracking,
  LeadConversionLink,
  ExtendedLeadFields
} from '../leadStore'
import { evaluatePartnerMatch } from '../partnerMatchEngine'
import { queryAll, queryOne, run, supabase } from '../supabase'
import { applyPiiMasking } from '../../lib/masking'

export const leadManagementRouter = Router()

// Helper to determine currently active TAT setting deterministically
export async function resolveActiveTatDays(): Promise<number> {
  try {
    const { data } = await supabase
      .from('crm_tat_settings')
      .select('first_contact_tat_days')
      .eq('is_active', 1)
      .order('effective_from', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].first_contact_tat_days) {
      return Number(data[0].first_contact_tat_days)
    }
  } catch (err) {
    // Fallback to local store or default
  }
  const store = loadLeadStore()
  return store.tat_settings?.[0]?.first_contact_tat_days || 2
}

function isValidLeadId(id: any): boolean {
  if (!id) return false;
  const s = String(id).trim().toLowerCase();
  return s.length > 0 && s !== 'undefined' && s !== 'null' && s !== '[object object]';
}


// Helper to determine if current user has supervisory / admin cross-category privileges
function isSupervisorOrAdmin(user: any): boolean {
  if (!user) return false
  return user.hierarchy_level_order <= 1 // Tier 0 (Super Admin) or Tier 1 (Regional Admin)
}

// Get assigned category IDs for a user (combining local store + relational Supabase table)
export async function getUserCategoryIdsAsync(userId: string): Promise<string[]> {
  const store = loadLeadStore()
  const localCats = (store.user_category_access || [])
    .filter(a => a.user_id === userId)
    .map(a => a.category_id)

  const catSet = new Set<string>(localCats)

  try {
    const { data: dbAccess } = await supabase
      .from('crm_user_category_access')
      .select('category_id')
      .eq('user_id', userId)

    if (dbAccess && dbAccess.length > 0) {
      for (const row of dbAccess) {
        if (row.category_id) {
          catSet.add(row.category_id)
        }
      }
    }
  } catch (err: any) {
    // If DB check fails, fallback to cached / local
  }

  return Array.from(catSet)
}

// Synchronous helper reading from store with in-memory synchronization
export function getUserCategoryIds(userId: string): string[] {
  const store = loadLeadStore()
  return (store.user_category_access || [])
    .filter(a => a.user_id === userId)
    .map(a => a.category_id)
}

// Helper: Resolve effective lead category from DB first, then fallback to extended_leads store
export async function resolveLeadCategory(leadId: string): Promise<string | null> {
  try {
    const { data: lead } = await supabase
      .from('crm_leads')
      .select('category_id')
      .eq('id', leadId)
      .maybeSingle()

    if (lead && lead.category_id) {
      return lead.category_id
    }
  } catch (e: any) {
    // fallback
  }

  const store = loadLeadStore()
  const ext = store.extended_leads?.[leadId]
  return ext?.category_id || null
}

// Unified async permission check: verifies if a user has access to a specific lead
export async function canUserAccessLeadAsync(user: any, leadIdOrCategory: string, isLeadId = false): Promise<boolean> {
  if (isSupervisorOrAdmin(user)) return true
  if (!user || !user.id) return false

  let categoryId: string | null = leadIdOrCategory
  if (isLeadId) {
    categoryId = await resolveLeadCategory(leadIdOrCategory)
  }

  // Uncategorized leads are restricted to supervisors (LM-17)
  if (!categoryId) return false

  const assigned = await getUserCategoryIdsAsync(user.id)
  return assigned.includes(categoryId)
}

// Check if user has permission to access a specific lead by category (sync fallback)
export function canUserAccessLead(user: any, leadCategoryId?: string | null): boolean {
  if (isSupervisorOrAdmin(user)) return true
  if (!user || !user.id) return false
  // Uncategorized leads are restricted to supervisors (LM-17)
  if (!leadCategoryId) return false
  const assigned = getUserCategoryIds(user.id)
  return assigned.includes(leadCategoryId)
}

// ==========================================
// 1. Dynamic Master Endpoints (LM-01, LM-02, LM-03, LM-04, LM-05)
// ==========================================

// LM-01: Lead Sources (Active + Admin create/edit/toggle)
leadManagementRouter.get('/crm/lead-sources', async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query
    let sql = 'SELECT * FROM crm_lead_sources'
    if (includeInactive !== 'true') {
      sql += ' WHERE is_active = 1'
    }
    sql += ' ORDER BY created_at ASC'
    const sources = await queryAll(sql)
    return res.json({ sources })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/lead-sources', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can manage master data.' })
    }
    const { source_name, description } = req.body
    if (!source_name || !source_name.trim()) {
      return res.status(400).json({ error: 'Source name is required.' })
    }
    const id = `src-${Date.now()}`
    const orgId = user?.organization_id || 'comp-default'
    await run(
      'INSERT INTO crm_lead_sources (id, source_name, is_active, organization_id) VALUES (?, ?, 1, ?)',
      [id, source_name.trim(), orgId]
    )
    return res.status(201).json({ success: true, id, source_name: source_name.trim() })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.patch('/crm/lead-sources/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can manage master data.' })
    }
    const { is_active, source_name } = req.body
    await run(
      'UPDATE crm_lead_sources SET is_active = COALESCE(?, is_active), source_name = COALESCE(?, source_name) WHERE id = ?',
      [is_active !== undefined ? Number(is_active) : null, source_name ? source_name.trim() : null, req.params.id]
    )
    return res.json({ success: true, message: 'Source updated successfully.' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// LM-02: Lead Categories (Admin managed)
leadManagementRouter.get('/crm/lead-categories', async (req: Request, res: Response) => {
  try {
    const store = loadLeadStore()
    const { includeInactive } = req.query
    let categories = store.categories || []
    if (includeInactive !== 'true') {
      categories = categories.filter(c => c.is_active === 1)
    }
    return res.json({ categories })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/lead-categories', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can manage categories.' })
    }
    const { category_name, description } = req.body
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ error: 'Category name is required.' })
    }
    const store = loadLeadStore()
    const existing = store.categories.find(c => c.category_name.toLowerCase() === category_name.trim().toLowerCase())
    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists.' })
    }
    const newCat: LeadCategory = {
      id: `cat-${Date.now()}`,
      category_name: category_name.trim(),
      description: description ? description.trim() : '',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    store.categories.push(newCat)
    saveLeadStore(store)
    return res.status(201).json({ success: true, category: newCat })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.patch('/crm/lead-categories/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can manage categories.' })
    }
    const { is_active, category_name, description } = req.body
    const store = loadLeadStore()
    const cat = store.categories.find(c => c.id === req.params.id)
    if (!cat) {
      return res.status(404).json({ error: 'Category not found.' })
    }
    if (is_active !== undefined) cat.is_active = Number(is_active)
    if (category_name) cat.category_name = category_name.trim()
    if (description !== undefined) cat.description = description.trim()
    cat.updated_at = new Date().toISOString()
    saveLeadStore(store)
    return res.json({ success: true, category: cat })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// LM-03: Dynamic Communication Channels Master
leadManagementRouter.get('/crm/communication-channels', async (req: Request, res: Response) => {
  try {
    const store = loadLeadStore()
    const { includeInactive } = req.query
    let channels = store.channels || []
    if (includeInactive !== 'true') {
      channels = channels.filter(c => c.is_active === 1)
    }
    return res.json({ channels })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/communication-channels', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can manage communication channels.' })
    }
    const { channel_name, channel_icon } = req.body
    if (!channel_name || !channel_name.trim()) {
      return res.status(400).json({ error: 'Channel name is required.' })
    }
    const store = loadLeadStore()
    const newChan: CommunicationChannel = {
      id: `chan-${Date.now()}`,
      channel_name: channel_name.trim(),
      channel_icon: channel_icon || 'Phone',
      is_active: 1,
      created_at: new Date().toISOString()
    }
    store.channels.push(newChan)
    saveLeadStore(store)
    return res.status(201).json({ success: true, channel: newChan })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// LM-04: Configurable Calling TAT Master
leadManagementRouter.get('/crm/tat-settings', async (req: Request, res: Response) => {
  try {
    const store = loadLeadStore()
    const current = store.tat_settings?.[0] || {
      id: 'tat-default',
      first_contact_tat_days: 2,
      follow_up_grace_hours: 24,
      is_active: 1,
      effective_from: new Date().toISOString()
    }
    return res.json({ tat: current })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/tat-settings', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can modify TAT settings.' })
    }
    const { first_contact_tat_days, follow_up_grace_hours } = req.body
    if (first_contact_tat_days === undefined || Number(first_contact_tat_days) < 1) {
      return res.status(400).json({ error: 'First contact TAT days must be at least 1 day.' })
    }
    const store = loadLeadStore()
    const updatedTat: TatSetting = {
      id: `tat-${Date.now()}`,
      first_contact_tat_days: Number(first_contact_tat_days),
      follow_up_grace_hours: Number(follow_up_grace_hours || 24),
      is_active: 1,
      effective_from: new Date().toISOString()
    }
    store.tat_settings = [updatedTat]
    saveLeadStore(store)
    return res.json({ success: true, tat: updatedTat })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// LM-05: Category-to-User Mapping (Row-level Scope assignments)
leadManagementRouter.get('/crm/user-category-access', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query
    const store = loadLeadStore()
    let access = store.user_category_access || []
    if (userId) {
      access = access.filter(a => a.user_id === String(userId))
    }
    return res.json({ access })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/user-category-access', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user || user.hierarchy_level_order > 1) {
      return res.status(403).json({ error: 'Only administrators can assign categories to users.' })
    }
    const { user_id, category_ids } = req.body
    if (!user_id || !Array.isArray(category_ids)) {
      return res.status(400).json({ error: 'user_id and array of category_ids are required.' })
    }
    const store = loadLeadStore()
    // Remove existing assignments for this user
    store.user_category_access = (store.user_category_access || []).filter(a => a.user_id !== user_id)
    // Add new assignments
    for (const cid of category_ids) {
      store.user_category_access.push({
        id: `uca-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id,
        category_id: cid,
        created_at: new Date().toISOString()
      })
    }
    saveLeadStore(store)
    return res.json({ success: true, message: 'User category assignments updated successfully.' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 2. Partner Matching & Review Endpoints (LM-08 to LM-14)
// ==========================================

// LM-08, LM-09, LM-10, LM-11: Check partner matches for input
leadManagementRouter.post('/crm/leads/check-partner-match', async (req: Request, res: Response) => {
  try {
    const { company_name, alternate_name, email, phone } = req.body

    // Wrap execution with a 4.5s safe timeout to prevent any 504 Gateway Timeout from reverse proxies
    const matchPromise = evaluatePartnerMatch({ company_name, alternate_name, email, phone })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Match evaluation timeout')), 4500)
    )

    const result = await Promise.race([matchPromise, timeoutPromise])
    return res.json(result)
  } catch (err: any) {
    if (err.message === 'Match evaluation timeout') {
      return res.status(504).json({ error: 'Partner match evaluation timed out' })
    }
    return res.status(500).json({ error: err.message })
  }
})

// LM-12: Human Verification & Clubbing into Existing Partner
leadManagementRouter.post('/crm/leads/:id/club-partner', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    const leadId = String(req.params.id)
    if (!isValidLeadId(leadId)) return res.status(400).json({ error: 'A valid Lead ID is required.' })
    const { partner_id, resolution_notes, match_review_id } = req.body
    if (!partner_id) {
      return res.status(400).json({ error: 'partner_id is required to club lead.' })
    }

    // Verify partner exists
    const partner = await queryOne<any>('SELECT id, company_name, partner_code FROM partners WHERE id = ?', [partner_id])
    if (!partner) {
      return res.status(404).json({ error: 'Target partner not found.' })
    }

    const store = loadLeadStore()
    const reviewId = match_review_id || `pmr-${Date.now()}`
    const nowIso = new Date().toISOString()
    const resolutionNotesStr = resolution_notes || 'Confirmed identity match and clubbed into existing partner.'

    // Record clubbing in reviews
    const review: PartnerMatchReview = {
      id: reviewId,
      lead_id: leadId,
      partner_id,
      match_type: 'CONFIRMED_MATCH',
      match_details: { clubbed_into: partner.partner_code },
      resolution_status: 'CLUBBED_TO_PARTNER',
      reviewed_by: user.id,
      reviewed_at: nowIso,
      resolution_notes: resolutionNotesStr,
      created_at: nowIso
    }
    store.match_reviews.push(review)

    // Direct Relational Persistence (DEF-01)
    try {
      await supabase.from('crm_partner_match_reviews').upsert({
        id: reviewId,
        lead_id: leadId,
        partner_id,
        match_type: 'CONFIRMED_MATCH',
        match_details: { clubbed_into: partner.partner_code },
        resolution_status: 'CLUBBED_TO_PARTNER',
        reviewed_by: user.id,
        reviewed_at: nowIso,
        resolution_notes: resolutionNotesStr,
        created_at: nowIso
      })
    } catch (e: any) {
      console.error('Direct persist crm_partner_match_reviews error:', e.message)
    }

    // Update extended lead status
    store.extended_leads[leadId] = {
      ...(store.extended_leads[leadId] || {}),
      match_status: 'MERGED_TO_PARTNER',
      linked_partner_id: partner_id
    }
    saveLeadStore(store)

    // Update main lead record in Supabase
    await run(
      'UPDATE crm_leads SET status = ?, is_merged = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['merged', 1, leadId]
    )

    return res.json({
      success: true,
      message: `Lead successfully clubbed into partner ${partner.partner_code}.`,
      partner_id,
      lead_id: leadId
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 3. Lead Interactions & Call Logging (LM-18 to LM-24)
// ==========================================

leadManagementRouter.get('/crm/leads/:id/interactions', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const leadId = String(req.params.id)

    // LM-16: Category isolation check (using unified async permission check with DB fallback)
    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to leads in this category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId]

    // Try reading authoritative relational history first (DEF-01)
    try {
      const { data: relInteractions } = await supabase
        .from('crm_lead_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (relInteractions && relInteractions.length > 0) {
        return res.json({ interactions: relInteractions })
      }
    } catch (e: any) {
      // Fallback to store
    }

    const interactions = (store.interactions || [])
      .filter(i => i.lead_id === leadId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return res.json({ interactions })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.post('/crm/leads/:id/interactions', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    const leadId = String(req.params.id)

    // LM-16: Category access check (unified async permission check with DB fallback)
    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to log contact for this category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId]

    // LM-14: Call Block Enforcement on strong/confirmed existing partner matches
    if (ext?.match_status === 'CONTACT_REVIEW' || ext?.match_status === 'CONFIRMED_PARTNER') {
      const { supervisor_override, override_reason } = req.body
      if (!supervisor_override || !override_reason?.trim()) {
        return res.status(403).json({
          error: 'Call Block Enforced: This lead matches an existing partner. Outreach is blocked pending review or documented supervisor override.',
          code: 'CALL_ACTION_BLOCKED'
        })
      }
      if (!isSupervisorOrAdmin(user)) {
        return res.status(403).json({
          error: 'Only supervisors can authorize outreach overrides on matched partner records.'
        })
      }
    }

    const { channel_id, outcome, reason, conversation_notes, next_follow_up_date, supervisor_override, override_reason } = req.body

    // LM-22: Mandatory channel
    if (!channel_id) {
      return res.status(400).json({ error: 'Communication channel is required.' })
    }
    const channel = store.channels.find(c => c.id === channel_id && c.is_active === 1)
    if (!channel) {
      return res.status(400).json({ error: 'Invalid or inactive communication channel.' })
    }

    // LM-19: Controlled outcomes
    const allowedOutcomes = ['Interested', 'Partially Interested', 'Not Interested', 'Not Relevant']
    if (!allowedOutcomes.includes(outcome)) {
      return res.status(400).json({ error: `Outcome must be one of: ${allowedOutcomes.join(', ')}` })
    }

    // LM-20: Mandatory reason separate from notes
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Mandatory reason must be provided when recording contact outcome.' })
    }

    // LM-21: Next follow-up date required for continuing outcomes
    if ((outcome === 'Interested' || outcome === 'Partially Interested') && !next_follow_up_date) {
      return res.status(400).json({ error: `Next follow-up date is required when outcome is "${outcome}".` })
    }

    const interactionId = `int-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const nowIso = new Date().toISOString()
    const interaction: LeadInteraction = {
      id: interactionId,
      lead_id: leadId,
      conducted_by: user.id,
      channel_id,
      channel_name: channel.channel_name,
      outcome,
      reason: reason.trim(),
      conversation_notes: conversation_notes ? conversation_notes.trim() : '',
      next_follow_up_date: next_follow_up_date || undefined,
      supervisor_override: supervisor_override ? 1 : 0,
      override_reason: override_reason ? override_reason.trim() : undefined,
      created_at: nowIso
    }

    store.interactions.push(interaction)

    // Direct Relational Persistence into crm_lead_interactions (DEF-01)
    try {
      await supabase.from('crm_lead_interactions').insert({
        id: interactionId,
        lead_id: leadId,
        conducted_by: user.id,
        channel_id,
        outcome,
        reason: reason.trim(),
        conversation_notes: conversation_notes ? conversation_notes.trim() : reason.trim(),
        next_follow_up_date: next_follow_up_date || null,
        supervisor_override: supervisor_override ? 1 : 0,
        override_reason: override_reason ? override_reason.trim() : null,
        created_at: nowIso
      })
    } catch (e: any) {
      console.error('Direct persist crm_lead_interactions error:', e.message)
    }

    // Update main lead status based on outcome
    let newStatus = 'contacted'
    if (outcome === 'Not Interested' || outcome === 'Not Relevant') {
      newStatus = 'closed'
    }
    await run(
      'UPDATE crm_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, leadId]
    )

    // Schedule next follow-up in crm_follow_ups if date provided
    if (next_follow_up_date) {
      const fuId = `fu-${Date.now()}`
      const orgId = user?.organization_id || 'comp-default'
      await run(`
        INSERT INTO crm_follow_ups (id, lead_id, channel, scheduled_at, status, notes, conducted_by, organization_id)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
      `, [fuId, leadId, channel.channel_name, next_follow_up_date, conversation_notes || reason, user.id, orgId])
    }

    saveLeadStore(store)
    return res.status(201).json({ success: true, interaction })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 4. Calling Queue Priority Engine (LM-15)
// ==========================================

leadManagementRouter.get('/crm/calling-queue', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    const store = loadLeadStore()
    const tatDays = store.tat_settings?.[0]?.first_contact_tat_days || 2
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Fetch active, non-merged leads
    const leads = await queryAll<any>(`
      SELECT l.*, u.full_name as assigned_agent_name
      FROM crm_leads l
      LEFT JOIN user_profiles u ON l.assigned_to = u.id
      WHERE l.is_merged = 0 AND l.status NOT IN ('merged', 'closed')
      ORDER BY l.created_at ASC
    `)

    // Fetch scheduled follow-ups
    const followUps = await queryAll<any>(`
      SELECT * FROM crm_follow_ups
      WHERE status = 'scheduled'
      ORDER BY scheduled_at ASC
    `)

    const followUpMap = new Map<string, any>()
    for (const fu of followUps) {
      if (!followUpMap.has(fu.lead_id)) {
        followUpMap.set(fu.lead_id, fu)
      }
    }

    // Filter by user category permissions (LM-16)
    const userCatIds = await getUserCategoryIdsAsync(user.id)
    const isSuper = isSupervisorOrAdmin(user)
    const filteredLeads = leads.filter(l => {
      if (isSuper) return true
      const catId = l.category_id || store.extended_leads[l.id]?.category_id
      return catId ? userCatIds.includes(catId) : false
    })

    // Classify into queue priority buckets (LM-15):
    // 1. OVERDUE (past scheduled follow-up OR elapsed TAT with no follow-up)
    // 2. DUE_TODAY (follow-up scheduled today OR TAT expires today)
    // 3. UPCOMING (future scheduled follow-up)
    // 4. UNSCHEDULED (new lead within TAT)
    const categorized = filteredLeads.map(l => {
      const ext = store.extended_leads[l.id] || {}
      const fu = followUpMap.get(l.id)
      const createdAt = new Date(l.created_at)
      // DEF-04: Use immutable applied TAT snapshot if present
      const effectiveTatDays = (ext.applied_tat_days && ext.applied_tat_days > 0) ? ext.applied_tat_days : tatDays
      const tatDueDateStr = ext.first_contact_due_at
        ? ext.first_contact_due_at.split('T')[0]
        : new Date(createdAt.getTime() + effectiveTatDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let priorityBucket: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'UNSCHEDULED' = 'UNSCHEDULED'
      let effectiveDueDate = tatDueDateStr

      if (fu) {
        effectiveDueDate = fu.scheduled_at.split('T')[0]
        if (effectiveDueDate < todayStr) {
          priorityBucket = 'OVERDUE'
        } else if (effectiveDueDate === todayStr) {
          priorityBucket = 'DUE_TODAY'
        } else {
          priorityBucket = 'UPCOMING'
        }
      } else {
        if (tatDueDateStr < todayStr) {
          priorityBucket = 'OVERDUE'
        } else if (tatDueDateStr === todayStr) {
          priorityBucket = 'DUE_TODAY'
        } else {
          priorityBucket = 'UNSCHEDULED'
        }
      }

      return {
        ...l,
        ...ext,
        effectiveDueDate,
        priorityBucket,
        scheduledFollowUp: fu || null,
        callBlocked: ext.match_status === 'CONTACT_REVIEW' || ext.match_status === 'CONFIRMED_PARTNER'
      }
    })

    // Sort order: OVERDUE (0), DUE_TODAY (1), UPCOMING (2), UNSCHEDULED (3)
    const priorityWeights: Record<string, number> = { OVERDUE: 0, DUE_TODAY: 1, UPCOMING: 2, UNSCHEDULED: 3 }
    categorized.sort((a, b) => {
      const diff = (priorityWeights[a.priorityBucket] ?? 3) - (priorityWeights[b.priorityBucket] ?? 3)
      if (diff !== 0) return diff
      return a.effectiveDueDate.localeCompare(b.effectiveDueDate)
    })

    return res.json({
      queue: categorized,
      counts: {
        total: categorized.length,
        overdue: categorized.filter(c => c.priorityBucket === 'OVERDUE').length,
        dueToday: categorized.filter(c => c.priorityBucket === 'DUE_TODAY').length,
        upcoming: categorized.filter(c => c.priorityBucket === 'UPCOMING').length,
        unscheduled: categorized.filter(c => c.priorityBucket === 'UNSCHEDULED').length
      }
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 5. Lead-to-Partner Conversion (LM-25, LM-28)
// ==========================================

leadManagementRouter.post('/crm/leads/:id/convert-partner', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    const leadId = String(req.params.id)

    // LM-16: Category isolation check
    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to convert leads in this category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    // LM-28: Prevent double conversion
    if (store.conversion_links[leadId]) {
      return res.status(409).json({
        error: 'This lead has already been converted to an active partner.',
        existingLink: store.conversion_links[leadId]
      })
    }

    const { company_name, contact_person, email, phone, billing_address, state_code, gstin, pan, type } = req.body
    if (!company_name || !phone) {
      return res.status(400).json({ error: 'Company name and phone number are required for partner onboarding.' })
    }

    // Create new partner
    const partnerId = `part-${Date.now()}`
    const partnerCode = `PRT-${state_code || 'IN'}-${Date.now().toString().slice(-4)}`

    const orgId = user?.organization_id || 'comp-default'

    await run(`
      INSERT INTO partners (id, partner_code, type, company_name, contact_person, email, phone, gstin, pan, billing_address, state_code, status, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [
      partnerId,
      partnerCode,
      type || 'dsc_partner',
      company_name.trim(),
      contact_person ? contact_person.trim() : null,
      email ? email.trim().toLowerCase() : null,
      phone.trim(),
      gstin ? gstin.trim().toUpperCase() : null,
      pan ? pan.trim().toUpperCase() : null,
      billing_address || null,
      state_code || '27',
      orgId
    ])

    // Record conversion link (LM-28)
    const linkId = `lcl-${Date.now()}`
    const convTimeIso = new Date().toISOString()
    const auditNoteStr = `Converted from lead ${leadId} by ${user.full_name || user.email}`

    const link: LeadConversionLink = {
      id: linkId,
      lead_id: leadId,
      partner_id: partnerId,
      converted_by: user.id,
      conversion_timestamp: convTimeIso,
      prefilled_data: req.body,
      audit_note: auditNoteStr
    }
    store.conversion_links[leadId] = link

    // Direct Relational Persistence into crm_lead_conversion_links (DEF-01)
    try {
      await supabase.from('crm_lead_conversion_links').insert({
        id: linkId,
        lead_id: leadId,
        partner_id: partnerId,
        converted_by: user.id,
        conversion_timestamp: convTimeIso,
        prefilled_data: req.body,
        audit_note: auditNoteStr
      })
    } catch (e: any) {
      console.error('Direct persist crm_lead_conversion_links error:', e.message)
    }

    // Update lead status to converted
    await run(
      "UPDATE crm_leads SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [leadId]
    )

    // Retain service tracking
    if (!store.service_tracking[leadId]) {
      store.service_tracking[leadId] = {
        id: `lst-${Date.now()}`,
        lead_id: leadId,
        service_intent: ext.service_intent || 'Undecided',
        token_requested: 0,
        token_fulfilled: 0,
        dsc_requested: 0,
        dsc_fulfilled: 0,
        tracking_status: 'ACTIVE_OUTREACH',
        updated_at: new Date().toISOString()
      }
    }

    saveLeadStore(store)
    return res.status(201).json({
      success: true,
      partner_id: partnerId,
      partner_code: partnerCode,
      conversion_link: link
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 6. Service Activation Tracking (LM-26, LM-27)
// ==========================================

leadManagementRouter.get('/crm/leads/:id/service-tracking', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const leadId = String(req.params.id)

    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this lead category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    const tracking = store.service_tracking[leadId] || {
      id: `lst-new`,
      lead_id: leadId,
      service_intent: ext.service_intent || 'Undecided',
      token_requested: 0,
      token_fulfilled: 0,
      dsc_requested: 0,
      dsc_fulfilled: 0,
      tracking_status: 'PENDING_QUALIFICATION',
      updated_at: new Date().toISOString()
    }

    return res.json({ tracking })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

leadManagementRouter.patch('/crm/leads/:id/service-tracking', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    const leadId = String(req.params.id)

    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this lead category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    const current: LeadServiceTracking = store.service_tracking[leadId] || {
      id: `lst-${Date.now()}`,
      lead_id: leadId,
      service_intent: ext.service_intent || 'Undecided',
      token_requested: 0,
      token_fulfilled: 0,
      dsc_requested: 0,
      dsc_fulfilled: 0,
      tracking_status: 'PENDING_QUALIFICATION',
      updated_at: new Date().toISOString()
    }

    const {
      service_intent,
      token_requested,
      token_fulfilled,
      token_batch_id,
      dsc_requested,
      dsc_fulfilled,
      dsc_application_id
    } = req.body

    if (service_intent) current.service_intent = service_intent
    if (token_requested !== undefined) current.token_requested = Number(token_requested)
    if (token_fulfilled !== undefined) {
      current.token_fulfilled = Number(token_fulfilled)
      if (current.token_fulfilled === 1 && !current.token_fulfilled_at) {
        current.token_fulfilled_at = new Date().toISOString()
      }
    }
    if (token_batch_id) current.token_batch_id = token_batch_id

    if (dsc_requested !== undefined) current.dsc_requested = Number(dsc_requested)
    if (dsc_fulfilled !== undefined) {
      current.dsc_fulfilled = Number(dsc_fulfilled)
      if (current.dsc_fulfilled === 1 && !current.dsc_fulfilled_at) {
        current.dsc_fulfilled_at = new Date().toISOString()
      }
    }
    if (dsc_application_id) current.dsc_application_id = dsc_application_id

    // LM-27: Status state machine rules:
    // If intent is 'Both', must NOT mark fulfilled until BOTH are fulfilled.
    if (current.service_intent === 'Both') {
      if (current.token_fulfilled === 1 && current.dsc_fulfilled === 1) {
        current.tracking_status = 'FULFILLED'
      } else if (current.token_fulfilled === 1) {
        current.tracking_status = 'DSC_PENDING'
      } else if (current.dsc_fulfilled === 1) {
        current.tracking_status = 'TOKEN_PENDING'
      } else {
        current.tracking_status = 'BOTH_PENDING'
      }
    } else if (current.service_intent === 'Token') {
      current.tracking_status = current.token_fulfilled === 1 ? 'FULFILLED' : 'TOKEN_PENDING'
    } else if (current.service_intent === 'DSC') {
      current.tracking_status = current.dsc_fulfilled === 1 ? 'FULFILLED' : 'DSC_PENDING'
    }

    current.last_updated_by = user.id
    current.updated_at = new Date().toISOString()
    store.service_tracking[leadId] = current
    saveLeadStore(store)

    // Direct Relational Persistence into crm_lead_service_tracking (DEF-01)
    try {
      await supabase.from('crm_lead_service_tracking').upsert({
        id: current.id,
        lead_id: leadId,
        service_intent: current.service_intent || 'Undecided',
        token_requested: current.token_requested ?? 0,
        token_fulfilled: current.token_fulfilled ?? 0,
        token_fulfilled_at: current.token_fulfilled_at || null,
        token_batch_id: current.token_batch_id || null,
        dsc_requested: current.dsc_requested ?? 0,
        dsc_fulfilled: current.dsc_fulfilled ?? 0,
        dsc_fulfilled_at: current.dsc_fulfilled_at || null,
        dsc_application_id: current.dsc_application_id || null,
        tracking_status: current.tracking_status || 'PENDING_QUALIFICATION',
        last_updated_by: user.id,
        updated_at: current.updated_at
      })
    } catch (e: any) {
      console.error('Direct persist crm_lead_service_tracking error:', e.message)
    }

    return res.json({ success: true, tracking: current })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 6. Lead Management v2.0 Extensions: Bulk Import, Reassignment, Detail, Analytics
// ==========================================


// ==========================================
// 6. Lead Management v2.0 Extensions: Bulk Import, Reassignment, Detail, Analytics
// ==========================================

import * as XLSX from 'xlsx'
import { allocateNextReferenceNumber } from './api'

// Helper: Sanitize string to prevent CSV formula injection
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return ''
  let str = String(val).trim()
  if (['=', '+', '-', '@'].includes(str.charAt(0))) {
    str = "'" + str
  }
  return str
}

// 6.1 Download CSV & XLSX Templates (LM-33)
leadManagementRouter.get('/crm/leads/templates/:format', async (req: Request, res: Response) => {
  try {
    const format = String(req.params.format).toLowerCase()
    const templateData = [
      {
        'Company Name': 'Acme FinTech Corp',
        'Alternate Name': 'Acme Services',
        'Contact Person': 'Rajesh Sharma',
        'Mobile Phone': '9820011223',
        'Email': 'rajesh@acmefintech.in',
        'City': 'Mumbai',
        'District': 'Mumbai Suburban',
        'State': 'Maharashtra',
        'Postal Code': '400051',
        'Address': '402 Trade Centre, BKC',
        'Requirement Description': 'Needs 50 USB Tokens and Class 3 Signing DSC',
        'Service Intent': 'Both',
        'Lead Source': 'Partner CA Referral',
        'Category Name': 'Corporate & Enterprise Clients'
      },
      {
        'Company Name': 'Solo Legal Practice',
        'Alternate Name': '',
        'Contact Person': 'Adv. Priya Verma',
        'Mobile Phone': '9811100222',
        'Email': 'priya.verma@legaladvisors.in',
        'City': 'New Delhi',
        'District': 'South Delhi',
        'State': 'Delhi',
        'Postal Code': '110001',
        'Address': 'Bar Council Chambers',
        'Requirement Description': 'Single Class 3 DSC certificate for e-Courts filing',
        'Service Intent': 'DSC',
        'Lead Source': 'Direct Website Walk-in',
        'Category Name': 'Chartered Accountants & Advocates'
      }
    ]

    if (format === 'csv') {
      const headers = Object.keys(templateData[0]).join(',')
      const rows = templateData.map(row => 
        Object.values(row).map(val => '"' + sanitizeCsvValue(val).replace(/"/g, '""') + '"').join(',')
      ).join('\n')
      const csvContent = headers + '\n' + rows
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="SignSync_Lead_Import_Template.csv"')
      return res.send(csvContent)
    } else if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(templateData)
      XLSX.utils.book_append_sheet(wb, ws, 'Lead_Template')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="SignSync_Lead_Import_Template.xlsx"')
      return res.send(buf)
    } else {
      return res.status(400).json({ error: 'Format must be csv or xlsx.' })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.2 Bulk Upload & Preview with Validation, Internal Deduplication & Partner Conflict (LM-34, LM-35)
leadManagementRouter.post('/crm/leads/import/preview', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const { rawData, fileName } = req.body
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: 'Empty or invalid spreadsheet data.' })
    }

    if (rawData.length > 500) {
      return res.status(400).json({ error: 'Maximum row limit of 500 rows per import batch exceeded.' })
    }

    const seenPhonesInBatch = new Set<string>()
    const seenEmailsInBatch = new Set<string>()

    const evaluatedRows = []
    const rejectedRows = []
    let validCount = 0
    let duplicateCount = 0
    let partnerConflictCount = 0

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNum = i + 2 // Assuming row 1 is header

      const companyName = String(row['Company Name'] || row.company_name || row['Name'] || '').trim()
      const altName = String(row['Alternate Name'] || row.alternate_name || '').trim()
      const contactPerson = String(row['Contact Person'] || row.contact_person || '').trim()
      const phone = String(row['Mobile Phone'] || row.phone || row['Phone'] || row['Mobile'] || '').trim()
      const email = String(row['Email'] || row.email || row['Email ID'] || '').trim().toLowerCase()
      const city = String(row['City'] || row['City/Town'] || row.city || '').trim()
      const district = String(row['District'] || row.district || '').trim()
      const state = String(row['State'] || row.state || '').trim()
      const postalCode = String(row['Postal Code'] || row['PIN Code'] || row.pin_code || '').trim()
      const address = String(row['Address'] || row.address || '').trim()
      const reqSummary = String(row['Requirement Description'] || row['Notes'] || row.requirement_summary || '').trim()
      const serviceIntent = String(row['Service Intent'] || row.service_intent || 'Undecided').trim()

      // Check within-file duplicates
      const normPhone = phone.replace(/[^0-9]/g, '')
      let isBatchDuplicate = false
      if (normPhone && seenPhonesInBatch.has(normPhone)) {
        isBatchDuplicate = true
      }
      if (email && seenEmailsInBatch.has(email)) {
        isBatchDuplicate = true
      }
      if (normPhone) seenPhonesInBatch.add(normPhone)
      if (email) seenEmailsInBatch.add(email)

      if (isBatchDuplicate) {
        duplicateCount++
        rejectedRows.push({ row: rowNum, reason: 'Duplicate contact within same import spreadsheet', rowData: row })
        continue
      }

      // Partner match evaluation
      const partnerMatch = await evaluatePartnerMatch({
        company_name: companyName,
        alternate_name: altName,
        email,
        phone
      })

      if (partnerMatch.callBlocked) {
        partnerConflictCount++
      }

      validCount++
      evaluatedRows.push({
        rowNum,
        companyName,
        altName,
        contactPerson,
        phone,
        email,
        city,
        district,
        state,
        postalCode,
        address,
        reqSummary,
        serviceIntent,
        partnerMatch: {
          hasMatch: partnerMatch.hasMatch,
          matchStatus: partnerMatch.matchStatus,
          matchType: partnerMatch.matchType,
          callBlocked: partnerMatch.callBlocked,
          matchedPartnerName: partnerMatch.matchedPartner?.company_name,
          matchFactors: partnerMatch.matchFactors
        }
      })
    }

    // DEF-03: Deterministic SHA256 Bulk Import Fingerprint
    const normalizedFingerprintInput = rawData.map((r: any) => ({
      c: String(r['Company Name'] || r.company_name || r['Name'] || '').trim().toLowerCase(),
      p: String(r['Mobile Phone'] || r.phone || r['Phone'] || r['Mobile'] || '').replace(/[^0-9]/g, ''),
      e: String(r['Email'] || r.email || r['Email ID'] || '').trim().toLowerCase()
    })).sort((a: any, b: any) => (a.p + a.e + a.c).localeCompare(b.p + b.e + b.c))

    const fingerprint = crypto.createHash('sha256').update(JSON.stringify(normalizedFingerprintInput)).digest('hex')
    const batchId = 'batch-' + Date.now()

    // Check store for duplicate batch fingerprint
    const store = loadLeadStore()
    const duplicateBatch = (store.import_batches || []).find((b: any) => b.fingerprint === fingerprint)
    let isDuplicateBatch = false
    let warning: string | undefined = undefined
    if (duplicateBatch) {
      isDuplicateBatch = true
      warning = `Warning: A spreadsheet with identical contact data was already imported as batch ${duplicateBatch.id} (${duplicateBatch.file_name}).`
    }

    return res.json({
      success: true,
      batchId,
      fingerprint,
      isDuplicateBatch,
      warning,
      fileName: fileName || 'bulk_import.xlsx',
      summary: {
        totalRows: rawData.length,
        validRows: validCount,
        rejectedRows: rejectedRows.length,
        duplicateRows: duplicateCount,
        partnerConflictRows: partnerConflictCount
      },
      previewRows: evaluatedRows.slice(0, 50),
      rejectedSample: rejectedRows.slice(0, 10)
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.3 Commit Bulk Import Batch (LM-36, LM-37, LM-38)
leadManagementRouter.post('/crm/leads/import/commit', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const { rows, category_id, source_id, assigned_to, fingerprint, fileName, batchId: clientBatchId } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No validated rows provided to commit.' })
    }

    const store = loadLeadStore()
    const committedLeadIds: string[] = []

    // Snapshot active TAT setting (DEF-04)
    const appliedTatDays = await resolveActiveTatDays()

    for (const r of rows) {
      const id = 'lead-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      const lead_code = await allocateNextReferenceNumber('lead')

      const cleanCompany = r.companyName ? String(r.companyName).trim() : ''
      const cleanContact = r.contactPerson ? String(r.contactPerson).trim() : ''
      const cleanEmail = r.email ? String(r.email).trim().toLowerCase() : ''
      const cleanPhone = r.phone ? String(r.phone).trim() : ''
      const cleanReq = r.reqSummary ? String(r.reqSummary).trim() : ''

      const partnerMatch = await evaluatePartnerMatch({
        company_name: cleanCompany,
        alternate_name: r.altName || null,
        email: cleanEmail,
        phone: cleanPhone
      })

      const orgId = user?.organization_id || 'comp-default'

      // Insert into PostgreSQL
      await run(`
        INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, assigned_to, organization_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'new', ?, ?)
      `, [id, lead_code, cleanCompany, cleanContact, cleanEmail, cleanPhone, cleanReq, assigned_to || null, orgId])

      const nowTime = Date.now()
      const dueDateIso = new Date(nowTime + appliedTatDays * 24 * 60 * 60 * 1000).toISOString()

      // Save extended metadata
      store.extended_leads[id] = {
        alternate_name: r.altName || null,
        city: r.city || null,
        state: r.state || null,
        district: r.district || null,
        address: r.address || null,
        pin_code: r.postalCode || null,
        source_id: source_id || null,
        category_id: category_id || null,
        service_intent: r.serviceIntent || 'Undecided',
        pipeline_status: 'NEW',
        match_status: partnerMatch.matchStatus,
        linked_partner_id: partnerMatch.matchedPartner?.id || null,
        partner_match_score: partnerMatch.matchScore,
        partner_match_factors: partnerMatch.matchFactors.join(' | '),
        assigned_to: assigned_to || null,
        applied_tat_days: appliedTatDays,
        first_contact_due_at: dueDateIso,
        assignment_history: assigned_to ? [{
          assigned_to,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          reason: 'Initial Bulk Import Assignment'
        }] : []
      }

      // If initially assigned on bulk import, also persist to crm_lead_assignment_history
      if (assigned_to) {
        try {
          await supabase.from('crm_lead_assignment_history').insert({
            id: `lah-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            lead_id: id,
            assigned_by: user.id,
            assigned_to,
            reason: 'Initial Bulk Import Assignment',
            created_at: new Date().toISOString()
          })
        } catch (e: any) {
          console.error('Direct persist initial assignment error:', e.message)
        }
      }

      const stId = 'lst-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      const stNowIso = new Date().toISOString()
      const tokenReq = (r.serviceIntent === 'Token' || r.serviceIntent === 'Both') ? 1 : 0
      const dscReq = (r.serviceIntent === 'DSC' || r.serviceIntent === 'Both') ? 1 : 0

      store.service_tracking[id] = {
        id: stId,
        lead_id: id,
        service_intent: r.serviceIntent || 'Undecided',
        token_requested: tokenReq,
        token_fulfilled: 0,
        dsc_requested: dscReq,
        dsc_fulfilled: 0,
        tracking_status: 'PENDING_QUALIFICATION',
        last_updated_by: user.id,
        updated_at: stNowIso
      }

      // Direct persist service tracking (DEF-01)
      try {
        await supabase.from('crm_lead_service_tracking').upsert({
          id: stId,
          lead_id: id,
          service_intent: r.serviceIntent || 'Undecided',
          token_requested: tokenReq,
          token_fulfilled: 0,
          token_fulfilled_at: null,
          token_batch_id: null,
          dsc_requested: dscReq,
          dsc_fulfilled: 0,
          dsc_fulfilled_at: null,
          dsc_application_id: null,
          tracking_status: 'PENDING_QUALIFICATION',
          last_updated_by: user.id,
          updated_at: stNowIso
        })
      } catch (e: any) {
        console.error('Direct persist import service_tracking error:', e.message)
      }

      committedLeadIds.push(id)
    }

    // Persist batch info into crm_bulk_import_batches (DEF-01 / DEF-03)
    const finalBatchId = clientBatchId || `batch-${Date.now()}`
    const finalFileName = fileName || 'bulk_import.xlsx'
    try {
      await supabase.from('crm_bulk_import_batches').insert({
        id: finalBatchId,
        uploaded_by: user.id,
        file_name: finalFileName,
        total_rows: rows.length,
        valid_rows: rows.length,
        duplicate_rows: 0,
        matched_partner_rows: 0,
        committed_rows: committedLeadIds.length,
        status: 'COMMITTED'
      })
    } catch (e: any) {
      console.error('Direct persist crm_bulk_import_batches error:', e.message)
    }

    if (!store.import_batches) store.import_batches = []
    store.import_batches.push({
      id: finalBatchId,
      file_name: finalFileName,
      uploader_id: user.id,
      category_id: category_id || undefined,
      source_id: source_id || undefined,
      total_rows: rows.length,
      valid_rows: rows.length,
      invalid_rows: 0,
      duplicate_rows: 0,
      partner_match_rows: 0,
      imported_rows: committedLeadIds.length,
      status: 'COMMITTED',
      errors: [],
      fingerprint: fingerprint || ('fp-' + rows.length),
      created_at: new Date().toISOString()
    })

    saveLeadStore(store)
    return res.status(201).json({
      success: true,
      batchId: finalBatchId,
      committedCount: committedLeadIds.length,
      leadIds: committedLeadIds,
      message: 'Successfully imported ' + committedLeadIds.length + ' customer leads.'
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.4 Lead Reassignment & Allocation (LM-39)
leadManagementRouter.patch('/crm/leads/:id/assign', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const leadId = String(req.params.id)
    const { assigned_to, reason } = req.body

    // Enforce category access
    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to manage leads in this category.' })
    }

    const effectiveCatId = await resolveLeadCategory(leadId)
    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    // Verify target executive has access to this category
    if (assigned_to) {
      const targetExecutive = await queryOne('SELECT id, full_name, hierarchy_level_id FROM user_profiles WHERE id = ?', [assigned_to])
      if (!targetExecutive) {
        return res.status(404).json({ error: 'Target staff account not found.' })
      }
      if (effectiveCatId) {
        const targetHasAccess = await canUserAccessLeadAsync({ id: assigned_to, hierarchy_level_order: 3 }, effectiveCatId, false)
        if (!targetHasAccess) {
          return res.status(400).json({ error: 'Target staff member is not authorized for this lead category.' })
        }
      }
    }

    // Update assignment in PostgreSQL
    await run('UPDATE crm_leads SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [assigned_to || null, leadId])

    const lahId = `lah-${Date.now()}`
    const assignNowIso = new Date().toISOString()
    const assignReason = reason || 'Supervisory Reallocation'

    // Direct Relational Persistence into crm_lead_assignment_history (DEF-02)
    try {
      await supabase.from('crm_lead_assignment_history').insert({
        id: lahId,
        lead_id: leadId,
        assigned_by: user.id,
        assigned_to: assigned_to || 'UNASSIGNED',
        reason: assignReason,
        created_at: assignNowIso
      })
    } catch (e: any) {
      console.error('Direct persist crm_lead_assignment_history error:', e.message)
    }

    // Update assignment history in JSON store
    if (!ext.assignment_history) ext.assignment_history = []
    ext.assignment_history.push({
      assigned_to: assigned_to || 'UNASSIGNED',
      assigned_by: user.id,
      assigned_at: assignNowIso,
      reason: assignReason
    })
    ext.assigned_to = assigned_to || null
    store.extended_leads[leadId] = ext
    saveLeadStore(store)

    return res.json({ success: true, message: 'Lead assignment successfully updated.', assigned_to })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.5 Comprehensive Follow-Up Action Center & KPIs (LM-40, LM-41)
leadManagementRouter.get('/crm/action-center', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const store = loadLeadStore()
    const tatDays = store.tat_settings?.[0]?.first_contact_tat_days || 2
    const todayStr = new Date().toISOString().split('T')[0]

    // Fetch accessible leads
    const allLeads = await queryAll<any>('SELECT l.*, u.full_name as assigned_agent_name FROM crm_leads l LEFT JOIN user_profiles u ON l.assigned_to = u.id WHERE l.is_merged = 0 ORDER BY l.created_at DESC')
    const userCatIds = await getUserCategoryIdsAsync(user.id)
    const isSuper = isSupervisorOrAdmin(user)
    const scopedLeads = allLeads.filter(l => {
      if (isSuper) return true
      const catId = l.category_id || store.extended_leads[l.id]?.category_id
      return catId ? userCatIds.includes(catId) : false
    })

    const followUps = await queryAll<any>('SELECT * FROM crm_follow_ups ORDER BY scheduled_at ASC')
    const fuMap = new Map<string, any>()
    followUps.forEach(f => {
      if (f.status === 'scheduled') fuMap.set(f.lead_id, f)
    })

    let newCount = 0
    let overdueCount = 0
    let dueTodayCount = 0
    let unassignedCount = 0
    let wonCount = 0
    let pendingTokenCount = 0
    let pendingDscCount = 0

    const enrichedQueue = scopedLeads.map(l => {
      const ext = store.extended_leads[l.id] || {}
      const st = store.service_tracking[l.id] || {}
      const fu = fuMap.get(l.id)

      if (l.status === 'new') newCount++
      if (!l.assigned_to) unassignedCount++
      if (l.status === 'won' || ext.pipeline_status === 'WON') wonCount++
      if (st.token_requested === 1 && st.token_fulfilled === 0) pendingTokenCount++
      if (st.dsc_requested === 1 && st.dsc_fulfilled === 0) pendingDscCount++

      const createdAt = new Date(l.created_at)
      // DEF-04: Use immutable applied TAT snapshot if present
      const effectiveTatDays = (ext.applied_tat_days && ext.applied_tat_days > 0) ? ext.applied_tat_days : tatDays
      const tatDue = ext.first_contact_due_at
        ? ext.first_contact_due_at.split('T')[0]
        : new Date(createdAt.getTime() + effectiveTatDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let bucket: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'UNSCHEDULED' = 'UNSCHEDULED'
      let effectiveDate = tatDue

      if (fu) {
        effectiveDate = fu.scheduled_at.split('T')[0]
        if (effectiveDate < todayStr) {
          bucket = 'OVERDUE'
          overdueCount++
        } else if (effectiveDate === todayStr) {
          bucket = 'DUE_TODAY'
          dueTodayCount++
        } else {
          bucket = 'UPCOMING'
        }
      } else {
        if (tatDue < todayStr) {
          bucket = 'OVERDUE'
          overdueCount++
        } else if (tatDue === todayStr) {
          bucket = 'DUE_TODAY'
          dueTodayCount++
        }
      }

      return {
        ...l,
        city: ext.city || null,
        alternate_name: ext.alternate_name || null,
        category_id: ext.category_id || null,
        source_id: ext.source_id || null,
        service_intent: ext.service_intent || 'Undecided',
        pipeline_status: ext.pipeline_status || l.status.toUpperCase(),
        match_status: ext.match_status || 'NO_MATCH',
        bucket,
        effectiveDueDate: effectiveDate,
        followUp: fu || null
      }
    })

    const totalLeads = scopedLeads.length
    const conversionRate = totalLeads > 0 ? Number(((wonCount / totalLeads) * 100).toFixed(1)) : 0

    return res.json({
      success: true,
      kpis: {
        totalLeads,
        newLeads: newCount,
        overdueCount,
        dueTodayCount,
        unassignedCount,
        conversionRate,
        pendingTokenCount,
        pendingDscCount
      },
      queue: enrichedQueue
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.6 Update CRM Pipeline Status (LM-42)
leadManagementRouter.patch('/crm/leads/:id/pipeline-status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const leadId = String(req.params.id)
    const { pipeline_status } = req.body

    const allowed = ['NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']
    if (!allowed.includes(pipeline_status)) {
      return res.status(400).json({ error: 'Invalid pipeline status. Must be one of: ' + allowed.join(', ') })
    }

    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this lead.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    ext.pipeline_status = pipeline_status
    store.extended_leads[leadId] = ext
    saveLeadStore(store)

    // Also update main status in PostgreSQL
    await run('UPDATE crm_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pipeline_status.toLowerCase(), leadId])

    return res.json({ success: true, pipeline_status })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.7 Analytics & Performance Metrics (Phase 8)
leadManagementRouter.get('/crm/analytics', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const store = loadLeadStore()
    const allLeads = await queryAll<any>('SELECT l.*, u.full_name as assigned_agent_name FROM crm_leads l LEFT JOIN user_profiles u ON l.assigned_to = u.id WHERE l.is_merged = 0')
    const userCatIds = await getUserCategoryIdsAsync(user.id)
    const isSuper = isSupervisorOrAdmin(user)
    const scoped = allLeads.filter(l => {
      if (isSuper) return true
      const catId = l.category_id || store.extended_leads[l.id]?.category_id
      return catId ? userCatIds.includes(catId) : false
    })

    // Sources breakdown
    const sourceMap: Record<string, { total: number; won: number }> = {}
    const categoryMap: Record<string, number> = {}

    for (const l of scoped) {
      const ext = store.extended_leads[l.id] || {}
      const sId = ext.source_id || 'Direct / Walk-in'
      const cId = ext.category_id || 'Uncategorized'

      if (!sourceMap[sId]) sourceMap[sId] = { total: 0, won: 0 }
      sourceMap[sId].total++
      if (l.status === 'won' || ext.pipeline_status === 'WON') sourceMap[sId].won++

      categoryMap[cId] = (categoryMap[cId] || 0) + 1
    }

    return res.json({
      success: true,
      totalLeads: scoped.length,
      bySource: sourceMap,
      byCategory: categoryMap
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// ==========================================
// 6.8 Controlled Phone Reveal with Audit Logging (DEF-05)
// ==========================================
leadManagementRouter.post('/crm/leads/:id/reveal-phone', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const leadId = String(req.params.id)
    if (!isValidLeadId(leadId)) {
      return res.status(400).json({ error: 'A valid Lead ID is required.' })
    }

    // Enforce category access (LM-16)
    const hasAccess = await canUserAccessLeadAsync(user, leadId, true)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to access contact info for this category.' })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    // Query unmasked primary lead record from PostgreSQL
    const lead = await queryOne<any>('SELECT id, phone, contact_person, company_name FROM crm_leads WHERE id = ?', [leadId])
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' })
    }

    const { reason: clientReason } = req.body || {}
    const revealReason = clientReason ? String(clientReason).trim() : 'Operational tele-call contact'

    // Write audit log entry (DEF-05)
    const auditId = `audit-reveal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    try {
      await supabase.from('audit_logs').insert({
        id: auditId,
        user_id: user.id,
        action_type: 'PHONE_REVEAL',
        module_key: 'crm',
        table_affected: 'crm_leads',
        record_id: leadId,
        old_value_json: null,
        new_value_json: JSON.stringify({ phone_revealed: true, lead_id: leadId }),
        reason: revealReason,
        ip_address: req.ip || '127.0.0.1'
      })
    } catch (e: any) {
      console.error('Audit log reveal phone insert error:', e.message)
    }

    return res.json({
      success: true,
      lead_id: leadId,
      phone: lead.phone || '',
      revealed_at: new Date().toISOString()
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})
