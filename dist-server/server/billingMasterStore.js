"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AGEING_BUCKETS = exports.DEFAULT_COMMISSION_RULES = exports.DEFAULT_CANCELLATION_REASONS = exports.DEFAULT_DEBIT_NOTE_REASONS = exports.DEFAULT_CREDIT_NOTE_REASONS = exports.DEFAULT_PAYMENT_MODES = exports.DEFAULT_INVOICE_STATUSES = exports.DEFAULT_INVOICE_TYPES = exports.DEFAULT_HSN_SAC = exports.DEFAULT_TAX_RATES = exports.DEFAULT_STATES_MASTER = void 0;
exports.saveBillingRelationalStore = saveBillingRelationalStore;
exports.getStatesMaster = getStatesMaster;
exports.getTaxRatesMaster = getTaxRatesMaster;
exports.getHsnSacMaster = getHsnSacMaster;
exports.getInvoiceTypesMaster = getInvoiceTypesMaster;
exports.getInvoiceStatusesMaster = getInvoiceStatusesMaster;
exports.getPaymentModesMaster = getPaymentModesMaster;
exports.getCreditNoteReasonsMaster = getCreditNoteReasonsMaster;
exports.getDebitNoteReasonsMaster = getDebitNoteReasonsMaster;
exports.getCancellationReasonsMaster = getCancellationReasonsMaster;
exports.getCommissionRulesMaster = getCommissionRulesMaster;
exports.getAgeingBucketsMaster = getAgeingBucketsMaster;
exports.getCreditNotes = getCreditNotes;
exports.saveCreditNotes = saveCreditNotes;
exports.getDebitNotes = getDebitNotes;
exports.saveDebitNotes = saveDebitNotes;
exports.getPaymentReceipts = getPaymentReceipts;
exports.savePaymentReceipts = savePaymentReceipts;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
/**
 * DBIZ ERP — Central Billing Master Store & Engine
 * Single Source of Truth for Invoicing, Taxation, Place of Supply & Accounting Rules
 */
