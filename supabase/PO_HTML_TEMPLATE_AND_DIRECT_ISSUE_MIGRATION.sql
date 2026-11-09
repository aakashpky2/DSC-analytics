-- ============================================================================
-- DBIZ ERP / SIGNSYNC: PURCHASE ORDER HTML TEMPLATE MASTER + DIRECT ISSUE & CANCELLATION
-- Target Database: Supabase PostgreSQL (Project: kbqwsfmfiomcakbhclca)
-- Description:
--   1. Creates purchase_order_html_templates table with organization-level isolation
--   2. Enforces unique (organization_id, template_code)
--   3. Adds template_id, template_snapshot, rendered_html, cancelled_by, cancelled_at,
--      cancellation_reason columns to token_purchase_orders
--   4. Creates RLS policies for tenant isolation
--   5. Seeds a professional default Indian A4 Purchase Order template
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: CREATE purchase_order_html_templates TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_order_html_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_code TEXT NOT NULL,
    description TEXT,
    html_content TEXT NOT NULL,
    css_content TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_template_code_org UNIQUE (organization_id, template_code)
);

CREATE INDEX IF NOT EXISTS idx_po_templates_org ON public.purchase_order_html_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_po_templates_active ON public.purchase_order_html_templates(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_po_templates_default ON public.purchase_order_html_templates(organization_id, is_default);
CREATE INDEX IF NOT EXISTS idx_po_templates_dates ON public.purchase_order_html_templates(organization_id, effective_from, effective_to);

-- ----------------------------------------------------------------------------
-- STEP 2: EXTEND token_purchase_orders FOR TEMPLATE SNAPSHOT & CANCELLATION
-- ----------------------------------------------------------------------------
ALTER TABLE public.token_purchase_orders
    ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES public.purchase_order_html_templates(id),
    ADD COLUMN IF NOT EXISTS template_version TEXT,
    ADD COLUMN IF NOT EXISTS template_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS rendered_html TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ----------------------------------------------------------------------------
-- STEP 3: SEED DEFAULT PROFESSIONAL INDIAN A4 PURCHASE ORDER TEMPLATE
-- ----------------------------------------------------------------------------
INSERT INTO public.purchase_order_html_templates (
    id,
    organization_id,
    template_name,
    template_code,
    description,
    is_active,
    is_default,
    effective_from,
    effective_to,
    css_content,
    html_content
)
VALUES (
    'tmpl-po-standard-default',
    'comp-default',
    'Standard Indian Commercial Purchase Order (A4)',
    'PO_STANDARD',
    'Official statutory A4 printable Purchase Order template with complete buyer, vendor, ship-to, token stock specs, GST breakdown and commercial terms.',
    true,
    true,
    '2026-01-01',
    NULL,
    '@page { size: A4 portrait; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; line-height: 1.4; font-size: 12px; margin: 0; padding: 0; background: #fff; } table { width: 100%; border-collapse: collapse; } th, td { padding: 6px 8px; }',
    '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Purchase Order - {{po.number}}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; margin: 0; padding: 12px; background: #fff; }
.po-card { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
.header-band { background: #0f172a; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
.po-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
.po-badge { background: #2563eb; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 18px; font-size: 11px; }
.meta-row { display: flex; margin-bottom: 3px; }
.meta-label { width: 110px; color: #64748b; font-weight: 600; }
.meta-val { color: #0f172a; font-weight: 700; }
.parties-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #fff; }
.party-box { font-size: 10.5px; }
.party-header { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-bottom: 4px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
.party-name { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.item-table { width: 100%; border-collapse: collapse; }
.item-table th { background: #f1f5f9; color: #334155; font-size: 10px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; }
.item-table td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #1e293b; }
.totals-section { display: flex; justify-content: flex-end; padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.totals-table { width: 280px; }
.totals-table td { padding: 3px 6px; font-size: 11px; }
.totals-table tr.grand-total td { font-size: 13px; font-weight: 800; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 6px; }
.terms-section { padding: 12px 18px; font-size: 10px; color: #475569; border-bottom: 1px solid #e2e8f0; }
.terms-title { font-weight: 700; text-transform: uppercase; color: #0f172a; margin-bottom: 4px; font-size: 10px; }
.sign-section { display: flex; justify-content: space-between; align-items: flex-end; padding: 18px 18px; background: #fff; }
.sign-box { text-align: right; width: 220px; }
.sign-line { border-top: 1px solid #94a3b8; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: 700; color: #0f172a; }
</style>
</head>
<body>
<div class="po-card">
  <div class="header-band">
    <div>
      <div class="po-title">PURCHASE ORDER</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">COMMERCIAL PROCUREMENT DOCUMENT</div>
    </div>
    <div style="text-align: right;">
      <span class="po-badge">{{po.status}}</span>
      <div style="font-size: 12px; font-weight: 700; margin-top: 4px;">{{po.number}}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-row"><span class="meta-label">PO Date:</span><span class="meta-val">{{po.date}}</span></div>
      <div class="meta-row"><span class="meta-label">Payment Terms:</span><span>{{po.payment_terms}}</span></div>
    </div>
    <div>
      <div class="meta-row"><span class="meta-label">Delivery Terms:</span><span>{{po.delivery_terms}}</span></div>
      <div class="meta-row"><span class="meta-label">Validity Terms:</span><span>{{po.validity_terms}}</span></div>
    </div>
  </div>

  <div class="parties-grid">
    <div class="party-box">
      <div class="party-header">Buyer / Purchasing Entity</div>
      <div class="party-name">{{buyer.legal_name}}</div>
      <div>{{buyer.address}}</div>
      <div>{{buyer.city}}, {{buyer.state}} - {{buyer.pincode}}</div>
      <div style="margin-top: 4px;"><strong>GSTIN:</strong> {{buyer.gstin}}</div>
      <div><strong>PAN:</strong> {{buyer.pan}}</div>
      <div>Attn: {{buyer.contact_person}} ({{buyer.mobile}})</div>
    </div>

    <div class="party-box">
      <div class="party-header">Vendor / Supplier</div>
      <div class="party-name">{{vendor.party_name}}</div>
      <div>{{vendor.address}}</div>
      <div>{{vendor.city}}, {{vendor.state}} - {{vendor.pincode}}</div>
      <div style="margin-top: 4px;"><strong>GSTIN:</strong> {{vendor.gstin}}</div>
      <div><strong>PAN:</strong> {{vendor.pan}}</div>
      <div>Attn: {{vendor.contact_person}} ({{vendor.mobile}})</div>
    </div>

    <div class="party-box">
      <div class="party-header">Ship / Deliver To</div>
      <div class="party-name">{{delivery.location_name}}</div>
      <div>{{delivery.address}}</div>
      <div>{{delivery.city}}, {{delivery.state}} - {{delivery.pincode}}</div>
      <div style="margin-top: 4px;"><strong>Destination Hub</strong></div>
      <div>Attn: {{delivery.contact_person}}</div>
      <div>Mobile: {{delivery.mobile}}</div>
    </div>
  </div>

  <table class="item-table">
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th>Token Specifications</th>
        <th>Product</th>
        <th>Version</th>
        <th style="text-align: right; width: 40px;">Qty</th>
        <th style="text-align: right; width: 65px;">Rate (₹)</th>
        <th style="text-align: right; width: 75px;">Taxable (₹)</th>
        <th style="text-align: right; width: 50px;">GST %</th>
        <th style="text-align: right; width: 65px;">GST (₹)</th>
        <th style="text-align: right; width: 85px;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td>{{item.index}}</td>
        <td><strong>{{item.company}}</strong> - {{item.description}}</td>
        <td>{{item.product}}</td>
        <td>{{item.version}}</td>
        <td style="text-align: right; font-weight: 700;">{{item.quantity}}</td>
        <td style="text-align: right;">{{item.unit_rate}}</td>
        <td style="text-align: right;">{{item.taxable_amount}}</td>
        <td style="text-align: right;">{{item.gst_percentage}}%</td>
        <td style="text-align: right;">{{item.gst_amount}}</td>
        <td style="text-align: right; font-weight: 700;">{{item.total_amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr>
        <td style="color: #64748b;">Subtotal (Taxable):</td>
        <td style="text-align: right; font-weight: 600;">₹{{po.subtotal}}</td>
      </tr>
      <tr>
        <td style="color: #64748b;">Total GST:</td>
        <td style="text-align: right; font-weight: 600;">₹{{po.gst_amount}}</td>
      </tr>
      {{#if po.other_charges}}
      <tr>
        <td style="color: #64748b;">Other Charges:</td>
        <td style="text-align: right; font-weight: 600;">₹{{po.other_charges}}</td>
      </tr>
      {{/if}}
      <tr class="grand-total">
        <td>Grand Total (INR):</td>
        <td style="text-align: right;">₹{{po.grand_total}}</td>
      </tr>
    </table>
  </div>

  <div class="terms-section">
    <div class="terms-title">Commercial & Statutory Terms</div>
    <div>1. <strong>Inspection & Warranty:</strong> {{po.inspection_terms}}</div>
    <div>2. <strong>Delivery Schedule:</strong> Material must strictly conform to cryptographic FIPS/CCA standards specified above.</div>
    <div>3. <strong>Remarks:</strong> {{po.remarks}}</div>
  </div>

  <div class="sign-section">
    <div style="font-size: 9px; color: #94a3b8;">
      This is a computer-generated Purchase Order issued by {{buyer.legal_name}}.<br>
      Generated on: {{po.date}}
    </div>
    <div class="sign-box">
      <div style="font-size: 10px; font-weight: 700; color: #475569;">For {{buyer.legal_name}}</div>
      <div class="sign-line">Authorized Signatory</div>
    </div>
  </div>
</div>
</body>
</html>'
)
ON CONFLICT (organization_id, template_code) DO UPDATE
SET template_name = EXCLUDED.template_name,
    html_content = EXCLUDED.html_content,
    css_content = EXCLUDED.css_content,
    is_active = true,
    is_default = true,
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- STEP 4: ENABLE RLS AND CREATE POLICIES FOR TEMPLATE TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.purchase_order_html_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_po_html_templates" ON public.purchase_order_html_templates;
CREATE POLICY "tenant_isolation_po_html_templates" ON public.purchase_order_html_templates
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

