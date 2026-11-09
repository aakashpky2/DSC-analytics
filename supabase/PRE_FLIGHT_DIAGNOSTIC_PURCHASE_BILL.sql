-- ============================================================================
-- PRE-FLIGHT DIAGNOSTIC QUERY: PURCHASE BILL & OPENING STOCK MODULE
-- Target: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   Executes read-only assertions across all columns that will receive NOT NULL
--   and Foreign Key constraints. If any rows are returned with violation_count > 0,
--   the diagnostic reports them immediately before migration execution.
-- ============================================================================

WITH
bills_nulls AS (
    SELECT 
        'token_purchase_bills' AS table_name,
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_count,
        COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_count,
        COUNT(*) FILTER (WHERE voucher_number IS NULL) AS null_voucher_count,
        COUNT(*) FILTER (WHERE supplier_invoice_number IS NULL) AS null_inv_num_count,
        COUNT(*) FILTER (WHERE vendor_party_id IS NULL) AS null_vendor_count
    FROM information_schema.tables t
    LEFT JOIN public.token_purchase_bills b ON true
    WHERE t.table_schema = 'public' AND t.table_name = 'token_purchase_bills'
    GROUP BY t.table_name
),
bill_items_nulls AS (
    SELECT 
        'token_purchase_bill_items' AS table_name,
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_count,
        COUNT(*) FILTER (WHERE purchase_bill_id IS NULL) AS null_bill_id_count,
        COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_count,
        COUNT(*) FILTER (WHERE quantity IS NULL) AS null_qty_count,
        COUNT(*) FILTER (WHERE unit_rate IS NULL) AS null_rate_count,
        COUNT(*) FILTER (WHERE taxable_value IS NULL) AS null_taxable_count,
        COUNT(*) FILTER (WHERE line_total IS NULL) AS null_total_count
    FROM information_schema.tables t
    LEFT JOIN public.token_purchase_bill_items bi ON true
    WHERE t.table_schema = 'public' AND t.table_name = 'token_purchase_bill_items'
    GROUP BY t.table_name
),
opening_stock_nulls AS (
    SELECT 
        'token_opening_stock' AS table_name,
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_count,
        COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_count,
        COUNT(*) FILTER (WHERE token_model_id IS NULL) AS null_token_model_count,
        COUNT(*) FILTER (WHERE quantity IS NULL) AS null_qty_count,
        COUNT(*) FILTER (WHERE purchase_rate IS NULL) AS null_rate_count,
        COUNT(*) FILTER (WHERE total_valuation IS NULL) AS null_val_count
    FROM information_schema.tables t
    LEFT JOIN public.token_opening_stock os ON true
    WHERE t.table_schema = 'public' AND t.table_name = 'token_opening_stock'
    GROUP BY t.table_name
),
profile_stocks_nulls AS (
    SELECT 
        'token_profile_stocks' AS table_name,
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE organization_id IS NULL) AS null_org_count,
        COUNT(*) FILTER (WHERE company_profile_id IS NULL) AS null_profile_count,
        COUNT(*) FILTER (WHERE token_model_id IS NULL) AS null_token_model_count
    FROM information_schema.tables t
    LEFT JOIN public.token_profile_stocks ps ON true
    WHERE t.table_schema = 'public' AND t.table_name = 'token_profile_stocks'
    GROUP BY t.table_name
)
SELECT 
    'DIAGNOSTIC REPORT' AS section,
    jsonb_build_object(
        'token_purchase_bills', (SELECT to_jsonb(bills_nulls.*) FROM bills_nulls),
        'token_purchase_bill_items', (SELECT to_jsonb(bill_items_nulls.*) FROM bill_items_nulls),
        'token_opening_stock', (SELECT to_jsonb(opening_stock_nulls.*) FROM opening_stock_nulls),
        'token_profile_stocks', (SELECT to_jsonb(profile_stocks_nulls.*) FROM profile_stocks_nulls)
    ) AS status;

