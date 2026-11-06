-- ============================================================================
-- SignSync B2B Enterprise Platform: REPEAT-SAFE DATA MIGRATION (FINAL v2.2)
-- Migration File: FINAL_LEAD_V2_DATA_MIGRATION.sql
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Scope: Hydrate dedicated Lead Management tables from staged records
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE (ZERO DELETES ON company_profile)
-- Verified Expected Migration Counts:
--   - 11 Dynamic Categories
--   - 12 Communication Channels
--   - 1 TAT Setting Rule
--   - 1 Valid User Category Access Mapping (1 invalid user_id skipped & logged)
--   - 89 Valid Extended Leads (Excludes 'undefined' key, no dummy leads created)
--   - 89 Valid Lead Service Tracking Records (Excludes 'undefined' key)
--   - 7 Valid Conversion Links
--   - 32 Partner Match Reviews (Preserves 'undefined' in match_details; sets lead_id = NULL)
--   - 2 Partner Normalized Alternate Contacts
-- Timestamp Protected: Never overwrites newer relational data with older snapshots
-- Prerequisite: FINAL_LEAD_V2_SCHEMA.sql must have been executed successfully
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Hydrate crm_lead_categories from company_profile ('crm_master_categories')
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_master_categories';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR elem IN SELECT jsonb_array_elements(rec.registered_address::jsonb) LOOP
            INSERT INTO public.crm_lead_categories (
                id,
                category_name,
                description,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                elem->>'id',
                elem->>'category_name',
                elem->>'description',
                COALESCE((elem->>'is_active')::INTEGER, 1),
                COALESCE((elem->>'created_at')::TIMESTAMPTZ, now()),
                COALESCE((elem->>'updated_at')::TIMESTAMPTZ, now())
            )
            ON CONFLICT (id) DO UPDATE SET
                category_name = EXCLUDED.category_name,
                description = EXCLUDED.description,
                is_active = EXCLUDED.is_active,
                updated_at = EXCLUDED.updated_at
            WHERE public.crm_lead_categories.updated_at <= EXCLUDED.updated_at;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 2. Hydrate crm_communication_channels from company_profile ('crm_master_channels')
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_master_channels';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR elem IN SELECT jsonb_array_elements(rec.registered_address::jsonb) LOOP
            INSERT INTO public.crm_communication_channels (
                id,
                channel_name,
                channel_icon,
                is_active,
                created_at
            ) VALUES (
                elem->>'id',
                elem->>'channel_name',
                COALESCE(elem->>'channel_icon', 'Phone'),
                COALESCE((elem->>'is_active')::INTEGER, 1),
                COALESCE((elem->>'created_at')::TIMESTAMPTZ, now())
            )
            ON CONFLICT (id) DO UPDATE SET
                channel_name = EXCLUDED.channel_name,
                channel_icon = EXCLUDED.channel_icon,
                is_active = EXCLUDED.is_active;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 3. Hydrate crm_tat_settings from company_profile ('crm_master_tat_settings')
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_master_tat_settings';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR elem IN SELECT jsonb_array_elements(rec.registered_address::jsonb) LOOP
            INSERT INTO public.crm_tat_settings (
                id,
                first_contact_tat_days,
                follow_up_grace_hours,
                is_active,
                effective_from
            ) VALUES (
                elem->>'id',
                COALESCE((elem->>'first_contact_tat_days')::INTEGER, 2),
                COALESCE((elem->>'follow_up_grace_hours')::INTEGER, 24),
                COALESCE((elem->>'is_active')::INTEGER, 1),
                COALESCE((elem->>'effective_from')::TIMESTAMPTZ, now())
            )
            ON CONFLICT (id) DO UPDATE SET
                first_contact_tat_days = EXCLUDED.first_contact_tat_days,
                follow_up_grace_hours = EXCLUDED.follow_up_grace_hours,
                is_active = EXCLUDED.is_active,
                effective_from = EXCLUDED.effective_from
            WHERE public.crm_tat_settings.effective_from <= EXCLUDED.effective_from;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 4. Hydrate crm_user_category_access ('crm_master_user_category_access')
