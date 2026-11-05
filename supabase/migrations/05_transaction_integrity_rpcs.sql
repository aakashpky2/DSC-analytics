-- Migration 05: SignSync B2B Transaction Integrity & Concurrency Controls
-- Implements database-level CHECK constraints and atomic PL/pgSQL transaction procedures

-- 1. Database-level Constraints for Financial & Inventory safety
DO $$
BEGIN
    -- Prevent negative stock on hand
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_branch_token_stocks_quantity_positive') THEN
        ALTER TABLE branch_token_stocks ADD CONSTRAINT chk_branch_token_stocks_quantity_positive CHECK (quantity_on_hand >= 0);
    END IF;

    -- Prevent negative outstanding balance on invoices
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_outstanding_positive') THEN
        ALTER TABLE invoices ADD CONSTRAINT chk_invoices_outstanding_positive CHECK (outstanding_balance >= 0);
    END IF;

    -- Prevent negative credit limit on partners
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_partners_credit_limit_positive') THEN
        ALTER TABLE partners ADD CONSTRAINT chk_partners_credit_limit_positive CHECK (credit_limit >= 0);
    END IF;
END $$;

-- 2. Atomic Payment Verification Procedure
CREATE OR REPLACE FUNCTION verify_payment_transaction(
    p_payment_id TEXT,
    p_user_id TEXT,
    p_action TEXT DEFAULT 'approved', -- 'approved' or 'rejected'
    p_rejection_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_new_paid NUMERIC;
    v_new_outstanding NUMERIC;
    v_ledger_id TEXT;
    v_current_ledger_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- 1. Lock payment record with FOR UPDATE
    SELECT * INTO v_payment 
    FROM payments_received 
    WHERE id = p_payment_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment record not found', 'code', 'NOT_FOUND');
    END IF;

    IF v_payment.verified_status <> 'pending_verification' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Payment is already processed with status: ' || v_payment.verified_status,
            'code', 'ALREADY_PROCESSED'
        );
    END IF;

    -- 2. Handle Rejection
    IF p_action = 'rejected' THEN
        UPDATE payments_received
        SET verified_status = 'rejected',
            status = 'rejected',
            verified_by = p_user_id,
            verified_at = NOW(),
            notes = COALESCE(notes, '') || ' [Rejected: ' || COALESCE(p_rejection_remarks, 'No remarks') || ']'
        WHERE id = p_payment_id;

        RETURN jsonb_build_object('success', true, 'action', 'rejected', 'payment_id', p_payment_id);
    END IF;

    -- 3. Lock associated Invoice
    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = v_payment.invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Associated invoice not found', 'code', 'INVOICE_NOT_FOUND');
    END IF;

    IF v_payment.amount_paid > v_invoice.outstanding_balance THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Payment amount (' || v_payment.amount_paid || ') exceeds invoice outstanding balance (' || v_invoice.outstanding_balance || ')',
            'code', 'OVERPAYMENT_NOT_ALLOWED'
        );
    END IF;

    -- Calculate updated amounts
    v_new_paid := COALESCE(v_invoice.paid_amount, 0) + v_payment.amount_paid;
    v_new_outstanding := v_invoice.outstanding_balance - v_payment.amount_paid;

    -- 4. Atomically update Invoice
    UPDATE invoices
    SET paid_amount = v_new_paid,
        outstanding_balance = v_new_outstanding,
        payment_status = CASE 
            WHEN v_new_outstanding <= 0.001 THEN 'paid' 
            ELSE 'partially_paid' 
        END,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- 5. Atomically update Payment record
    UPDATE payments_received
    SET verified_status = 'verified',
        status = 'verified',
        verified_by = p_user_id,
        verified_at = NOW()
    WHERE id = p_payment_id;

    -- 6. Atomically post to Partner Ledger
    SELECT COALESCE(closing_balance, 0) INTO v_current_ledger_balance
    FROM partner_ledger_entries
    WHERE partner_id = v_invoice.partner_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_current_ledger_balance IS NULL THEN
        v_current_ledger_balance := 0;
    END IF;

    v_new_balance := v_current_ledger_balance - v_payment.amount_paid;
    v_ledger_id := 'led-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);

    INSERT INTO partner_ledger_entries (
        id, partner_id, invoice_id, entry_type,
        amount, credit, debit, running_balance, closing_balance,
        description, reference_no, created_by, created_at
    ) VALUES (
        v_ledger_id,
        v_invoice.partner_id,
        v_invoice.id,
        'payment',
        v_payment.amount_paid,
        v_payment.amount_paid,
        0,
        v_new_balance,
        v_new_balance,
        'Payment received for invoice #' || COALESCE(v_invoice.invoice_number, v_invoice.id) || ' (UTR: ' || COALESCE(v_payment.transaction_reference_utr, 'N/A') || ')',
        v_payment.transaction_reference_utr,
        p_user_id,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'action', 'verified',
        'payment_id', p_payment_id,
        'invoice_id', v_invoice.id,
        'new_paid', v_new_paid,
        'new_outstanding', v_new_outstanding,
        'ledger_id', v_ledger_id,
        'new_ledger_balance', v_new_balance
    );
