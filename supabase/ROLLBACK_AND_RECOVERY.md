# SignSync Lead Management v2.0: Rollback and Recovery Procedure

This document provides step-by-step instructions to restore the database and application to its exact pre-migration state if any anomaly occurs during or after migration execution.

---

## 1. Verified Pre-Migration Backups Location

All existing production records were extracted and archived before migration preparation:
1. `data/crm_leads_backup.json` (110 records)
2. `data/crm_follow_ups_backup.json` (22 records)
3. `data/crm_lead_sources_backup.json` (15 records)
4. `data/crm_lead_store_v2_backup.json` (21 audit snapshot states)
5. `data/lead_management_store.json` (Authoritative local operational state)

---

## 2. Fast Rollback via SQL (Within Supabase SQL Editor)

If you need to rollback the dedicated schema without affecting existing core platform tables:

```sql
BEGIN;

-- 1. Restore company_profile staged metadata if deleted
-- (Only required if FINAL_LEAD_V2_DATA_MIGRATION.sql completed Step 9)
-- You can run `node scripts/run-lead-relational-migration.js` from the server to re-stage.

-- 2. Drop newly created Lead Management v2.0 tables safely
DROP TABLE IF EXISTS public.crm_lead_assignment_history CASCADE;
DROP TABLE IF EXISTS public.crm_bulk_import_batches CASCADE;
DROP TABLE IF EXISTS public.crm_lead_conversion_links CASCADE;
DROP TABLE IF EXISTS public.crm_lead_service_tracking CASCADE;
DROP TABLE IF EXISTS public.crm_lead_interactions CASCADE;
DROP TABLE IF EXISTS public.crm_partner_match_reviews CASCADE;
DROP TABLE IF EXISTS public.partner_contact_methods CASCADE;
DROP TABLE IF EXISTS public.crm_user_category_access CASCADE;
DROP TABLE IF EXISTS public.crm_tat_settings CASCADE;
DROP TABLE IF EXISTS public.crm_communication_channels CASCADE;
DROP TABLE IF EXISTS public.crm_lead_categories CASCADE;

-- 3. (Optional) Remove extended columns from crm_leads if strict revert is desired
-- Note: Leaving these columns does NOT break the application.
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS alternate_name;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS city;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS state;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS district;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS address;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS pin_code;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS source_id;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS pipeline_status;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS service_intent;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS match_status;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS linked_partner_id;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS partner_match_score;
-- ALTER TABLE public.crm_leads DROP COLUMN IF EXISTS partner_match_factors;

COMMIT;
```

---

## 3. Restoring Staged Configuration in company_profile

If dedicated tables are rolled back, run the existing node script:
```bash
node scripts/run-lead-relational-migration.js
```
This restores all 9 operational categories and services back into `company_profile` so the application continues to run without interruption.

---

## 4. Emergency Core Data Restoration Script

If any core records in `crm_leads`, `crm_follow_ups`, or `crm_lead_sources` need to be restored from pre-migration JSON backups:

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function restore() {
  const leads = JSON.parse(fs.readFileSync('data/crm_leads_backup.json'));
  for (const l of leads) {
    await supabase.from('crm_leads').upsert(l);
  }
  console.log('Restored ' + leads.length + ' leads');
}
restore();
"
```

