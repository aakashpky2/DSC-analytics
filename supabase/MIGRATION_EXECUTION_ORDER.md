# SignSync Lead Management v2.0: Migration Execution Order & Guide

This runbook outlines the exact sequence to execute the production-safe migration package in the Supabase PostgreSQL Dashboard SQL Editor (`https://supabase.com/dashboard/project/kbqwsfmfiomcakbhclca/sql`).

---

## 1. Migration Package Inventory

All deliverables are available under `c:\acoundz\dsc analytics\supabase\`:

1. `PRE_MIGRATION_CHECK.sql`: Read-only diagnostics verifying table counts, column nullability, and staged data.
2. `FINAL_LEAD_V2_SCHEMA.sql`: Consolidated idempotent schema creating 11 dedicated tables, adding v2.0 columns to `crm_leads`, creating performance indexes, and dropping legacy NOT NULL constraints on optional contact fields.
3. `FINAL_LEAD_V2_DATA_MIGRATION.sql`: Repeat-safe data migration hydrating the dedicated tables from `company_profile` staged entities, linking relationships, and cleaning up temporary entries.
4. `POST_MIGRATION_CHECK.sql`: Verification diagnostics confirming table existence, column nullabilities, foreign keys, and migrated record counts.
5. `ROLLBACK_AND_RECOVERY.md`: Comprehensive rollback SQL script and procedures using pre-migration backups.

---

## 2. Step-by-Step Execution Sequence

### Phase 1: Pre-Migration Diagnostics (Read-Only)
1. Open the Supabase Dashboard: `https://supabase.com/dashboard/project/kbqwsfmfiomcakbhclca/sql`.
2. Paste and run the contents of [`supabase/PRE_MIGRATION_CHECK.sql`](file:///c:/acoundz/dsc%20analytics/supabase/PRE_MIGRATION_CHECK.sql).
3. Review the outputs:
   - Confirm `crm_leads` row count matches ~125.
   - Confirm `company_name`, `contact_person`, `email`, and `phone` currently show `is_nullable: NO`.
   - Confirm the 9 staged rows exist in `company_profile`.

### Phase 2: Schema Migration
1. In the Supabase SQL Editor, paste and run [`supabase/FINAL_LEAD_V2_SCHEMA.sql`](file:///c:/acoundz/dsc%20analytics/supabase/FINAL_LEAD_V2_SCHEMA.sql).
2. The transaction will:
   - Make `company_name`, `contact_person`, `email`, and `phone` nullable (`DROP NOT NULL`).
   - Add all 14 v2.0 columns to `crm_leads`.
   - Create 11 dedicated tables with foreign keys and performance indexes.
   - Seed baseline categories, communication channels, and TAT settings.
3. Confirm execution returns `Success. No rows returned`.

### Phase 3: Data Migration & Hydration
1. In the Supabase SQL Editor, paste and run [`supabase/FINAL_LEAD_V2_DATA_MIGRATION.sql`](file:///c:/acoundz/dsc%20analytics/supabase/FINAL_LEAD_V2_DATA_MIGRATION.sql).
2. The transaction will:
   - Hydrate `crm_lead_categories` (11 categories).
   - Hydrate `crm_communication_channels` (12 channels).
   - Hydrate `crm_tat_settings` (1 configured TAT rule).
   - Hydrate `crm_user_category_access` (2 access mappings).
   - Backfill `city`, `pin_code`, `pipeline_status`, etc. on existing `crm_leads` rows.
   - Hydrate `crm_lead_service_tracking` (90 lead service tracking rows).
   - Hydrate `crm_lead_conversion_links` (7 idempotency links).
   - Hydrate `crm_partner_match_reviews` (32 match reviews).
   - Remove the staged metadata records from `company_profile` while leaving `comp-default` intact.
3. Confirm execution returns `Success. No rows returned`.

### Phase 4: Post-Migration Diagnostics
1. Paste and run [`supabase/POST_MIGRATION_CHECK.sql`](file:///c:/acoundz/dsc%20analytics/supabase/POST_MIGRATION_CHECK.sql).
2. Verify:
   - All 11 dedicated tables return `status: EXISTS`.
   - `crm_leads` columns show `is_nullable: YES` for intake fields.
   - `crm_lead_categories` has count >= 11.
   - `crm_communication_channels` has count >= 12.
   - `crm_lead_service_tracking` has count >= 90.
   - `company_profile` contains only `comp-default`.

---

## 3. Backward Compatibility Safeguards

- **Zero Breaking Changes**: Existing APIs continue to work seamlessly during and after migration.
- **Null Safety**: All newly added columns default to `NULL` or neutral defaults (`pipeline_status = 'NEW'`, `service_intent = 'Undecided'`).
- **Core Platform Protection**: Neither `partners`, `invoices`, `user_profiles`, nor `audit_logs` are altered in a way that impacts other platform modules.
- **Git & Deployment Isolation**: No Git commits have been pushed and no production deployments have been triggered.