END;
$$;

-- 3. Atomic Stock Transfer Procedure
CREATE OR REPLACE FUNCTION transfer_branch_stock(
    p_source_id TEXT,
    p_dest_id TEXT,
    p_model TEXT,
    p_quantity INT,
    p_user_id TEXT,
    p_remarks TEXT DEFAULT NULL,
    p_transfer_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_stock RECORD;
    v_challan_id TEXT;
    v_challan_number TEXT;
    v_counter INT;
    v_prefix TEXT := 'DC-';
BEGIN
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transfer quantity must be a positive whole number', 'code', 'INVALID_QUANTITY');
    END IF;

    IF p_source_id = p_dest_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source and destination branches cannot be the same', 'code', 'SAME_BRANCH');
    END IF;

    -- 1. Lock source stock row FOR UPDATE
    SELECT * INTO v_source_stock
    FROM branch_token_stocks
    WHERE branch_id = p_source_id AND token_model = p_model
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Token model ' || p_model || ' not found at source branch', 'code', 'MODEL_NOT_FOUND');
    END IF;

    IF v_source_stock.quantity_on_hand < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Insufficient stock at source branch. Available: ' || v_source_stock.quantity_on_hand || ', Requested: ' || p_quantity,
            'code', 'INSUFFICIENT_STOCK'
        );
    END IF;

    -- 2. Deduct from source branch stock atomically
    UPDATE branch_token_stocks
    SET quantity_on_hand = quantity_on_hand - p_quantity,
        updated_at = NOW()
    WHERE id = v_source_stock.id;

    -- 3. Generate sequential challan number atomically
    v_counter := FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::INT;
    v_challan_id := 'ch-' || v_counter::TEXT;
    v_challan_number := v_prefix || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(v_counter::TEXT, LENGTH(v_counter::TEXT) - 3);

    -- 4. Create Delivery Challan with status 'dispatched'
    -- Note: Destination stock is NOT credited until physical receipt
    INSERT INTO delivery_challans (
        id, challan_number, source_branch_id, destination_branch_id,
        token_model, quantity, status, dispatched_by, dispatched_at,
        transfer_date, remarks, created_at, updated_at
    ) VALUES (
        v_challan_id,
        v_challan_number,
        p_source_id,
        p_dest_id,
        p_model,
        p_quantity,
        'dispatched',
        p_user_id,
        NOW(),
        p_transfer_date,
        p_remarks,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'challan_id', v_challan_id,
        'challan_number', v_challan_number,
        'source_branch_id', p_source_id,
        'destination_branch_id', p_dest_id,
        'quantity', p_quantity,
        'remaining_source_stock', (v_source_stock.quantity_on_hand - p_quantity)
    );
END;
$$;

