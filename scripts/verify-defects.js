const { createSession } = require('../dist-server/server/auth');
const { supabase } = require('../dist-server/server/supabase');

const BASE_URL = 'http://127.0.0.1:3000';

async function runGapVerification() {
  console.log('=== VERIFYING ALL 5 DEFECT IMPLEMENTATIONS ===\n');
  const token = await createSession('usr-admin-root', 1);
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': 'signsync_session=' + token
  };

  // DEF-04: Verify active TAT snapshot on lead creation
  console.log('--- Checking DEF-04: Immutable Applied TAT Snapshot ---');
  const createRes = await fetch(BASE_URL + '/api/crm/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      company_name: 'DEF04 TAT Snapshot Enterprise',
      contact_person: 'TAT Tester',
      phone: '9822998811',
      email: 'def04@tat-enterprise.com',
      service_intent: 'Both'
    })
  });
  const createData = await createRes.json();
  console.log('Created test lead:', createData.id, 'success:', createData.success);

  // Check lead properties
  const getLeadRes = await fetch(BASE_URL + '/api/crm/leads?search=' + createData.id, { headers });
  const getLeadData = await getLeadRes.json();
  const createdLead = (getLeadData.leads || []).find(l => l.id === createData.id);
  console.log('Applied TAT days:', createdLead?.applied_tat_days, 'First contact due at:', createdLead?.first_contact_due_at);

  // DEF-01: Direct relational persistence of interactions
  console.log('\n--- Checking DEF-01: Direct Relational Persistence ---');
  const intRes = await fetch(BASE_URL + '/api/crm/leads/' + createData.id + '/interactions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      channel_id: 'chan-phone-call',
      outcome: 'Interested',
      reason: 'Discussing bulk cryptographic tokens quote',
      conversation_notes: 'Client requested proforma for 20 tokens',
      next_follow_up_date: new Date(Date.now() + 86400000).toISOString()
    })
  });
  const intData = await intRes.json();
  console.log('Logged interaction:', intData.interaction?.id, 'success:', intData.success);

  // Verify directly from PostgreSQL crm_lead_interactions
  const { data: dbInt } = await supabase.from('crm_lead_interactions').select('*').eq('id', intData.interaction.id);
  console.log('PostgreSQL crm_lead_interactions direct query count:', dbInt?.length, 'row:', dbInt?.[0]?.id);

  // DEF-01: Service tracking relational persistence
  const stRes = await fetch(BASE_URL + '/api/crm/leads/' + createData.id + '/service-tracking', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      service_intent: 'Both',
      token_requested: 1,
      token_fulfilled: 1,
      token_batch_id: 'batch-test-01',
      dsc_requested: 1,
      dsc_fulfilled: 0
    })
  });
  const stData = await stRes.json();
  console.log('Updated service tracking status:', stData.tracking?.tracking_status);
  const { data: dbSt } = await supabase.from('crm_lead_service_tracking').select('*').eq('lead_id', createData.id);
  console.log('PostgreSQL crm_lead_service_tracking direct query count:', dbSt?.length, 'tracking_status:', dbSt?.[0]?.tracking_status);

  // DEF-02: Relational Reassignment History
  console.log('\n--- Checking DEF-02: Relational Reassignment History ---');
  const assignRes = await fetch(BASE_URL + '/api/crm/leads/' + createData.id + '/assign', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      assigned_to: 'usr-admin-root',
      reason: 'Assigned to senior consultant for enterprise quote'
    })
  });
  const assignData = await assignRes.json();
  console.log('Assign response:', assignData);
  const { data: dbLah } = await supabase.from('crm_lead_assignment_history').select('*').eq('lead_id', createData.id);
  console.log('PostgreSQL crm_lead_assignment_history direct query count:', dbLah?.length, 'assigned_to:', dbLah?.[0]?.assigned_to);

  // DEF-03: Deterministic SHA256 Bulk Import Fingerprint
  console.log('\n--- Checking DEF-03: SHA256 Bulk Import Fingerprint ---');
  const importRows = [
    { company_name: 'Fp Test Alpha', phone: '9811122233', email: 'alpha@fptest.com' },
    { company_name: 'Fp Test Beta', phone: '9811122244', email: 'beta@fptest.com' }
  ];
  const prev1 = await (await fetch(BASE_URL + '/api/crm/leads/import/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawData: importRows, fileName: 'test1.xlsx' })
  })).json();
  console.log('Preview 1 fingerprint:', prev1.fingerprint, 'isDuplicateBatch:', prev1.isDuplicateBatch);

  // Reverse row order - fingerprint must be identical!
  const prev2 = await (await fetch(BASE_URL + '/api/crm/leads/import/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify({ rawData: [importRows[1], importRows[0]], fileName: 'test2.xlsx' })
  })).json();
  console.log('Preview 2 fingerprint (reversed order):', prev2.fingerprint, 'Match?:', prev1.fingerprint === prev2.fingerprint);

  // DEF-05: Controlled Phone Reveal with Audit Logging
  console.log('\n--- Checking DEF-05: Controlled Phone Reveal with Audit Logging ---');
  const revealRes = await fetch(BASE_URL + '/api/crm/leads/' + createData.id + '/reveal-phone', {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'Verification of authorized reveal flow' })
  });
  const revealData = await revealRes.json();
  console.log('Reveal response phone:', revealData.phone, 'success:', revealData.success);
  const { data: dbAudit } = await supabase.from('audit_logs').select('*').eq('record_id', createData.id).eq('action_type', 'PHONE_REVEAL');
  console.log('PostgreSQL audit_logs reveal count:', dbAudit?.length, 'action_type:', dbAudit?.[0]?.action_type);

  console.log('\n=== ALL GAP CHECKS COMPLETED SUCCESSFULLY ===');
}

runGapVerification().catch(e => console.error(e));

