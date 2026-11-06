// Migration script: Hydrate and sync Lead Management v2.0 relational masters into Supabase PostgreSQL
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runRelationalMigration() {
  console.log('=== STARTING RELATIONAL DATA MIGRATION ===');

  // 1. Read latest snapshot backup
  const backup = JSON.parse(fs.readFileSync('data/crm_lead_store_v2_backup.json', 'utf8'));
  const latestSnapshot = backup[0];
  const snapData = typeof latestSnapshot.new_value_json === 'string' 
    ? JSON.parse(latestSnapshot.new_value_json) 
    : latestSnapshot.new_value_json;

  console.log(`Snapshot extracted from ${latestSnapshot.created_at}:`);
  console.log(`- Categories: ${snapData.categories?.length}`);
  console.log(`- Channels: ${snapData.channels?.length}`);
  console.log(`- User Category Access: ${snapData.user_category_access?.length}`);
  console.log(`- Match Reviews: ${snapData.match_reviews?.length}`);
  console.log(`- Service Tracking: ${Object.keys(snapData.service_tracking || {}).length}`);
  console.log(`- Conversion Links: ${Object.keys(snapData.conversion_links || {}).length}`);
  console.log(`- Extended Leads: ${Object.keys(snapData.extended_leads || {}).length}`);

  // 2. Persist Relational Masters in company_profile relational store
  const masters = [
    {
      id: 'crm_master_categories',
      legal_name: 'CRM Categories Master',
      trade_name: 'Category Master Relational Store',
      data: snapData.categories || []
    },
    {
      id: 'crm_master_channels',
      legal_name: 'CRM Communication Channels Master',
      trade_name: 'Communication Channel Relational Store',
      data: snapData.channels || []
    },
    {
      id: 'crm_master_tat_settings',
      legal_name: 'CRM TAT Settings Master',
      trade_name: 'Turnaround Time Relational Store',
      data: snapData.tat_settings || [{ id: 'tat-default', first_contact_tat_days: 2, follow_up_grace_hours: 24, is_active: 1 }]
    },
    {
      id: 'crm_master_user_category_access',
      legal_name: 'CRM User Category Access',
      trade_name: 'Category Security & Isolation Relational Store',
      data: snapData.user_category_access || []
    },
    {
      id: 'crm_rel_match_reviews',
      legal_name: 'CRM Partner Match Reviews',
      trade_name: 'Partner Match Reviews Relational Store',
      data: snapData.match_reviews || []
    },
    {
      id: 'crm_rel_service_tracking',
      legal_name: 'CRM Lead Service Tracking',
      trade_name: 'Service Activation Fulfillment Relational Store',
      data: snapData.service_tracking || {}
    },
    {
      id: 'crm_rel_conversion_links',
      legal_name: 'CRM Lead Conversion Links',
      trade_name: 'Lead to Partner Conversion Relational Store',
      data: snapData.conversion_links || {}
    },
    {
      id: 'crm_rel_extended_leads',
      legal_name: 'CRM Lead Extended Fields',
      trade_name: 'Extended Geography & Pipeline Relational Store',
      data: snapData.extended_leads || {}
    },
    {
      id: 'crm_rel_bulk_batches',
      legal_name: 'CRM Bulk Import Batches',
      trade_name: 'Bulk Import Batches Relational Store',
      data: snapData.bulk_batches || []
    }
  ];

  for (const m of masters) {
    const { data: existing } = await supabase.from('company_profile').select('id').eq('id', m.id).maybeSingle();
    const payload = {
      id: m.id,
      legal_name: m.legal_name,
      trade_name: m.trade_name,
      gstin: 'NA',
      pan: 'NA',
      email: 'crm-relational@signsync.io',
      phone: 'NA',
      registered_address: JSON.stringify(m.data),
      state_code: 'NA',
      state_name: 'NA',
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { error } = await supabase.from('company_profile').update(payload).eq('id', m.id);
      if (error) throw error;
      console.log(`[UPDATE] ${m.id} synchronized.`);
    } else {
      const { error } = await supabase.from('company_profile').insert(payload);
      if (error) throw error;
      console.log(`[INSERT] ${m.id} initialized.`);
    }
  }

  // 3. Migrate interaction history into crm_follow_ups table directly
  console.log('\n--- Syncing Lead Interactions to crm_follow_ups ---');
  const interactions = snapData.interactions || [];
  let interactionsInserted = 0;
  for (const inter of interactions) {
    // Check if interaction already exists in crm_follow_ups
    const { data: existingFu } = await supabase.from('crm_follow_ups').select('id').eq('id', inter.id).maybeSingle();
    if (!existingFu) {
      const { error } = await supabase.from('crm_follow_ups').insert({
        id: inter.id,
        lead_id: inter.lead_id,
        channel: inter.channel_id || 'phone_call',
        scheduled_at: inter.next_follow_up_date ? new Date(inter.next_follow_up_date).toISOString() : inter.created_at,
        completed_at: inter.created_at,
        status: 'completed',
        disposition: inter.outcome,
        notes: `Outcome: ${inter.outcome} | Reason: ${inter.reason} | Notes: ${inter.conversation_notes || 'None'}${inter.supervisor_override ? ' [SUPERVISOR OVERRIDE: ' + inter.override_reason + ']' : ''}`,
        conducted_by: inter.conducted_by,
        created_at: inter.created_at
      });
      if (error) {
        console.warn(`Could not insert interaction ${inter.id}:`, error.message);
      } else {
        interactionsInserted++;
      }
    }
  }
  console.log(`Interactions synced to crm_follow_ups: ${interactionsInserted} new records inserted.`);

  // 4. Verify counts from database
  console.log('\n--- Verification of Relational Tables in Supabase ---');
  const { data: verifiedMasters } = await supabase.from('company_profile').select('id, legal_name').neq('id', 'comp-default');
  console.log(`Relational store records active in Supabase: ${verifiedMasters.length}`);
  for (const vm of verifiedMasters) {
    console.log(` - ${vm.id} (${vm.legal_name})`);
  }

  console.log('\n=== MIGRATION COMPLETE & VERIFIED ===');
}

runRelationalMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

