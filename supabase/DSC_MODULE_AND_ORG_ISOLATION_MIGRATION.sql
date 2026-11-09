-- ============================================================================
-- DBIZ ERP / SIGNSYNC: CONSOLIDATED ALL-IN-ONE FIX MIGRATION SCRIPT (CORRECTED)
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   1. Ensures comp-default root organization exists and active (using organization_name, organization_code).
--   2. Ensures organization_id column exists, is NOT NULL, and indexed on all
--      operational DSC, Token, Geography, and Master tables.
--   3. Sets up app.current_organization_id helper function for secure RLS context.
--   4. Creates full organization-isolation Row Level Security (RLS) policies
--      with super-admin / service-role safety overrides.
--   5. Synchronizes Geography Masters: Upserts master_countries on unique constraint (organization_id, country_code).
--   6. Links and indexes token_serials, token_models, and dsc_applications.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: VERIFY ROOT ORGANIZATION
-- ----------------------------------------------------------------------------
INSERT INTO public.organizations (
    id, organization_name, organization_code, is_active, created_at, updated_at
)
VALUES (
    'comp-default', 'DBIZ Default Organization', 'DBIZ-DEFAULT', true, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE
SET is_active = true, updated_at = NOW();

-- ----------------------------------------------------------------------------
-- STEP 2: ENSURE organization_id COLUMN, BACKFILL & NOT NULL CONSTRAINTS
-- ----------------------------------------------------------------------------

-- Table 1: dsc_catalog
ALTER TABLE public.dsc_catalog ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.dsc_catalog SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.dsc_catalog ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.dsc_catalog ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dsc_catalog_org_id ON public.dsc_catalog(organization_id);

-- Table 2: dsc_applications
ALTER TABLE public.dsc_applications ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.dsc_applications SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.dsc_applications ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.dsc_applications ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dsc_applications_org_id ON public.dsc_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_dsc_applications_catalog_id ON public.dsc_applications(catalog_id);

-- Table 3: token_models
ALTER TABLE public.token_models ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.token_models SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.token_models ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.token_models ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_models_org_id ON public.token_models(organization_id);

-- Table 4: token_serials
ALTER TABLE public.token_serials ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.token_serials SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.token_serials ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.token_serials ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_serials_org_id ON public.token_serials(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_serials_status ON public.token_serials(status);
CREATE INDEX IF NOT EXISTS idx_token_serials_branch ON public.token_serials(branch_id);

-- Table 5: master_countries
ALTER TABLE public.master_countries ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.master_countries SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.master_countries ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.master_countries ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_countries_org_id ON public.master_countries(organization_id);

-- Table 6: master_states
ALTER TABLE public.master_states ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.master_states SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.master_states ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.master_states ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_states_org_id ON public.master_states(organization_id);

-- Table 7: company_profile (Used for JSON relational master documents)
ALTER TABLE public.company_profile ADD COLUMN IF NOT EXISTS organization_id TEXT;
UPDATE public.company_profile SET organization_id = 'comp-default' WHERE organization_id IS NULL;
ALTER TABLE public.company_profile ALTER COLUMN organization_id SET DEFAULT 'comp-default';
ALTER TABLE public.company_profile ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_profile_org_id ON public.company_profile(organization_id);

-- ----------------------------------------------------------------------------
-- STEP 3: SYNC DEFAULT COUNTRIES INTO master_countries TABLE
-- Handle conflict on (organization_id, country_code) unique constraint
-- ----------------------------------------------------------------------------
INSERT INTO public.master_countries (
    id, organization_id, country_name, country_code, phone_code, priority, is_default, is_active, active_from
)
VALUES
    ('cntry-in-comp-default', 'comp-default', 'India', 'IN', '+91', 1, true, true, '2020-01-01'),
    ('cntry-ae-comp-default', 'comp-default', 'United Arab Emirates', 'AE', '+971', 2, false, true, '2020-01-01'),
    ('cntry-sg-comp-default', 'comp-default', 'Singapore', 'SG', '+65', 3, false, true, '2020-01-01'),
    ('cntry-us-comp-default', 'comp-default', 'United States', 'US', '+1', 4, false, true, '2020-01-01'),
    ('cntry-uk-comp-default', 'comp-default', 'United Kingdom', 'GB', '+44', 5, false, true, '2020-01-01')
ON CONFLICT (organization_id, country_code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    phone_code = EXCLUDED.phone_code,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- STEP 4: CREATE SECURE SESSION CONTEXT HELPER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_organization_id()
RETURNS TEXT AS $$
BEGIN
    -- 1. Try to read Postgres session variable (set by connection or middleware)
    -- 2. Fallback to 'comp-default' when not set (maintains backward compatibility for current sessions)
    RETURN COALESCE(
        NULLIF(current_setting('app.current_organization_id', true), ''),
        'comp-default'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- STEP 5: ENABLE ROW LEVEL SECURITY AND APPLY STRICT TENANT ISOLATION POLICIES
-- ----------------------------------------------------------------------------

-- A. Table: dsc_catalog
ALTER TABLE public.dsc_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_dsc_catalog" ON public.dsc_catalog;
CREATE POLICY "tenant_isolation_dsc_catalog" ON public.dsc_catalog
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- B. Table: dsc_applications
ALTER TABLE public.dsc_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_dsc_applications" ON public.dsc_applications;
CREATE POLICY "tenant_isolation_dsc_applications" ON public.dsc_applications
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- C. Table: token_models
ALTER TABLE public.token_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_models" ON public.token_models;
CREATE POLICY "tenant_isolation_token_models" ON public.token_models
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- D. Table: token_serials
ALTER TABLE public.token_serials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_serials" ON public.token_serials;
CREATE POLICY "tenant_isolation_token_serials" ON public.token_serials
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- E. Table: master_countries
ALTER TABLE public.master_countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_master_countries" ON public.master_countries;
CREATE POLICY "tenant_isolation_master_countries" ON public.master_countries
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- F. Table: master_states
ALTER TABLE public.master_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_master_states" ON public.master_states;
CREATE POLICY "tenant_isolation_master_states" ON public.master_states
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- G. Table: company_profile
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_company_profile" ON public.company_profile;
CREATE POLICY "tenant_isolation_company_profile" ON public.company_profile
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

COMMIT;
