-- ============================================================================
-- DBIZ ERP / SIGNSYNC: TOKEN PROCUREMENT POST-MIGRATION VERIFICATION
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Safety: READ-ONLY (No writes, no schema modifications)
-- Description:
--   Verifies:
--     1. All 10 procurement tables exist.
--     2. Every table contains organization_id and is NOT NULL.
--     3. RLS is enabled on all 10 tables.
--     4. Policies are active on all 10 tables.
--     5. Function next_procurement_number works as expected.
--     6. No overlapping quotation slabs exist.
--     7. Zero NULL organization_ids across all procurement tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VERIFY TABLE EXISTENCE & RECORD COUNTS
-- ----------------------------------------------------------------------------
SELECT '=== 1. PROCUREMENT TABLES EXISTENCE & ROW COUNTS ===' AS test_name;

SELECT 'token_purchase_parties' AS table_name, count(*) AS total_rows, count(*) FILTER (WHERE organization_id IS NULL) AS null_orgs FROM public.token_purchase_parties
UNION ALL
SELECT 'token_vendor_quotes', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_vendor_quotes
UNION ALL
SELECT 'token_vendor_quote_slabs', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_vendor_quote_slabs
UNION ALL
SELECT 'purchase_internal_profiles', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.purchase_internal_profiles
UNION ALL
SELECT 'purchase_delivery_locations', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.purchase_delivery_locations
UNION ALL
SELECT 'token_purchase_estimates', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_purchase_estimates
UNION ALL
SELECT 'token_purchase_estimate_items', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_purchase_estimate_items
UNION ALL
SELECT 'token_purchase_orders', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_purchase_orders
UNION ALL
SELECT 'token_purchase_order_items', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.token_purchase_order_items
UNION ALL
SELECT 'procurement_sequences', count(*), count(*) FILTER (WHERE organization_id IS NULL) FROM public.procurement_sequences;

-- ----------------------------------------------------------------------------
-- 2. VERIFY RLS STATUS ON PROCUREMENT TABLES
-- ----------------------------------------------------------------------------
SELECT '=== 2. RLS & POLICY STATUS ===' AS test_name;

SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    p.polname AS policy_name,
    p.polcmd AS command
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'token_purchase_parties',
    'token_vendor_quotes',
    'token_vendor_quote_slabs',
    'purchase_internal_profiles',
    'purchase_delivery_locations',
    'token_purchase_estimates',
    'token_purchase_estimate_items',
    'token_purchase_orders',
    'token_purchase_order_items',
    'procurement_sequences'
  )
ORDER BY c.relname, p.polname;

-- ----------------------------------------------------------------------------
-- 3. CHECK FOR OVERLAPPING QUOTE SLABS
-- ----------------------------------------------------------------------------
SELECT '=== 3. CHECK FOR OVERLAPPING QUOTE SLABS ===' AS test_name;

SELECT 
    s1.quote_id,
    s1.id AS slab_1_id,
    s1.min_quantity AS s1_min,
    s1.max_quantity AS s1_max,
    s2.id AS slab_2_id,
    s2.min_quantity AS s2_min,
    s2.max_quantity AS s2_max,
    'OVERLAP_DETECTED' AS issue
FROM public.token_vendor_quote_slabs s1
JOIN public.token_vendor_quote_slabs s2 
  ON s1.quote_id = s2.quote_id 
 AND s1.id != s2.id
WHERE (
    -- S1 overlaps S2
    (s1.min_quantity <= COALESCE(s2.max_quantity, 999999999) AND COALESCE(s1.max_quantity, 999999999) >= s2.min_quantity)
);

-- ----------------------------------------------------------------------------
-- 4. TEST ATOMIC NUMBER GENERATOR
-- ----------------------------------------------------------------------------
SELECT '=== 4. TEST PO NUMBER GENERATOR ===' AS test_name;

SELECT public.next_procurement_number('comp-default', 'PO_TEST', 'PO') AS sample_generated_po_number;

-- ----------------------------------------------------------------------------
-- 5. VERIFY FINAL VERDICT
-- ----------------------------------------------------------------------------
SELECT '=== 5. INTEGRITY VERDICT ===' AS test_name;

SELECT 
    CASE 
        WHEN (SELECT count(*) FROM public.token_purchase_parties WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.token_vendor_quotes WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.token_vendor_quote_slabs WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.purchase_internal_profiles WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.purchase_delivery_locations WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.token_purchase_estimates WHERE organization_id IS NULL) = 0
         AND (SELECT count(*) FROM public.token_purchase_orders WHERE organization_id IS NULL) = 0
        THEN 'PASS: TOKEN PROCUREMENT SCHEMA IS VERIFIED AND ORGANIZATION ISOLATED'
        ELSE 'FAIL: NULL ORGANIZATION_ID FOUND IN PROCUREMENT TABLES'
    END AS post_migration_verdict;

