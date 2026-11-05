-- ==============================================================================
-- SIGNSYNC B2B — COMPREHENSIVE SUPABASE POSTGRESQL SCHEMA (ALL TABLES & COLUMNS)
-- Copy and paste this into the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yuzcsbqbnmnwdvyqbkpv/sql
-- ==============================================================================

-- Drop old sample tables to rebuild clean schema with TEXT IDs
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS temporary_delegations CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_permission_overrides CASCADE;
DROP TABLE IF EXISTS role_module_permissions CASCADE;
DROP TABLE IF EXISTS crm_follow_ups CASCADE;
DROP TABLE IF EXISTS crm_leads CASCADE;
DROP TABLE IF EXISTS crm_lead_sources CASCADE;
DROP TABLE IF EXISTS dsc_applications CASCADE;
DROP TABLE IF EXISTS dsc_catalog CASCADE;
DROP TABLE IF EXISTS certifying_authorities CASCADE;
DROP TABLE IF EXISTS courier_dispatches CASCADE;
DROP TABLE IF EXISTS courier_partners CASCADE;
DROP TABLE IF EXISTS delivery_challans CASCADE;
DROP TABLE IF EXISTS service_orders CASCADE;
DROP TABLE IF EXISTS services_catalog CASCADE;
DROP TABLE IF EXISTS financial_ledger CASCADE;
DROP TABLE IF EXISTS payments_received CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_series_configs CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS token_serials CASCADE;
DROP TABLE IF EXISTS stock_adjustments CASCADE;
DROP TABLE IF EXISTS stock_adjustment_reasons CASCADE;
DROP TABLE IF EXISTS branch_token_stocks CASCADE;
DROP TABLE IF EXISTS token_purchase_batches CASCADE;
DROP TABLE IF EXISTS token_models CASCADE;
DROP TABLE IF EXISTS hardware_vendors CASCADE;
DROP TABLE IF EXISTS numbering_series_configs CASCADE;
DROP TABLE IF EXISTS company_profile CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS hierarchy_levels CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS app_modules CASCADE;

-- 1. Core Hierarchy & Organization
CREATE TABLE hierarchy_levels (
    id TEXT PRIMARY KEY,
    level_order INTEGER UNIQUE NOT NULL,
    level_name TEXT NOT NULL,
    can_delegate_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    branch_name TEXT NOT NULL,
    branch_code TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT,
    state_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY,
    auth_user_id TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role_id TEXT REFERENCES roles(id),
    hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
    reports_to_user_id TEXT REFERENCES user_profiles(id),
    can_grant_permissions BOOLEAN DEFAULT FALSE,
    permissions_frozen BOOLEAN DEFAULT FALSE,
    branch_id TEXT REFERENCES branches(id),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_modules (
    id TEXT PRIMARY KEY,
    module_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    route_path TEXT NOT NULL
);

CREATE TABLE role_module_permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES app_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    mask_pii_fields BOOLEAN DEFAULT TRUE
);

CREATE TABLE user_permission_overrides (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
    module_id TEXT REFERENCES app_modules(id) ON DELETE CASCADE,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_export BOOLEAN,
    mask_pii_fields BOOLEAN
);

