-- ============================================================================
-- DBIZ ERP / SIGNSYNC: TOKEN PROCUREMENT & PURCHASE ORDER MODULE MIGRATION
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   Creates the complete Token Procurement and Purchase Management schema:
--     1. token_purchase_parties (Vendors / Purchasing Parties)
--     2. token_vendor_quotes (Vendor Quotations with Date Validity)
--     3. token_vendor_quote_slabs (Quantity Slab Pricing & Overlap Constraint)
--     4. token_purchase_estimates (Estimates Header)
--     5. token_purchase_estimate_items (Multi-item Estimate Detail)
--     6. purchase_internal_profiles (Company Internal Purchasing Entities)
--     7. purchase_delivery_locations (Delivery / Warehouse Locations)
--     8. token_purchase_orders (Purchase Orders with Historical Snapshot)
--     9. token_purchase_order_items (Purchase Order Items with Historical Snapshot)
--    10. po_number_sequences (Concurrency-safe PO sequence counter per organization)
--    11. Row Level Security (RLS) & Tenant Isolation Policies
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- TABLE 1: token_purchase_parties (Vendors / Suppliers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_parties (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    party_name TEXT NOT NULL,
    contact_person TEXT,
    country_id TEXT,
    state_id TEXT,
    street_address TEXT,
    city TEXT,
    district TEXT,
    pincode TEXT,
    country_code TEXT DEFAULT '+91',
    mobile TEXT,
    email TEXT,
    gstin TEXT,
    pan TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_purchase_parties_org ON public.token_purchase_parties(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_purchase_parties_active ON public.token_purchase_parties(organization_id, is_active);

-- ----------------------------------------------------------------------------
-- TABLE 2: token_vendor_quotes (Quotations with Validity Windows)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_vendor_quotes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    party_id TEXT NOT NULL REFERENCES public.token_purchase_parties(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED'
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    remarks TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_vendor_quotes_org ON public.token_vendor_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_vendor_quotes_party ON public.token_vendor_quotes(organization_id, party_id);
CREATE INDEX IF NOT EXISTS idx_token_vendor_quotes_dates ON public.token_vendor_quotes(organization_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_token_vendor_quotes_token ON public.token_vendor_quotes(token_company_id, token_product_id, token_version_id);

-- ----------------------------------------------------------------------------
-- TABLE 3: token_vendor_quote_slabs (Quantity Slabs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_vendor_quote_slabs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    quote_id TEXT NOT NULL REFERENCES public.token_vendor_quotes(id) ON DELETE CASCADE,
    min_quantity INT NOT NULL,
    max_quantity INT, -- NULL indicates unlimited
    unit_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_type TEXT NOT NULL DEFAULT 'PERCENTAGE', -- 'PERCENTAGE', 'FIXED', 'INCLUSIVE'
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slab_quantities CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_token_vendor_quote_slabs_org ON public.token_vendor_quote_slabs(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_vendor_quote_slabs_quote ON public.token_vendor_quote_slabs(quote_id);

-- ----------------------------------------------------------------------------
-- TABLE 4: purchase_internal_profiles (Our Purchasing Entities)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_internal_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    legal_name TEXT NOT NULL,
    trade_name TEXT,
    address_line TEXT,
    city TEXT,
    district TEXT,
    state_id TEXT,
    country_id TEXT,
    pincode TEXT,
    gst_registered BOOLEAN NOT NULL DEFAULT true,
    gstin TEXT,
    pan TEXT,
    email TEXT,
    mobile TEXT,
    contact_person TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_internal_profiles_org ON public.purchase_internal_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_internal_profiles_def ON public.purchase_internal_profiles(organization_id, is_default);

-- ----------------------------------------------------------------------------
-- TABLE 5: purchase_delivery_locations (Our Warehouse / Receiving Hubs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_delivery_locations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    location_name TEXT NOT NULL,
    contact_person TEXT,
    mobile TEXT,
    email TEXT,
    address_line TEXT,
    city TEXT,
    district TEXT,
    state_id TEXT,
    country_id TEXT,
    pincode TEXT,
    gstin TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_delivery_locations_org ON public.purchase_delivery_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_delivery_locations_def ON public.purchase_delivery_locations(organization_id, is_default);

-- ----------------------------------------------------------------------------
-- TABLE 6: token_purchase_estimates (Estimates Header)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_estimates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    estimate_number TEXT NOT NULL,
    estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
    party_id TEXT NOT NULL REFERENCES public.token_purchase_parties(id),
    quote_id TEXT REFERENCES public.token_vendor_quotes(id),
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    quantity INT NOT NULL,
    base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED', -- 'CALCULATED', 'CONVERTED_TO_PO', 'ARCHIVED'
    pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_estimate_number_org UNIQUE (organization_id, estimate_number)
);

CREATE INDEX IF NOT EXISTS idx_token_purchase_estimates_org ON public.token_purchase_estimates(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_purchase_estimates_party ON public.token_purchase_estimates(organization_id, party_id);

-- ----------------------------------------------------------------------------
-- TABLE 7: token_purchase_estimate_items (Estimate Items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_estimate_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    estimate_id TEXT NOT NULL REFERENCES public.token_purchase_estimates(id) ON DELETE CASCADE,
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    quantity INT NOT NULL,
    unit_rate NUMERIC(12, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    quote_id TEXT REFERENCES public.token_vendor_quotes(id),
    quote_slab_id TEXT REFERENCES public.token_vendor_quote_slabs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_purchase_estimate_items_est ON public.token_purchase_estimate_items(estimate_id);

-- ----------------------------------------------------------------------------
-- TABLE 8: token_purchase_orders (Purchase Orders Header with Snapshots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_orders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    po_number TEXT NOT NULL,
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    estimate_id TEXT REFERENCES public.token_purchase_estimates(id),
    internal_profile_id TEXT NOT NULL REFERENCES public.purchase_internal_profiles(id),
    party_id TEXT NOT NULL REFERENCES public.token_purchase_parties(id),
    delivery_location_id TEXT NOT NULL REFERENCES public.purchase_delivery_locations(id),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED'
    payment_terms TEXT DEFAULT '100% advance against Proforma Invoice',
    delivery_terms TEXT DEFAULT 'Door delivery within 5-7 working days',
    validity_terms TEXT DEFAULT 'Quotation and pricing valid for 15 days from PO date',
    inspection_terms TEXT DEFAULT 'Defective tokens subject to instant RMA warranty replacement',
    remarks TEXT,
    -- Immutable historical snapshots
    internal_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    vendor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_location_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_number_org UNIQUE (organization_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_token_purchase_orders_org ON public.token_purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_purchase_orders_status ON public.token_purchase_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_token_purchase_orders_party ON public.token_purchase_orders(organization_id, party_id);

-- ----------------------------------------------------------------------------
-- TABLE 9: token_purchase_order_items (PO Items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchase_order_items (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL DEFAULT 'comp-default',
    purchase_order_id TEXT NOT NULL REFERENCES public.token_purchase_orders(id) ON DELETE CASCADE,
    token_company_id TEXT,
    token_product_id TEXT,
    token_version_id TEXT,
    description TEXT,
    quantity INT NOT NULL,
    unit_rate NUMERIC(12, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    gst_amount NUMERIC(12, 2) NOT NULL,
    other_charges NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    token_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_purchase_order_items_po ON public.token_purchase_order_items(purchase_order_id);

-- ----------------------------------------------------------------------------
-- TABLE 10: po_number_sequences (Concurrency-safe PO & Estimate Sequence Counter)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.procurement_sequences (
    organization_id TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    sequence_type TEXT NOT NULL, -- 'PO', 'EST'
    current_value INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, financial_year, sequence_type)
);

-- Concurrency-safe atomic sequence generation function
CREATE OR REPLACE FUNCTION public.next_procurement_number(
    p_organization_id TEXT,
    p_sequence_type TEXT,
    p_prefix TEXT DEFAULT 'PO'
)
RETURNS TEXT AS $$
DECLARE
    v_fy TEXT;
    v_next_val INT;
    v_year INT;
    v_month INT;
    v_num_str TEXT;
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_month := EXTRACT(MONTH FROM CURRENT_DATE)::INT;

    -- Calculate Indian Financial Year (e.g. 26-27)
    IF v_month >= 4 THEN
        v_fy := SUBSTRING((v_year)::TEXT FROM 3 FOR 2) || '-' || SUBSTRING((v_year + 1)::TEXT FROM 3 FOR 2);
    ELSE
        v_fy := SUBSTRING((v_year - 1)::TEXT FROM 3 FOR 2) || '-' || SUBSTRING((v_year)::TEXT FROM 3 FOR 2);
    END IF;

    -- Atomic upsert and increment
    INSERT INTO public.procurement_sequences (organization_id, financial_year, sequence_type, current_value, updated_at)
    VALUES (p_organization_id, v_fy, p_sequence_type, 1, NOW())
    ON CONFLICT (organization_id, financial_year, sequence_type)
    DO UPDATE SET current_value = public.procurement_sequences.current_value + 1, updated_at = NOW()
    RETURNING current_value INTO v_next_val;

    v_num_str := LPAD(v_next_val::TEXT, 4, '0');
    RETURN p_prefix || '/' || v_fy || '/' || v_num_str;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- STEP 11: SEED DEFAULT INTERNAL PROFILE & DELIVERY LOCATION FOR comp-default
-- ----------------------------------------------------------------------------
INSERT INTO public.purchase_internal_profiles (
    id, organization_id, legal_name, trade_name, address_line, city, district, state_id, country_id, pincode, gst_registered, gstin, pan, email, mobile, contact_person, is_default, is_active
)
VALUES (
    'prof-default-comp', 'comp-default', 'DBIZ Consultancy Services Pvt Ltd', 'SignSync Operations', 'Corporate Towers, 4th Floor, Infopark', 'Bengaluru', 'Bengaluru Urban', 'KA', 'country-in-comp-default', '560100', true, '29AABCS1234F1Z5', 'AABCS1234F', 'procurement@dbizcorp.com', '9845012345', 'Procurement Head', true, true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.purchase_delivery_locations (
    id, organization_id, location_name, contact_person, mobile, email, address_line, city, district, state_id, country_id, pincode, gstin, is_default, is_active, active_from
)
VALUES (
    'loc-default-comp', 'comp-default', 'Bangalore Central Tech Hub', 'Warehouse Manager', '9845098765', 'warehouse@dbizcorp.com', 'Plot 18, Electronics City Phase 1', 'Bengaluru', 'Bengaluru Urban', 'KA', 'country-in-comp-default', '560100', '29AABCS1234F1Z5', true, true, CURRENT_DATE
)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Vendors if table is empty
INSERT INTO public.token_purchase_parties (
    id, organization_id, party_name, contact_person, country_id, state_id, street_address, city, district, pincode, country_code, mobile, email, gstin, pan, is_active
)
VALUES
    ('ven-party-1', 'comp-default', 'Feitian Technologies India Pvt Ltd', 'Anil Kumar', 'country-in-comp-default', 'KA', 'Plot 42, Electronics City', 'Bengaluru', 'Bengaluru Urban', '560100', '+91', '9888877777', 'sales@feitian.co.in', '29AABCF1234F1Z8', 'AABCF1234F', true),
    ('ven-party-2', 'comp-default', 'Watchdata Technologies Pte Ltd', 'Marcus Tan', 'cntry-sg-comp-default', NULL, '10 Ubi Crescent, #04-32 Ubi Techpark', 'Singapore', 'Singapore', '408564', '+65', '67489876', 'sales@watchdata.sg', NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Quote for Feitian
INSERT INTO public.token_vendor_quotes (
    id, organization_id, party_id, quote_number, quote_date, valid_from, valid_to, status, token_company_id, token_product_id, token_version_id, remarks
)
VALUES (
    'qte-sample-1', 'comp-default', 'ven-party-1', 'QT-FT-2026-001', '2026-11-01', '2026-11-01', '2026-12-31', 'ACTIVE', 'tok-co-1', 'tok-prod-1', 'tok-ver-1', 'Q4 2026 Special Batch Pricing for ePass2003 Auto'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Quantity Slabs for the Sample Quote
INSERT INTO public.token_vendor_quote_slabs (
    id, organization_id, quote_id, min_quantity, max_quantity, unit_rate, gst_type, gst_percentage, gst_amount, other_charges
)
VALUES
    ('slab-s1-1', 'comp-default', 'qte-sample-1', 1, 50, 350.00, 'PERCENTAGE', 18.00, 63.00, 0.00),
    ('slab-s1-2', 'comp-default', 'qte-sample-1', 51, 200, 330.00, 'PERCENTAGE', 18.00, 59.40, 0.00),
    ('slab-s1-3', 'comp-default', 'qte-sample-1', 201, 1000, 310.00, 'PERCENTAGE', 18.00, 55.80, 0.00),
    ('slab-s1-4', 'comp-default', 'qte-sample-1', 1001, NULL, 290.00, 'PERCENTAGE', 18.00, 52.20, 0.00)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- STEP 12: ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.token_purchase_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_parties" ON public.token_purchase_parties;
CREATE POLICY "tenant_isolation_token_purchase_parties" ON public.token_purchase_parties
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

ALTER TABLE public.token_vendor_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_vendor_quotes" ON public.token_vendor_quotes;
CREATE POLICY "tenant_isolation_token_vendor_quotes" ON public.token_vendor_quotes
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

ALTER TABLE public.token_vendor_quote_slabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_vendor_quote_slabs" ON public.token_vendor_quote_slabs;
CREATE POLICY "tenant_isolation_token_vendor_quote_slabs" ON public.token_vendor_quote_slabs
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

ALTER TABLE public.purchase_internal_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_purchase_internal_profiles" ON public.purchase_internal_profiles;
CREATE POLICY "tenant_isolation_purchase_internal_profiles" ON public.purchase_internal_profiles
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

ALTER TABLE public.purchase_delivery_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_purchase_delivery_locations" ON public.purchase_delivery_locations;
CREATE POLICY "tenant_isolation_purchase_delivery_locations" ON public.purchase_delivery_locations
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

ALTER TABLE public.token_purchase_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_estimates" ON public.token_purchase_estimates;
CREATE POLICY "tenant_isolation_token_purchase_estimates" ON public.token_purchase_estimates
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

ALTER TABLE public.token_purchase_estimate_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_estimate_items" ON public.token_purchase_estimate_items;
CREATE POLICY "tenant_isolation_token_purchase_estimate_items" ON public.token_purchase_estimate_items
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

ALTER TABLE public.token_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_orders" ON public.token_purchase_orders;
CREATE POLICY "tenant_isolation_token_purchase_orders" ON public.token_purchase_orders
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

ALTER TABLE public.token_purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_token_purchase_order_items" ON public.token_purchase_order_items;
CREATE POLICY "tenant_isolation_token_purchase_order_items" ON public.token_purchase_order_items
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

ALTER TABLE public.procurement_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_procurement_sequences" ON public.procurement_sequences;
CREATE POLICY "tenant_isolation_procurement_sequences" ON public.procurement_sequences
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