-- 4. Atomic Delivery Challan Receipt Procedure
CREATE OR REPLACE FUNCTION receive_transfer_challan(
    p_challan_id TEXT,
    p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_challan RECORD;
    v_dest_stock RECORD;
BEGIN
    -- 1. Lock Challan FOR UPDATE
    SELECT * INTO v_challan
    FROM delivery_challans
    WHERE id = p_challan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challan record not found', 'code', 'NOT_FOUND');
    END IF;

    IF v_challan.status = 'received' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challan has already been received', 'code', 'ALREADY_RECEIVED');
    END IF;

    IF v_challan.status <> 'dispatched' AND v_challan.status <> 'in_transit' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challan is not in a receivable status: ' || v_challan.status, 'code', 'INVALID_STATUS');
    END IF;

    -- 2. Mark Challan as Received
    UPDATE delivery_challans
    SET status = 'received',
        received_by = p_user_id,
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_challan_id;

    -- 3. Atomically Upsert Destination Branch Stock
    SELECT * INTO v_dest_stock
    FROM branch_token_stocks
    WHERE branch_id = v_challan.destination_branch_id AND token_model = v_challan.token_model
    FOR UPDATE;

    IF FOUND THEN
        UPDATE branch_token_stocks
        SET quantity_on_hand = quantity_on_hand + v_challan.quantity,
            updated_at = NOW()
        WHERE id = v_dest_stock.id;
    ELSE
        INSERT INTO branch_token_stocks (
            id, branch_id, token_model, quantity_on_hand, reserved_quantity, created_at, updated_at
        ) VALUES (
            'stk-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT,
            v_challan.destination_branch_id,
            v_challan.token_model,
            v_challan.quantity,
            0,
            NOW(),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'challan_id', p_challan_id,
        'destination_branch_id', v_challan.destination_branch_id,
        'token_model', v_challan.token_model,
        'quantity_added', v_challan.quantity
    );
END;
$$;

-- 5. Atomic Stock Adjustment Procedure
CREATE OR REPLACE FUNCTION adjust_branch_stock(
    p_branch_id TEXT,
    p_model TEXT,
    p_adj_type TEXT, -- 'increase', 'decrease', 'damaged', 'write_off'
    p_quantity INT,
    p_reason TEXT,
    p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock RECORD;
    v_new_qty INT;
    v_adj_id TEXT;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjustment quantity must be greater than zero', 'code', 'INVALID_QUANTITY');
    END IF;

    SELECT * INTO v_stock
    FROM branch_token_stocks
    WHERE branch_id = p_branch_id AND token_model = p_model
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_adj_type IN ('decrease', 'damaged', 'write_off') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Stock item does not exist at branch to decrease', 'code', 'STOCK_NOT_FOUND');
        END IF;

        INSERT INTO branch_token_stocks (
            id, branch_id, token_model, quantity_on_hand, reserved_quantity, created_at, updated_at
        ) VALUES (
            'stk-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT,
            p_branch_id,
            p_model,
            p_quantity,
            0,
            NOW(),
            NOW()
        );
        v_new_qty := p_quantity;
    ELSE
        IF p_adj_type IN ('decrease', 'damaged', 'write_off') THEN
            IF v_stock.quantity_on_hand < p_quantity THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Insufficient stock to adjust. Current: ' || v_stock.quantity_on_hand || ', Requested deduction: ' || p_quantity,
                    'code', 'INSUFFICIENT_STOCK'
                );
            END IF;
            v_new_qty := v_stock.quantity_on_hand - p_quantity;
        ELSE
            v_new_qty := v_stock.quantity_on_hand + p_quantity;
        END IF;

        UPDATE branch_token_stocks
        SET quantity_on_hand = v_new_qty,
            updated_at = NOW()
        WHERE id = v_stock.id;
    END IF;

    v_adj_id := 'adj-' || FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)::TEXT;
    INSERT INTO stock_adjustments (
        id, branch_id, token_model, adjustment_type, quantity,
        reason, adjusted_by, created_at
    ) VALUES (
        v_adj_id,
        p_branch_id,
        p_model,
        p_adj_type,
        p_quantity,
        p_reason,
        p_user_id,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'adjustment_id', v_adj_id,
        'branch_id', p_branch_id,
        'token_model', p_model,
        'new_quantity_on_hand', v_new_qty
    );
END;
$$;

-- 6. Atomic CRM Lead Merge Procedure
CREATE OR REPLACE FUNCTION merge_crm_leads(
    p_primary_id TEXT,
    p_secondary_id TEXT,
    p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_primary RECORD;
    v_secondary RECORD;
    v_moved_followups INT := 0;
BEGIN
    IF p_primary_id = p_secondary_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot merge a lead into itself', 'code', 'SAME_LEAD');
    END IF;

    -- Lock both leads FOR UPDATE
    SELECT * INTO v_primary FROM crm_leads WHERE id = p_primary_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Primary lead not found', 'code', 'PRIMARY_NOT_FOUND');
    END IF;

    SELECT * INTO v_secondary FROM crm_leads WHERE id = p_secondary_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Secondary lead not found', 'code', 'SECONDARY_NOT_FOUND');
    END IF;

    IF v_secondary.is_merged = 1 OR v_secondary.status = 'merged' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Secondary lead has already been merged', 'code', 'ALREADY_MERGED');
    END IF;

    -- Re-parent follow-ups to primary lead
    UPDATE crm_lead_follow_ups
    SET lead_id = p_primary_id,
        notes = COALESCE(notes, '') || ' [Transferred from merged lead ' || p_secondary_id || ']'
    WHERE lead_id = p_secondary_id;
    GET DIAGNOSTICS v_moved_followups = ROW_COUNT;

    -- Mark secondary lead as merged
    UPDATE crm_leads
    SET is_merged = 1,
        status = 'merged',
        merged_into_lead_id = p_primary_id,
        updated_at = NOW(),
        notes = COALESCE(notes, '') || ' [Merged into lead ' || p_primary_id || ' by ' || p_user_id || ' at ' || NOW()::TEXT || ']'
    WHERE id = p_secondary_id;

    RETURN jsonb_build_object(
        'success', true,
        'primary_lead_id', p_primary_id,
        'secondary_lead_id', p_secondary_id,
        'moved_followups', v_moved_followups
    );
END;
$$;

