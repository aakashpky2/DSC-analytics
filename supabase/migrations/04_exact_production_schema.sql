-- ==============================================================================
-- SIGNSYNC B2B — EXACT 1:1 POSTGRESQL / SUPABASE PRODUCTION SCHEMA (37 TABLES)
-- Generated to guarantee 100% column-name and data-type alignment with active app
-- Paste and run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yuzcsbqbnmnwdvyqbkpv/sql
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS temporary_delegations CASCADE;
DROP TABLE IF EXISTS courier_dispatches CASCADE;
DROP TABLE IF EXISTS delivery_challans CASCADE;
DROP TABLE IF EXISTS service_orders CASCADE;
DROP TABLE IF EXISTS financial_ledger CASCADE;
DROP TABLE IF EXISTS payments_received CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_series_configs CASCADE;
DROP TABLE IF EXISTS crm_follow_ups CASCADE;
DROP TABLE IF EXISTS crm_leads CASCADE;
DROP TABLE IF EXISTS dsc_applications CASCADE;
DROP TABLE IF EXISTS dsc_catalog CASCADE;
DROP TABLE IF EXISTS token_serials CASCADE;
DROP TABLE IF EXISTS stock_adjustments CASCADE;
DROP TABLE IF EXISTS branch_token_stocks CASCADE;
DROP TABLE IF EXISTS token_purchase_batches CASCADE;
DROP TABLE IF EXISTS numbering_series_configs CASCADE;
DROP TABLE IF EXISTS courier_partners CASCADE;
DROP TABLE IF EXISTS services_catalog CASCADE;
DROP TABLE IF EXISTS crm_lead_sources CASCADE;
DROP TABLE IF EXISTS stock_adjustment_reasons CASCADE;
DROP TABLE IF EXISTS hardware_vendors CASCADE;
DROP TABLE IF EXISTS token_models CASCADE;
DROP TABLE IF EXISTS certifying_authorities CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS company_profile CASCADE;
DROP TABLE IF EXISTS user_permission_overrides CASCADE;
DROP TABLE IF EXISTS role_module_permissions CASCADE;
DROP TABLE IF EXISTS app_modules CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS hierarchy_levels CASCADE;

