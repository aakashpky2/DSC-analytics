# SignSync Lead Management v2.0 - Known Limitations & Safeguards

## 1. Supabase PostgreSQL Schema Sync
- The current Supabase PostgreSQL instance (`kbqwsfmfiomcakbhclca`) contains a standard `crm_leads` table schema.
- In instances where custom expanded fields (such as `pipeline_status`, `assignment_history`, or `service_intent`) are not yet added via DDL migrations to the primary table columns, the system automatically persists them into the Supabase cloud audit log state store (`crm_lead_store_v2`) on each change.
- **Recommendation for Future DB Migration**: Apply standard DDL alterations on Supabase:
  ```sql
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS city text;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS pin_code text;
  ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'NEW';
  ```

## 2. Bulk Upload Limits
- Bulk ingestion is optimized for spreadsheets up to 5,000 rows. Files exceeding 10,000 rows should be split into smaller batches to prevent HTTP gateway timeout on Hostinger reverse proxies.

## 3. Mandatory Outcome Rules on Calling Queue
- Calls logged on active leads require a valid outcome reason and next follow-up date for ongoing statuses (`INTERESTED`, `PARTIALLY_INTERESTED`).
- Leads matched with existing partners will have outgoing calls blocked by default unless overridden by an authorized supervisor.
