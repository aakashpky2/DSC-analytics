-- ==========================================================================
-- SIGNSYNC LEAD MANAGEMENT V2.0: POST-MIGRATION VERIFICATION SCRIPT
-- Project: kbqwsfmfiomcakbhclca
-- Purpose: Verify crm_lead_interactions, TAT settings, category permissions, 
--          service tracking, and legacy archive integrity.
-- ==========================================================================

-- 1. RECORD COUNT RECONCILIATION SUMMARY
SELECT 
  'crm_lead_interactions' AS table_name, 
  COUNT(*) AS total_rows,
  '36' AS expected_rows,
  CASE WHEN COUNT(*) = 36 THEN 'PASS' ELSE 'CHECK' END AS audit_status
FROM public.crm_lead_interactions
UNION ALL
SELECT 
  'crm_follow_ups (source preserved)', 
  COUNT(*),
  '36',
  CASE WHEN COUNT(*) = 36 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_follow_ups
UNION ALL
SELECT 
  'crm_tat_settings', 
  COUNT(*),
  '2',
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_tat_settings
UNION ALL
SELECT 
  'crm_user_category_access', 
  COUNT(*),
  '2',
  CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_user_category_access
UNION ALL
SELECT 
  'crm_lead_service_tracking', 
  COUNT(*),
  '89',
  CASE WHEN COUNT(*) = 89 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_lead_service_tracking
UNION ALL
SELECT 
  'crm_lead_conversion_links', 
  COUNT(*),
  '7',
  CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_lead_conversion_links
UNION ALL
SELECT 
  'crm_partner_match_reviews', 
  COUNT(*),
  '32',
  CASE WHEN COUNT(*) = 32 THEN 'PASS' ELSE 'CHECK' END
FROM public.crm_partner_match_reviews
UNION ALL
SELECT 
  'company_profile (staging preserved)', 
  COUNT(*),
  '10',
  CASE WHEN COUNT(*) = 10 THEN 'PASS' ELSE 'CHECK' END
FROM public.company_profile;

-- 2. INTEGRITY CHECKS ON crm_lead_interactions (Zero Broken Foreign Keys)
SELECT 
  'crm_lead_interactions -> crm_leads' AS fk_relationship,
  COUNT(*) AS orphan_lead_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM public.crm_lead_interactions i
LEFT JOIN public.crm_leads l ON i.lead_id = l.id
WHERE l.id IS NULL
UNION ALL
SELECT 
  'crm_lead_interactions -> user_profiles',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.crm_lead_interactions i
LEFT JOIN public.user_profiles u ON i.conducted_by = u.id
WHERE u.id IS NULL
UNION ALL
SELECT 
  'crm_lead_interactions -> crm_communication_channels',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
FROM public.crm_lead_interactions i
LEFT JOIN public.crm_communication_channels c ON i.channel_id = c.id
WHERE c.id IS NULL;

-- 3. DETERMINISTIC TAT SETTING INSPECTION
SELECT 
  id,
  first_contact_tat_days,
  follow_up_grace_hours,
  is_active,
  effective_from,
  'ACTIVE_TAT_RECORD' AS selection_status
FROM public.crm_tat_settings
WHERE is_active = 1
ORDER BY effective_from DESC, id DESC
LIMIT 1;

-- 4. VERIFY USER CATEGORY PERMISSIONS & ROLES
SELECT 
  uca.id AS mapping_id,
  uca.user_id,
  u.full_name,
  u.email,
  r.name AS role_name,
  uca.category_id,
  cat.category_name,
  uca.created_at
FROM public.crm_user_category_access uca
JOIN public.user_profiles u ON uca.user_id = u.id
JOIN public.roles r ON u.role_id = r.id
JOIN public.crm_lead_categories cat ON uca.category_id = cat.id;

-- 5. SAMPLE AUDIT OF MIGRATED INTERACTIONS (Including widened outcome)
SELECT 
  id,
  lead_id,
  conducted_by,
  channel_id,
  outcome,
  LENGTH(outcome) AS outcome_char_length,
  reason,
  supervisor_override,
  created_at
FROM public.crm_lead_interactions
ORDER BY created_at ASC
LIMIT 5;