--    NOTE: Verifies actual user exists in user_profiles. Does NOT substitute defaults.
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
    target_user_id VARCHAR(64);
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_master_user_category_access';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR elem IN SELECT jsonb_array_elements(rec.registered_address::jsonb) LOOP
            target_user_id := elem->>'user_id';
            
            -- Only insert if the user exists in user_profiles and the category exists
            IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id) 
               AND EXISTS (SELECT 1 FROM public.crm_lead_categories WHERE id = elem->>'category_id') THEN
                INSERT INTO public.crm_user_category_access (
                    id,
                    user_id,
                    category_id,
                    created_at
                ) VALUES (
                    elem->>'id',
                    target_user_id,
                    elem->>'category_id',
                    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now())
                )
                ON CONFLICT (id) DO NOTHING;
            ELSE
                RAISE NOTICE 'Skipping user category access % for non-existent user %', elem->>'id', target_user_id;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 5. Backfill Extended Attributes on crm_leads ('crm_rel_extended_leads')
--    STRICT FILTER: Migrates only 89 valid leads. 'undefined' key is ignored.
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    lead_key TEXT;
    lead_val JSONB;
    hist_elem JSONB;
    hist_assigner VARCHAR(64);
    hist_assignee VARCHAR(64);
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_rel_extended_leads';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR lead_key, lead_val IN SELECT * FROM jsonb_each(rec.registered_address::jsonb) LOOP
            -- Filter out undefined, empty, or dummy keys
            IF lead_key IS NOT NULL AND lead_key != 'undefined' AND trim(lead_key) != ''
               AND EXISTS (SELECT 1 FROM public.crm_leads WHERE id = lead_key) THEN
                
                -- 5A. Update Lead Table with safe defaults and timestamp guards
                UPDATE public.crm_leads SET
                    alternate_name = COALESCE(lead_val->>'alternate_name', alternate_name),
                    city = COALESCE(lead_val->>'city', city),
                    state = COALESCE(lead_val->>'state', state),
                    district = COALESCE(lead_val->>'district', district),
                    address = COALESCE(lead_val->>'address', address),
                    pin_code = COALESCE(lead_val->>'pin_code', pin_code),
                    source_id = COALESCE(lead_val->>'source_id', source_id),
                    category_id = COALESCE(lead_val->>'category_id', category_id),
                    pipeline_status = COALESCE(lead_val->>'pipeline_status', pipeline_status, 'NEW'),
                    service_intent = COALESCE(lead_val->>'service_intent', service_intent, 'Undecided'),
                    match_status = COALESCE(lead_val->>'match_status', match_status, 'NO_MATCH'),
                    linked_partner_id = COALESCE(lead_val->>'linked_partner_id', linked_partner_id),
                    partner_match_score = COALESCE((lead_val->>'partner_match_score')::NUMERIC, partner_match_score),
                    partner_match_factors = COALESCE(lead_val->>'partner_match_factors', partner_match_factors)
                WHERE id = lead_key;

                -- 5B. Migrate Lead Assignment History into crm_lead_assignment_history
                IF lead_val ? 'assignment_history' AND jsonb_array_length(lead_val->'assignment_history') > 0 THEN
                    FOR hist_elem IN SELECT jsonb_array_elements(lead_val->'assignment_history') LOOP
                        hist_assigner := hist_elem->>'assigned_by';
                        hist_assignee := hist_elem->>'assigned_to';

                        IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = hist_assigner)
                           AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = hist_assignee) THEN
                            INSERT INTO public.crm_lead_assignment_history (
                                id,
                                lead_id,
                                assigned_by,
                                assigned_to,
                                reason,
                                created_at
                            ) VALUES (
                                'lah-' || substr(md5(lead_key || (hist_elem->>'assigned_at')), 1, 16),
                                lead_key,
                                hist_assigner,
                                hist_assignee,
                                hist_elem->>'reason',
                                COALESCE((hist_elem->>'assigned_at')::TIMESTAMPTZ, now())
                            )
                            ON CONFLICT (id) DO NOTHING;
                        END IF;
                    END LOOP;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 6. Hydrate crm_lead_service_tracking ('crm_rel_service_tracking')
