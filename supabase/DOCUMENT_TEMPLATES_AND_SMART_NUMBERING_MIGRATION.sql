-- ============================================================================
-- DBIZ ERP / SIGNSYNC: DOCUMENT TEMPLATES, NUMBERING MASTER & SMART RULES
-- Supports:
--   1. document_html_templates (PO, PB, ESTIMATE, INVOICE)
--   2. document_numbering_series (Configurable Prefix, Suffix, Padding, Counters)
--   3. document_numbering_rules (GST, State, District, Customer Type priority rules)
-- ============================================================================

-- 1. Document HTML Templates Table
CREATE TABLE IF NOT EXISTS public.document_html_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  document_type TEXT NOT NULL, -- PURCHASE_ORDER, PURCHASE_BILL, SALES_ESTIMATE, SALES_INVOICE
  template_name TEXT NOT NULL,
  template_code TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  css_content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_doc_tmpl_code_org UNIQUE (organization_id, template_code)
);

CREATE INDEX IF NOT EXISTS idx_doc_tmpl_org_type ON public.document_html_templates(organization_id, document_type);
CREATE INDEX IF NOT EXISTS idx_doc_tmpl_profile ON public.document_html_templates(company_profile_id);

-- 2. Document Numbering Series Table
CREATE TABLE IF NOT EXISTS public.document_numbering_series (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  series_name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  suffix TEXT DEFAULT '',
  starting_number INT NOT NULL DEFAULT 1001,
  current_counter INT NOT NULL DEFAULT 1000,
  padding_length INT NOT NULL DEFAULT 4,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  allow_reuse_on_cancellation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_series_org_prof ON public.document_numbering_series(organization_id, company_profile_id, document_type);

-- 3. Document Numbering Rules Table
CREATE TABLE IF NOT EXISTS public.document_numbering_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  series_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 1,
  field TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'EQUALS',
  value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_rules_org_prof ON public.document_numbering_rules(organization_id, company_profile_id, priority);

-- 4. Enable RLS
ALTER TABLE public.document_html_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_numbering_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_numbering_rules ENABLE ROW LEVEL SECURITY;

