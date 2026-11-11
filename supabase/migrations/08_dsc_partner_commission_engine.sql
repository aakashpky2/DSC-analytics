-- DBIZ ERP / SIGNSYNC — DSC PARTNER COMMISSION ENGINE MIGRATION
-- Migration 08: DSC Partner Commission Engine, Provider Payouts, Incentives, and Snapshot Transactions

-- 1. Dual-Role Partner Support
ALTER TABLE IF EXISTS public.partners
  ADD COLUMN IF NOT EXISTS is_token_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dsc_partner BOOLEAN DEFAULT false;

-- Backfill existing partner roles based on current 'type' column
UPDATE public.partners
SET is_dsc_partner = true
WHERE type IN ('dsc_partner', 'associate_partner', 'master_distributor') AND is_dsc_partner IS NOT true;

UPDATE public.partners
SET is_token_customer = true
WHERE type IN ('token_partner') AND is_token_customer IS NOT true;

-- 2. DSC Provider Incoming Payouts Master
-- Defines incoming payout/commission we receive from DSC Certifying Authorities (CAs)
CREATE TABLE IF NOT EXISTS public.dsc_provider_payouts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  class_id TEXT,
  validity_id TEXT,
  payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  calculation_basis TEXT NOT NULL DEFAULT 'BASE_PRICE_ONLY',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsc_provider_payouts_org_lookup 
  ON public.dsc_provider_payouts(organization_id, company_id, product_id, is_active);

-- 3. DSC Partner Commission Configuration
-- Rules determining outgoing partner commission for DSC certificates and optional Support Fees
CREATE TABLE IF NOT EXISTS public.dsc_partner_commission_configs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  partner_id TEXT, -- null = global/default config for the provider/product
  fee_type TEXT NOT NULL DEFAULT 'DSC_PRODUCT', -- 'DSC_PRODUCT' | 'SUPPORT_FEE'
  company_id TEXT NOT NULL,
  product_id TEXT, -- null = provider-wide default
  class_id TEXT,
  validity_id TEXT,
  commission_type TEXT NOT NULL DEFAULT 'FIXED', -- 'FIXED' | 'PERCENTAGE'
  commission_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  calculation_basis TEXT NOT NULL DEFAULT 'BASE_PRICE_ONLY', -- 'BASE_PRICE_ONLY' | 'BASE_PLUS_GST'
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsc_comm_cfg_lookup 
  ON public.dsc_partner_commission_configs(organization_id, partner_id, company_id, fee_type, is_active);

-- 4. Quantity / Volume Slab Incentives
CREATE TABLE IF NOT EXISTS public.dsc_partner_quantity_incentives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  partner_id TEXT, -- null = applies to all partners
  company_id TEXT, -- null = CA-agnostic
  period_type TEXT NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER, -- null = no upper cap
  incentive_amount NUMERIC(12,2) NOT NULL, -- per unit or flat
  incentive_type TEXT NOT NULL DEFAULT 'PER_UNIT', -- 'PER_UNIT' | 'FLAT'
  custom_period_from DATE,
  custom_period_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Turnover / Value Slab Incentives
CREATE TABLE IF NOT EXISTS public.dsc_partner_turnover_incentives (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  partner_id TEXT, -- null = applies to all partners
  company_id TEXT,
  period_type TEXT NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY' | 'QUARTERLY' | 'CUSTOM'
  min_turnover NUMERIC(14,2) NOT NULL,
  max_turnover NUMERIC(14,2),
  calculation_basis TEXT NOT NULL DEFAULT 'BASE_PRICE_ONLY', -- 'BASE_PRICE_ONLY' | 'BASE_PLUS_GST'
  incentive_type TEXT NOT NULL DEFAULT 'PERCENTAGE', -- 'PERCENTAGE' | 'FIXED'
  incentive_value NUMERIC(12,2) NOT NULL,
  custom_period_from DATE,
  custom_period_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Frozen Historical Commission Transactions
-- Snapshots storing full calculation state, provider payout, margin warnings, and approval audits
CREATE TABLE IF NOT EXISTS public.dsc_commission_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT,
  transaction_number TEXT NOT NULL,
  dsc_application_id TEXT,
  partner_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  class_id TEXT,
  validity_id TEXT,
  transaction_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Price & Payout snapshots
  selling_base_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  provider_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  
  -- Partner Commission snapshots
  commission_type TEXT NOT NULL,
  commission_value NUMERIC(12,2) NOT NULL,
  calculation_basis TEXT NOT NULL,
  applied_config_id TEXT,
  calculated_commission NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  
  -- Support fee snapshots
  has_support_fee BOOLEAN NOT NULL DEFAULT false,
  support_fee_base_amount NUMERIC(12,2) DEFAULT 0.00,
  support_fee_commission NUMERIC(12,2) DEFAULT 0.00,
  
  -- Net margin snapshot
  total_partner_payout NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_retained_margin NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  
  -- Margin Warning & Override Audit
  margin_warning BOOLEAN NOT NULL DEFAULT false,
  margin_warning_amount NUMERIC(12,2) DEFAULT 0.00,
  margin_warning_acknowledged BOOLEAN NOT NULL DEFAULT false,
  override_by_user_id TEXT,
  override_user_name TEXT,
  override_reason TEXT,
  override_at TIMESTAMPTZ,
  
  -- Status & Settlement
  status TEXT NOT NULL DEFAULT 'APPROVED', -- 'PENDING_APPROVAL' | 'APPROVED' | 'SETTLED' | 'VOID'
  settlement_status TEXT NOT NULL DEFAULT 'UNPAID', -- 'UNPAID' | 'PAID'
  settlement_reference TEXT,
  settled_at TIMESTAMPTZ,
  
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsc_comm_txn_partner_org 
  ON public.dsc_commission_transactions(organization_id, partner_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_dsc_comm_txn_margin_warning 
  ON public.dsc_commission_transactions(organization_id, margin_warning, margin_warning_acknowledged);

