"use strict";
/**
 * Controlled Safe HTML Document Template Engine for DBIZ ERP / SIGNSYNC
 * Unified engine supporting:
 *  - PURCHASE_ORDER
 *  - PURCHASE_BILL
 *  - SALES_ESTIMATE
 *  - SALES_INVOICE
 *
 * Security: Strict HTML sanitization, no executable JavaScript, no event handlers.
 * Layout: Standard A4 portrait print formatting, repeating table headers, proper totals, signatures.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_A4_CSS = void 0;
exports.validateDocumentTemplateHtml = validateDocumentTemplateHtml;
exports.renderDocumentHtml = renderDocumentHtml;
exports.getDefaultTemplateHtmlForType = getDefaultTemplateHtmlForType;
/**
 * Validates document HTML template for syntax and strict security.
 */
function validateDocumentTemplateHtml(html, docType) {
    const errors = [];
    if (!html || typeof html !== 'string' || !html.trim()) {
        return { valid: false, errors: ['HTML template content is empty.'] };
    }
    // Security checks: Disallow executable scripts and event handlers
    if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(html) ||
        /javascript:/gi.test(html) ||
        /\bon[a-z]+\s*=/gi.test(html)) {
        errors.push('Executable JavaScript, <script> tags, and inline event handlers are strictly prohibited in document templates.');
    }
    // Check for repeatable items block
    if (!html.includes('{{#items}}') || !html.includes('{{/items}}')) {
        errors.push('Template must contain a repeatable {{#items}} ... {{/items}} block for the line items table.');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Resolves a nested key safely from the context object.
 */
function resolveValue(context, path) {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === undefined || current === null)
            return '';
        current = current[part];
    }
    if (current === undefined || current === null)
        return '';
    return String(current);
}
/**
 * Renders the Document HTML by substituting placeholders with real context values.
 */
function renderDocumentHtml(templateHtml, rawContext) {
    // Setup bidirectional aliases for maximum template backward and forward compatibility
    const context = Object.assign(Object.assign({}, rawContext), { buyer: rawContext.company || rawContext.buyer, vendor: rawContext.party || rawContext.vendor, customer: rawContext.party || rawContext.customer, po: rawContext.document || rawContext.po });
    let rendered = templateHtml;
    // 1. Process repeatable items block: {{#items}} ... {{/items}}
    const itemsRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
    rendered = rendered.replace(itemsRegex, (_match, rowTemplate) => {
        if (!Array.isArray(context.items) || context.items.length === 0) {
            return '';
        }
        return context.items
            .map((item, idx) => {
            let row = rowTemplate;
            const itemWithIndex = Object.assign(Object.assign({}, item), { index: idx + 1, company: item.company || item.token_company || '', product: item.product || item.token_product || '', version: item.version || item.token_version || item.token_model || '' });
            row = row.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_m, field) => {
                const val = itemWithIndex[field];
                return val !== undefined && val !== null ? String(val) : '';
            });
            return row;
        })
            .join('\n');
    });
    // 2. Process simple condition: {{#if condition}} ... {{/if}}
    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    rendered = rendered.replace(ifRegex, (_match, condPath, content) => {
        const val = resolveValue(context, condPath);
        if (val && val !== '0' && val !== 'false' && val.trim() !== '') {
            return content;
        }
        return '';
    });
    // 3. Process all top-level placeholders: {{document.*}}, {{company.*}}, {{party.*}}, {{buyer.*}}, {{vendor.*}}, {{customer.*}}, {{po.*}}, {{delivery.*}}
    const varRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
    rendered = rendered.replace(varRegex, (_match, varPath) => {
        return resolveValue(context, varPath);
    });
    // 4. Sanitize against executable scripts and event handlers in rendered output
    rendered = rendered
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s*on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript:[^"'\s>]+/gi, '');
    return rendered;
}
/**
 * Standard CSS for statutory Indian A4 documents
 */
