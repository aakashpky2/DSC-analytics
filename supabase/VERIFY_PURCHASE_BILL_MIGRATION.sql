-- ============================================================================
-- VERIFICATION & AUDIT SQL: PURCHASE BILL + OPENING STOCK + PROFILE LEDGER
-- Target Database: Supabase PostgreSQL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- D. PRE-MIGRATION SAFETY CHECK: Check if any existing rows contain NULL or invalid FKs
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    RAISE NOTICE 'Executing pre-migration row safety check...';
END $$;

SELECT 
    'token_opening_stock' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE token_model_id IS NULL) AS null_token_model_rows,
    COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_rows,
    COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_rows
FROM information_schema.tables t
LEFT JOIN public.token_opening_stock s ON true
WHERE t.table_schema = 'public' AND t.table_name = 'token_opening_stock'
GROUP BY t.table_name;

SELECT 
    'token_profile_stocks' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE token_model_id IS NULL) AS null_token_model_rows,
    COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_rows,
    COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_rows
FROM information_schema.tables t
LEFT JOIN public.token_profile_stocks s ON true
WHERE t.table_schema = 'public' AND t.table_name = 'token_profile_stocks'
GROUP BY t.table_name;

-- ----------------------------------------------------------------------------
-- E. VERIFY organization_id IS NOT NULL ON ALL 4 TABLES
-- ----------------------------------------------------------------------------
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')
  AND column_name = 'organization_id'
ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- F. VERIFY RLS IS ENABLED ON ALL 4 TABLES
-- ----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- G. PROVE NO RLS POLICY CONTAINS A HARDCODED 'comp-default' BYPASS
-- (Must return 0 rows)
-- ----------------------------------------------------------------------------
SELECT 
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('token_purchase_bills', 'token_purchase_bill_items', 'token_opening_stock', 'token_profile_stocks')
  AND (qual ILIKE '%comp-default%' OR with_check ILIKE '%comp-default%');

-- ----------------------------------------------------------------------------
-- H. VERIFY COMPOSITE PROFILE FOREIGN KEYS (CROSS-ORGANIZATION PREVENTED)
-- ----------------------------------------------------------------------------
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND conname IN (
    'fk_bill_org_profile',
    'fk_bill_item_org_profile',
    'fk_opening_stock_org_profile',
    'fk_profile_stock_org_profile',
    'uq_purchase_internal_profiles_org_id'
  );

-- ----------------------------------------------------------------------------
-- I. VERIFY PURCHASE BILL / LINE ITEM PROFILE-MATCHING FOREIGN KEY
-- ----------------------------------------------------------------------------
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND conname IN (
    'uq_purchase_bill_profile',
    'fk_bill_item_parent_profile'
  );

-- ----------------------------------------------------------------------------
-- J. VERIFY VOUCHER NUMBERING FUNCTION AND UNIQUENESS
-- ----------------------------------------------------------------------------
-- 1. Uniqueness constraint:
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
  AND conname = 'uq_purchase_bill_voucher_org';

-- 2. Concurrency-safe atomic sequence function definition:
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'next_procurement_number';
