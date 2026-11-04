-- SignSync B2B Enterprise Platform Migration Script
-- Version 2.4 Production Baseline

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Custom Enumerated Types (ENUMs)
-- ==========================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended', 'invited', 'deactivated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_type') THEN
        CREATE TYPE partner_type AS ENUM ('dsc_partner', 'token_partner', 'associate_partner', 'master_distributor');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsc_class_type') THEN
        CREATE TYPE dsc_class_type AS ENUM ('class_3_individual', 'class_3_organization', 'dgft', 'foreign_national', 'document_signer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsc_validity_years') THEN
        CREATE TYPE dsc_validity_years AS ENUM ('1_year', '2_years', '3_years');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'token_type') THEN
        CREATE TYPE token_type AS ENUM ('epass2003_auto', 'watchdata_proxkey', 'mtoken_crypto', 'trustkey');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'requirement_gathered', 'quoted', 'negotiation', 'won', 'lost', 'merged');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type') THEN
        CREATE TYPE invoice_type AS ENUM ('gst_tax_invoice', 'non_gst_bill_of_supply', 'proforma');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid', 'under_verification', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'courier_status') THEN
        CREATE TYPE courier_status AS ENUM ('manifested', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'rto_undelivered');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dsc_app_status') THEN
        CREATE TYPE dsc_app_status AS ENUM ('intake', 'document_verification', 'video_recording', 'ca_portal_approval', 'issued_dispatched', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_order_type') THEN
        CREATE TYPE service_order_type AS ENUM ('trademark', 'fssai_basic', 'fssai_state', 'fssai_central', 'gst_registration', 'company_incorporation');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_stage') THEN
        CREATE TYPE service_stage AS ENUM ('draft_review', 'govt_submission', 'hearing_query', 'completed_certificate');
    END IF;
END $$;

-- ==========================================
-- 2. Hierarchy Levels & Granular RBAC
-- ==========================================
CREATE TABLE IF NOT EXISTS hierarchy_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_order INT UNIQUE NOT NULL, -- 0: Super Admin, 1: Partner Admin, 2: Manager, 3: Staff, 4: Field Staff
    level_name VARCHAR(100) NOT NULL,
    can_delegate_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hierarchy_level_id UUID REFERENCES hierarchy_levels(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name VARCHAR(150) NOT NULL,
    branch_code VARCHAR(30) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state_code VARCHAR(5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID, -- References Supabase auth.users if available
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    role_id UUID REFERENCES roles(id),
    hierarchy_level_id UUID REFERENCES hierarchy_levels(id),
    reports_to_user_id UUID REFERENCES user_profiles(id),
    can_grant_permissions BOOLEAN DEFAULT FALSE,
    permissions_frozen BOOLEAN DEFAULT FALSE,
    branch_id UUID REFERENCES branches(id),
    status user_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key VARCHAR(50) UNIQUE NOT NULL, -- 'auth_users', 'partners', 'dsc_catalog', 'dsc_applications', 'inventory', 'crm', 'services', 'billing', 'courier'
    display_name VARCHAR(100) NOT NULL,
    route_path VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    module_id UUID REFERENCES app_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    mask_pii_fields BOOLEAN DEFAULT TRUE,
    UNIQUE(role_id, module_id)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    module_id UUID REFERENCES app_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_export BOOLEAN,
    mask_pii_fields BOOLEAN,
    granted_by_user_id UUID REFERENCES user_profiles(id),
    UNIQUE(user_id, module_id)
);

-- ==========================================
-- 3. Partners & KYC Network
-- ==========================================
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_code VARCHAR(30) UNIQUE NOT NULL,
    type partner_type NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    gstin VARCHAR(20),
    pan VARCHAR(15),
    billing_address TEXT NOT NULL,
    state_code VARCHAR(5) NOT NULL,
    credit_period_days INT DEFAULT 0,
    credit_limit DECIMAL(12, 2) DEFAULT 0.00,
    wallet_balance DECIMAL(12, 2) DEFAULT 0.00,
    kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_document_url TEXT,
    status user_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. DSC Catalogue & Applications Pipeline
-- ==========================================
CREATE TABLE IF NOT EXISTS dsc_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_type dsc_class_type NOT NULL,
    certificate_type VARCHAR(50) NOT NULL, -- 'signing_only', 'encryption_only', 'combo_signing_encryption'
    validity_years dsc_validity_years NOT NULL,
    vendor_base_price DECIMAL(10, 2) NOT NULL,
    partner_price DECIMAL(10, 2) NOT NULL,
    mrp DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_type, certificate_type, validity_years)
);

CREATE TABLE IF NOT EXISTS dsc_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number VARCHAR(50) UNIQUE NOT NULL,
    partner_id UUID REFERENCES partners(id),
    catalog_id UUID REFERENCES dsc_catalog(id),
    applicant_name VARCHAR(150) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    applicant_phone VARCHAR(20) NOT NULL,
    applicant_pan VARCHAR(20),
    stage dsc_app_status DEFAULT 'intake',
    documents_submitted JSONB DEFAULT '{}'::jsonb,
    video_verification_url TEXT,
    ca_reference_no VARCHAR(100),
    assigned_staff_id UUID REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. Hardware Token Inventory & Landed Costing
