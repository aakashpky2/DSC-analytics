import fs from 'fs'
import path from 'path'
import { supabase } from './supabase'

const STORE_PATH = path.join(process.cwd(), 'data', 'lead_management_store.json')

export interface LeadCategory {
  id: string
  category_name: string
  description?: string
  is_active: number
  created_at: string
  updated_at: string
}

export interface CommunicationChannel {
  id: string
  channel_name: string
  channel_icon: string
  is_active: number
  created_at: string
}

export interface TatSetting {
  id: string
  first_contact_tat_days: number
  follow_up_grace_hours: number
  is_active: number
  effective_from: string
}

export interface UserCategoryAccess {
  id: string
  user_id: string
  category_id: string
  created_at: string
}

export interface PartnerContactMethod {
  id: string
  partner_id: string
  contact_type: string // 'MOBILE', 'LANDLINE', 'EMAIL', 'ALTERNATE_PHONE'
  contact_value: string
  normalized_value: string
  is_primary: number
  created_at: string
}

export interface PartnerMatchReview {
  id: string
  lead_id: string
  partner_id: string
  match_type: string // 'EXACT_PHONE', 'ALTERNATE_PHONE', 'EXACT_EMAIL', 'PHONE_SIMILARITY', 'NAME_SIMILARITY'
  match_details: any
  resolution_status: string // 'PENDING_REVIEW', 'CONFIRMED_MATCH', 'FALSE_POSITIVE', 'CLUBBED_TO_PARTNER'
  reviewed_by?: string
  reviewed_at?: string
  resolution_notes?: string
  created_at: string
}

export interface LeadInteraction {
  id: string
  lead_id: string
  conducted_by: string
  channel_id: string
  channel_name?: string
  outcome: string // 'Interested', 'Partially Interested', 'Not Interested', 'Not Relevant'
  reason: string
  conversation_notes?: string
  next_follow_up_date?: string
  supervisor_override?: number
  override_reason?: string
  created_at: string
}

export interface LeadServiceTracking {
  id: string
  lead_id: string
  service_intent: string // 'Token', 'DSC', 'Both', 'Undecided'
  token_requested: number
  token_fulfilled: number
  token_fulfilled_at?: string
  token_batch_id?: string
  dsc_requested: number
  dsc_fulfilled: number
  dsc_fulfilled_at?: string
  dsc_application_id?: string
  tracking_status: string // 'PENDING_QUALIFICATION', 'ACTIVE_OUTREACH', 'TOKEN_PENDING', 'DSC_PENDING', 'BOTH_PENDING', 'FULFILLED', 'CLOSED'
  last_updated_by?: string
  updated_at: string
}

export interface LeadConversionLink {
  id: string
  lead_id: string
  partner_id: string
  converted_by: string
  conversion_timestamp: string
  prefilled_data?: any
  audit_note?: string
}

export interface ExtendedLeadFields {
  alternate_name?: string | null
  city?: string | null
  state?: string | null
  district?: string | null
  address?: string | null
  pin_code?: string | null
  source_id?: string | null
  category_id?: string | null
  service_intent?: string | null
  match_status?: string | null // 'NO_MATCH', 'NAME_REVIEW', 'CONTACT_REVIEW', 'CONFIRMED_PARTNER', 'MERGED_TO_PARTNER'
  linked_partner_id?: string | null
  partner_match_score?: number | null
  partner_match_factors?: string | null
  pipeline_status?: string | null // 'NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'
  assigned_to?: string | null
  applied_tat_days?: number | null
  first_contact_due_at?: string | null
  assignment_history?: Array<{
    assigned_to: string
    assigned_by: string
    assigned_at: string
    reason?: string
  }>
}

export interface BulkImportBatch {
  id: string
  file_name: string
  uploader_id: string
  category_id?: string
  source_id?: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  duplicate_rows: number
  partner_match_rows: number
  imported_rows: number
  status: 'PENDING_REVIEW' | 'COMMITTED' | 'REJECTED'
  errors: Array<{ row: number; reason: string; rowData?: any }>
  fingerprint: string
  created_at: string
}

export interface LeadManagementStore {
  categories: LeadCategory[]
  channels: CommunicationChannel[]
  tat_settings: TatSetting[]
  user_category_access: UserCategoryAccess[]
  partner_contacts: PartnerContactMethod[]
  match_reviews: PartnerMatchReview[]
  interactions: LeadInteraction[]
  service_tracking: Record<string, LeadServiceTracking>
  conversion_links: Record<string, LeadConversionLink>
  extended_leads: Record<string, ExtendedLeadFields>
  import_batches?: BulkImportBatch[]
}

