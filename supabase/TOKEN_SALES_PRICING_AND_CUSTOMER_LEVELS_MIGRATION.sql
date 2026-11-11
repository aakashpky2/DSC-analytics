-- ============================================================================
-- DBIZ ERP / SIGNSYNC — TOKEN SALES PRICING & CUSTOMER LEVEL MASTERS
-- Tables:
-- 1. public.token_sales_rates
-- 2. public.customer_pricing_categories
-- 3. public.customer_category_assignments
-- 4. public.customer_levels
-- 5. public.customer_level_rules
-- 6. public.customer_level_assignments
-- ============================================================================

-- 1. SALES RATE MASTER
CREATE TABLE IF NOT EXISTS public.token_sales_rates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  token_company TEXT,
  token_product TEXT,
  token_model_id TEXT NOT NULL,
  model_name TEXT,
  customer_category_id TEXT,
  customer_id TEXT,
  rate_type TEXT NOT NULL DEFAULT 'FIXED' CHECK (rate_type IN ('FIXED', 'SLAB')),
  rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  quantity_slabs JSONB DEFAULT '[]'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_token_sales_rates_org_model ON public.token_sales_rates(organization_id, token_model_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_rates_dates ON public.token_sales_rates(effective_from, effective_to);

-- 2. CUSTOMER PRICING CATEGORIES
CREATE TABLE IF NOT EXISTS public.customer_pricing_categories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  category_name TEXT NOT NULL,
  category_code TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_categories_org ON public.customer_pricing_categories(organization_id);

-- 3. CUSTOMER CATEGORY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.customer_category_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  customer_id TEXT NOT NULL,
  customer_category_id TEXT NOT NULL,
  assignment_type TEXT NOT NULL DEFAULT 'PERMANENT' CHECK (assignment_type IN ('PERMANENT', 'DATE_BASED')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_category_assignments_cust ON public.customer_category_assignments(organization_id, customer_id);

-- 4. CUSTOMER LEVELS
CREATE TABLE IF NOT EXISTS public.customer_levels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  level_name TEXT NOT NULL,
  level_code TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assignment_mode TEXT NOT NULL DEFAULT 'AUTOMATIC' CHECK (assignment_mode IN ('AUTOMATIC', 'MANUAL')),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_levels_org ON public.customer_levels(organization_id);

-- 5. CUSTOMER LEVEL RULES
CREATE TABLE IF NOT EXISTS public.customer_level_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  customer_level_id TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (period_type IN ('MONTHLY', 'ANNUAL', 'CUSTOM')),
  custom_period_from DATE,
  custom_period_to DATE,
  min_purchase_volume NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_level_rules_org ON public.customer_level_rules(organization_id);

-- 6. CUSTOMER LEVEL ASSIGNMENTS & OVERRIDES
CREATE TABLE IF NOT EXISTS public.customer_level_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  customer_id TEXT NOT NULL,
  current_level_id TEXT NOT NULL,
  previous_level_id TEXT,
  assignment_type TEXT NOT NULL DEFAULT 'AUTOMATIC' CHECK (assignment_type IN ('AUTOMATIC', 'MANUAL_OVERRIDE')),
  qualification_volume NUMERIC(15, 2) DEFAULT 0,
  matched_rule_id TEXT,
  calculated_period TEXT,
  override_by TEXT,
  override_date TIMESTAMPTZ,
  override_reason TEXT,
  effective_from DATE,
  effective_to DATE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_level_assignments_cust ON public.customer_level_assignments(organization_id, customer_id);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.token_sales_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pricing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_level_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_level_assignments ENABLE ROW LEVEL SECURITY;

-- 8. TENANT ISOLATION POLICIES (No comp-default bypass)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'token_sales_rates' AND policyname = 'token_sales_rates_org_isolation') THEN
    CREATE POLICY token_sales_rates_org_isolation ON public.token_sales_rates
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_pricing_categories' AND policyname = 'customer_pricing_categories_org_isolation') THEN
    CREATE POLICY customer_pricing_categories_org_isolation ON public.customer_pricing_categories
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_category_assignments' AND policyname = 'customer_category_assignments_org_isolation') THEN
    CREATE POLICY customer_category_assignments_org_isolation ON public.customer_category_assignments
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_levels' AND policyname = 'customer_levels_org_isolation') THEN
    CREATE POLICY customer_levels_org_isolation ON public.customer_levels
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_level_rules' AND policyname = 'customer_level_rules_org_isolation') THEN
    CREATE POLICY customer_level_rules_org_isolation ON public.customer_level_rules
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_level_assignments' AND policyname = 'customer_level_assignments_org_isolation') THEN
    CREATE POLICY customer_level_assignments_org_isolation ON public.customer_level_assignments
      FOR ALL
      USING (organization_id = COALESCE(current_setting('app.current_organization_id', true), 'comp-default'));
  END IF;
END $$;