-- ==========================================
CREATE TABLE IF NOT EXISTS token_purchase_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    token_model token_type NOT NULL,
    vendor_name VARCHAR(150) NOT NULL,
    quantity_purchased INT NOT NULL,
    base_unit_price DECIMAL(10, 2) NOT NULL,
    inward_shipping_cost DECIMAL(10, 2) DEFAULT 0.00,
    customs_or_taxes DECIMAL(10, 2) DEFAULT 0.00,
    handling_charges DECIMAL(10, 2) DEFAULT 0.00,
    total_landed_cost DECIMAL(12, 2) GENERATED ALWAYS AS (
        (base_unit_price * quantity_purchased) + inward_shipping_cost + customs_or_taxes + handling_charges
    ) STORED,
    unit_landed_cost DECIMAL(10, 2) GENERATED ALWAYS AS (
        ((base_unit_price * quantity_purchased) + inward_shipping_cost + customs_or_taxes + handling_charges) / quantity_purchased
    ) STORED,
    allocated_quantity INT DEFAULT 0,
    damaged_quantity INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_token_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    token_model token_type NOT NULL,
    quantity_on_hand INT DEFAULT 0,
    quarantine_damaged INT DEFAULT 0,
    min_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, token_model)
);

CREATE TABLE IF NOT EXISTS delivery_challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_number VARCHAR(50) UNIQUE NOT NULL,
    source_branch_id UUID REFERENCES branches(id),
    destination_branch_id UUID REFERENCES branches(id),
    partner_id UUID REFERENCES partners(id),
    token_model token_type NOT NULL,
    quantity INT NOT NULL,
    purpose VARCHAR(100) NOT NULL, -- 'inter_branch_transfer', 'partner_dispatch', 'replacement'
    issued_by UUID REFERENCES user_profiles(id),
    status VARCHAR(50) DEFAULT 'dispatched',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. CRM Leads, Deduplication & Follow-ups
-- ==========================================
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(30) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    gstin VARCHAR(20),
    pan VARCHAR(15),
    status lead_status DEFAULT 'new',
    requirement_summary TEXT,
    assigned_to UUID REFERENCES user_profiles(id),
    is_merged BOOLEAN DEFAULT FALSE,
    merged_into_lead_id UUID REFERENCES crm_leads(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL, -- 'call', 'whatsapp', 'email'
    scheduled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'completed', 'snoozed'
    disposition VARCHAR(100), -- 'interested', 'not_reachable', 'quote_requested', 'callback_scheduled', 'lost_pricing'
    notes TEXT,
    conducted_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. Additional Business Services Hub
-- ==========================================
CREATE TABLE IF NOT EXISTS service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    service_type service_order_type NOT NULL,
    partner_id UUID REFERENCES partners(id),
    client_name VARCHAR(150) NOT NULL,
    client_contact VARCHAR(50) NOT NULL,
    stage service_stage DEFAULT 'draft_review',
    portal_ack_number VARCHAR(100),
    government_fees DECIMAL(10, 2) DEFAULT 0.00,
    professional_fees DECIMAL(10, 2) DEFAULT 0.00,
    uploaded_documents JSONB DEFAULT '{}'::jsonb,
    final_certificate_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 8. Multi-Account Banking, Series & Invoicing
-- ==========================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_nickname VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    account_holder_name VARCHAR(150) NOT NULL,
    upi_id VARCHAR(100),
    google_pay_number VARCHAR(20),
    qr_code_image_path TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_series_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_name VARCHAR(100) NOT NULL,
    prefix VARCHAR(30) NOT NULL,
    suffix VARCHAR(20),
    current_counter INT DEFAULT 1000,
    is_gst_compliant BOOLEAN NOT NULL,
    mapped_bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(60) UNIQUE NOT NULL,
    series_id UUID REFERENCES invoice_series_configs(id),
    partner_id UUID REFERENCES partners(id),
    invoice_type invoice_type DEFAULT 'gst_tax_invoice',
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    cgst_amount DECIMAL(12, 2) DEFAULT 0.00,
    sgst_amount DECIMAL(12, 2) DEFAULT 0.00,
    igst_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) DEFAULT 0.00,
    outstanding_balance DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status payment_status DEFAULT 'unpaid',
    bank_account_snapshot_id UUID REFERENCES bank_accounts(id),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id),
    partner_id UUID REFERENCES partners(id),
    amount_paid DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id),
    transaction_reference_utr VARCHAR(100),
    screenshot_proof_url TEXT,
    verified_status VARCHAR(50) DEFAULT 'pending_verification', -- 'pending_verification', 'verified', 'rejected'
    verified_by UUID REFERENCES user_profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL, -- 'invoice_raised', 'payment_received', 'credit_note', 'wallet_recharge'
    reference_id UUID,
    debit DECIMAL(12, 2) DEFAULT 0.00,
    credit DECIMAL(12, 2) DEFAULT 0.00,
    running_balance DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. Logistics, Couriers & POD Tracking
-- ==========================================
CREATE TABLE IF NOT EXISTS courier_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    carrier_name VARCHAR(100) NOT NULL, -- 'DTDC', 'Blue Dart', 'Speed Post', 'Delhivery'
    awb_number VARCHAR(100) UNIQUE NOT NULL,
    recipient_name VARCHAR(150) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    shipping_address TEXT NOT NULL,
    package_contents VARCHAR(200) NOT NULL, -- e.g. '2x ePass2003 Token + Class 3 DSC'
    status courier_status DEFAULT 'manifested',
    delivery_challan_id UUID REFERENCES delivery_challans(id),
    proof_of_delivery_url TEXT,
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