function getDefaultStore(): LeadManagementStore {
  return {
    categories: [
      {
        id: 'cat-ca-advocates',
        category_name: 'Chartered Accountants & Advocates',
        description: 'Legal and financial professionals issuing business DSCs',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'cat-tax-practitioners',
        category_name: 'Tax Practitioners & GST Consultants',
        description: 'Consultants filing returns and company formations',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'cat-enterprises',
        category_name: 'Corporate & Enterprise Clients',
        description: 'Direct enterprise accounts requiring volume tokens & signing',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'cat-retail-partners',
        category_name: 'Retail Tech & DSC Vendors',
        description: 'Retail counter partners reselling token and DSC services',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    channels: [
      {
        id: 'chan-phone-call',
        channel_name: 'Phone Call',
        channel_icon: 'Phone',
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'chan-whatsapp',
        channel_name: 'WhatsApp Business',
        channel_icon: 'MessageSquare',
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'chan-email',
        channel_name: 'Official Email',
        channel_icon: 'Mail',
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'chan-in-person',
        channel_name: 'In-Person Meeting',
        channel_icon: 'Users',
        is_active: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'chan-video-meet',
        channel_name: 'Video Conference',
        channel_icon: 'Video',
        is_active: 1,
        created_at: new Date().toISOString()
      }
    ],
    tat_settings: [
      {
        id: 'tat-default',
        first_contact_tat_days: 2,
        follow_up_grace_hours: 24,
        is_active: 1,
        effective_from: new Date().toISOString()
      }
    ],
    user_category_access: [],
    partner_contacts: [
      {
        id: 'pcm-part-001-alt',
        partner_id: 'part-001',
        contact_type: 'ALTERNATE_PHONE',
        contact_value: '+91 98200 99999',
        normalized_value: '9820099999',
        is_primary: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'pcm-part-002-alt',
        partner_id: 'part-002',
        contact_type: 'ALTERNATE_PHONE',
        contact_value: '+91 98222 88888',
        normalized_value: '9822288888',
        is_primary: 0,
        created_at: new Date().toISOString()
      }
    ],
    match_reviews: [],
    interactions: [],
    service_tracking: {},
    conversion_links: {},
    extended_leads: {},
    import_batches: []
  }
}

// In-memory cache for speed backed by durable Supabase PostgreSQL relational tables
let inMemoryStore: LeadManagementStore | null = null

export function loadLeadStore(): LeadManagementStore {
  if (inMemoryStore) {
    return inMemoryStore
  }

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8')
      inMemoryStore = JSON.parse(raw)
      return inMemoryStore!
    }
  } catch (err) {
    console.error('Error reading local cache:', err)
  }

  const defaultStore = getDefaultStore()
  saveLeadStore(defaultStore)
  return defaultStore
}