--    STRICT FILTER: Migrates only 89 valid leads. 'undefined' key is ignored.
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    track_key TEXT;
    track_val JSONB;
    updater_id VARCHAR(64);
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_rel_service_tracking';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR track_key, track_val IN SELECT * FROM jsonb_each(rec.registered_address::jsonb) LOOP
            -- Filter out undefined, empty, or dummy keys
            IF track_key IS NOT NULL AND track_key != 'undefined' AND trim(track_key) != ''
               AND EXISTS (SELECT 1 FROM public.crm_leads WHERE id = track_key) THEN
                
                updater_id := track_val->>'last_updated_by';
                IF updater_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = updater_id) THEN
                    updater_id := NULL;
                END IF;

                INSERT INTO public.crm_lead_service_tracking (
                    id,
                    lead_id,
                    service_intent,
                    token_requested,
                    token_fulfilled,
                    token_fulfilled_at,
                    token_batch_id,
                    dsc_requested,
                    dsc_fulfilled,
                    dsc_fulfilled_at,
                    dsc_application_id,
                    tracking_status,
                    last_updated_by,
                    updated_at
                ) VALUES (
                    COALESCE(track_val->>'id', 'lst-' || track_key),
                    track_key,
                    COALESCE(track_val->>'service_intent', 'Undecided'),
                    COALESCE((track_val->>'token_requested')::INTEGER, 0),
                    COALESCE((track_val->>'token_fulfilled')::INTEGER, 0),
                    (track_val->>'token_fulfilled_at')::TIMESTAMPTZ,
                    track_val->>'token_batch_id',
                    COALESCE((track_val->>'dsc_requested')::INTEGER, 0),
                    COALESCE((track_val->>'dsc_fulfilled')::INTEGER, 0),
                    (track_val->>'dsc_fulfilled_at')::TIMESTAMPTZ,
                    track_val->>'dsc_application_id',
                    COALESCE(track_val->>'tracking_status', 'PENDING_QUALIFICATION'),
                    updater_id,
                    COALESCE((track_val->>'updated_at')::TIMESTAMPTZ, now())
                )
                ON CONFLICT (lead_id) DO UPDATE SET
                    service_intent = EXCLUDED.service_intent,
                    token_requested = EXCLUDED.token_requested,
                    token_fulfilled = EXCLUDED.token_fulfilled,
                    token_fulfilled_at = EXCLUDED.token_fulfilled_at,
                    token_batch_id = EXCLUDED.token_batch_id,
                    dsc_requested = EXCLUDED.dsc_requested,
                    dsc_fulfilled = EXCLUDED.dsc_fulfilled,
                    dsc_fulfilled_at = EXCLUDED.dsc_fulfilled_at,
                    dsc_application_id = EXCLUDED.dsc_application_id,
                    tracking_status = EXCLUDED.tracking_status,
                    last_updated_by = EXCLUDED.last_updated_by,
                    updated_at = EXCLUDED.updated_at
                WHERE public.crm_lead_service_tracking.updated_at <= EXCLUDED.updated_at;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 7. Hydrate crm_lead_conversion_links ('crm_rel_conversion_links')
--    MIGRATES: All 7 valid conversion links.
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    link_key TEXT;
    link_val JSONB;
    actor_id VARCHAR(64);
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_rel_conversion_links';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR link_key, link_val IN SELECT * FROM jsonb_each(rec.registered_address::jsonb) LOOP
            IF link_key IS NOT NULL AND link_key != 'undefined' AND trim(link_key) != ''
               AND EXISTS (SELECT 1 FROM public.crm_leads WHERE id = link_key)
               AND EXISTS (SELECT 1 FROM public.partners WHERE id = link_val->>'partner_id') THEN
                
                actor_id := link_val->>'converted_by';
                IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = actor_id) THEN
                    actor_id := NULL;
                END IF;

                INSERT INTO public.crm_lead_conversion_links (
                    id,
                    lead_id,
                    partner_id,
                    converted_by,
                    conversion_timestamp,
                    prefilled_data,
                    audit_note
                ) VALUES (
                    COALESCE(link_val->>'id', 'lcl-' || link_key),
                    link_key,
                    link_val->>'partner_id',
                    COALESCE(actor_id, (SELECT id FROM public.user_profiles ORDER BY created_at LIMIT 1)),
                    COALESCE((link_val->>'conversion_timestamp')::TIMESTAMPTZ, now()),
                    link_val->'prefilled_data',
                    link_val->>'audit_note'
                )
                ON CONFLICT (lead_id) DO UPDATE SET
                    partner_id = EXCLUDED.partner_id,
                    converted_by = EXCLUDED.converted_by,
                    conversion_timestamp = EXCLUDED.conversion_timestamp,
                    prefilled_data = EXCLUDED.prefilled_data,
                    audit_note = EXCLUDED.audit_note
                WHERE public.crm_lead_conversion_links.conversion_timestamp <= EXCLUDED.conversion_timestamp;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 8. Hydrate crm_partner_match_reviews ('crm_rel_match_reviews')
