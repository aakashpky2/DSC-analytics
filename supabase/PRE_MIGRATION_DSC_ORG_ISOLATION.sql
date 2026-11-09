-- ============================================================================
-- DBIZ ERP / SIGNSYNC: PRE-MIGRATION VERIFICATION SCRIPT
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Safety: READ-ONLY (No writes, no schema modifications)
-- Description:
--   Verifies existing table existence, row counts, organization_id distribution,
--   foreign keys, and RLS state before executing the migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RECORD COUNT BASELINE (BEFORE MIGRATION)
-- ----------------------------------------------------------------------------
SELECT '=== 1. RECORD COUNT BASELINE ===' AS check_step;

SELECT 
    'organizations' AS table_name, count(*) AS total_rows FROM public.organizations
UNION ALL
SELECT 
    'user_profiles', count(*) FROM public.user_profiles
UNION ALL
SELECT 
    'branches', count(*) FROM public.branches
UNION ALL
SELECT 
    'dsc_catalog', count(*) FROM public.dsc_catalog
UNION ALL
SELECT 
    'dsc_applications', count(*) FROM public.dsc_applications
UNION ALL
SELECT 
    'token_models', count(*) FROM public.token_models
UNION ALL
SELECT 
    'token_serials', count(*) FROM public.token_serials
UNION ALL
SELECT 
    'master_countries', count(*) FROM public.master_countries
UNION ALL
SELECT 
    'master_states', count(*) FROM public.master_states
UNION ALL
SELECT 
    'company_profile', count(*) FROM public.company_profile;

-- ----------------------------------------------------------------------------
-- 2. VERIFY ORGANIZATION_ID DISTRIBUTION ACROSS CORE TABLES
-- ----------------------------------------------------------------------------
SELECT '=== 2. VERIFY ORGANIZATION_ID VALUES ===' AS check_step;

SELECT 'user_profiles' AS tbl, COALESCE(organization_id, 'NULL') AS org_id, count(*) AS count 
FROM public.user_profiles GROUP BY organization_id
UNION ALL
SELECT 'dsc_catalog', COALESCE(organization_id, 'NULL'), count(*) 
FROM public.dsc_catalog GROUP BY organization_id
UNION ALL
SELECT 'dsc_applications', COALESCE(organization_id, 'NULL'), count(*) 
FROM public.dsc_applications GROUP BY organization_id
UNION ALL
SELECT 'token_serials', COALESCE(organization_id, 'NULL'), count(*) 
FROM public.token_serials GROUP BY organization_id
UNION ALL
SELECT 'token_models', COALESCE(organization_id, 'NULL'), count(*) 
FROM public.token_models GROUP BY organization_id;

-- ----------------------------------------------------------------------------
-- 3. INSPECT CURRENT RLS & POLICY STATUS
-- ----------------------------------------------------------------------------
SELECT '=== 3. RLS STATUS ON TARGET TABLES ===' AS check_step;

SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_enforced,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'organizations',
    'company_profile',
    'branches',
    'user_profiles',
    'dsc_catalog',
    'dsc_applications',
    'token_models',
    'token_serials',
    'invoices',
    'invoice_items',
    'master_countries',
    'master_states',
    'crm_leads',
    'partners'
  )
ORDER BY c.relname ASC;

-- ----------------------------------------------------------------------------
-- 4. VERIFY MASTER STORES IN company_profile
-- ----------------------------------------------------------------------------
SELECT '=== 4. company_profile MASTER STORE PAYLOADS ===' AS check_step;

SELECT 
    id AS store_key,
    organization_id,
    LENGTH(registered_address) AS payload_bytes,
    updated_at
FROM public.company_profile
WHERE id IN (
    'dsc_master_companies',
    'dsc_master_products',
    'dsc_master_classes',
    'dsc_master_rates',
    'dsc_master_validities',
    'dsc_category_additional_charges',
    'token_master_companies',
    'token_master_products',
    'token_master_versions',
    'app_master_countries',
    'app_master_states'
)
ORDER BY id ASC;

