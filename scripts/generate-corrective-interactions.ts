import { supabase } from '../src/server/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const { data: rows, error } = await supabase.from('crm_follow_ups').select('*');
  if (error || !rows) {
    console.error('Failed to read crm_follow_ups:', error);
    process.exit(1);
  }

  const channelMap: Record<string, string> = {
    'whatsapp': 'chan-whatsapp',
    'WhatsApp Business': 'chan-whatsapp',
    'chan-whatsapp': 'chan-whatsapp',
    'phone_call': 'chan-phone-call',
    'Phone Call': 'chan-phone-call',
    'chan-phone-call': 'chan-phone-call'
  };

  const recordsToInsert = [];
  for (const r of rows) {
    let conducted_by = r.conducted_by;
    if (!conducted_by && r.notes && r.notes.startsWith('usr-')) {
      conducted_by = r.notes.trim();
    }
    if (!conducted_by) conducted_by = 'usr-admin-root';

    const channel_id = channelMap[r.channel] || 'chan-phone-call';

    let outcome = 'Interested';
    let reason = 'Historical follow-up';
    let notes = r.notes || '';
    let supervisor_override = 0;
    let override_reason = null;

    if (r.disposition) {
      outcome = r.disposition;
      reason = r.notes || r.disposition;
    } else if (r.status && r.status !== 'completed' && r.status !== 'pending') {
      outcome = 'Interested';
      reason = r.status;
    } else if (r.notes) {
      reason = r.notes;
    }

    if (notes.includes('Outcome: ')) {
      const parts = notes.split(' | ');
      for (const p of parts) {
        if (p.startsWith('Outcome: ')) outcome = p.replace('Outcome: ', '').trim();
        if (p.startsWith('Reason: ')) reason = p.replace('Reason: ', '').trim();
        if (p.startsWith('Notes: ')) {
          const notePart = p.replace('Notes: ', '');
          if (notePart.includes('[SUPERVISOR OVERRIDE:')) {
            const sub = notePart.split('[SUPERVISOR OVERRIDE:');
            notes = sub[0].trim();
            supervisor_override = 1;
            override_reason = sub[1].replace(']', '').trim();
          } else {
            notes = notePart.trim();
          }
        }
      }
    }

    recordsToInsert.push({
      id: r.id,
      lead_id: r.lead_id,
      conducted_by,
      channel_id,
      outcome,
      reason,
      conversation_notes: notes === conducted_by ? null : notes,
      next_follow_up_date: r.scheduled_at ? r.scheduled_at.split('T')[0] : null,
      supervisor_override,
      override_reason,
      created_at: r.created_at
    });
  }

  let sql = '-- ==========================================================================\n';
  sql += '-- SIGNSYNC LEAD MANAGEMENT V2.0: CORRECTIVE INTERACTIONS MIGRATION\n';
  sql += '-- Source: crm_follow_ups (36 historical records)\n';
  sql += '-- Destination: crm_lead_interactions\n';
  sql += '-- ==========================================================================\n\n';
  sql += 'INSERT INTO public.crm_lead_interactions (\n';
  sql += '  id, lead_id, conducted_by, channel_id, outcome, reason, conversation_notes, next_follow_up_date, supervisor_override, override_reason, created_at\n';
  sql += ') VALUES\n';

  const esc = (str: string | null | undefined) => (str === null || str === undefined) ? 'NULL' : `'${String(str).replace(/'/g, "''")}'`;
  const escDate = (d: string | null) => d ? `'${d}'::date` : 'NULL';
  const escTs = (ts: string | null) => ts ? `'${ts}'::timestamptz` : 'now()';

  const valStrings = recordsToInsert.map(rec => {
    return '  (' + [
      esc(rec.id),
      esc(rec.lead_id),
      esc(rec.conducted_by),
      esc(rec.channel_id),
      esc(rec.outcome),
      esc(rec.reason),
      esc(rec.conversation_notes),
      escDate(rec.next_follow_up_date),
      rec.supervisor_override,
      esc(rec.override_reason),
      escTs(rec.created_at)
    ].join(', ') + ')';
  });

  sql += valStrings.join(',\n') + '\nON CONFLICT (id) DO NOTHING;\n';

  const outPath = path.join(process.cwd(), 'supabase', 'CORRECTIVE_INTERACTIONS_MIGRATION.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('SUCCESS: Written', outPath, 'with', recordsToInsert.length, 'records');
}

main().catch(console.error);

