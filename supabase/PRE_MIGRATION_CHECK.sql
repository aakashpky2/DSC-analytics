-- ============================================================================
-- SignSync B2B Enterprise Platform: PRE-MIGRATION VERIFICATION SCRIPT
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Safety: READ-ONLY (No writes, no schema modifications)
-- Description:
--   Queries system catalogs, column nullabilities, foreign keys, and existing
--   record counts before executing FINAL_LEAD_V2_SCHEMA.sql.
-- ============================================================================

SELECT '=== 1. VERIFY CORE DATABASE RECORD COUNTS BEFORE MIGRATION ===' AS step;

SELECT 'crm_leads' AS table_name, count(*) AS row_count FROM public.crm_leads
UNION ALL
SELECT 'partners' AS table_name, count(*) AS row_count FROM public.partners
UNION ALL
SELECT 'crm_follow_ups' AS table_name, count(*) AS row_count FROM public.crm_follow_ups
UNION ALL
SELECT 'crm_lead_sources' AS table_name, count(*) AS row_count FROM public.crm_lead_sources
UNION ALL
SELECT 'user_profiles' AS table_name, count(*) AS row_count FROM public.user_profiles
UNION ALL
SELECT 'audit_logs' AS table_name, count(*) AS row_count FROM public.audit_logs;

SELECT '=== 2. VERIFY CURRENT COLUMNS AND NULLABILITY ON crm_leads ===' AS step;

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'crm_leads'
ORDER BY ordinal_position;

SELECT '=== 3. CHECK IF NEW DEDICATED TABLES ALREADY EXIST ===' AS step;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'crm_lead_categories',
    'crm_communication_channels',
    'crm_tat_settings',
    'crm_user_category_access',
    'crm_partner_match_reviews',
    'crm_lead_interactions',
    'crm_lead_service_tracking',
    'crm_lead_conversion_links',
    'partner_contact_methods',
    'crm_bulk_import_batches',
    'crm_lead_assignment_history'
  );

SELECT '=== 4. VERIFY STAGED METADATA IN company_profile ===' AS step;

SELECT 
    id, 
    legal_name, 
    trade_name, 
    length(registered_address) AS payload_bytes,
    updated_at
FROM public.company_profile
ORDER BY id;