exports.STANDARD_A4_CSS = `
@page {
  size: A4 portrait;
  margin: 12mm;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print {
    display: none !important;
  }
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #111827;
  font-size: 11px;
  line-height: 1.4;
  margin: 0;
  padding: 0;
  background: #ffffff;
}
table {
  width: 100%;
  border-collapse: collapse;
}
.doc-container {
  width: 100%;
}
.header-table {
  border-bottom: 2px solid #111827;
  padding-bottom: 8px;
  margin-bottom: 10px;
}
.doc-title {
  font-size: 20px;
  font-weight: 800;
  text-align: right;
  letter-spacing: 0.5px;
  color: #1e3a8a;
  text-transform: uppercase;
}
.party-grid {
  width: 100%;
  border: 1px solid #d1d5db;
  margin-bottom: 12px;
}
.party-box {
  padding: 8px 10px;
  vertical-align: top;
  font-size: 11px;
}
.party-title {
  font-size: 9px;
  font-weight: 800;
  color: #4b5563;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.party-name {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 2px;
}
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  margin-bottom: 12px;
}
.items-table th {
  background: #f3f4f6;
  border: 1px solid #9ca3af;
  padding: 6px 8px;
  font-size: 9px;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
}
.items-table td {
  border: 1px solid #d1d5db;
  padding: 6px 8px;
  vertical-align: top;
}
.text-right {
  text-align: right;
}
.text-center {
  text-align: center;
}
.totals-table {
  width: 320px;
  margin-left: auto;
  border-collapse: collapse;
  margin-bottom: 16px;
}
.totals-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #e5e7eb;
}
.grand-total-row td {
  font-size: 13px;
  font-weight: 800;
  border-top: 2px solid #111827;
  border-bottom: 2px solid #111827;
  background: #f9fafb;
}
.signature-section {
  width: 100%;
  margin-top: 30px;
  page-break-inside: avoid;
}
.signature-box {
  width: 240px;
  text-align: center;
  border-top: 1px solid #9ca3af;
  padding-top: 6px;
  font-size: 10px;
  font-weight: 600;
}
`;
/**
 * Built-in Standard Template Generator for each Document Type
 */
