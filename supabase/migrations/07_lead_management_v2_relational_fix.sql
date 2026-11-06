-- ============================================================================
-- SignSync B2B Enterprise Platform — Lead Management v2.0 Corrective Schema Migration (07)
-- Target: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   Durable relational schema for SignSync Lead Management v2.0.
--   Replaces non-relational snapshot persistence with fully relational, indexed tables.
-- Safe and idempotent: preserves all existing data and tables.
-- ============================================================================

-- 1. Dynamic Lead Categories Master
CREATE TABLE IF NOT EXISTS public.crm_lead_categories (
  id VARCHAR(64) PRIMARY KEY,
  category_name VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default categories if empty
INSERT INTO public.crm_lead_categories (id, category_name, description, is_active)
VALUES 
  ('cat-ca-advocates', 'Chartered Accountants & Advocates', 'Legal and financial professionals issuing business DSCs', 1),
  ('cat-tax-practitioners', 'Tax Practitioners & GST Consultants', 'Consultants filing returns and company formations', 1),
  ('cat-enterprises', 'Corporate & Enterprise Clients', 'Direct enterprise accounts requiring volume tokens & signing', 1),
  ('cat-retail-partners', 'Retail Tech & DSC Vendors', 'Retail counter partners reselling token and DSC services', 1)
ON CONFLICT (id) DO NOTHING;

-- 2. Dynamic Communication Channels Master
CREATE TABLE IF NOT EXISTS public.crm_communication_channels (
  id VARCHAR(64) PRIMARY KEY,
  channel_name VARCHAR(64) NOT NULL UNIQUE,
  channel_icon VARCHAR(32) DEFAULT 'Phone',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default communication channels
INSERT INTO public.crm_communication_channels (id, channel_name, channel_icon, is_active)
VALUES
  ('chan-phone-call', 'Phone Call', 'Phone', 1),
  ('chan-whatsapp', 'WhatsApp Business', 'MessageSquare', 1),
  ('chan-email', 'Official Email', 'Mail', 1),
  ('chan-in-person', 'In-Person Meeting', 'Users', 1),
  ('chan-video-meet', 'Video Conference', 'Video', 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Dynamic TAT Settings Master
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

-- 4. User-to-Category Access Mapping
CREATE TABLE IF NOT EXISTS public.crm_user_category_access (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category_id VARCHAR(64) NOT NULL REFERENCES public.crm_lead_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, category_id)
);

-- 5. Extend crm_leads table with all v2.0 relational attributes
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

-- 6. Normalized Partner Contact Methods
CREATE TABLE IF NOT EXISTS public.partner_contact_methods (
  id VARCHAR(64) PRIMARY KEY,
  partner_id VARCHAR(64) NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  contact_type VARCHAR(32) NOT NULL,
  contact_value VARCHAR(255) NOT NULL,
  normalized_value VARCHAR(255) NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_partner_contact_normalized ON public.partner_contact_methods(normalized_value);

-- 7. Partner Match Reviews
CREATE TABLE IF NOT EXISTS public.crm_partner_match_reviews (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
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

-- 8. Immutable Lead Interactions
CREATE TABLE IF NOT EXISTS public.crm_lead_interactions (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  conducted_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  channel_id VARCHAR(64) NOT NULL REFERENCES public.crm_communication_channels(id),
  outcome VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  conversation_notes TEXT,
  next_follow_up_date DATE,
  supervisor_override INTEGER DEFAULT 0,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON public.crm_lead_interactions(lead_id);

-- 9. Lead Service Activation Tracking
CREATE TABLE IF NOT EXISTS public.crm_lead_service_tracking (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  service_intent VARCHAR(32) NOT NULL DEFAULT 'Undecided',
  token_requested INTEGER NOT NULL DEFAULT 0,
  token_fulfilled INTEGER NOT NULL DEFAULT 0,
  token_fulfilled_at TIMESTAMPTZ,
  token_batch_id VARCHAR(64),
  dsc_requested INTEGER NOT NULL DEFAULT 0,
  dsc_fulfilled INTEGER NOT NULL DEFAULT 0,
  dsc_fulfilled_at TIMESTAMPTZ,
  dsc_application_id VARCHAR(64),
  tracking_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_QUALIFICATION',
  last_updated_by VARCHAR(64) REFERENCES public.user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Lead-to-Partner Conversion Links
CREATE TABLE IF NOT EXISTS public.crm_lead_conversion_links (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL UNIQUE REFERENCES public.crm_leads(id) ON DELETE RESTRICT,
  partner_id VARCHAR(64) NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  converted_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  conversion_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  prefilled_data JSONB,
  audit_note TEXT
);

-- 11. Bulk Import Batches & Row Results
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

CREATE TABLE IF NOT EXISTS public.crm_lead_assignment_history (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  assigned_by VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  assigned_to VARCHAR(64) NOT NULL REFERENCES public.user_profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assignment_history_lead ON public.crm_lead_assignment_history(lead_id);

