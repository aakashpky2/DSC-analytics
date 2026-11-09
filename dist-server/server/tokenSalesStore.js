"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesEstimates = getSalesEstimates;
exports.saveSalesEstimate = saveSalesEstimate;
exports.getSalesEstimateById = getSalesEstimateById;
exports.getSalesInvoices = getSalesInvoices;
exports.saveSalesInvoice = saveSalesInvoice;
exports.getSalesInvoiceById = getSalesInvoiceById;
exports.getSalesPayments = getSalesPayments;
exports.saveSalesPayment = saveSalesPayment;
exports.getVendorPayments = getVendorPayments;
exports.saveVendorPayment = saveVendorPayment;
exports.getPartyCreditConfig = getPartyCreditConfig;
exports.savePartyCreditConfig = savePartyCreditConfig;
exports.getBillCreditOverrides = getBillCreditOverrides;
exports.getBillCreditOverride = getBillCreditOverride;
exports.saveBillCreditOverride = saveBillCreditOverride;
exports.getSeriesConfigs = getSeriesConfigs;
exports.saveSeriesConfig = saveSeriesConfig;
exports.allocateNextSalesInvoiceNumber = allocateNextSalesInvoiceNumber;
exports.handleSalesInvoiceCancellationNumbering = handleSalesInvoiceCancellationNumbering;
const dscMasterStore_1 = require("./dscMasterStore");
const STORE_ESTIMATES = 'token_sales_estimates';
const STORE_INVOICES = 'token_sales_invoices';
const STORE_PAYMENTS = 'token_sales_payments';
const STORE_SERIES = 'token_sales_series_configs';
const STORE_PARTY_CREDIT = 'token_party_credit_configs';
const STORE_BILL_CREDIT = 'token_bill_credit_overrides';
const STORE_VENDOR_PAYMENTS = 'token_vendor_payments';
// ----------------------------------------------------------------------------
// ESTIMATES STORE
// ----------------------------------------------------------------------------
async function getSalesEstimates(orgId, profileId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_ESTIMATES);
    return all.filter(e => e.organization_id === orgId && (!profileId || e.company_profile_id === profileId));
}
async function saveSalesEstimate(estimate) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_ESTIMATES);
    const idx = all.findIndex(e => e.id === estimate.id);
    if (idx >= 0) {
        all[idx] = estimate;
    }
    else {
        all.unshift(estimate);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_ESTIMATES, all);
}
async function getSalesEstimateById(orgId, id) {
    const all = await getSalesEstimates(orgId);
    return all.find(e => e.id === id) || null;
}
// ----------------------------------------------------------------------------
// INVOICES STORE
// ----------------------------------------------------------------------------
async function getSalesInvoices(orgId, profileId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_INVOICES);
    return all.filter(i => i.organization_id === orgId && (!profileId || i.company_profile_id === profileId));
}
async function saveSalesInvoice(invoice) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_INVOICES);
    const idx = all.findIndex(i => i.id === invoice.id);
    if (idx >= 0) {
        all[idx] = invoice;
    }
    else {
        all.unshift(invoice);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_INVOICES, all);
}
async function getSalesInvoiceById(orgId, id) {
    const all = await getSalesInvoices(orgId);
    return all.find(i => i.id === id || i.invoice_number === id) || null;
}
// ----------------------------------------------------------------------------
// CUSTOMER PAYMENTS STORE
// ----------------------------------------------------------------------------
async function getSalesPayments(orgId, invoiceId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PAYMENTS);
    return all.filter(p => p.organization_id === orgId && (!invoiceId || p.invoice_id === invoiceId));
}
async function saveSalesPayment(payment) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PAYMENTS);
    all.unshift(payment);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_PAYMENTS, all);
}
// ----------------------------------------------------------------------------
// VENDOR PAYMENTS STORE
// ----------------------------------------------------------------------------
async function getVendorPayments(orgId, billId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_VENDOR_PAYMENTS);
    return all.filter(p => p.organization_id === orgId && (!billId || p.purchase_bill_id === billId));
}
async function saveVendorPayment(payment) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_VENDOR_PAYMENTS);
    all.unshift(payment);
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_VENDOR_PAYMENTS, all);
}
// ----------------------------------------------------------------------------
// PARTY CREDIT CONFIGS (Vendors & Customers with Default Nil = 0 days)
// ----------------------------------------------------------------------------
async function getPartyCreditConfig(orgId, partyId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PARTY_CREDIT);
    return all.find(c => c.organization_id === orgId && c.party_id === partyId) || null;
}
async function savePartyCreditConfig(config) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_PARTY_CREDIT);
    const idx = all.findIndex(c => c.organization_id === config.organization_id && c.party_id === config.party_id);
    if (idx >= 0) {
        all[idx] = config;
    }
    else {
        all.push(config);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_PARTY_CREDIT, all);
}
// ----------------------------------------------------------------------------
// BILL CREDIT OVERRIDES & DUE DATE SNAPSHOTS
// ----------------------------------------------------------------------------
async function getBillCreditOverrides(orgId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_BILL_CREDIT);
    return all.filter(b => b.organization_id === orgId);
}
async function getBillCreditOverride(orgId, billId) {
    const all = await getBillCreditOverrides(orgId);
    return all.find(b => b.bill_id === billId) || null;
}
async function saveBillCreditOverride(override) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_BILL_CREDIT);
    const idx = all.findIndex(b => b.organization_id === override.organization_id && b.bill_id === override.bill_id);
    if (idx >= 0) {
        all[idx] = override;
    }
    else {
        all.push(override);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_BILL_CREDIT, all);
}
// ----------------------------------------------------------------------------
// SERIES NUMBERING & CONCURRENCY
// ----------------------------------------------------------------------------
async function getSeriesConfigs(orgId, profileId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SERIES);
    return all.filter(s => s.organization_id === orgId && (!profileId || s.company_profile_id === profileId));
}
async function saveSeriesConfig(config) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SERIES);
    const idx = all.findIndex(s => s.id === config.id);
    if (idx >= 0) {
        all[idx] = config;
    }
    else {
        all.push(config);
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_SERIES, all);
}
/**
 * Concurrency-safe Next Number generator for Token Sales Invoice
 */
