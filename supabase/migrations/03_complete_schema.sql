-- ==============================================================================
-- SIGNSYNC B2B — COMPREHENSIVE SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Run this in the Supabase SQL Editor (Project: yuzcsbqbnmnwdvyqbkpv)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Missing Tables & Schema Alignments

-- 2.1 Company Profile & Tax Legal Entities
CREATE TABLE IF NOT EXISTS company_profile (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 2.2 Certifying Authorities (CAs)
CREATE TABLE IF NOT EXISTS certifying_authorities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ca_name TEXT NOT NULL UNIQUE,
    ca_code TEXT NOT NULL UNIQUE,
    api_endpoint TEXT,
    support_contact TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Hardware USB Token Models
CREATE TABLE IF NOT EXISTS token_models (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    model_name TEXT NOT NULL UNIQUE,
    manufacturer TEXT NOT NULL,
    vendor_contact TEXT,
    min_threshold INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Hardware Procurement Vendors
CREATE TABLE IF NOT EXISTS hardware_vendors (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    vendor_name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    gstin TEXT,
    address TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Stock Adjustment & Quarantine Reasons
CREATE TABLE IF NOT EXISTS stock_adjustment_reasons (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reason_code TEXT NOT NULL UNIQUE,
    reason_label TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Stock Adjustments History
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL,
    token_model TEXT NOT NULL,
    adjustment_type TEXT NOT NULL, -- 'quarantine_damaged' | 'reconcile_add' | 'reconcile_deduct'
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 Token Serials (Individual Physical Token Inventory Tracking)
CREATE TABLE IF NOT EXISTS token_serials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    serial_number TEXT NOT NULL UNIQUE,
    token_model TEXT NOT NULL,
    batch_id TEXT,
    branch_id TEXT NOT NULL,
    status TEXT DEFAULT 'in_stock', -- 'in_stock', 'allocated', 'dispatched', 'quarantined'
    partner_id TEXT,
    delivery_challan_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 CRM Lead Acquisition Sources
CREATE TABLE IF NOT EXISTS crm_lead_sources (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_name TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.9 Business Compliance Services Catalog
CREATE TABLE IF NOT EXISTS services_catalog (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    service_key TEXT NOT NULL UNIQUE,
    service_name TEXT NOT NULL,
    category TEXT NOT NULL,
    government_fee NUMERIC(12,2) DEFAULT 0,
    professional_fee NUMERIC(12,2) DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.10 Courier Partners Master
CREATE TABLE IF NOT EXISTS courier_partners (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_name TEXT NOT NULL UNIQUE,
    tracking_url_template TEXT,
    support_phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11 Numbering Series Configurations
CREATE TABLE IF NOT EXISTS numbering_series_configs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.12 Temporary Delegations
CREATE TABLE IF NOT EXISTS temporary_delegations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    grantor_user_id TEXT NOT NULL,
    recipient_user_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    action_key TEXT NOT NULL,
    branch_id TEXT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    can_delegate_further INTEGER DEFAULT 0,
    parent_delegation_id TEXT,
    status TEXT DEFAULT 'active',
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.13 Administrative Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
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

-- 2.14 Web Sessions & Password Resets
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Missing Columns to Existing Tables (if not present)
DO $$
BEGIN
    -- user_profiles.password_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='password_hash') THEN
        ALTER TABLE user_profiles ADD COLUMN password_hash TEXT;
    END IF;
    -- partners columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partners' AND column_name='state_name') THEN
        ALTER TABLE partners ADD COLUMN state_name TEXT;
    END IF;
    -- invoices columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='reference_no') THEN
        ALTER TABLE invoices ADD COLUMN reference_no TEXT;
    END IF;
    -- dsc_applications missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_applications' AND column_name='pan_number') THEN
        ALTER TABLE dsc_applications ADD COLUMN pan_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dsc_applications' AND column_name='aadhaar_number') THEN
        ALTER TABLE dsc_applications ADD COLUMN aadhaar_number TEXT;
    END IF;
    -- payments_received columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments_received' AND column_name='verified_by') THEN
        ALTER TABLE payments_received ADD COLUMN verified_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments_received' AND column_name='verified_at') THEN
        ALTER TABLE payments_received ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments_received' AND column_name='rejection_reason') THEN
        ALTER TABLE payments_received ADD COLUMN rejection_reason TEXT;
    END IF;
    -- delivery_challans columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='dispatched_at') THEN
        ALTER TABLE delivery_challans ADD COLUMN dispatched_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='received_at') THEN
        ALTER TABLE delivery_challans ADD COLUMN received_at TIMESTAMPTZ;
    END IF;
END $$;

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