-- 2. Master Settings & Business Entities
CREATE TABLE company_profile (
    id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    pan TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    registered_address TEXT NOT NULL,
    state_code TEXT NOT NULL,
    state_name TEXT NOT NULL,
    logo_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partners (
    id TEXT PRIMARY KEY,
    partner_code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    gstin TEXT,
    pan TEXT,
    billing_address TEXT,
    state_code TEXT,
    state_name TEXT,
    credit_period_days INTEGER DEFAULT 0,
    credit_limit NUMERIC(14,2) DEFAULT 0,
    wallet_balance NUMERIC(14,2) DEFAULT 0,
    kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_document_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_type TEXT NOT NULL,
    branch_name TEXT,
    upi_id TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE certifying_authorities (
    id TEXT PRIMARY KEY,
    ca_name TEXT NOT NULL UNIQUE,
    ca_code TEXT NOT NULL UNIQUE,
    api_endpoint TEXT,
    support_contact TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_models (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL UNIQUE,
    manufacturer TEXT NOT NULL,
    vendor_contact TEXT,
    min_threshold INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hardware_vendors (
    id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    gstin TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustment_reasons (
    id TEXT PRIMARY KEY,
    reason_code TEXT NOT NULL UNIQUE,
    reason_label TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_lead_sources (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services_catalog (
    id TEXT PRIMARY KEY,
    service_key TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    category TEXT NOT NULL,
    government_fee NUMERIC(12,2) DEFAULT 0,
    professional_fee NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courier_partners (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL UNIQUE,
    tracking_url_template TEXT,
    support_phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE numbering_series_configs (
    id TEXT PRIMARY KEY,
    series_name TEXT NOT NULL,
    document_type TEXT NOT NULL UNIQUE,
    prefix TEXT,
    suffix TEXT,
    separator TEXT DEFAULT '-',
    parts_order TEXT DEFAULT '["prefix", "fy", "counter", "suffix"]',
    fy_format TEXT DEFAULT 'YY-YY',
    company_code TEXT,
    branch_code TEXT,
    counter_padding INT DEFAULT 5,
    current_counter INT DEFAULT 1000,
    starting_counter INT DEFAULT 1001,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Hardware Token Inventory & Batches
CREATE TABLE token_purchase_batches (
    id TEXT PRIMARY KEY,
    batch_reference TEXT UNIQUE NOT NULL,
    vendor_name TEXT NOT NULL,
    token_model TEXT NOT NULL,
    quantity_received INTEGER NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL,
    freight_charges NUMERIC(12,2) DEFAULT 0,
    customs_taxes NUMERIC(12,2) DEFAULT 0,
    total_landed_cost NUMERIC(12,2) NOT NULL,
    unit_landed_cost NUMERIC(12,2) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL,
    received_by_user_id TEXT REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branch_token_stocks (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id),
    token_model TEXT NOT NULL,
    current_stock INTEGER DEFAULT 0,
    allocated_stock INTEGER DEFAULT 0,
    min_alert_threshold INTEGER DEFAULT 10,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustments (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id),
    token_model TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE token_serials (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL UNIQUE,
    token_model TEXT NOT NULL,
    batch_id TEXT REFERENCES token_purchase_batches(id),
    branch_id TEXT REFERENCES branches(id),
    status TEXT DEFAULT 'in_stock',
    partner_id TEXT REFERENCES partners(id),
    delivery_challan_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DSC Operations & CRM
CREATE TABLE dsc_catalog (
    id TEXT PRIMARY KEY,
    class_type TEXT NOT NULL,
    certificate_type TEXT NOT NULL,
    validity_years TEXT NOT NULL,
    vendor_base_price NUMERIC(12,2) NOT NULL,
    partner_price NUMERIC(12,2) NOT NULL,
    mrp NUMERIC(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dsc_applications (
    id TEXT PRIMARY KEY,
    application_number TEXT UNIQUE NOT NULL,
    partner_id TEXT REFERENCES partners(id),
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    pan_number TEXT,
    aadhaar_number TEXT,
    dsc_product_id TEXT REFERENCES dsc_catalog(id),
    class_type TEXT NOT NULL,
    status TEXT DEFAULT 'intake',
    video_verification_url TEXT,
    assigned_ops_user_id TEXT REFERENCES user_profiles(id),
    stage_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_leads (
    id TEXT PRIMARY KEY,
    lead_code TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    assigned_sales_user_id TEXT REFERENCES user_profiles(id),
    status TEXT DEFAULT 'new',
    est_token_volume INTEGER DEFAULT 0,
    est_dsc_volume INTEGER DEFAULT 0,
    requirement_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_follow_ups (
    id TEXT PRIMARY KEY,
    lead_id TEXT REFERENCES crm_leads(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    agenda TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    outcome_notes TEXT,
    created_by_user_id TEXT REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Invoicing, Payments, Ledger & Logistics
CREATE TABLE invoice_series_configs (
    id TEXT PRIMARY KEY,
    series_name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    starting_sequence INTEGER DEFAULT 1001,
    current_sequence INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    series_id TEXT REFERENCES invoice_series_configs(id),
    partner_id TEXT REFERENCES partners(id),
    invoice_type TEXT NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    cgst_amount NUMERIC(14,2) DEFAULT 0,
    sgst_amount NUMERIC(14,2) DEFAULT 0,
    igst_amount NUMERIC(14,2) DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL,
    paid_amount NUMERIC(14,2) DEFAULT 0,
    outstanding_balance NUMERIC(14,2) NOT NULL,
    status TEXT DEFAULT 'unpaid',
    bank_account_snapshot_id TEXT REFERENCES bank_accounts(id),
    company_snapshot TEXT,
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments_received (
    id TEXT PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    invoice_id TEXT REFERENCES invoices(id),
    partner_id TEXT REFERENCES partners(id),
    bank_account_id TEXT REFERENCES bank_accounts(id),
    amount_received NUMERIC(14,2) NOT NULL,
    payment_mode TEXT NOT NULL,
    transaction_reference TEXT,
    payment_proof_url TEXT,
    status TEXT DEFAULT 'under_verification',
    verified_by_user_id TEXT REFERENCES user_profiles(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    payment_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE financial_ledger (
    id TEXT PRIMARY KEY,
    partner_id TEXT REFERENCES partners(id),
    entry_type TEXT NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    reference_id TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    debit_amount NUMERIC(14,2) DEFAULT 0,
    credit_amount NUMERIC(14,2) DEFAULT 0,
    running_balance NUMERIC(14,2) NOT NULL,
    narration TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    partner_id TEXT REFERENCES partners(id),
    service_type TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    current_stage TEXT DEFAULT 'draft_review',
    government_fees NUMERIC(12,2) DEFAULT 0,
    professional_fees NUMERIC(12,2) DEFAULT 0,
    assigned_specialist_user_id TEXT REFERENCES user_profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE delivery_challans (
    id TEXT PRIMARY KEY,
    challan_number TEXT UNIQUE NOT NULL,
    from_branch_id TEXT REFERENCES branches(id),
    to_branch_id TEXT REFERENCES branches(id),
    to_partner_id TEXT REFERENCES partners(id),
    items JSONB NOT NULL,
    status TEXT DEFAULT 'dispatched',
    authorized_by_user_id TEXT REFERENCES user_profiles(id),
    company_snapshot TEXT,
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courier_dispatches (
    id TEXT PRIMARY KEY,
    docket_number TEXT UNIQUE NOT NULL,
    courier_company TEXT NOT NULL,
    destination_partner_id TEXT REFERENCES partners(id),
    destination_address TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    package_weight_kg NUMERIC(6,2) DEFAULT 0.5,
    status TEXT DEFAULT 'manifested',
    tracking_url TEXT,
    manifested_by_user_id TEXT REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Delegations, Audit, Sessions & Security
CREATE TABLE temporary_delegations (
    id TEXT PRIMARY KEY,
    grantor_user_id TEXT NOT NULL REFERENCES user_profiles(id),
    recipient_user_id TEXT NOT NULL REFERENCES user_profiles(id),
    module_key TEXT NOT NULL,
    action_key TEXT NOT NULL,
    branch_id TEXT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    can_delegate_further BOOLEAN DEFAULT FALSE,
    parent_delegation_id TEXT REFERENCES temporary_delegations(id),
    status TEXT DEFAULT 'active',
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user_profiles(id),
    action_type TEXT NOT NULL,
    module_key TEXT NOT NULL,
    table_affected TEXT NOT NULL,
    record_id TEXT,
    old_value_json TEXT,
    new_value_json TEXT,
    reason TEXT,
    delegation_id TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user_profiles(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user_profiles(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reload PostgREST cache immediately
NOTIFY pgrst, 'reload schema';