// 1. Indian States & GST State Code Master (Authorized 37 States & UTs)
exports.DEFAULT_STATES_MASTER = [
    { state_code: '01', state_name: 'Jammu & Kashmir', is_active: 1 },
    { state_code: '02', state_name: 'Himachal Pradesh', is_active: 1 },
    { state_code: '03', state_name: 'Punjab', is_active: 1 },
    { state_code: '04', state_name: 'Chandigarh', is_active: 1 },
    { state_code: '05', state_name: 'Uttarakhand', is_active: 1 },
    { state_code: '06', state_name: 'Haryana', is_active: 1 },
    { state_code: '07', state_name: 'Delhi', is_active: 1 },
    { state_code: '08', state_name: 'Rajasthan', is_active: 1 },
    { state_code: '09', state_name: 'Uttar Pradesh', is_active: 1 },
    { state_code: '10', state_name: 'Bihar', is_active: 1 },
    { state_code: '11', state_name: 'Sikkim', is_active: 1 },
    { state_code: '12', state_name: 'Arunachal Pradesh', is_active: 1 },
    { state_code: '13', state_name: 'Nagaland', is_active: 1 },
    { state_code: '14', state_name: 'Manipur', is_active: 1 },
    { state_code: '15', state_name: 'Mizoram', is_active: 1 },
    { state_code: '16', state_name: 'Tripura', is_active: 1 },
    { state_code: '17', state_name: 'Meghalaya', is_active: 1 },
    { state_code: '18', state_name: 'Assam', is_active: 1 },
    { state_code: '19', state_name: 'West Bengal', is_active: 1 },
    { state_code: '20', state_name: 'Jharkhand', is_active: 1 },
    { state_code: '21', state_name: 'Odisha', is_active: 1 },
    { state_code: '22', state_name: 'Chhattisgarh', is_active: 1 },
    { state_code: '23', state_name: 'Madhya Pradesh', is_active: 1 },
    { state_code: '24', state_name: 'Gujarat', is_active: 1 },
    { state_code: '26', state_name: 'Dadra & Nagar Haveli and Daman & Diu', is_active: 1 },
    { state_code: '27', state_name: 'Maharashtra', is_active: 1 },
    { state_code: '29', state_name: 'Karnataka', is_active: 1 },
    { state_code: '30', state_name: 'Goa', is_active: 1 },
    { state_code: '31', state_name: 'Lakshadweep', is_active: 1 },
    { state_code: '32', state_name: 'Kerala', is_active: 1 },
    { state_code: '33', state_name: 'Tamil Nadu', is_active: 1 },
    { state_code: '34', state_name: 'Puducherry', is_active: 1 },
    { state_code: '35', state_name: 'Andaman & Nicobar Islands', is_active: 1 },
    { state_code: '36', state_name: 'Telangana', is_active: 1 },
    { state_code: '37', state_name: 'Andhra Pradesh', is_active: 1 },
    { state_code: '38', state_name: 'Ladakh', is_active: 1 },
    { state_code: '97', state_name: 'Other Territory', is_active: 1 }
];
// 2. GST Tax Rates Master
exports.DEFAULT_TAX_RATES = [
    { id: 'tax-0', rate_pct: 0, description: 'Exempt / Nil Rated (0%)', is_active: 1, effective_from: '2017-07-01' },
    { id: 'tax-5', rate_pct: 5, description: 'Concessional Goods / Essential (5%)', is_active: 1, effective_from: '2017-07-01' },
    { id: 'tax-12', rate_pct: 12, description: 'Standard Lower Slab (12%)', is_active: 1, effective_from: '2017-07-01' },
    { id: 'tax-18', rate_pct: 18, description: 'Standard Services & Digital Tokens (18%)', is_active: 1, effective_from: '2017-07-01' },
    { id: 'tax-28', rate_pct: 28, description: 'Luxury / Peak Goods (28%)', is_active: 1, effective_from: '2017-07-01' }
];
// 3. HSN (Goods) and SAC (Services) Classification Master
exports.DEFAULT_HSN_SAC = [
    { id: 'hs-8471', code: '8471', type: 'GOODS', description: 'USB Cryptographic Hardware Token / Smart Card Readers', default_tax_rate: 18, is_active: 1 },
    { id: 'hs-8523', code: '8523', type: 'GOODS', description: 'Recorded Media, Storage & Smart Cards', default_tax_rate: 18, is_active: 1 },
    { id: 'sac-998313', code: '998313', type: 'SERVICE', description: 'Information Technology & Digital Signature Certificate Issuance Services', default_tax_rate: 18, is_active: 1 },
    { id: 'sac-998314', code: '998314', type: 'SERVICE', description: 'IT Infrastructure & Digital Trust Security Advisory Services', default_tax_rate: 18, is_active: 1 },
    { id: 'sac-998222', code: '998222', type: 'SERVICE', description: 'Accounting, Auditing & Statutory Tax Compliance Services', default_tax_rate: 18, is_active: 1 },
    { id: 'sac-996812', code: '996812', type: 'SERVICE', description: 'Courier, Express Cargo & Logistics Freight Services', default_tax_rate: 18, is_active: 1 }
];
// 4. Invoice Types Master
exports.DEFAULT_INVOICE_TYPES = [
    { id: 'it-tax', type_code: 'TAX_INVOICE', name: 'Tax Invoice (GST B2B / B2C)', generates_ledger: 1, is_active: 1 },
    { id: 'it-proforma', type_code: 'PROFORMA', name: 'Proforma Quotation / Estimate', generates_ledger: 0, is_active: 1 },
    { id: 'it-credit', type_code: 'CREDIT_NOTE', name: 'Credit Note (Financial & GST Adjustment)', generates_ledger: 1, is_active: 1 },
    { id: 'it-debit', type_code: 'DEBIT_NOTE', name: 'Debit Note (Supplementary Commercial Charge)', generates_ledger: 1, is_active: 1 }
];
// 5. Invoice Lifecycle Statuses Master
exports.DEFAULT_INVOICE_STATUSES = [
    { id: 'is-draft', status_code: 'DRAFT', display_name: 'Draft (Editable)', color: 'slate', is_active: 1 },
    { id: 'is-issued', status_code: 'ISSUED', display_name: 'Issued & Unpaid', color: 'amber', is_active: 1 },
    { id: 'is-partially-paid', status_code: 'PARTIALLY_PAID', display_name: 'Partially Paid', color: 'blue', is_active: 1 },
    { id: 'is-paid', status_code: 'PAID', display_name: 'Fully Paid & Reconciled', color: 'emerald', is_active: 1 },
    { id: 'is-overdue', status_code: 'OVERDUE', display_name: 'Overdue Past SLA', color: 'rose', is_active: 1 },
    { id: 'is-cancelled', status_code: 'CANCELLED', display_name: 'Cancelled (Immutable Audit)', color: 'red', is_active: 1 }
];
// 6. Payment Modes Master
exports.DEFAULT_PAYMENT_MODES = [
    { id: 'pm-upi', mode_code: 'UPI', display_name: 'Unified Payments Interface (UPI / QR)', requires_ref: 1, is_active: 1 },
    { id: 'pm-neft', mode_code: 'NEFT', display_name: 'National Electronic Funds Transfer (NEFT)', requires_ref: 1, is_active: 1 },
    { id: 'pm-rtgs', mode_code: 'RTGS', display_name: 'Real Time Gross Settlement (RTGS)', requires_ref: 1, is_active: 1 },
    { id: 'pm-imps', mode_code: 'IMPS', display_name: 'Immediate Payment Service (IMPS)', requires_ref: 1, is_active: 1 },
    { id: 'pm-bank', mode_code: 'BANK_TRANSFER', display_name: 'Direct Bank Transfer / Net Banking', requires_ref: 1, is_active: 1 },
    { id: 'pm-cheque', mode_code: 'CHEQUE', display_name: 'Commercial Bank Cheque / Demand Draft', requires_ref: 1, is_active: 1 },
    { id: 'pm-gateway', mode_code: 'PAYMENT_GATEWAY', display_name: 'Online Payment Gateway (PG Webhook)', requires_ref: 1, is_active: 1 },
    { id: 'pm-cash', mode_code: 'CASH', display_name: 'Petty Cash Counter Payment', requires_ref: 0, is_active: 1 }
];
// 7. Credit Note Reasons Master
exports.DEFAULT_CREDIT_NOTE_REASONS = [
    { id: 'cnr-defective', reason_code: 'DEFECTIVE_GOODS', description: 'Defective hardware token returned (RMA)', is_active: 1 },
    { id: 'cnr-overcharge', reason_code: 'PRICE_OVERCHARGE', description: 'Correction in price or rate overcharged', is_active: 1 },
    { id: 'cnr-discount', reason_code: 'POST_SALE_DISCOUNT', description: 'Post-sale volume incentive / distributor discount', is_active: 1 },
    { id: 'cnr-cancellation', reason_code: 'SERVICE_CANCELLED', description: 'DSC verification rejected / service cancelled', is_active: 1 },
    { id: 'cnr-rto', reason_code: 'RTO_NON_DELIVERY', description: 'Consignment returned to origin undelivered', is_active: 1 }
];
// 8. Debit Note Reasons Master
exports.DEFAULT_DEBIT_NOTE_REASONS = [
    { id: 'dnr-supplementary', reason_code: 'SUPPLEMENTARY_CHARGE', description: 'Additional services or extended validity requested', is_active: 1 },
    { id: 'dnr-freight', reason_code: 'EXPRESS_FREIGHT_SURCHARGE', description: 'Emergency / express overnight courier surcharge', is_active: 1 },
    { id: 'dnr-undercharge', reason_code: 'PRICE_UNDERCHARGE', description: 'Correction in invoice undercharge', is_active: 1 }
];
// 9. Cancellation Reasons Master
exports.DEFAULT_CANCELLATION_REASONS = [
    { id: 'can-clerical', reason_code: 'CLERICAL_ERROR', description: 'Clerical data entry or wrong GSTIN entered', is_active: 1 },
    { id: 'can-duplicate', reason_code: 'DUPLICATE_INVOICE', description: 'Duplicate invoice generation', is_active: 1 },
    { id: 'can-order-dropped', reason_code: 'ORDER_DROPPED', description: 'Customer cancelled transaction before payment/dispatch', is_active: 1 }
];
// 10. Partner Commission Rules Master
exports.DEFAULT_COMMISSION_RULES = [
    { id: 'pcr-dsc-retail', partner_type: 'dsc_partner', item_category: 'DSC', commission_pct: 15.0, basis: 'TAXABLE_VALUE', is_active: 1 },
    { id: 'pcr-token-stockist', partner_type: 'token_partner', item_category: 'TOKEN', commission_pct: 10.0, basis: 'TAXABLE_VALUE', is_active: 1 },
    { id: 'pcr-distributor-combo', partner_type: 'master_distributor', item_category: 'ALL', commission_pct: 20.0, basis: 'TAXABLE_VALUE', is_active: 1 },
    { id: 'pcr-associate', partner_type: 'associate_partner', item_category: 'ALL', commission_pct: 12.0, basis: 'TAXABLE_VALUE', is_active: 1 }
];
// 11. Accounts Receivable Ageing Buckets Master
exports.DEFAULT_AGEING_BUCKETS = [
    { id: 'age-0-30', bucket_name: 'Current (0-30 Days)', min_days: 0, max_days: 30, color: 'emerald', is_active: 1 },
    { id: 'age-31-60', bucket_name: 'Mild Delay (31-60 Days)', min_days: 31, max_days: 60, color: 'blue', is_active: 1 },
    { id: 'age-61-90', bucket_name: 'Aging (61-90 Days)', min_days: 61, max_days: 90, color: 'amber', is_active: 1 },
    { id: 'age-90-plus', bucket_name: 'Critical Overdue (90+ Days)', min_days: 91, max_days: 99999, color: 'rose', is_active: 1 }
];
// --- Helper Functions to Fetch or Initialize Master Stores ---
async function saveBillingRelationalStore(storeId, items) {
    const payload = JSON.stringify(items);
    const { error } = await supabase_1.supabase
        .from('company_profile')
        .upsert({
        id: storeId,
        legal_name: `Billing Store ${storeId}`,
        trade_name: `Billing Relational Store`,
        gstin: 'NA',
        pan: 'NA',
        email: 'admin@signsync.io',
        phone: 'NA',
        registered_address: payload,
        state_code: 'NA',
        state_name: 'NA',
        updated_at: new Date().toISOString()
    });
    if (error) {
        console.error(`Error saving billing store ${storeId}:`, error);
        return false;
    }
    return true;
}
async function getOrInitStore(storeKey, defaultData) {
    const existing = await (0, dscMasterStore_1.getRelationalStore)(storeKey);
    if (Array.isArray(existing) && existing.length > 0) {
        return existing;
    }
    // Initialize in central Supabase relational store
    await saveBillingRelationalStore(storeKey, defaultData);
    return defaultData;
}
async function getStatesMaster() {
    return await getOrInitStore('billing_master_states', exports.DEFAULT_STATES_MASTER);
}
async function getTaxRatesMaster() {
    return await getOrInitStore('billing_master_tax_rates', exports.DEFAULT_TAX_RATES);
}
async function getHsnSacMaster() {
    return await getOrInitStore('billing_master_hsn_sac', exports.DEFAULT_HSN_SAC);
}
async function getInvoiceTypesMaster() {
    return await getOrInitStore('billing_master_invoice_types', exports.DEFAULT_INVOICE_TYPES);
}
async function getInvoiceStatusesMaster() {
    return await getOrInitStore('billing_master_invoice_statuses', exports.DEFAULT_INVOICE_STATUSES);
}
async function getPaymentModesMaster() {
    return await getOrInitStore('billing_master_payment_modes', exports.DEFAULT_PAYMENT_MODES);
}
async function getCreditNoteReasonsMaster() {
    return await getOrInitStore('billing_master_credit_reasons', exports.DEFAULT_CREDIT_NOTE_REASONS);
}
async function getDebitNoteReasonsMaster() {
    return await getOrInitStore('billing_master_debit_reasons', exports.DEFAULT_DEBIT_NOTE_REASONS);
}
async function getCancellationReasonsMaster() {
    return await getOrInitStore('billing_master_cancellation_reasons', exports.DEFAULT_CANCELLATION_REASONS);
}
async function getCommissionRulesMaster() {
    return await getOrInitStore('billing_master_commission_rules', exports.DEFAULT_COMMISSION_RULES);
}
async function getAgeingBucketsMaster() {
    return await getOrInitStore('billing_master_ageing_buckets', exports.DEFAULT_AGEING_BUCKETS);
}
// Relational transactional stores for extended billing documents
async function getCreditNotes() {
    return await (0, dscMasterStore_1.getRelationalStore)('billing_rel_credit_notes');
}
async function saveCreditNotes(notes) {
    return await saveBillingRelationalStore('billing_rel_credit_notes', notes);
}
async function getDebitNotes() {
    return await (0, dscMasterStore_1.getRelationalStore)('billing_rel_debit_notes');
}
async function saveDebitNotes(notes) {
    return await saveBillingRelationalStore('billing_rel_debit_notes', notes);
}
async function getPaymentReceipts() {
    return await (0, dscMasterStore_1.getRelationalStore)('billing_rel_payment_receipts');
}
async function savePaymentReceipts(receipts) {
    return await saveBillingRelationalStore('billing_rel_payment_receipts', receipts);
}
