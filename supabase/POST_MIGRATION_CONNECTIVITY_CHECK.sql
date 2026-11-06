-- ==============================================================================
-- SIGNSYNC / DBIZ ERP: POST-MIGRATION & DATABASE CONNECTIVITY VERIFICATION
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to audit:
-- 1. Hardware Token Status Integrity & Normalization
-- 2. Courier Dispatch Status Integrity & Normalization
-- 3. Authoritative vs Inactive Courier Partners
-- 4. Procurement Batch to Serial Relationship & Orphan Check
-- 5. Relational Master Stores & JSON Configuration State
-- 6. Audit Trail Logging & System Activity
-- ==============================================================================

-- 1. CHECK TOKEN INVENTORY STATUSES (Expected: All uppercase, 0 lowercase 'in_stock')
SELECT 
    status AS token_status,
    COUNT(*) AS total_tokens,
    CASE 
        WHEN status IN ('AVAILABLE', 'RESERVED', 'CONFIGURED', 'DISPATCHED', 'DELIVERED', 'BLOCKED_DEFECTIVE', 'RETURNED_RMA') THEN 'VALID_PRODUCTION_STATUS'
        ELSE 'NEEDS_NORMALIZATION'
    END AS status_health
FROM token_serials
GROUP BY status
ORDER BY total_tokens DESC;

-- 2. CHECK TOKEN BATCH TO SERIAL RELATIONSHIP (Expected: 0 orphan serials)
SELECT 
    COUNT(*) AS total_serials_in_system,
    COUNT(ts.batch_id) AS serials_with_batch_id,
    COUNT(tpb.id) AS matched_procurement_batches,
    COUNT(*) - COUNT(tpb.id) AS orphan_serials_count
FROM token_serials ts
LEFT JOIN token_purchase_batches tpb ON ts.batch_id = tpb.id;

-- 3. CHECK COURIER DISPATCH STATUSES (Expected: 0 lowercase 'manifested'/'delivered', 0 raw JSON strings)
SELECT 
    status AS dispatch_status,
    COUNT(*) AS total_shipments,
    CASE 
        WHEN status IN ('MANIFESTED', 'HANDED_TO_COURIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ACKNOWLEDGED', 'DELIVERY_FAILED', 'RTO_IN_TRANSIT', 'RETURNED_TO_OFFICE') THEN 'VALID_LIFECYCLE_STATUS'
        ELSE 'INVALID_OR_UNNORMALIZED'
    END AS status_health
FROM courier_dispatches
GROUP BY status
ORDER BY total_shipments DESC;

-- 4. CHECK COURIER PARTNERS (Expected: Real carriers active = 1, test couriers active = 0)
SELECT 
    id,
    company_name,
    CASE 
        WHEN is_active = 1 THEN 'ACTIVE_PRODUCTION_CARRIER'
        ELSE 'INACTIVE_OR_ARCHIVED'
    END AS carrier_status,
    tracking_url_template,
    created_at
FROM courier_partners
ORDER BY is_active DESC, company_name ASC;

-- 5. CHECK RELATIONAL MASTER STORES IN COMPANY_PROFILE
SELECT 
    id AS store_identifier,
    trade_name AS store_description,
    jsonb_array_length(registered_address::jsonb) AS items_in_store,
    updated_at AS last_updated
FROM company_profile
WHERE id IN (
    'token_master_statuses',
    'token_master_rma_reasons',
    'token_master_manufacturers',
    'token_rel_custody_history',
    'token_rel_rma_records',
    'courier_master_shipment_statuses',
    'courier_master_rto_reasons',
    'courier_master_dispatch_methods',
    'courier_master_packaging_types',
    'courier_master_sla_settings',
    'courier_rel_manifests',
    'courier_rel_milestones',
    'courier_rel_rto_tasks',
    'courier_rel_notifications'
)
ORDER BY id ASC;

-- 6. CHECK RECENT AUDIT LOGS FOR TOKEN & COURIER ACTIONS
SELECT 
    action_type,
    module_key,
    table_affected,
    COUNT(*) AS log_count,
    MAX(created_at) AS most_recent_event
FROM audit_logs
WHERE module_key IN ('inventory', 'courier', 'dsc')
GROUP BY action_type, module_key, table_affected
ORDER BY most_recent_event DESC;

