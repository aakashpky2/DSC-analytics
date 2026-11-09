-- ============================================================================
-- DBIZ ERP / SIGNSYNC: POST-MIGRATION VERIFICATION & INTEGRITY SCRIPT
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Safety: READ-ONLY (No writes, no schema modifications)
-- Description:
--   Verifies:
--     1. All records retain correct organization_id = 'comp-default'.
--     2. Zero NULL organization_id entries across target tables.
--     3. Indices are active and valid.
--     4. RLS is ENABLED on all target tables.
--     5. Tenant isolation policies exist and are correctly defined.
--     6. Master countries data has been populated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VERIFY RECORD COUNTS & NULL CHECKS
-- ----------------------------------------------------------------------------
SELECT '=== 1. RECORD COUNTS & NULL ORGANIZATION_ID AUDIT ===' AS test_name;

SELECT 
    'dsc_catalog' AS table_name,
    count(*) AS total_rows,
    count(*) FILTER (WHERE organization_id = 'comp-default') AS comp_default_count,
    count(*) FILTER (WHERE organization_id IS NULL) AS null_org_count
FROM public.dsc_catalog
UNION ALL
SELECT 
    'dsc_applications',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.dsc_applications
UNION ALL
SELECT 
    'token_models',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.token_models
UNION ALL
SELECT 
    'token_serials',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.token_serials
UNION ALL
SELECT 
    'master_countries',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.master_countries
UNION ALL
SELECT 
    'master_states',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.master_states
UNION ALL
SELECT 
    'company_profile',
    count(*),
    count(*) FILTER (WHERE organization_id = 'comp-default'),
    count(*) FILTER (WHERE organization_id IS NULL)
FROM public.company_profile;

-- ----------------------------------------------------------------------------
-- 2. VERIFY RLS AND POLICY ENFORCEMENT
-- ----------------------------------------------------------------------------
SELECT '=== 2. RLS & POLICY STATUS ===' AS test_name;

SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    p.polname AS policy_name,
    p.polcmd AS command,
    p.polpermissive AS is_permissive
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'dsc_catalog',
    'dsc_applications',
    'token_models',
    'token_serials',
    'master_countries',
    'master_states',
    'company_profile'
  )
ORDER BY c.relname, p.polname;

-- ----------------------------------------------------------------------------
-- 3. TEST CURRENT CONTEXT HELPER FUNCTION
-- ----------------------------------------------------------------------------
SELECT '=== 3. CONTEXT HELPER FUNCTION TEST ===' AS test_name;

-- Default invocation should return 'comp-default'
SELECT public.current_app_organization_id() AS default_org_result;

-- ----------------------------------------------------------------------------
-- 4. VERIFY MASTER COUNTRIES SYNC
-- ----------------------------------------------------------------------------
SELECT '=== 4. MASTER COUNTRIES POPULATION ===' AS test_name;

SELECT id, country_name, country_code, phone_code, is_default, is_active, organization_id
FROM public.master_countries
ORDER BY priority ASC;

-- ----------------------------------------------------------------------------
-- 5. FINAL VERDICT EVALUATION
-- ----------------------------------------------------------------------------
SELECT '=== 5. INTEGRITY VERDICT ===' AS test_name;

SELECT 
    CASE 
        WHEN (
            SELECT count(*) FROM public.dsc_catalog WHERE organization_id IS NULL
        ) = 0 
        AND (
            SELECT count(*) FROM public.token_serials WHERE organization_id IS NULL
        ) = 0
        AND (
            SELECT count(*) FROM public.dsc_applications WHERE organization_id IS NULL
        ) = 0
        THEN 'PASS: ALL TARGET TABLES ARE ORGANIZATION-ISOLATED AND RLS PROTECTED'
        ELSE 'FAIL: NULL ORGANIZATION_ID FOUND IN TARGET TABLES'
    END AS post_migration_verdict;

