-- ============================================================================
-- DBIZ ERP / SIGNSYNC — TOKEN SALES, LANDED COST & ANALYTICS SCHEMA
-- ============================================================================

-- 1. Extend token_purchase_bills with Courier Linkage & Freight Amount
ALTER TABLE public.token_purchase_bills
  ADD COLUMN IF NOT EXISTS courier_dispatch_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS freight_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS freight_allocation_method TEXT DEFAULT 'QUANTITY_WEIGHTED';

-- 2. Extend token_purchase_bill_items with Freight Allocation & Landed Costs
ALTER TABLE public.token_purchase_bill_items
  ADD COLUMN IF NOT EXISTS freight_allocation NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS landed_cost NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS landed_total_value NUMERIC(12,2) DEFAULT 0.00;

-- 3. Extend token_profile_stocks with Landed Cost & Valuation
ALTER TABLE public.token_profile_stocks
  ADD COLUMN IF NOT EXISTS landed_cost NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_landed_valuation NUMERIC(14,2) DEFAULT 0.00;

-- 4. Extend courier_dispatches with Purchase Bill Linkage
ALTER TABLE public.courier_dispatches
  ADD COLUMN IF NOT EXISTS purchase_bill_id TEXT NULL;

-- 5. Create Token Sales Estimates Table
CREATE TABLE IF NOT EXISTS public.token_sales_estimates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  estimate_number TEXT NOT NULL,
  estimate_date DATE NOT NULL,
  valid_until DATE,
  subtotal NUMERIC(12,2) DEFAULT 0.00,
  tax_amount NUMERIC(12,2) DEFAULT 0.00,
  grand_total NUMERIC(12,2) DEFAULT 0.00,
  status TEXT DEFAULT 'DRAFT', -- DRAFT, SENT, APPROVED, REJECTED, EXPIRED, CANCELLED, CONVERTED
  converted_sales_invoice_id TEXT,
  company_profile_snapshot JSONB DEFAULT '{}'::jsonb,
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Token Sales Invoices Table
CREATE TABLE IF NOT EXISTS public.token_sales_invoices (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  estimate_id TEXT,
  series_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  place_of_supply TEXT,
  customer_gstin TEXT,
  subtotal NUMERIC(12,2) DEFAULT 0.00,
  cgst_amount NUMERIC(12,2) DEFAULT 0.00,
  sgst_amount NUMERIC(12,2) DEFAULT 0.00,
  igst_amount NUMERIC(12,2) DEFAULT 0.00,
  total_tax NUMERIC(12,2) DEFAULT 0.00,
  grand_total NUMERIC(12,2) DEFAULT 0.00,
  paid_amount NUMERIC(12,2) DEFAULT 0.00,
  outstanding_balance NUMERIC(12,2) DEFAULT 0.00,
  status TEXT DEFAULT 'DRAFT', -- DRAFT, POSTED, PARTIALLY_PAID, PAID, CANCELLED
  company_profile_snapshot JSONB DEFAULT '{}'::jsonb,
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  total_landed_cost NUMERIC(12,2) DEFAULT 0.00,
  total_profit NUMERIC(12,2) DEFAULT 0.00,
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  is_number_reused BOOLEAN DEFAULT false,
  posted_by TEXT,
  posted_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create Token Sales Payments Table
CREATE TABLE IF NOT EXISTS public.token_sales_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  payment_number TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_mode TEXT NOT NULL, -- NEFT, RTGS, IMPS, UPI, CHEQUE, CASH
  transaction_reference_utr TEXT,
  proof_url TEXT,
  notes TEXT,
  shortage_amount NUMERIC(12,2) DEFAULT 0.00,
  excess_amount NUMERIC(12,2) DEFAULT 0.00,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create Profile-Specific Sales Series Numbering Configs
CREATE TABLE IF NOT EXISTS public.token_sales_series_configs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  series_name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  suffix TEXT DEFAULT '',
  current_counter INT DEFAULT 1000,
  allow_reuse_on_cancellation BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & isolation
CREATE INDEX IF NOT EXISTS idx_token_sales_estimates_org_prof ON public.token_sales_estimates(organization_id, company_profile_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_invoices_org_prof ON public.token_sales_invoices(organization_id, company_profile_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_payments_org_inv ON public.token_sales_payments(organization_id, invoice_id);

-- Enable RLS
ALTER TABLE public.token_sales_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_sales_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_sales_series_configs ENABLE ROW LEVEL SECURITY;