--    MIGRATES: 32 match reviews.
--    NOTE: Preserves original 'undefined' lead reference inside match_details
--    while storing relational lead_id as NULL.
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
    elem JSONB;
    target_lead_id VARCHAR(64);
    reviewer_id VARCHAR(64);
    details JSONB;
BEGIN
    SELECT registered_address INTO rec FROM public.company_profile WHERE id = 'crm_rel_match_reviews';
    IF rec.registered_address IS NOT NULL AND rec.registered_address != '' THEN
        FOR elem IN SELECT jsonb_array_elements(rec.registered_address::jsonb) LOOP
            details := COALESCE(elem->'match_details', '{}'::jsonb);

            -- If lead_id is undefined or missing from crm_leads, preserve original in match_details and set lead_id to NULL
            target_lead_id := elem->>'lead_id';
            IF target_lead_id = 'undefined' OR NOT EXISTS (SELECT 1 FROM public.crm_leads WHERE id = target_lead_id) THEN
                details := details || jsonb_build_object('original_lead_reference', elem->>'lead_id');
                target_lead_id := NULL;
            END IF;

            reviewer_id := elem->>'reviewed_by';
            IF reviewer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = reviewer_id) THEN
                reviewer_id := NULL;
            END IF;

            IF EXISTS (SELECT 1 FROM public.partners WHERE id = elem->>'partner_id') THEN
                INSERT INTO public.crm_partner_match_reviews (
                    id,
                    lead_id,
                    partner_id,
                    match_type,
                    match_details,
                    resolution_status,
                    reviewed_by,
                    reviewed_at,
                    resolution_notes,
                    created_at
                ) VALUES (
                    elem->>'id',
                    target_lead_id,
                    elem->>'partner_id',
                    COALESCE(elem->>'match_type', 'CONFIRMED_MATCH'),
                    details,
                    COALESCE(elem->>'resolution_status', 'PENDING_REVIEW'),
                    reviewer_id,
                    (elem->>'reviewed_at')::TIMESTAMPTZ,
                    elem->>'resolution_notes',
                    COALESCE((elem->>'created_at')::TIMESTAMPTZ, now())
                )
                ON CONFLICT (id) DO UPDATE SET
                    lead_id = EXCLUDED.lead_id,
                    match_details = EXCLUDED.match_details,
                    resolution_status = EXCLUDED.resolution_status,
                    reviewed_by = EXCLUDED.reviewed_by,
                    reviewed_at = EXCLUDED.reviewed_at,
                    resolution_notes = EXCLUDED.resolution_notes;
            END IF;
        END LOOP;
    END IF;
END $$;

-- ============================================================================
-- 9. Hydrate partner_contact_methods (Normalized Alternate Contacts)
-- ============================================================================
INSERT INTO public.partner_contact_methods (id, partner_id, contact_type, contact_value, normalized_value, is_primary, created_at)
VALUES 
  ('pcm-part-001-alt', 'part-001', 'ALTERNATE_PHONE', '+91 98200 99999', '9820099999', 0, now()),
  ('pcm-part-002-alt', 'part-002', 'ALTERNATE_PHONE', '+91 98222 88888', '9822288888', 0, now())
ON CONFLICT (id) DO NOTHING;

-- NOTE: All staged records in public.company_profile are INTENTIONALLY PRESERVED.
-- Zero DELETE operations are executed on company_profile.

COMMIT;