function getDefaultTemplateHtmlForType(docType) {
    switch (docType) {
        case 'SALES_ESTIMATE':
            return {
                template_name: 'Standard Commercial Sales Estimate (A4)',
                template_code: 'EST_STANDARD',
                css_content: exports.STANDARD_A4_CSS,
                html_content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sales Estimate - {{document.number}}</title>
<style>
${exports.STANDARD_A4_CSS}
</style>
</head>
<body>
<div class="doc-container">
  <table class="header-table">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="party-name" style="font-size: 16px;">{{company.legal_name}}</div>
        <div>{{company.registered_address}}</div>
        <div>GSTIN: <strong>{{company.gstin}}</strong> | PAN: <strong>{{company.pan}}</strong></div>
        <div>Email: {{company.email}} | Phone: {{company.phone}}</div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-title">SALES ESTIMATE / QUOTATION</div>
        <div style="margin-top: 6px;">Estimate #: <strong>{{document.number}}</strong></div>
        <div>Date: <strong>{{document.date}}</strong></div>
        <div>Valid Until: <strong>{{document.valid_until}}</strong></div>
        {{#if document.expected_closure_date}}
        <div>Expected Closure: <strong>{{document.expected_closure_date}}</strong></div>
        {{/if}}
      </td>
    </tr>
  </table>

  <table class="party-grid">
    <tr>
      <td class="party-box" style="width: 50%; border-right: 1px solid #d1d5db;">
        <div class="party-title">ESTIMATE FOR / PROSPECTIVE CUSTOMER:</div>
        <div class="party-name">{{party.company_name}}</div>
        <div>Contact: {{party.contact_person}}</div>
        <div>{{party.billing_address}}</div>
        <div>GSTIN: <strong>{{party.gstin}}</strong></div>
        <div>Email: {{party.email}} | Phone: {{party.phone}}</div>
      </td>
      <td class="party-box" style="width: 50%;">
        <div class="party-title">SALES & COMMERCIAL TERMS:</div>
        <div>Status: <strong>{{document.status}}</strong></div>
        <div>Place of Supply: <strong>{{party.state_code}}</strong></div>
        {{#if document.assigned_to}}
        <div>Sales Representative: <strong>{{document.assigned_to}}</strong></div>
        {{/if}}
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 30px;">#</th>
        <th>Token Model / Description</th>
        <th class="text-center" style="width: 50px;">Qty</th>
        <th class="text-right" style="width: 80px;">Unit Rate</th>
        <th class="text-right" style="width: 90px;">Taxable</th>
        <th class="text-right" style="width: 70px;">GST %</th>
        <th class="text-right" style="width: 80px;">GST Amt</th>
        <th class="text-right" style="width: 100px;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td class="text-center">{{item.index}}</td>
        <td>
          <strong>{{item.description}}</strong>
        </td>
        <td class="text-center">{{item.quantity}}</td>
        <td class="text-right">₹ {{item.unit_rate}}</td>
        <td class="text-right">₹ {{item.taxable_amount}}</td>
        <td class="text-right">{{item.gst_percentage}}%</td>
        <td class="text-right">₹ {{item.gst_amount}}</td>
        <td class="text-right">₹ {{item.total_amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td>Taxable Subtotal:</td>
      <td class="text-right">₹ {{document.subtotal}}</td>
    </tr>
    <tr>
      <td>Total GST:</td>
      <td class="text-right">₹ {{document.gst_amount}}</td>
    </tr>
    <tr class="grand-total-row">
      <td>Grand Total:</td>
      <td class="text-right">₹ {{document.grand_total}}</td>
    </tr>
  </table>

  <div style="font-size: 10px; color: #4b5563; margin-top: 10px; border-left: 3px solid #3b82f6; padding-left: 8px;">
    <strong>Notes & Commercial Terms:</strong><br>
    1. Rates quoted above are inclusive of standard manufacturer warranty.<br>
    2. Validity: This quotation is valid until {{document.valid_until}}.<br>
    3. Delivery timeline: 2-3 business days upon purchase order / advance payment confirmation.
  </div>

  <table class="signature-section">
    <tr>
      <td style="width: 50%; vertical-align: bottom;">
        <div>Customer Acceptance (Sign & Seal):</div>
        <div style="margin-top: 35px; border-top: 1px dashed #9ca3af; width: 200px;"></div>
      </td>
      <td style="width: 50%; text-align: right; vertical-align: bottom;">
        <div>For <strong>{{company.legal_name}}</strong></div>
        <div style="margin-top: 40px; display: inline-block;" class="signature-box">Authorized Signatory</div>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`
            };
        case 'SALES_INVOICE':
            return {
                template_name: 'Standard Indian GST Tax Invoice (A4)',
                template_code: 'INV_STANDARD',
                css_content: exports.STANDARD_A4_CSS,
                html_content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tax Invoice - {{document.number}}</title>
<style>
${exports.STANDARD_A4_CSS}
</style>
</head>
<body>
<div class="doc-container">
  <table class="header-table">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="party-name" style="font-size: 17px; color: #1e3a8a;">{{company.legal_name}}</div>
        <div>{{company.registered_address}}</div>
        <div>GSTIN: <strong>{{company.gstin}}</strong> | PAN: <strong>{{company.pan}}</strong></div>
        <div>Email: {{company.email}} | Phone: {{company.phone}}</div>
        <div>State / State Code: <strong>{{company.state_name}} ({{company.state_code}})</strong></div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-title" style="color: #047857;">TAX INVOICE</div>
        <div style="font-size: 9px; font-weight: 700; color: #6b7280;">(Under Section 31 of Central Goods and Services Tax Act, 2017)</div>
        <div style="margin-top: 6px;">Invoice #: <strong>{{document.number}}</strong></div>
        <div>Invoice Date: <strong>{{document.date}}</strong></div>
        <div>Due Date: <strong>{{document.due_date}}</strong></div>
        <div>Place of Supply: <strong>{{document.place_of_supply}}</strong></div>
      </td>
    </tr>
  </table>

  <table class="party-grid">
    <tr>
      <td class="party-box" style="width: 50%; border-right: 1px solid #d1d5db;">
        <div class="party-title">BILLED TO (BUYER):</div>
        <div class="party-name">{{party.company_name}}</div>
        <div>Contact: {{party.contact_person}}</div>
        <div>{{party.billing_address}}</div>
        <div>GSTIN / Unique ID: <strong>{{party.gstin}}</strong></div>
        <div>PAN: <strong>{{party.pan}}</strong></div>
        <div>State Code: <strong>{{party.state_code}}</strong></div>
      </td>
      <td class="party-box" style="width: 50%;">
        <div class="party-title">SHIPPED TO (CONSIGNEE):</div>
        <div class="party-name">{{party.company_name}}</div>
        <div>{{party.billing_address}}</div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e5e7eb;">
          Status: <strong>{{document.status}}</strong> | Credit Period: <strong>{{document.payment_terms}}</strong>
        </div>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 30px;">#</th>
        <th>Product Description</th>
        <th class="text-center" style="width: 60px;">HSN/SAC</th>
        <th class="text-center" style="width: 45px;">Qty</th>
        <th class="text-right" style="width: 75px;">Unit Rate</th>
        <th class="text-right" style="width: 85px;">Taxable</th>
        <th class="text-right" style="width: 75px;">CGST</th>
        <th class="text-right" style="width: 75px;">SGST</th>
        <th class="text-right" style="width: 75px;">IGST</th>
        <th class="text-right" style="width: 95px;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td class="text-center">{{item.index}}</td>
        <td>
          <strong>{{item.description}}</strong>
        </td>
        <td class="text-center">{{item.hsn_sac}}</td>
        <td class="text-center">{{item.quantity}}</td>
        <td class="text-right">₹ {{item.unit_rate}}</td>
        <td class="text-right">₹ {{item.taxable_amount}}</td>
        <td class="text-right">₹ {{item.cgst_amount}}</td>
        <td class="text-right">₹ {{item.sgst_amount}}</td>
        <td class="text-right">₹ {{item.igst_amount}}</td>
        <td class="text-right">₹ {{item.total_amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td>Taxable Value:</td>
      <td class="text-right">₹ {{document.subtotal}}</td>
    </tr>
    <tr>
      <td>Total GST:</td>
      <td class="text-right">₹ {{document.gst_amount}}</td>
    </tr>
    <tr class="grand-total-row">
      <td>Invoice Total:</td>
      <td class="text-right">₹ {{document.grand_total}}</td>
    </tr>
    <tr>
      <td>Amount Paid:</td>
      <td class="text-right" style="color: #047857; font-weight: 700;">₹ {{document.paid_amount}}</td>
    </tr>
    <tr>
      <td>Balance Due:</td>
      <td class="text-right" style="color: #b91c1c; font-weight: 700;">₹ {{document.outstanding_balance}}</td>
    </tr>
  </table>

  <div style="font-size: 10px; color: #4b5563; margin-top: 10px; border: 1px solid #e5e7eb; padding: 6px 8px;">
    <strong>Statutory Declaration & Terms:</strong><br>
    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.<br>
    Interest @ 18% per annum will be charged on all delayed payments exceeding the due date ({{document.due_date}}).
  </div>

  <table class="signature-section">
    <tr>
      <td style="width: 50%; vertical-align: bottom;">
        <div>Customer Seal & Signature:</div>
        <div style="margin-top: 35px; border-top: 1px dashed #9ca3af; width: 200px;"></div>
      </td>
      <td style="width: 50%; text-align: right; vertical-align: bottom;">
        <div>For <strong>{{company.legal_name}}</strong></div>
        <div style="margin-top: 40px; display: inline-block;" class="signature-box">Authorized Signatory</div>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`
            };
        case 'PURCHASE_BILL':
            return {
                template_name: 'Standard Indian Commercial Purchase Bill (A4)',
                template_code: 'PB_STANDARD',
                css_content: exports.STANDARD_A4_CSS,
                html_content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Purchase Bill - {{document.number}}</title>
<style>
${exports.STANDARD_A4_CSS}
</style>
</head>
<body>
<div class="doc-container">
  <table class="header-table">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="party-name" style="font-size: 17px; color: #047857;">{{company.legal_name}}</div>
        <div>{{company.registered_address}}</div>
        <div>GSTIN: <strong>{{company.gstin}}</strong> | PAN: <strong>{{company.pan}}</strong></div>
        <div>Accounting Profile: <strong>{{company.legal_name}}</strong></div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-title" style="color: #1e3a8a;">PURCHASE BILL / INWARD INVOICE</div>
        <div style="margin-top: 6px;">Voucher #: <strong>{{document.number}}</strong></div>
        <div>Accounting Date: <strong>{{document.date}}</strong></div>
        <div>Due Date: <strong>{{document.due_date}}</strong></div>
        <div>Supplier Inv #: <strong>{{document.supplier_invoice_number}}</strong></div>
        <div>Supplier Inv Date: <strong>{{document.supplier_invoice_date}}</strong></div>
        {{#if document.po_reference}}
        <div>PO Ref: <strong>{{document.po_reference}}</strong></div>
        {{/if}}
      </td>
    </tr>
  </table>

  <table class="party-grid">
    <tr>
      <td class="party-box" style="width: 50%; border-right: 1px solid #d1d5db;">
        <div class="party-title">VENDOR / SUPPLIER DETAILS:</div>
        <div class="party-name">{{party.party_name}}</div>
        <div>Contact: {{party.contact_person}}</div>
        <div>{{party.address}}, {{party.city}}</div>
        <div>GSTIN: <strong>{{party.gstin}}</strong> | PAN: <strong>{{party.pan}}</strong></div>
        <div>Email: {{party.email}} | Phone: {{party.mobile}}</div>
      </td>
      <td class="party-box" style="width: 50%;">
        <div class="party-title">PURCHASE ACCOUNTING & LOGISTICS:</div>
        <div>Status: <strong>{{document.status}}</strong></div>
        <div>Payment Terms: <strong>{{document.payment_terms}}</strong></div>
        <div>Inward Freight: <strong>₹ {{document.freight_amount}}</strong></div>
        <div>Place of Supply: <strong>{{document.place_of_supply}}</strong></div>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 30px;">#</th>
        <th>Token Model & Specifications</th>
        <th class="text-center" style="width: 50px;">Qty</th>
        <th class="text-right" style="width: 80px;">Unit Rate</th>
        <th class="text-right" style="width: 90px;">Taxable</th>
        <th class="text-right" style="width: 70px;">GST %</th>
        <th class="text-right" style="width: 80px;">GST Amt</th>
        <th class="text-right" style="width: 80px;">Landed/Unit</th>
        <th class="text-right" style="width: 95px;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td class="text-center">{{item.index}}</td>
        <td>
          <strong>{{item.description}}</strong>
        </td>
        <td class="text-center">{{item.quantity}}</td>
        <td class="text-right">₹ {{item.unit_rate}}</td>
        <td class="text-right">₹ {{item.taxable_amount}}</td>
        <td class="text-right">{{item.gst_percentage}}%</td>
        <td class="text-right">₹ {{item.gst_amount}}</td>
        <td class="text-right">₹ {{item.landed_cost}}</td>
        <td class="text-right">₹ {{item.total_amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td>Taxable Subtotal:</td>
      <td class="text-right">₹ {{document.subtotal}}</td>
    </tr>
    <tr>
      <td>Total GST:</td>
      <td class="text-right">₹ {{document.gst_amount}}</td>
    </tr>
    {{#if document.freight_amount}}
    <tr>
      <td>Freight Inward:</td>
      <td class="text-right">₹ {{document.freight_amount}}</td>
    </tr>
    {{/if}}
    <tr class="grand-total-row">
      <td>Gross Total:</td>
      <td class="text-right">₹ {{document.grand_total}}</td>
    </tr>
    <tr>
      <td>Vendor Paid:</td>
      <td class="text-right" style="color: #047857; font-weight: 700;">₹ {{document.paid_amount}}</td>
    </tr>
    <tr>
      <td>Payable Balance:</td>
      <td class="text-right" style="color: #b91c1c; font-weight: 700;">₹ {{document.outstanding_balance}}</td>
    </tr>
  </table>

  <table class="signature-section">
    <tr>
      <td style="width: 50%; vertical-align: bottom;">
        <div>Goods Verified & Inwarded By:</div>
        <div style="margin-top: 35px; border-top: 1px dashed #9ca3af; width: 200px;">Warehouse Manager</div>
      </td>
      <td style="width: 50%; text-align: right; vertical-align: bottom;">
        <div>For <strong>{{company.legal_name}}</strong></div>
        <div style="margin-top: 40px; display: inline-block;" class="signature-box">Accounts & Finance Verification</div>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`
            };
        case 'PURCHASE_ORDER':
        default:
            return {
                template_name: 'Standard Indian Commercial Purchase Order (A4)',
                template_code: 'PO_STANDARD',
                css_content: exports.STANDARD_A4_CSS,
                html_content: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Purchase Order - {{document.number}}</title>
<style>
${exports.STANDARD_A4_CSS}
</style>
</head>
<body>
<div class="doc-container">
  <table class="header-table">
    <tr>
      <td style="width: 60%; vertical-align: top;">
        <div class="party-name" style="font-size: 16px;">{{company.legal_name}}</div>
        <div>{{company.registered_address}}</div>
        <div>GSTIN: <strong>{{company.gstin}}</strong> | PAN: <strong>{{company.pan}}</strong></div>
        <div>Email: {{company.email}} | Mobile: {{company.mobile}}</div>
      </td>
      <td style="width: 40%; text-align: right; vertical-align: top;">
        <div class="doc-title">PURCHASE ORDER</div>
        <div style="margin-top: 6px;">PO #: <strong>{{document.number}}</strong></div>
        <div>PO Date: <strong>{{document.date}}</strong></div>
        <div>Status: <strong>{{document.status}}</strong></div>
      </td>
    </tr>
  </table>

  <table class="party-grid">
    <tr>
      <td class="party-box" style="width: 50%; border-right: 1px solid #d1d5db;">
        <div class="party-title">VENDOR / SUPPLIER:</div>
        <div class="party-name">{{party.party_name}}</div>
        <div>Contact: {{party.contact_person}}</div>
        <div>{{party.address}}, {{party.city}}</div>
        <div>GSTIN: <strong>{{party.gstin}}</strong></div>
        <div>Email: {{party.email}} | Mobile: {{party.mobile}}</div>
      </td>
      <td class="party-box" style="width: 50%;">
        <div class="party-title">SHIP TO / DELIVERY DESTINATION:</div>
        <div class="party-name">{{delivery.location_name}}</div>
        <div>{{delivery.address}}, {{delivery.city}}</div>
        <div>PIN Code: {{delivery.pincode}}</div>
        <div>Contact: {{delivery.contact_person}} ({{delivery.mobile}})</div>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-center" style="width: 30px;">#</th>
        <th>Token Model & Specifications</th>
        <th class="text-center" style="width: 50px;">Qty</th>
        <th class="text-right" style="width: 80px;">Unit Rate</th>
        <th class="text-right" style="width: 90px;">Taxable</th>
        <th class="text-right" style="width: 70px;">GST %</th>
        <th class="text-right" style="width: 80px;">GST Amt</th>
        <th class="text-right" style="width: 95px;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#items}}
      <tr>
        <td class="text-center">{{item.index}}</td>
        <td>
          <strong>{{item.description}}</strong>
        </td>
        <td class="text-center">{{item.quantity}}</td>
        <td class="text-right">₹ {{item.unit_rate}}</td>
        <td class="text-right">₹ {{item.taxable_amount}}</td>
        <td class="text-right">{{item.gst_percentage}}%</td>
        <td class="text-right">₹ {{item.gst_amount}}</td>
        <td class="text-right">₹ {{item.total_amount}}</td>
      </tr>
      {{/items}}
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td>Taxable Subtotal:</td>
      <td class="text-right">₹ {{document.subtotal}}</td>
    </tr>
    <tr>
      <td>Total GST:</td>
      <td class="text-right">₹ {{document.gst_amount}}</td>
    </tr>
    <tr class="grand-total-row">
      <td>Grand Total:</td>
      <td class="text-right">₹ {{document.grand_total}}</td>
    </tr>
  </table>

  <table class="signature-section">
    <tr>
      <td style="width: 50%; vertical-align: bottom;">
        <div>Vendor Acceptance (Sign & Stamp):</div>
        <div style="margin-top: 35px; border-top: 1px dashed #9ca3af; width: 200px;"></div>
      </td>
      <td style="width: 50%; text-align: right; vertical-align: bottom;">
        <div>For <strong>{{company.legal_name}}</strong></div>
        <div style="margin-top: 40px; display: inline-block;" class="signature-box">Authorized Signatory</div>
      </td>
    </tr>
  </table>
</div>
</body>
</html>`
            };
    }
}