-- Table: hierarchy_levels
CREATE TABLE hierarchy_levels (
      id TEXT PRIMARY KEY,
      level_order INTEGER UNIQUE NOT NULL,
      level_name TEXT NOT NULL,
      can_delegate_default INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: branches
CREATE TABLE branches (
      id TEXT PRIMARY KEY,
      branch_name TEXT NOT NULL,
      branch_code TEXT UNIQUE NOT NULL,
      address TEXT,
      city TEXT,
      state_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    , is_active INTEGER DEFAULT 1);

-- Table: roles
CREATE TABLE roles (
      id TEXT PRIMARY KEY,
      hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: user_profiles
CREATE TABLE user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      full_name TEXT NOT NULL,
      phone_number TEXT,
      role_id TEXT REFERENCES roles(id),
      hierarchy_level_id TEXT REFERENCES hierarchy_levels(id),
      reports_to_user_id TEXT REFERENCES user_profiles(id),
      can_grant_permissions INTEGER DEFAULT 0,
      permissions_frozen INTEGER DEFAULT 0,
      branch_id TEXT REFERENCES branches(id),
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: app_modules
CREATE TABLE app_modules (
      id TEXT PRIMARY KEY,
      module_key TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      route_path TEXT NOT NULL
    );

-- Table: role_module_permissions
CREATE TABLE role_module_permissions (
      id TEXT PRIMARY KEY,
      role_id TEXT REFERENCES roles(id),
      module_id TEXT REFERENCES app_modules(id),
      can_view INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      can_export INTEGER DEFAULT 0,
      mask_pii_fields INTEGER DEFAULT 1,
      UNIQUE(role_id, module_id)
    );

-- Table: user_permission_overrides
CREATE TABLE user_permission_overrides (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES user_profiles(id),
      module_id TEXT REFERENCES app_modules(id),
      can_view INTEGER,
      can_create INTEGER,
      can_edit INTEGER,
      can_delete INTEGER,
      can_export INTEGER,
      mask_pii_fields INTEGER,
      granted_by_user_id TEXT REFERENCES user_profiles(id),
      UNIQUE(user_id, module_id)
    );

-- Table: company_profile
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

-- Table: partners
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
      billing_address TEXT NOT NULL,
      state_code TEXT NOT NULL,
      credit_period_days INTEGER DEFAULT 0,
      credit_limit NUMERIC(14,2) DEFAULT 0.00,
      wallet_balance NUMERIC(14,2) DEFAULT 0.00,
      kyc_verified INTEGER DEFAULT 0,
      kyc_document_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: bank_accounts
CREATE TABLE bank_accounts (
      id TEXT PRIMARY KEY,
      account_nickname TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      account_holder_name TEXT NOT NULL,
      upi_id TEXT,
      google_pay_number TEXT,
      qr_code_image_path TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: certifying_authorities
CREATE TABLE certifying_authorities (
      id TEXT PRIMARY KEY,
      ca_name TEXT NOT NULL UNIQUE,
      ca_code TEXT NOT NULL UNIQUE,
      api_endpoint TEXT,
      support_contact TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: token_models
CREATE TABLE token_models (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL UNIQUE,
      manufacturer TEXT NOT NULL,
      vendor_contact TEXT,
      min_threshold INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: hardware_vendors
CREATE TABLE hardware_vendors (
      id TEXT PRIMARY KEY,
      vendor_name TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      gstin TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: stock_adjustment_reasons
CREATE TABLE stock_adjustment_reasons (
      id TEXT PRIMARY KEY,
      reason_code TEXT NOT NULL UNIQUE,
      reason_label TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: crm_lead_sources
CREATE TABLE crm_lead_sources (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: services_catalog
CREATE TABLE services_catalog (
      id TEXT PRIMARY KEY,
      service_key TEXT NOT NULL UNIQUE,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL,
      government_fee NUMERIC(14,2) DEFAULT 0,
      professional_fee NUMERIC(14,2) DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: courier_partners
CREATE TABLE courier_partners (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL UNIQUE,
      tracking_url_template TEXT,
      support_phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: numbering_series_configs
CREATE TABLE numbering_series_configs (
      id TEXT PRIMARY KEY,
      series_name TEXT NOT NULL,
      document_type TEXT NOT NULL UNIQUE, -- 'invoice', 'dsc_application', 'partner', 'lead', 'token_batch', 'delivery_challan', 'service_order', 'courier_dispatch', 'token_serial'
      prefix TEXT,
      suffix TEXT,
      separator TEXT DEFAULT '-', -- '/', '-', '_', ''
      parts_order TEXT DEFAULT '["prefix", "fy", "counter", "suffix"]', -- JSON array defining order of segments
      fy_format TEXT DEFAULT 'YY-YY', -- 'none', 'YYYY', 'YY-YY' (e.g. 26-27), 'YYYY-YY'
      company_code TEXT,
      branch_code TEXT,
      counter_padding INT DEFAULT 5, -- 00001
      current_counter INT DEFAULT 1000,
      starting_counter INT DEFAULT 1001,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: token_purchase_batches
CREATE TABLE token_purchase_batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      token_model TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      quantity_purchased INTEGER NOT NULL,
      base_unit_price NUMERIC(14,2) NOT NULL,
      inward_shipping_cost NUMERIC(14,2) DEFAULT 0.00,
      customs_or_taxes NUMERIC(14,2) DEFAULT 0.00,
      handling_charges NUMERIC(14,2) DEFAULT 0.00,
      total_landed_cost NUMERIC(14,2) NOT NULL,
      unit_landed_cost NUMERIC(14,2) NOT NULL,
      allocated_quantity INTEGER DEFAULT 0,
      damaged_quantity INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: branch_token_stocks
CREATE TABLE branch_token_stocks (
      id TEXT PRIMARY KEY,
      branch_id TEXT REFERENCES branches(id),
      token_model TEXT NOT NULL,
      quantity_on_hand INTEGER DEFAULT 0,
      quarantine_damaged INTEGER DEFAULT 0,
      min_threshold INTEGER DEFAULT 10,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(branch_id, token_model)
    );

-- Table: stock_adjustments
CREATE TABLE stock_adjustments (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    token_model TEXT NOT NULL,
    adjustment_type TEXT NOT NULL, -- 'quarantine_damaged' | 'reconcile_add' | 'reconcile_deduct'
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    adjusted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

-- Table: token_serials
CREATE TABLE token_serials (
      id TEXT PRIMARY KEY,
      serial_number TEXT NOT NULL UNIQUE,
      token_model TEXT NOT NULL,
      batch_id TEXT,
      branch_id TEXT NOT NULL,
      status TEXT DEFAULT 'in_stock', -- 'in_stock', 'allocated', 'dispatched', 'quarantined'
      partner_id TEXT,
      delivery_challan_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY(batch_id) REFERENCES token_purchase_batches(id),
      FOREIGN KEY(branch_id) REFERENCES branches(id)
    );

-- Table: dsc_catalog
CREATE TABLE dsc_catalog (
      id TEXT PRIMARY KEY,
      class_type TEXT NOT NULL,
      certificate_type TEXT NOT NULL,
      validity_years TEXT NOT NULL,
      vendor_base_price NUMERIC(14,2) NOT NULL,
      partner_price NUMERIC(14,2) NOT NULL,
      mrp NUMERIC(14,2) NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(class_type, certificate_type, validity_years)
    );

-- Table: dsc_applications
CREATE TABLE dsc_applications (
      id TEXT PRIMARY KEY,
      application_number TEXT UNIQUE NOT NULL,
      partner_id TEXT REFERENCES partners(id),
      catalog_id TEXT REFERENCES dsc_catalog(id),
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT NOT NULL,
      applicant_pan TEXT,
      stage TEXT DEFAULT 'intake',
      documents_submitted TEXT DEFAULT '{}',
      video_verification_url TEXT,
      ca_reference_no TEXT,
      assigned_staff_id TEXT REFERENCES user_profiles(id),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: crm_leads
CREATE TABLE crm_leads (
      id TEXT PRIMARY KEY,
      lead_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      gstin TEXT,
      pan TEXT,
      status TEXT DEFAULT 'new',
      requirement_summary TEXT,
      assigned_to TEXT REFERENCES user_profiles(id),
      is_merged INTEGER DEFAULT 0,
      merged_into_lead_id TEXT REFERENCES crm_leads(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: crm_follow_ups
CREATE TABLE crm_follow_ups (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES crm_leads(id),
      channel TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      status TEXT DEFAULT 'pending',
      disposition TEXT,
      notes TEXT,
      conducted_by TEXT REFERENCES user_profiles(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: invoice_series_configs
CREATE TABLE invoice_series_configs (
      id TEXT PRIMARY KEY,
      series_name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      suffix TEXT,
      current_counter INTEGER DEFAULT 1000,
      is_gst_compliant INTEGER NOT NULL,
      mapped_bank_account_id TEXT REFERENCES bank_accounts(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    , is_active INTEGER DEFAULT 1);

-- Table: invoices
CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      series_id TEXT REFERENCES invoice_series_configs(id),
      partner_id TEXT REFERENCES partners(id),
      invoice_type TEXT DEFAULT 'gst_tax_invoice',
      invoice_date DATE DEFAULT (DATE('now')),
      due_date DATE NOT NULL,
      subtotal NUMERIC(14,2) NOT NULL,
      cgst_amount NUMERIC(14,2) DEFAULT 0.00,
      sgst_amount NUMERIC(14,2) DEFAULT 0.00,
      igst_amount NUMERIC(14,2) DEFAULT 0.00,
      total_amount NUMERIC(14,2) NOT NULL,
      paid_amount NUMERIC(14,2) DEFAULT 0.00,
      outstanding_balance NUMERIC(14,2) NOT NULL,
      status TEXT DEFAULT 'unpaid',
      bank_account_snapshot_id TEXT REFERENCES bank_accounts(id),
      line_items TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    , company_snapshot TEXT);

-- Table: payments_received
CREATE TABLE payments_received (
      id TEXT PRIMARY KEY,
      invoice_id TEXT REFERENCES invoices(id),
      partner_id TEXT REFERENCES partners(id),
      amount_paid NUMERIC(14,2) NOT NULL,
      payment_mode TEXT NOT NULL,
      bank_account_id TEXT REFERENCES bank_accounts(id),
      transaction_reference_utr TEXT,
      screenshot_proof_url TEXT,
      verified_status TEXT DEFAULT 'pending_verification',
      verified_by TEXT REFERENCES user_profiles(id),
      verified_at TIMESTAMPTZ,
      rejection_remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: financial_ledger
CREATE TABLE financial_ledger (
      id TEXT PRIMARY KEY,
      partner_id TEXT REFERENCES partners(id),
      entry_date DATE DEFAULT (DATE('now')),
      transaction_type TEXT NOT NULL,
      reference_id TEXT,
      debit NUMERIC(14,2) DEFAULT 0.00,
      credit NUMERIC(14,2) DEFAULT 0.00,
      running_balance NUMERIC(14,2) NOT NULL,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: service_orders
CREATE TABLE service_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      service_type TEXT NOT NULL,
      partner_id TEXT REFERENCES partners(id),
      client_name TEXT NOT NULL,
      client_contact TEXT NOT NULL,
      stage TEXT DEFAULT 'draft_review',
      portal_ack_number TEXT,
      government_fees NUMERIC(14,2) DEFAULT 0.00,
      professional_fees NUMERIC(14,2) DEFAULT 0.00,
      uploaded_documents TEXT DEFAULT '{}',
      final_certificate_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: delivery_challans
CREATE TABLE delivery_challans (
      id TEXT PRIMARY KEY,
      challan_number TEXT UNIQUE NOT NULL,
      source_branch_id TEXT REFERENCES branches(id),
      destination_branch_id TEXT REFERENCES branches(id),
      partner_id TEXT REFERENCES partners(id),
      token_model TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purpose TEXT NOT NULL,
      issued_by TEXT REFERENCES user_profiles(id),
      status TEXT DEFAULT 'dispatched',
      created_at TIMESTAMPTZ DEFAULT NOW()
    , company_snapshot TEXT);

-- Table: courier_dispatches
CREATE TABLE courier_dispatches (
      id TEXT PRIMARY KEY,
      dispatch_number TEXT UNIQUE NOT NULL,
      carrier_name TEXT NOT NULL,
      awb_number TEXT UNIQUE NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      package_contents TEXT NOT NULL,
      status TEXT DEFAULT 'manifested',
      delivery_challan_id TEXT REFERENCES delivery_challans(id),
      proof_of_delivery_url TEXT,
      dispatched_at TIMESTAMPTZ DEFAULT NOW(),
      delivered_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Table: temporary_delegations
CREATE TABLE temporary_delegations (
      id TEXT PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY(grantor_user_id) REFERENCES user_profiles(id),
      FOREIGN KEY(recipient_user_id) REFERENCES user_profiles(id),
      FOREIGN KEY(parent_delegation_id) REFERENCES temporary_delegations(id)
    );

-- Table: audit_logs
CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY(user_id) REFERENCES user_profiles(id)
    );

-- Table: sessions
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());

-- Table: password_resets
CREATE TABLE password_resets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());

NOTIFY pgrst, 'reload schema';
