-- ==============================================================================
-- SIGNSYNC / DBIZ ERP: OPERATIONAL ONBOARDING CLEANUP & STATUS NORMALIZATION
-- ==============================================================================
-- Purpose:
-- 1. Deactivates automated acceptance-test courier partners (Express Logistics *, Express Carrier *).
-- 2. Normalizes legacy lowercase token statuses ('in_stock' -> 'AVAILABLE').
-- 3. Normalizes legacy lowercase courier dispatch statuses ('manifested' -> 'MANIFESTED', 'delivered' -> 'DELIVERED').
-- 4. Corrects malformed status string in early test dispatch DSP-600822.
-- ==============================================================================

BEGIN;

-- 1. Deactivate test couriers while preserving historical references
UPDATE courier_partners
SET is_active = 0
WHERE company_name LIKE 'Express Logistics%' OR company_name LIKE 'Express Carrier%';

-- 2. Normalize token serial statuses to standard uppercase AVAILABLE
UPDATE token_serials
SET status = 'AVAILABLE'
WHERE status = 'in_stock';

-- 3. Normalize courier dispatch statuses to standard uppercase
UPDATE courier_dispatches
SET status = 'MANIFESTED'
WHERE status = 'manifested';

UPDATE courier_dispatches
SET status = 'DELIVERED'
WHERE status = 'delivered';

-- 4. Correct malformed status on test dispatch DSP-600822
UPDATE courier_dispatches
SET status = 'RETURNED_TO_OFFICE'
WHERE dispatch_number = 'DSP-600822' AND status LIKE '{%';

COMMIT;

-- ==============================================================================
-- POST-CLEANUP VERIFICATION QUERY
-- ==============================================================================
-- Run the following to verify normalization:
-- SELECT status, COUNT(*) FROM token_serials GROUP BY status;
-- SELECT status, COUNT(*) FROM courier_dispatches GROUP BY status;
-- SELECT company_name, is_active FROM courier_partners;

