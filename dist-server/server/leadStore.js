"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLeadStore = loadLeadStore;
exports.syncLeadStoreFromSupabase = syncLeadStoreFromSupabase;
exports.saveLeadStore = saveLeadStore;
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.normalizeEmail = normalizeEmail;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_1 = require("./supabase");
const STORE_PATH = path_1.default.join(process.cwd(), 'data', 'lead_management_store.json');
function getDefaultStore() {
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
    };
}
// In-memory cache for speed backed by durable Supabase PostgreSQL relational tables
let inMemoryStore = null;
function loadLeadStore() {
    if (inMemoryStore) {
        return inMemoryStore;
    }
    try {
        if (fs_1.default.existsSync(STORE_PATH)) {
            const raw = fs_1.default.readFileSync(STORE_PATH, 'utf8');
            inMemoryStore = JSON.parse(raw);
            return inMemoryStore;
        }
    }
    catch (err) {
        console.error('Error reading local cache:', err);
    }
    const defaultStore = getDefaultStore();
    saveLeadStore(defaultStore);
    return defaultStore;
}
// Relational Masters Hydration from Supabase company_profile & crm_follow_ups
async function syncLeadStoreFromSupabase() {
    try {
        const { data: records, error } = await supabase_1.supabase
            .from('company_profile')
            .select('id, registered_address')
            .neq('id', 'comp-default');
        if (!error && records && records.length > 0) {
            const base = getDefaultStore();
            for (const rec of records) {
                try {
                    const parsed = JSON.parse(rec.registered_address || '[]');
                    if (rec.id === 'crm_master_categories')
                        base.categories = parsed;
                    else if (rec.id === 'crm_master_channels')
                        base.channels = parsed;
                    else if (rec.id === 'crm_master_tat_settings')
                        base.tat_settings = parsed;
                    else if (rec.id === 'crm_master_user_category_access')
                        base.user_category_access = parsed;
                    else if (rec.id === 'crm_rel_match_reviews')
                        base.match_reviews = parsed;
                    else if (rec.id === 'crm_rel_service_tracking')
                        base.service_tracking = parsed;
                    else if (rec.id === 'crm_rel_conversion_links')
                        base.conversion_links = parsed;
                    else if (rec.id === 'crm_rel_extended_leads')
                        base.extended_leads = parsed;
                    else if (rec.id === 'crm_rel_bulk_batches')
                        base.import_batches = parsed;
                }
                catch (_a) {
                    // parse fallback
                }
            }
            // Also hydrate interaction logs from crm_follow_ups table
            const { data: followUps } = await supabase_1.supabase
                .from('crm_follow_ups')
                .select('*')
                .order('created_at', { ascending: false });
            if (followUps && followUps.length > 0) {
                base.interactions = followUps.map(fu => {
                    let outcome = fu.disposition || 'Interested';
                    let reason = '';
                    let conversation_notes = '';
                    let supervisor_override = 0;
                    let override_reason = '';
                    if (fu.notes && fu.notes.includes('Outcome:')) {
                        const parts = fu.notes.split(' | ');
                        for (const p of parts) {
                            if (p.startsWith('Outcome: '))
                                outcome = p.replace('Outcome: ', '').trim();
                            if (p.startsWith('Reason: '))
                                reason = p.replace('Reason: ', '').trim();
                            if (p.startsWith('Notes: ')) {
                                const notePart = p.replace('Notes: ', '');
                                if (notePart.includes('[SUPERVISOR OVERRIDE:')) {
                                    const subParts = notePart.split('[SUPERVISOR OVERRIDE:');
                                    conversation_notes = subParts[0].trim();
                                    supervisor_override = 1;
                                    override_reason = subParts[1].replace(']', '').trim();
                                }
                                else {
                                    conversation_notes = notePart.trim();
                                }
                            }
                        }
                    }
                    else {
                        conversation_notes = fu.notes || '';
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
                    };
                });
            }
            inMemoryStore = base;
            // Keep local JSON in sync as read-through cache
            const dir = path_1.default.dirname(STORE_PATH);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(STORE_PATH, JSON.stringify(inMemoryStore, null, 2), 'utf8');
            console.log('✓ Successfully hydrated Lead Store from Supabase PostgreSQL Relational Tables.');
        }
    }
    catch (err) {
        console.warn('Could not sync Lead Store from Supabase Relational Tables:', err);
    }
}
// Save store to memory/cache and persist to Supabase PostgreSQL Relational Storage
function saveLeadStore(store) {
    inMemoryStore = store;
    try {
        const dir = path_1.default.dirname(STORE_PATH);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    }
    catch (err) {
        console.error('Error writing local lead store cache:', err);
    }
    // Durable Supabase Relational PostgreSQL Persistence (Debounced)
    persistToSupabaseRelational(store).catch(err => {
        console.warn('Supabase relational store backup warning:', err.message);
    });
}
let syncTimeout = null;
async function persistToSupabaseRelational(store) {
    if (syncTimeout)
        clearTimeout(syncTimeout);
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
            ];
            for (const target of syncTargets) {
                await supabase_1.supabase
                    .from('company_profile')
                    .update({
                    registered_address: JSON.stringify(target.data),
                    updated_at: new Date().toISOString()
                })
                    .eq('id', target.id);
            }
        }
        catch (err) {
            console.warn('Supabase relational update deferred:', err.message);
        }
    }, 1000);
}
// Contact Normalizer helper (removes +91, spaces, dashes, leading zero)
function normalizePhoneNumber(phone) {
    if (!phone)
        return '';
    let cleaned = String(phone).replace(/[^0-9]/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.slice(2);
    }
    else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
}
function normalizeEmail(email) {
    if (!email)
        return '';
    return String(email).trim().toLowerCase();
}
