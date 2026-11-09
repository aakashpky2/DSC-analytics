-- ============================================================================
-- DBIZ ERP / SIGNSYNC: PURCHASE BILL + OPENING STOCK + PROFILE LEDGER
-- Final Migration Script (Strict Multi-Tenant Isolation & Relational Integrity)
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: PRE-FLIGHT VALIDATION ASSERTION
-- Fail fast if any existing row contains NULL in columns to be made NOT NULL
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_null_bills INT := 0;
    v_null_items INT := 0;
    v_null_opening INT := 0;
    v_null_stocks INT := 0;
BEGIN
    -- Check token_purchase_bills
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_purchase_bills') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.token_purchase_bills WHERE organization_id IS NULL OR company_profile_id IS NULL OR voucher_number IS NULL OR supplier_invoice_number IS NULL OR vendor_party_id IS NULL'
        INTO v_null_bills;
        IF v_null_bills > 0 THEN
            RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: Found % rows with NULL required columns in token_purchase_bills. Migration aborted.', v_null_bills;
        END IF;
    END IF;

    -- Check token_purchase_bill_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_purchase_bill_items') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.token_purchase_bill_items WHERE organization_id IS NULL OR purchase_bill_id IS NULL OR company_profile_id IS NULL OR quantity IS NULL OR unit_rate IS NULL OR taxable_value IS NULL OR line_total IS NULL'
        INTO v_null_items;
        IF v_null_items > 0 THEN
            RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: Found % rows with NULL required columns in token_purchase_bill_items. Migration aborted.', v_null_items;
        END IF;
    END IF;

    -- Check token_opening_stock
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_opening_stock') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.token_opening_stock WHERE organization_id IS NULL OR company_profile_id IS NULL OR token_model_id IS NULL OR quantity IS NULL OR purchase_rate IS NULL OR total_valuation IS NULL'
        INTO v_null_opening;
        IF v_null_opening > 0 THEN
            RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: Found % rows with NULL required columns in token_opening_stock. Migration aborted.', v_null_opening;
        END IF;
    END IF;

    -- Check token_profile_stocks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_profile_stocks') THEN
        EXECUTE 'SELECT COUNT(*) FROM public.token_profile_stocks WHERE organization_id IS NULL OR company_profile_id IS NULL OR token_model_id IS NULL'
        INTO v_null_stocks;
        IF v_null_stocks > 0 THEN
            RAISE EXCEPTION 'PRE-FLIGHT CHECK FAILED: Found % rows with NULL required columns in token_profile_stocks. Migration aborted.', v_null_stocks;
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 2: ANCHOR PARENT COMPOSITE UNIQUE CONSTRAINTS FOR STRICT TENANT SCOPING
-- ----------------------------------------------------------------------------
-- 1. purchase_internal_profiles (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_purchase_internal_profiles_org_id') THEN
        ALTER TABLE public.purchase_internal_profiles
            ADD CONSTRAINT uq_purchase_internal_profiles_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- 2. token_purchase_parties (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_token_purchase_parties_org_id') THEN
        ALTER TABLE public.token_purchase_parties
            ADD CONSTRAINT uq_token_purchase_parties_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- 3. token_purchase_orders (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_token_purchase_orders_org_id') THEN
        ALTER TABLE public.token_purchase_orders
            ADD CONSTRAINT uq_token_purchase_orders_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- 4. token_purchase_receipts (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_token_purchase_receipts_org_id') THEN
        ALTER TABLE public.token_purchase_receipts
            ADD CONSTRAINT uq_token_purchase_receipts_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- 5. token_purchase_order_items (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_token_purchase_order_items_org_id') THEN
        ALTER TABLE public.token_purchase_order_items
            ADD CONSTRAINT uq_token_purchase_order_items_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- 6. token_models (organization_id, id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_token_models_org_id') THEN
        ALTER TABLE public.token_models
            ADD CONSTRAINT uq_token_models_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: CREATE / DEFENSIVELY ALTER token_purchase_bills
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_bills (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    company_profile_id TEXT NOT NULL,
    voucher_number TEXT NOT NULL,
    supplier_invoice_number TEXT NOT NULL,
    accounting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    purchase_order_id TEXT,
    purchase_receipt_id TEXT,
    vendor_party_id TEXT NOT NULL,
    place_of_supply TEXT,
    vendor_gstin TEXT,
    vendor_state TEXT,
    vendor_state_code TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    company_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    vendor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    posted_by TEXT,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.token_purchase_bills
    ADD COLUMN IF NOT EXISTS organization_id TEXT,
    ADD COLUMN IF NOT EXISTS company_profile_id TEXT,
    ADD COLUMN IF NOT EXISTS voucher_number TEXT,
    ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT,
    ADD COLUMN IF NOT EXISTS accounting_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS purchase_order_id TEXT,
    ADD COLUMN IF NOT EXISTS purchase_receipt_id TEXT,
    ADD COLUMN IF NOT EXISTS vendor_party_id TEXT,
    ADD COLUMN IF NOT EXISTS place_of_supply TEXT,
    ADD COLUMN IF NOT EXISTS vendor_gstin TEXT,
    ADD COLUMN IF NOT EXISTS vendor_state TEXT,
    ADD COLUMN IF NOT EXISTS vendor_state_code TEXT,
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS other_charges NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS round_off NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS company_profile_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS vendor_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by TEXT,
    ADD COLUMN IF NOT EXISTS posted_by TEXT,
    ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce NOT NULL constraints
ALTER TABLE public.token_purchase_bills ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.token_purchase_bills ALTER COLUMN company_profile_id SET NOT NULL;
ALTER TABLE public.token_purchase_bills ALTER COLUMN voucher_number SET NOT NULL;
ALTER TABLE public.token_purchase_bills ALTER COLUMN supplier_invoice_number SET NOT NULL;
ALTER TABLE public.token_purchase_bills ALTER COLUMN vendor_party_id SET NOT NULL;

-- Safe single-instance constraint creation for token_purchase_bills
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_purchase_bill_voucher_org') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT uq_purchase_bill_voucher_org UNIQUE (organization_id, voucher_number);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_purchase_bill_profile') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT uq_purchase_bill_profile UNIQUE (id, company_profile_id);
    END IF;
    -- Organization-safe composite profile FK (cross-tenant profile blocked)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_org_profile') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT fk_bill_org_profile
            FOREIGN KEY (organization_id, company_profile_id) REFERENCES public.purchase_internal_profiles(organization_id, id);
    END IF;
    -- Organization-safe composite vendor FK (cross-tenant vendor blocked)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_org_vendor') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT fk_bill_org_vendor
            FOREIGN KEY (organization_id, vendor_party_id) REFERENCES public.token_purchase_parties(organization_id, id);
    END IF;
    -- Organization-safe optional PO FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_org_po') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT fk_bill_org_po
            FOREIGN KEY (organization_id, purchase_order_id) REFERENCES public.token_purchase_orders(organization_id, id);
    END IF;
    -- Organization-safe optional Receipt FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_org_receipt') THEN
        ALTER TABLE public.token_purchase_bills ADD CONSTRAINT fk_bill_org_receipt
            FOREIGN KEY (organization_id, purchase_receipt_id) REFERENCES public.token_purchase_receipts(organization_id, id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_bills_org ON public.token_purchase_bills(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_profile ON public.token_purchase_bills(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_vendor ON public.token_purchase_bills(vendor_party_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_dates ON public.token_purchase_bills(organization_id, accounting_date, supplier_invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON public.token_purchase_bills(organization_id, status);

-- ----------------------------------------------------------------------------
-- STEP 4: CREATE / DEFENSIVELY ALTER token_purchase_bill_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_bill_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    purchase_bill_id TEXT NOT NULL,
    company_profile_id TEXT NOT NULL,
    purchase_order_item_id TEXT,
    token_model_id TEXT,
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    description TEXT NOT NULL,
    hsn_sac TEXT DEFAULT '8523',
    quantity INT NOT NULL,
    unit_rate NUMERIC(12, 2) NOT NULL,
    taxable_value NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12, 2) NOT NULL,
    token_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.token_purchase_bill_items
    ADD COLUMN IF NOT EXISTS organization_id TEXT,
    ADD COLUMN IF NOT EXISTS purchase_bill_id TEXT,
    ADD COLUMN IF NOT EXISTS company_profile_id TEXT,
    ADD COLUMN IF NOT EXISTS purchase_order_item_id TEXT,
    ADD COLUMN IF NOT EXISTS token_model_id TEXT,
    ADD COLUMN IF NOT EXISTS token_company_id TEXT,
    ADD COLUMN IF NOT EXISTS token_product_id TEXT,
    ADD COLUMN IF NOT EXISTS token_version_id TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS hsn_sac TEXT DEFAULT '8523',
    ADD COLUMN IF NOT EXISTS quantity INT,
    ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) DEFAULT 18.00,
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_tax NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS other_charges NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS token_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce NOT NULL constraints
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN purchase_bill_id SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN company_profile_id SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN quantity SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN unit_rate SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN taxable_value SET NOT NULL;
ALTER TABLE public.token_purchase_bill_items ALTER COLUMN line_total SET NOT NULL;

-- Safe single-instance constraint creation for token_purchase_bill_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_bill_qty') THEN
        ALTER TABLE public.token_purchase_bill_items ADD CONSTRAINT chk_positive_bill_qty CHECK (quantity > 0);
    END IF;
    -- Enforce exact same company profile between line item and parent bill
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_item_parent_profile') THEN
        ALTER TABLE public.token_purchase_bill_items ADD CONSTRAINT fk_bill_item_parent_profile
            FOREIGN KEY (purchase_bill_id, company_profile_id) REFERENCES public.token_purchase_bills(id, company_profile_id) ON DELETE CASCADE;
    END IF;
    -- Organization-safe composite profile FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_item_org_profile') THEN
        ALTER TABLE public.token_purchase_bill_items ADD CONSTRAINT fk_bill_item_org_profile
            FOREIGN KEY (organization_id, company_profile_id) REFERENCES public.purchase_internal_profiles(organization_id, id);
    END IF;
    -- Organization-safe composite token model FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bill_item_org_model') THEN
        ALTER TABLE public.token_purchase_bill_items ADD CONSTRAINT fk_bill_item_org_model
            FOREIGN KEY (organization_id, token_model_id) REFERENCES public.token_models(organization_id, id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill ON public.token_purchase_bill_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_profile ON public.token_purchase_bill_items(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_org ON public.token_purchase_bill_items(organization_id);

-- ----------------------------------------------------------------------------
-- STEP 5: CREATE / DEFENSIVELY ALTER token_opening_stock
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_opening_stock (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    company_profile_id TEXT NOT NULL,
    opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
    token_model_id TEXT NOT NULL,
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    item_description TEXT NOT NULL,
    quantity INT NOT NULL,
    purchase_rate NUMERIC(12, 2) NOT NULL,
    total_valuation NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.token_opening_stock
    ADD COLUMN IF NOT EXISTS organization_id TEXT,
    ADD COLUMN IF NOT EXISTS company_profile_id TEXT,
    ADD COLUMN IF NOT EXISTS opening_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS token_model_id TEXT,
    ADD COLUMN IF NOT EXISTS token_company_id TEXT,
    ADD COLUMN IF NOT EXISTS token_product_id TEXT,
    ADD COLUMN IF NOT EXISTS token_version_id TEXT,
    ADD COLUMN IF NOT EXISTS item_description TEXT,
    ADD COLUMN IF NOT EXISTS quantity INT,
    ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS total_valuation NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce NOT NULL constraints (token_model_id is strictly NOT NULL)
ALTER TABLE public.token_opening_stock ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.token_opening_stock ALTER COLUMN company_profile_id SET NOT NULL;
ALTER TABLE public.token_opening_stock ALTER COLUMN token_model_id SET NOT NULL;
ALTER TABLE public.token_opening_stock ALTER COLUMN quantity SET NOT NULL;
ALTER TABLE public.token_opening_stock ALTER COLUMN purchase_rate SET NOT NULL;
ALTER TABLE public.token_opening_stock ALTER COLUMN total_valuation SET NOT NULL;

-- Safe single-instance constraint creation for token_opening_stock
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_positive_opening_qty') THEN
        ALTER TABLE public.token_opening_stock ADD CONSTRAINT chk_positive_opening_qty CHECK (quantity >= 0);
    END IF;
    -- Organization-safe composite profile FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_opening_stock_org_profile') THEN
        ALTER TABLE public.token_opening_stock ADD CONSTRAINT fk_opening_stock_org_profile
            FOREIGN KEY (organization_id, company_profile_id) REFERENCES public.purchase_internal_profiles(organization_id, id);
    END IF;
    -- Organization-safe composite token model FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_opening_stock_org_model') THEN
        ALTER TABLE public.token_opening_stock ADD CONSTRAINT fk_opening_stock_org_model
            FOREIGN KEY (organization_id, token_model_id) REFERENCES public.token_models(organization_id, id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opening_stock_org ON public.token_opening_stock(organization_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_profile ON public.token_opening_stock(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_date ON public.token_opening_stock(organization_id, opening_date);

-- ----------------------------------------------------------------------------
-- STEP 6: CREATE / DEFENSIVELY ALTER token_profile_stocks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_profile_stocks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    company_profile_id TEXT NOT NULL,
    token_model_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    opening_quantity INT NOT NULL DEFAULT 0,
    purchased_quantity INT NOT NULL DEFAULT 0,
    issued_quantity INT NOT NULL DEFAULT 0,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    last_purchase_rate NUMERIC(12, 2),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column alignment
ALTER TABLE public.token_profile_stocks
    ADD COLUMN IF NOT EXISTS organization_id TEXT,
    ADD COLUMN IF NOT EXISTS company_profile_id TEXT,
    ADD COLUMN IF NOT EXISTS token_model_id TEXT,
    ADD COLUMN IF NOT EXISTS model_name TEXT,
    ADD COLUMN IF NOT EXISTS opening_quantity INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchased_quantity INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS issued_quantity INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_on_hand INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_purchase_rate NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce NOT NULL constraints (token_model_id is strictly NOT NULL)
ALTER TABLE public.token_profile_stocks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.token_profile_stocks ALTER COLUMN company_profile_id SET NOT NULL;
ALTER TABLE public.token_profile_stocks ALTER COLUMN token_model_id SET NOT NULL;

-- Safe single-instance constraint creation for token_profile_stocks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_profile_token_model') THEN
        ALTER TABLE public.token_profile_stocks ADD CONSTRAINT uq_profile_token_model
            UNIQUE (organization_id, company_profile_id, token_model_id);
    END IF;
    -- Organization-safe composite profile FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profile_stock_org_profile') THEN
        ALTER TABLE public.token_profile_stocks ADD CONSTRAINT fk_profile_stock_org_profile
            FOREIGN KEY (organization_id, company_profile_id) REFERENCES public.purchase_internal_profiles(organization_id, id);
    END IF;
    -- Organization-safe composite token model FK
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profile_stock_org_model') THEN
        ALTER TABLE public.token_profile_stocks ADD CONSTRAINT fk_profile_stock_org_model
            FOREIGN KEY (organization_id, token_model_id) REFERENCES public.token_models(organization_id, id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profile_stocks_org ON public.token_profile_stocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_profile_stocks_profile ON public.token_profile_stocks(company_profile_id);

-- ----------------------------------------------------------------------------
-- STEP 7: ROW LEVEL SECURITY POLICIES (ZERO HARDCODED BYPASS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.token_purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_opening_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_profile_stocks ENABLE ROW LEVEL SECURITY;

-- 1. token_purchase_bills RLS
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_bills" ON public.token_purchase_bills;
DROP POLICY IF EXISTS "token_purchase_bills_org_isolation" ON public.token_purchase_bills;
CREATE POLICY "tenant_isolation_token_purchase_bills" ON public.token_purchase_bills
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- 2. token_purchase_bill_items RLS
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_bill_items" ON public.token_purchase_bill_items;
DROP POLICY IF EXISTS "token_purchase_bill_items_org_isolation" ON public.token_purchase_bill_items;
CREATE POLICY "tenant_isolation_token_purchase_bill_items" ON public.token_purchase_bill_items
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- 3. token_opening_stock RLS
DROP POLICY IF EXISTS "tenant_isolation_token_opening_stock" ON public.token_opening_stock;
DROP POLICY IF EXISTS "token_opening_stock_org_isolation" ON public.token_opening_stock;
CREATE POLICY "tenant_isolation_token_opening_stock" ON public.token_opening_stock
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

-- 4. token_profile_stocks RLS
DROP POLICY IF EXISTS "tenant_isolation_token_profile_stocks" ON public.token_profile_stocks;
DROP POLICY IF EXISTS "token_profile_stocks_org_isolation" ON public.token_profile_stocks;
CREATE POLICY "tenant_isolation_token_profile_stocks" ON public.token_profile_stocks
    FOR ALL
    USING (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    )
    WITH CHECK (
        organization_id = public.current_app_organization_id()
        OR auth.jwt() ->> 'role' = 'service_role'
        OR current_user = 'service_role'
        OR current_user = 'postgres'
    );

COMMIT;
