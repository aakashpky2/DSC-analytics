# SignSync Lead Management v2.0 — Missing or Incorrect Logic Report

**Audit Date:** 06 November 2026  
**Auditor Standard:** Strict Manager Specification Compliance  
**Rule:** Only verified gaps and divergent logic are listed here.

---

## 1. Defect & Gap Classification Summary

| Issue ID | Priority | Requirement | Summary of Finding | Location in Code | Impact |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **DEF-01** | **P1** | Relational Write Path | Live mutations currently update `leadStore.ts` and sync debounced JSON snapshots into `company_profile` rather than executing direct SQL `INSERT/UPDATE` into the dedicated PostgreSQL relational tables (`crm_lead_service_tracking`, `crm_partner_match_reviews`, `crm_lead_conversion_links`). | `src/server/leadStore.ts`<br>(lines 407–436) | Relational tables exist and are populated, but subsequent runtime writes do not immediately insert relational rows. |
| **DEF-02** | **P1** | Direct SQL on Reassignment | Executive reassignment via `PATCH /crm/leads/:id/assign` logs history into `extended_leads.assignment_history` JSON array instead of directly executing an `INSERT INTO crm_lead_assignment_history`. | `src/server/routes/leadManagement.ts` | The dedicated PostgreSQL table `crm_lead_assignment_history` currently holds 1 audit record and is bypassed for subsequent reassignments. |
| **DEF-03** | **P2** | Bulk Batch Fingerprint Hashing | Duplicate file upload protection in `POST /crm/leads/import/preview` checks filename and row values, but lacks an explicit SHA256 batch checksum stored in `crm_bulk_import_batches.batch_fingerprint`. | `src/server/routes/leadManagement.ts` | Renaming an identical spreadsheet allows it to be re-analyzed without triggering an automatic idempotency warning. |
| **DEF-04** | **P2** | Applied TAT Snapshotting | When Calling TAT changes in `crm_tat_settings`, active overdue calculations dynamically apply the newest TAT to all active leads rather than freezing the SLA agreed upon at lead creation time. | `src/server/routes/leadManagement.ts`<br>(line 521) | Existing leads within their original 2-day TAT window inherit a 3-day window immediately upon admin settings update. |
| **DEF-05** | **P2** | Mobile PII Masking Granularity | Full PII masking is applied based on role tier, but tele-callers cannot view masked phone numbers in a one-click reveal mode with documented audit logging. | `src/server/routes/api.ts`<br>(lines 1653, 1971) | Field staff must request supervisor escalation rather than using timed reveal permissions. |

---

## 2. Detailed Findings

### DEF-01: Direct Write Path to Dedicated Relational Tables
- **Specification:** The relational database (PostgreSQL) must be the authoritative source of truth, not serialized JSON in `company_profile`.
- **Actual Behavior:** 
  The schema and data migrations were successfully executed into PostgreSQL (`crm_lead_service_tracking`, `crm_lead_conversion_links`, `crm_partner_match_reviews`, `crm_lead_interactions`).
  However, in `src/server/leadStore.ts`:
  ```typescript
  async function persistToSupabaseRelational(store: LeadManagementStore): Promise<void> {
    // Updates company_profile.registered_address JSON
  }
  ```
  New records added through operational APIs update the in-memory cache and `company_profile` JSON rather than emitting direct Supabase PostgREST `INSERT` calls against the dedicated tables.
- **Recommended Action:** Update `saveLeadStore` or route handlers to directly write to `supabase.from('crm_lead_service_tracking').upsert(...)`.

---

### DEF-02: Direct Relational Reassignment History Logging
- **Specification:** `LM-39` requires individual assignments to log an audit trail into `crm_lead_assignment_history`.
- **Actual Behavior:**
  The table `crm_lead_assignment_history` exists in PostgreSQL with 1 row, but the reassignment route handler appends the audit object into `ext.assignment_history` inside `store.extended_leads`.
- **Recommended Action:** Add `supabase.from('crm_lead_assignment_history').insert(...)` in the reassignment route.

