-- ============================================================================
-- DBIZ ERP / SIGNSYNC: TOKEN PROCUREMENT — PURCHASE ENTRY + FREIGHT INWARD + TRACKING
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   1. Adds preferred_courier_id to token_purchase_orders (optional preference)
--   2. Creates token_purchase_receipts & token_purchase_receipt_items (Purchase entries / GRN)
--   3. Extends existing courier_dispatches with procurement inward tracking & freight columns
--   4. Creates courier_dispatch_status_history for immutable status audit trail
--   5. Establishes RLS tenant-isolation policies
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: EXTEND token_purchase_orders WITH OPTIONAL PREFERRED COURIER
-- ----------------------------------------------------------------------------
ALTER TABLE public.token_purchase_orders
    ADD COLUMN IF NOT EXISTS preferred_courier_id TEXT REFERENCES public.courier_partners(id);

CREATE INDEX IF NOT EXISTS idx_po_preferred_courier ON public.token_purchase_orders(preferred_courier_id);

-- ----------------------------------------------------------------------------
-- STEP 2: CREATE token_purchase_receipts (PURCHASE / PROCUREMENT ENTRY MASTER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_receipts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    purchase_receipt_number TEXT NOT NULL,
    purchase_order_id TEXT NOT NULL REFERENCES public.token_purchase_orders(id),
    vendor_party_id TEXT NOT NULL REFERENCES public.token_purchase_parties(id),
    internal_profile_id TEXT NOT NULL REFERENCES public.purchase_internal_profiles(id),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    purchase_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'RECORDED', -- 'RECORDED', 'INWARD_CREATED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'
    notes TEXT,
    vendor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    internal_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_token_purchase_receipt_number_org UNIQUE (organization_id, purchase_receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_org ON public.token_purchase_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po ON public.token_purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_vendor ON public.token_purchase_receipts(vendor_party_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_datetime ON public.token_purchase_receipts(organization_id, purchase_datetime);

-- ----------------------------------------------------------------------------
-- STEP 3: CREATE token_purchase_receipt_items (LINE ITEMS PER RECEIPT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_receipt_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    purchase_receipt_id TEXT NOT NULL REFERENCES public.token_purchase_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id TEXT NOT NULL REFERENCES public.token_purchase_order_items(id),
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    description TEXT,
    quantity_ordered INT NOT NULL,
    quantity_received INT NOT NULL,
    unit_rate NUMERIC(12, 2) NOT NULL,
    taxable_value NUMERIC(12, 2) NOT NULL,
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    token_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_positive_received_qty CHECK (quantity_received > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt ON public.token_purchase_receipt_items(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_po_item ON public.token_purchase_receipt_items(purchase_order_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_org ON public.token_purchase_receipt_items(organization_id);

-- ----------------------------------------------------------------------------
-- STEP 4: EXTEND EXISTING courier_dispatches FOR FREIGHT / COURIER INWARD
-- ----------------------------------------------------------------------------
ALTER TABLE public.courier_dispatches
    ADD COLUMN IF NOT EXISTS purchase_order_id TEXT REFERENCES public.token_purchase_orders(id),
    ADD COLUMN IF NOT EXISTS purchase_receipt_id TEXT REFERENCES public.token_purchase_receipts(id),
    ADD COLUMN IF NOT EXISTS courier_partner_id TEXT REFERENCES public.courier_partners(id),
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS dispatch_datetime TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expected_delivery_datetime TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_delivery_datetime TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS courier_charge NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS freight_rate NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS charge_currency TEXT DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'DISPATCHED',
    ADD COLUMN IF NOT EXISTS current_location TEXT,
    ADD COLUMN IF NOT EXISTS destination_city TEXT,
    ADD COLUMN IF NOT EXISTS destination_district TEXT,
    ADD COLUMN IF NOT EXISTS destination_state_id TEXT,
    ADD COLUMN IF NOT EXISTS destination_country_id TEXT,
    ADD COLUMN IF NOT EXISTS destination_pincode TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_courier_dispatches_po ON public.courier_dispatches(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_courier_dispatches_receipt ON public.courier_dispatches(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_courier_dispatches_partner ON public.courier_dispatches(courier_partner_id);
CREATE INDEX IF NOT EXISTS idx_courier_dispatches_tracking ON public.courier_dispatches(tracking_number);
CREATE INDEX IF NOT EXISTS idx_courier_dispatches_dest_pin ON public.courier_dispatches(destination_pincode);
CREATE INDEX IF NOT EXISTS idx_courier_dispatches_dest_city ON public.courier_dispatches(destination_city);

-- ----------------------------------------------------------------------------
-- STEP 5: CREATE courier_dispatch_status_history (IMMUTABLE TRACKING AUDIT TRAIL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courier_dispatch_status_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    courier_dispatch_id TEXT NOT NULL REFERENCES public.courier_dispatches(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'DISPATCHED', 'IN_TRANSIT', 'DELAYED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'
    status_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_location TEXT,
    expected_delivery_datetime TIMESTAMPTZ,
    delay_reason TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courier_status_history_disp ON public.courier_dispatch_status_history(courier_dispatch_id);
CREATE INDEX IF NOT EXISTS idx_courier_status_history_org ON public.courier_dispatch_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_courier_status_history_datetime ON public.courier_dispatch_status_history(status_datetime);

-- ----------------------------------------------------------------------------
-- STEP 6: ROW LEVEL SECURITY POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.token_purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_dispatch_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_purchase_receipts_org_isolation" ON public.token_purchase_receipts;
CREATE POLICY "token_purchase_receipts_org_isolation"
    ON public.token_purchase_receipts
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    );

DROP POLICY IF EXISTS "token_purchase_receipt_items_org_isolation" ON public.token_purchase_receipt_items;
CREATE POLICY "token_purchase_receipt_items_org_isolation"
    ON public.token_purchase_receipt_items
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    );

DROP POLICY IF EXISTS "courier_dispatch_status_history_org_isolation" ON public.courier_dispatch_status_history;
CREATE POLICY "courier_dispatch_status_history_org_isolation"
    ON public.courier_dispatch_status_history
    FOR ALL
    USING (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    )
    WITH CHECK (
        organization_id = NULLIF(current_setting('app.current_organization_id', true), '')
        OR organization_id = 'comp-default'
    );

COMMIT;

