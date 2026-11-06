# SignSync Lead Management Module — v1.0 to v2.0 Gap Analysis & Requirements Matrix

**Document Reference**: SignSync B2B Enterprise Platform — Lead Management Specification v2.0 (Expanded)  
**Target Environment**: Supabase PostgreSQL (`kbqwsfmfiomcakbhclca`) & Next.js/Express  
**Execution Date**: 2026-11-06  
**Status**: ACTIVE IMPLEMENTATION IN PROGRESS  

---

## 1. Functional Scope Reconciliation (v1.0 Baseline vs v2.0 Expanded)

| Requirement ID | Specification Ref | Requirement Description | v1.0 Status | v2.0 Expanded Scope | Change Needed | Implemented File | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LM-01 to 05** | §3.1 / §10 | Dynamic Masters (Source, Category, Channels, TAT) | In local store | Authoritative Cloud Source of Truth in Supabase PostgreSQL | Persist to Supabase with automatic backup & restore sync | `src/server/leadStore.ts`, `src/server/routes/leadManagement.ts` | ACTIVE |
| **LM-06, 07, 29, 30** | §3.2 / §10.1 | Flexible Lead Intake & Structured Geography | Supported | Add City/Town, structured Postal Code, retain Address/State/District; all fields strictly optional | Add City field, normalize Postal Code, keep non-blocking | `src/components/AddLeadModal.tsx`, `src/server/routes/api.ts` | ACTIVE |
| **LM-31** | §10.1 | Remove GSTIN from Lead Intake | Previously retained | Explicitly remove GSTIN from Lead Create/Edit UI & bulk templates | Remove GSTIN input from UI while preserving DB compatibility | `src/components/AddLeadModal.tsx` | ACTIVE |
| **LM-08 to 14** | §3.3 / §10.2 | Multi-Factor Partner Matching & Call Block | Verified | Extend partner matching to Bulk Import pipeline | Integrate partner matching preview into batch upload | `src/server/partnerMatchEngine.ts`, `src/server/routes/leadManagement.ts` | ACTIVE |
| **LM-33 to 38** | §10.2 | Bulk Excel & CSV Import with Preview & Deduplication | Missing in v1 | CSV & Excel template download, file upload, column mapping, row preview, partner match warnings, idempotency | New bulk import endpoints & modal UI | `src/server/routes/leadManagement.ts`, `src/app/crm/leads/page.tsx` | PENDING_TEST |
| **LM-39** | §10.3 | Lead Assignment & Routing | Basic category filter | Assign to executive, reassign, workload view, audit trail | Assignment endpoints & supervisor reallocation modal | `src/server/routes/leadManagement.ts` | PENDING_TEST |
| **LM-40, 41** | §10.3 | Follow-Up Action Center & KPIs | Basic queue | Add Total Leads, New, Due Today, Overdue, Conversion Rate, Unassigned; executive queue | Comprehensive metrics & urgency dashboard | `src/app/crm/calling-queue/page.tsx` | PENDING_TEST |
| **LM-42** | §10.3 | CRM Pipeline Status Taxonomy | `new/contacted` | Pipeline statuses: NEW, CONTACTED, FOLLOW_UP_SCHEDULED, QUALIFIED, PROPOSAL_SENT, WON, LOST | Distinct pipeline state separate from partner conversion | `src/server/routes/leadManagement.ts` | PENDING_TEST |
| **LM-43, 44** | §10.3 | Lead Detail 2-Panel Workspace & Interactions | Follow-up modal | 2-panel lead view: Left (identity/category/services), Right (chronological timeline/record interaction) | Responsive 2-panel detail screen / modal | `src/app/crm/leads/[id]/page.tsx` | PENDING_TEST |
| **LM-25 to 28** | §3.6 / §11 | Partner Conversion & Dual Service Lifecycle | Verified | 1-click prefilled conversion, independent Token & DSC fulfillment retention | Retained from v1 with direct links & idempotency safeguards | `src/server/routes/leadManagement.ts` | VERIFIED |

