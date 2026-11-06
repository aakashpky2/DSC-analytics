-- ============================================================================
-- SignSync B2B Enterprise Platform: CONSOLIDATED SCHEMA MIGRATION (CORRECTED)
-- Migration File: FINAL_LEAD_V2_SCHEMA.sql
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Scope: Complete Lead Management v2.0 Specification Baseline & Data Integrity
-- Safety: IDEMPOTENT (IF NOT EXISTS), NON-DESTRUCTIVE
-- Dependencies: public.user_profiles, public.partners, public.crm_leads
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Correct Legacy NOT NULL Constraints on crm_leads (LM-06 All Fields Optional)
-- ============================================================================
-- The v2.0 specification strictly mandates that lead intake fields (company_name,
-- contact_person, email, phone) can be created with partial or single identifiers
-- (e.g. mobile-only, email-only, or walk-in inquiries).
-- We safely drop NOT NULL constraints without altering existing values.

ALTER TABLE public.crm_leads ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE public.crm_leads ALTER COLUMN contact_person DROP NOT NULL;
ALTER TABLE public.crm_leads ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.crm_leads ALTER COLUMN phone DROP NOT NULL;

-- ============================================================================
-- 2. Extend crm_leads with v2.0 Relational Attributes & Value Constraints
-- ============================================================================
ALTER TABLE public.crm_leads 
  ADD COLUMN IF NOT EXISTS alternate_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS category_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS pipeline_status VARCHAR(32) DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS service_intent VARCHAR(32) DEFAULT 'Undecided',
  ADD COLUMN IF NOT EXISTS match_status VARCHAR(32) DEFAULT 'NO_MATCH',
  ADD COLUMN IF NOT EXISTS linked_partner_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS partner_match_score NUMERIC(5,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS partner_match_factors TEXT;

-- Value check constraints on crm_leads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leads_pipeline_status') THEN
    ALTER TABLE public.crm_leads ADD CONSTRAINT chk_leads_pipeline_status 
      CHECK (pipeline_status IN ('NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leads_service_intent') THEN
    ALTER TABLE public.crm_leads ADD CONSTRAINT chk_leads_service_intent 
      CHECK (service_intent IN ('Token', 'DSC', 'Both', 'Undecided'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_leads_match_status') THEN
    ALTER TABLE public.crm_leads ADD CONSTRAINT chk_leads_match_status 
      CHECK (match_status IN ('NO_MATCH', 'NAME_REVIEW', 'CONTACT_REVIEW', 'CONFIRMED_PARTNER', 'MERGED_TO_PARTNER'));
  END IF;
END $$;

-- Dedicated indexes for query performance and rapid filtering
CREATE INDEX IF NOT EXISTS idx_crm_leads_category ON public.crm_leads(category_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON public.crm_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipeline_status ON public.crm_leads(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_match_status ON public.crm_leads(match_status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON public.crm_leads(email);

-- ============================================================================
-- 3. Dynamic Lead Categories Master (LM-02)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_categories (
  id VARCHAR(64) PRIMARY KEY,
  category_name VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed standard baseline categories
INSERT INTO public.crm_lead_categories (id, category_name, description, is_active)
VALUES 
  ('cat-ca-advocates', 'Chartered Accountants & Advocates', 'Legal and financial professionals issuing business DSCs', 1),
  ('cat-tax-practitioners', 'Tax Practitioners & GST Consultants', 'Consultants filing returns and company formations', 1),
  ('cat-enterprises', 'Corporate & Enterprise Clients', 'Direct enterprise accounts requiring volume tokens & signing', 1),
  ('cat-retail-partners', 'Retail Tech & DSC Vendors', 'Retail counter partners reselling token and DSC services', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Dynamic Communication Channels Master (LM-03)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_communication_channels (
  id VARCHAR(64) PRIMARY KEY,
  channel_name VARCHAR(64) NOT NULL UNIQUE,
  channel_icon VARCHAR(32) DEFAULT 'Phone',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed standard communication channels
INSERT INTO public.crm_communication_channels (id, channel_name, channel_icon, is_active)
VALUES
  ('chan-phone-call', 'Phone Call', 'Phone', 1),
  ('chan-whatsapp', 'WhatsApp Business', 'MessageSquare', 1),
  ('chan-email', 'Official Email', 'Mail', 1),
  ('chan-in-person', 'In-Person Meeting', 'Users', 1),
  ('chan-video-meet', 'Video Conference', 'Video', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. Turnaround Time (TAT) Settings Master (LM-04)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_tat_settings (
  id VARCHAR(64) PRIMARY KEY,
  first_contact_tat_days INTEGER NOT NULL DEFAULT 2,
  follow_up_grace_hours INTEGER NOT NULL DEFAULT 24,
  is_active INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.crm_tat_settings (id, first_contact_tat_days, follow_up_grace_hours, is_active)
VALUES ('tat-default', 2, 24, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. User-to-Category Access & Scope Isolation (LM-05, LM-16)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_user_category_access (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id VARCHAR(64) NOT NULL REFERENCES public.crm_lead_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_category_user ON public.crm_user_category_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_category_cat ON public.crm_user_category_access(category_id);

-- ============================================================================
-- 7. Normalized Partner Contact Methods (LM-08, LM-09, LM-10)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_contact_methods (
  id VARCHAR(64) PRIMARY KEY,
  partner_id VARCHAR(64) NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_type VARCHAR(32) NOT NULL, -- 'MOBILE', 'LANDLINE', 'EMAIL', 'ALTERNATE_PHONE'
  contact_value VARCHAR(255) NOT NULL,
  normalized_value VARCHAR(255) NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_partner_contact_normalized ON public.partner_contact_methods(normalized_value);
CREATE INDEX IF NOT EXISTS idx_partner_contact_partner ON public.partner_contact_methods(partner_id);

-- ============================================================================
-- 8. Partner Match Reviews & Human Clubbing Table (LM-11, LM-12)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_partner_match_reviews (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  partner_id VARCHAR(64) NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  match_type VARCHAR(32) NOT NULL,
  match_details JSONB,
  resolution_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by VARCHAR(64) REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_match_reviews_lead ON public.crm_partner_match_reviews(lead_id);
CREATE INDEX IF NOT EXISTS idx_match_reviews_partner ON public.crm_partner_match_reviews(partner_id);
CREATE INDEX IF NOT EXISTS idx_match_reviews_status ON public.crm_partner_match_reviews(resolution_status);

-- ============================================================================
-- 9. Immutable Lead Interactions (LM-18 to LM-24)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_interactions (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  conducted_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  channel_id VARCHAR(64) NOT NULL REFERENCES public.crm_communication_channels(id),
  outcome VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  conversation_notes TEXT,
  next_follow_up_date TIMESTAMPTZ, -- Date AND Time support
  supervisor_override INTEGER DEFAULT 0,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON public.crm_lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_actor ON public.crm_lead_interactions(conducted_by);

-- ============================================================================
-- 10. Lead Service Activation Tracking (LM-26, LM-27)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_service_tracking (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  service_intent VARCHAR(32) NOT NULL DEFAULT 'Undecided' CHECK (service_intent IN ('Token', 'DSC', 'Both', 'Undecided')),
  token_requested INTEGER NOT NULL DEFAULT 0,
  token_fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (token_fulfilled IN (0, 1)),
  token_fulfilled_at TIMESTAMPTZ,
  token_batch_id VARCHAR(64),
  dsc_requested INTEGER NOT NULL DEFAULT 0,
  dsc_fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (dsc_fulfilled IN (0, 1)),
  dsc_fulfilled_at TIMESTAMPTZ,
  dsc_application_id VARCHAR(64),
  tracking_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_QUALIFICATION' CHECK (tracking_status IN ('PENDING_QUALIFICATION', 'ACTIVE_OUTREACH', 'TOKEN_PENDING', 'DSC_PENDING', 'BOTH_PENDING', 'FULFILLED', 'CLOSED')),
  last_updated_by VARCHAR(64) REFERENCES public.user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_service_tracking_lead ON public.crm_lead_service_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_service_tracking_status ON public.crm_lead_service_tracking(tracking_status);

-- ============================================================================
-- 11. Lead-to-Partner Conversion Links & Idempotency Safeguards (LM-25, LM-28)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_conversion_links (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.crm_leads(id) ON DELETE RESTRICT,
  partner_id VARCHAR(64) NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  converted_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  conversion_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  prefilled_data JSONB,
  audit_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversion_links_lead ON public.crm_lead_conversion_links(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversion_links_partner ON public.crm_lead_conversion_links(partner_id);

-- ============================================================================
-- 12. Bulk Import Batches & Import Row Results (LM-33 to LM-38)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_bulk_import_batches (
  id VARCHAR(64) PRIMARY KEY,
  uploaded_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  file_name VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  matched_partner_rows INTEGER NOT NULL DEFAULT 0,
  committed_rows INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bulk_import_uploader ON public.crm_bulk_import_batches(uploaded_by);

-- Granular Row-Level Import Log Table
CREATE TABLE IF NOT EXISTS public.crm_bulk_import_row_results (
  id VARCHAR(64) PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL REFERENCES public.crm_bulk_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  company_name VARCHAR(255),
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  validation_status VARCHAR(32) NOT NULL, -- 'VALID', 'DUPLICATE', 'PARTNER_MATCH', 'ERROR'
  created_lead_id VARCHAR(64) REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bulk_import_rows_batch ON public.crm_bulk_import_row_results(batch_id);

-- ============================================================================
-- 13. Lead Assignment History Audit Trail (LM-39)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_assignment_history (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  assigned_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  assigned_to VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assignment_history_lead ON public.crm_lead_assignment_history(lead_id);

COMMIT;