// Relational Masters Hydration from Supabase company_profile & crm_follow_ups
export async function syncLeadStoreFromSupabase(): Promise<void> {
  try {
    const { data: records, error } = await supabase
      .from('company_profile')
      .select('id, registered_address')
      .neq('id', 'comp-default')

    if (!error && records && records.length > 0) {
      const base = getDefaultStore()
      for (const rec of records) {
        try {
          const parsed = JSON.parse(rec.registered_address || '[]')
          if (rec.id === 'crm_master_categories') base.categories = parsed
          else if (rec.id === 'crm_master_channels') base.channels = parsed
          else if (rec.id === 'crm_master_tat_settings') base.tat_settings = parsed
          else if (rec.id === 'crm_master_user_category_access') base.user_category_access = parsed
          else if (rec.id === 'crm_rel_match_reviews') base.match_reviews = parsed
          else if (rec.id === 'crm_rel_service_tracking') base.service_tracking = parsed
          else if (rec.id === 'crm_rel_conversion_links') base.conversion_links = parsed
          else if (rec.id === 'crm_rel_extended_leads') base.extended_leads = parsed
          else if (rec.id === 'crm_rel_bulk_batches') base.import_batches = parsed
        } catch {
          // parse fallback
        }
      }

      // Also hydrate interaction logs from crm_follow_ups table
      const { data: followUps } = await supabase
        .from('crm_follow_ups')
        .select('*')
        .order('created_at', { ascending: false })

      if (followUps && followUps.length > 0) {
        base.interactions = followUps.map(fu => {
          let outcome = fu.disposition || 'Interested'
          let reason = ''
          let conversation_notes = ''
          let supervisor_override = 0
          let override_reason = ''

          if (fu.notes && fu.notes.includes('Outcome:')) {
            const parts = fu.notes.split(' | ')
            for (const p of parts) {
              if (p.startsWith('Outcome: ')) outcome = p.replace('Outcome: ', '').trim()
              if (p.startsWith('Reason: ')) reason = p.replace('Reason: ', '').trim()
              if (p.startsWith('Notes: ')) {
                const notePart = p.replace('Notes: ', '')
                if (notePart.includes('[SUPERVISOR OVERRIDE:')) {
                  const subParts = notePart.split('[SUPERVISOR OVERRIDE:')
                  conversation_notes = subParts[0].trim()
                  supervisor_override = 1
                  override_reason = subParts[1].replace(']', '').trim()
                } else {
                  conversation_notes = notePart.trim()
                }
              }
            }
          } else {
            conversation_notes = fu.notes || ''
          }

          return {
            id: fu.id,
            lead_id: fu.lead_id,
            conducted_by: fu.conducted_by,
            channel_id: fu.channel || 'chan-phone-call',
            outcome,
            reason: reason || outcome,
            conversation_notes,
            next_follow_up_date: fu.scheduled_at,
            supervisor_override,
            override_reason,
            created_at: fu.created_at
          }
        })
      }

      inMemoryStore = base

      // Keep local JSON in sync as read-through cache
      const dir = path.dirname(STORE_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(STORE_PATH, JSON.stringify(inMemoryStore, null, 2), 'utf8')
      console.log('✓ Successfully hydrated Lead Store from Supabase PostgreSQL Relational Tables.')
    }
  } catch (err) {
    console.warn('Could not sync Lead Store from Supabase Relational Tables:', err)
  }
}

// Save store to memory/cache and persist to Supabase PostgreSQL Relational Storage
export function saveLeadStore(store: LeadManagementStore): void {
  inMemoryStore = store
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing local lead store cache:', err)
  }

  // Durable Supabase Relational PostgreSQL Persistence (Debounced)
  persistToSupabaseRelational(store).catch(err => {
    console.warn('Supabase relational store backup warning:', err.message)
  })
}

let syncTimeout: NodeJS.Timeout | null = null

async function persistToSupabaseRelational(store: LeadManagementStore): Promise<void> {
  if (syncTimeout) clearTimeout(syncTimeout)

  syncTimeout = setTimeout(async () => {
    try {
      const syncTargets = [
        { id: 'crm_master_categories', name: 'CRM Categories Master', data: store.categories },
        { id: 'crm_master_channels', name: 'CRM Communication Channels Master', data: store.channels },
        { id: 'crm_master_tat_settings', name: 'CRM TAT Settings Master', data: store.tat_settings },
        { id: 'crm_master_user_category_access', name: 'CRM User Category Access', data: store.user_category_access },
        { id: 'crm_rel_match_reviews', name: 'CRM Partner Match Reviews', data: store.match_reviews },
        { id: 'crm_rel_service_tracking', name: 'CRM Lead Service Tracking', data: store.service_tracking },
        { id: 'crm_rel_conversion_links', name: 'CRM Lead Conversion Links', data: store.conversion_links },
        { id: 'crm_rel_extended_leads', name: 'CRM Lead Extended Fields', data: store.extended_leads },
        { id: 'crm_rel_bulk_batches', name: 'CRM Bulk Import Batches', data: store.import_batches || [] }
      ]

      for (const target of syncTargets) {
        await supabase
          .from('company_profile')
          .update({
            registered_address: JSON.stringify(target.data),
            updated_at: new Date().toISOString()
          })
          .eq('id', target.id)
      }
    } catch (err: any) {
      console.warn('Supabase relational update deferred:', err.message)
    }
  }, 1000)
}

// Contact Normalizer helper (removes +91, spaces, dashes, leading zero)
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return ''
  let cleaned = String(phone).replace(/[^0-9]/g, '')
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2)
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1)
  }
  return cleaned
}

export function normalizeEmail(email?: string | null): string {
  if (!email) return ''
  return String(email).trim().toLowerCase()
}
