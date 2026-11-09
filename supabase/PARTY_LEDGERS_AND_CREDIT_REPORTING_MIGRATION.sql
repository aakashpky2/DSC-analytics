-- ============================================================================
-- DBIZ ERP / SIGNSYNC — PARTY LEDGERS, CREDIT TERMS, DUE DATES & REPORTING
-- ============================================================================

-- 1. Vendors Master: Credit terms configuration
ALTER TABLE public.token_purchase_parties
  ADD COLUMN IF NOT EXISTS credit_period_days INTEGER DEFAULT 0;

-- 2. Token Purchase Bills: Credit period snapshot, due date, payment & outstanding
ALTER TABLE public.token_purchase_bills
  ADD COLUMN IF NOT EXISTS credit_period_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) DEFAULT 0.00;

-- 3. Sales Estimates: Expected closure date and sales rep assignment for pipeline
ALTER TABLE public.token_sales_estimates
  ADD COLUMN IF NOT EXISTS expected_closure_date DATE NULL,
  ADD COLUMN IF NOT EXISTS assigned_to TEXT NULL;

-- 4. Vendor Payments Table
CREATE TABLE IF NOT EXISTS public.token_vendor_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  company_profile_id TEXT NOT NULL,
  purchase_bill_id TEXT NOT NULL,
  vendor_party_id TEXT NOT NULL,
  payment_number TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_mode TEXT NOT NULL, -- NEFT, RTGS, IMPS, UPI, CHEQUE, CASH
  transaction_reference_utr TEXT,
  proof_url TEXT,
  notes TEXT,
  shortage_amount NUMERIC(12,2) DEFAULT 0.00,
  excess_amount NUMERIC(12,2) DEFAULT 0.00,
  receipt_number TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for high-speed reporting
CREATE INDEX IF NOT EXISTS idx_tvp_org_profile ON public.token_vendor_payments(organization_id, company_profile_id);
CREATE INDEX IF NOT EXISTS idx_tvp_vendor ON public.token_vendor_payments(vendor_party_id);
CREATE INDEX IF NOT EXISTS idx_tvp_bill ON public.token_vendor_payments(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_tpb_org_due ON public.token_purchase_bills(organization_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tse_org_closure ON public.token_sales_estimates(organization_id, expected_closure_date);