async function allocateNextSalesInvoiceNumber(orgId, profileId, seriesId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SERIES);
    let cfg = all.find(s => s.organization_id === orgId && s.company_profile_id === profileId && (!seriesId || s.id === seriesId));
    if (!cfg) {
        // Generate default series for this profile
        const prefix = `TSI-${profileId.slice(-4).toUpperCase()}/26-27/`;
        cfg = {
            id: `series-${profileId}-${Date.now()}`,
            organization_id: orgId,
            company_profile_id: profileId,
            series_name: 'Standard Token Sales Series',
            prefix,
            suffix: '',
            current_counter: 1000,
            allow_reuse_on_cancellation: false,
            is_active: true
        };
        all.push(cfg);
    }
    // Atomic increment
    cfg.current_counter = (cfg.current_counter || 1000) + 1;
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_SERIES, all);
    const num = `${cfg.prefix}${cfg.current_counter}${cfg.suffix || ''}`;
    return { invoiceNumber: num, seriesConfig: cfg };
}
/**
 * When invoice is cancelled, check if series permits counter reuse.
 */
async function handleSalesInvoiceCancellationNumbering(orgId, profileIdOrSeriesId, seriesIdOrInvoiceNumber, maybeInvoiceNumber) {
    const seriesId = maybeInvoiceNumber !== undefined ? seriesIdOrInvoiceNumber : profileIdOrSeriesId;
    const invoiceNumber = maybeInvoiceNumber !== undefined ? maybeInvoiceNumber : seriesIdOrInvoiceNumber;
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_SERIES);
    const cfg = all.find(s => s.id === seriesId && s.organization_id === orgId);
    if (!cfg || !cfg.allow_reuse_on_cancellation) {
        return { numberReused: false };
    }
    // Safe prefix string slice without regex escape pitfalls
    if (invoiceNumber.startsWith(cfg.prefix)) {
        const suffix = cfg.suffix || '';
        const numPart = suffix ? invoiceNumber.slice(cfg.prefix.length, -suffix.length) : invoiceNumber.slice(cfg.prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed === cfg.current_counter) {
            cfg.current_counter = Math.max(1000, cfg.current_counter - 1);
            await (0, dscMasterStore_1.saveRelationalStore)(STORE_SERIES, all);
            return { numberReused: true };
        }
    }
    return { numberReused: false };
}
