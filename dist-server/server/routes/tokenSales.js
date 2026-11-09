"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenSalesRouter = void 0;
const express_1 = require("express");
const supabase_1 = require("../supabase");
const tokenSalesStore_1 = require("../tokenSalesStore");
exports.tokenSalesRouter = (0, express_1.Router)();
function getAuthOrg(req) {
    const user = req.user;
    if (!user || !user.organization_id) {
        throw new Error('Authentication required. Missing organization boundary.');
    }
    return user.organization_id;
}
function requireAuth(req, res, next) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Please enter your email and password to sign in.' });
    }
    next();
}
// ----------------------------------------------------------------------------
// 1. SALES ESTIMATES
// ----------------------------------------------------------------------------
exports.tokenSalesRouter.get('/token-sales/estimates', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { company_profile_id } = req.query;
        const list = await (0, tokenSalesStore_1.getSalesEstimates)(orgId, company_profile_id ? String(company_profile_id) : undefined);
        return res.json({ estimates: list });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.tokenSalesRouter.post('/token-sales/estimates', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const { company_profile_id, customer_id, estimate_date, valid_until, expected_closure_date, assigned_to, items, notes } = req.body;
        if (!company_profile_id || !customer_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'company_profile_id, customer_id, and items are required.' });
        }
        const [profile, customer] = await Promise.all([
            (0, supabase_1.queryOne)('SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?', [company_profile_id, orgId]),
            (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [customer_id])
        ]);
        if (!profile)
            return res.status(404).json({ error: 'Company Profile not found in your organization.' });
        if (!customer)
            return res.status(404).json({ error: 'Customer not found.' });
        let subtotal = 0;
        let totalTax = 0;
        const processedItems = [];
        for (const item of items) {
            const q = parseInt(item.quantity, 10) || 1;
            const price = parseFloat(item.unit_price) || 0;
            const taxable = Number((q * price).toFixed(2));
            const gstRate = parseFloat(item.gst_rate) || 18;
            const tax = Number(((taxable * gstRate) / 100).toFixed(2));
            const total = Number((taxable + tax).toFixed(2));
            subtotal += taxable;
            totalTax += tax;
            processedItems.push({
                token_model_id: item.token_model_id || 'tm-1',
                model_name: item.model_name || 'Cryptographic USB Token',
                quantity: q,
                unit_price: price,
                taxable_amount: taxable,
                gst_rate: gstRate,
                tax_amount: tax,
                total_amount: total,
                estimated_landed_cost: parseFloat(item.estimated_landed_cost) || 0
            });
        }
        const grandTotal = Number((subtotal + totalTax).toFixed(2));
        const estId = `tse-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const estNumber = `EST-TKN/${Date.now().toString().slice(-6)}`;
        const estimate = {
            id: estId,
            organization_id: orgId,
            company_profile_id,
            customer_id,
            estimate_number: estNumber,
            estimate_date: estimate_date || new Date().toISOString().slice(0, 10),
            valid_until: valid_until || null,
            expected_closure_date: expected_closure_date || valid_until || estimate_date || new Date().toISOString().slice(0, 10),
            assigned_to: assigned_to || null,
            subtotal,
            tax_amount: totalTax,
            grand_total: grandTotal,
            status: 'DRAFT',
            company_profile_snapshot: profile,
            customer_snapshot: customer,
            items: processedItems,
            notes: notes || null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await (0, tokenSalesStore_1.saveSalesEstimate)(estimate);
        // NOTE: Creating an estimate MUST NEVER deduct inventory stock!
        return res.status(201).json({ success: true, estimate });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Update Estimate Status (e.g. DRAFT -> SENT -> APPROVED)
exports.tokenSalesRouter.post('/token-sales/estimates/:id/status', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const id = String(req.params.id);
        const { status } = req.body;
        const estimate = await (0, tokenSalesStore_1.getSalesEstimateById)(orgId, id);
        if (!estimate)
            return res.status(404).json({ error: 'Estimate not found.' });
        const validStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status: ${status}` });
        }
        estimate.status = status;
        estimate.updated_at = new Date().toISOString();
        await (0, tokenSalesStore_1.saveSalesEstimate)(estimate);
        // Approving an estimate MUST NEVER deduct inventory stock!
        return res.json({ success: true, estimate });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Convert Estimate to Sales Invoice
exports.tokenSalesRouter.post('/token-sales/estimates/:id/convert-to-invoice', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const id = String(req.params.id);
        const { series_id } = req.body;
        const estimate = await (0, tokenSalesStore_1.getSalesEstimateById)(orgId, id);
        if (!estimate)
            return res.status(404).json({ error: 'Estimate not found.' });
        if (estimate.status === 'CONVERTED') {
            return res.status(400).json({ error: 'Estimate has already been converted to an invoice.' });
        }
        // Allocate number
        const { invoiceNumber, seriesConfig } = await (0, tokenSalesStore_1.allocateNextSalesInvoiceNumber)(orgId, estimate.company_profile_id, series_id);
        // Calculate taxes & historical landed cost per item
        const profile = estimate.company_profile_snapshot || {};
        const customer = estimate.customer_snapshot || {};
        const isInterstate = Boolean(customer.state_code && profile.state_code &&
            customer.state_code !== profile.state_code);
        let totalSubtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalTax = 0;
        let totalLandedCost = 0;
        let totalProfit = 0;
        const processedInvoiceItems = [];
        for (const it of estimate.items) {
            // Fetch latest profile stock landed cost for this item
            const stock = await (0, supabase_1.queryOne)('SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?', [orgId, estimate.company_profile_id, it.token_model_id]);
            const historicalLandedCost = parseFloat(stock === null || stock === void 0 ? void 0 : stock.landed_cost) || parseFloat(stock === null || stock === void 0 ? void 0 : stock.last_purchase_rate) || it.estimated_landed_cost || 0;
            const totalItemLanded = Number((it.quantity * historicalLandedCost).toFixed(2));
            let cgst = 0, sgst = 0, igst = 0;
            if (isInterstate) {
                igst = Number(((it.taxable_amount * it.gst_rate) / 100).toFixed(2));
            }
            else {
                cgst = Number(((it.taxable_amount * (it.gst_rate / 2)) / 100).toFixed(2));
                sgst = Number(((it.taxable_amount * (it.gst_rate / 2)) / 100).toFixed(2));
            }
            const itemTax = isInterstate ? igst : Number((cgst + sgst).toFixed(2));
            const profit = Number((it.taxable_amount - totalItemLanded).toFixed(2));
            totalSubtotal += it.taxable_amount;
            totalCgst += cgst;
            totalSgst += sgst;
            totalIgst += igst;
            totalTax += itemTax;
            totalLandedCost += totalItemLanded;
            totalProfit += profit;
            processedInvoiceItems.push({
                token_model_id: it.token_model_id,
                model_name: it.model_name,
                quantity: it.quantity,
                unit_price: it.unit_price,
                taxable_amount: it.taxable_amount,
                gst_rate: it.gst_rate,
                cgst_amount: cgst,
                sgst_amount: sgst,
                igst_amount: igst,
                total_tax: itemTax,
                line_total: Number((it.taxable_amount + itemTax).toFixed(2)),
                historical_landed_cost: historicalLandedCost,
                total_landed_cost: totalItemLanded,
                gross_profit: profit
            });
        }
        const grandTotal = Number((totalSubtotal + totalTax).toFixed(2));
        const invoiceId = `tsi-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nowIso = new Date().toISOString();
        // Determine credit period and snapshot due date
        const creditCfg = await (0, tokenSalesStore_1.getPartyCreditConfig)(orgId, estimate.customer_id);
        const custCreditDays = creditCfg ? creditCfg.credit_period_days : Number(customer.credit_period_days || 0);
        const invDateStr = nowIso.slice(0, 10);
        const invDueDate = new Date(new Date(invDateStr).getTime() + (custCreditDays * 86400000)).toISOString().slice(0, 10);
        const invoice = {
            id: invoiceId,
            organization_id: orgId,
            company_profile_id: estimate.company_profile_id,
            customer_id: estimate.customer_id,
            estimate_id: estimate.id,
            series_id: seriesConfig.id,
            invoice_number: invoiceNumber,
            invoice_date: invDateStr,
            due_date: invDueDate,
            credit_period_days: custCreditDays,
            subtotal: totalSubtotal,
            cgst_amount: totalCgst,
            sgst_amount: totalSgst,
            igst_amount: totalIgst,
            total_tax: totalTax,
            grand_total: grandTotal,
            paid_amount: 0,
            outstanding_balance: grandTotal,
            status: 'DRAFT', // Remains DRAFT until confirmed/posted
            company_profile_snapshot: profile,
            customer_snapshot: customer,
            items: processedInvoiceItems,
            total_landed_cost: Number(totalLandedCost.toFixed(2)),
            total_profit: Number(totalProfit.toFixed(2)),
            created_by: user.id,
            created_at: nowIso,
            updated_at: nowIso
        };
        await (0, tokenSalesStore_1.saveSalesInvoice)(invoice);
        // Mark estimate as CONVERTED
        estimate.status = 'CONVERTED';
        estimate.converted_sales_invoice_id = invoiceId;
        estimate.updated_at = nowIso;
        await (0, tokenSalesStore_1.saveSalesEstimate)(estimate);
        return res.status(201).json({ success: true, invoice, converted_estimate_id: estimate.id });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 2. SALES INVOICES & STOCK DEDUCTION
// ----------------------------------------------------------------------------
exports.tokenSalesRouter.get('/token-sales/invoices', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { company_profile_id, status } = req.query;
        let list = await (0, tokenSalesStore_1.getSalesInvoices)(orgId, company_profile_id ? String(company_profile_id) : undefined);
        if (status) {
            list = list.filter(i => i.status === status);
        }
        return res.json({ invoices: list });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.tokenSalesRouter.get('/token-sales/invoices/:id', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const id = String(req.params.id);
        const invoice = await (0, tokenSalesStore_1.getSalesInvoiceById)(orgId, id);
        if (!invoice)
            return res.status(404).json({ error: 'Invoice not found.' });
        return res.json({ invoice });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Direct Sales Invoice Creation
exports.tokenSalesRouter.post('/token-sales/invoices', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const { company_profile_id, customer_id, series_id, invoice_date, due_date, items, is_post_immediately = false } = req.body;
        if (!company_profile_id || !customer_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'company_profile_id, customer_id, and items are required.' });
        }
        const [profile, customer] = await Promise.all([
            (0, supabase_1.queryOne)('SELECT * FROM purchase_internal_profiles WHERE id = ? AND organization_id = ?', [company_profile_id, orgId]),
            (0, supabase_1.queryOne)('SELECT * FROM partners WHERE id = ?', [customer_id])
        ]);
        if (!profile)
            return res.status(404).json({ error: 'Company Profile not found.' });
        if (!customer)
            return res.status(404).json({ error: 'Customer not found.' });
        const { invoiceNumber, seriesConfig } = await (0, tokenSalesStore_1.allocateNextSalesInvoiceNumber)(orgId, company_profile_id, series_id);
        const isInterstate = Boolean(customer.state_code && profile.state_code &&
            customer.state_code !== profile.state_code);
        let totalSubtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalTax = 0;
        let totalLandedCost = 0;
        let totalProfit = 0;
        const processedItems = [];
        for (const it of items) {
            const q = parseInt(it.quantity, 10) || 1;
            const price = parseFloat(it.unit_price) || 0;
            const taxable = Number((q * price).toFixed(2));
            const gstRate = parseFloat(it.gst_rate) || 18;
            // Fetch profile stock landed cost
            const stock = await (0, supabase_1.queryOne)('SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?', [orgId, company_profile_id, it.token_model_id]);
            const historicalLandedCost = parseFloat(stock === null || stock === void 0 ? void 0 : stock.landed_cost) || parseFloat(stock === null || stock === void 0 ? void 0 : stock.last_purchase_rate) || 0;
            const totalItemLanded = Number((q * historicalLandedCost).toFixed(2));
            let cgst = 0, sgst = 0, igst = 0;
            if (isInterstate) {
                igst = Number(((taxable * gstRate) / 100).toFixed(2));
            }
            else {
                cgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
                sgst = Number(((taxable * (gstRate / 2)) / 100).toFixed(2));
            }
            const itemTax = isInterstate ? igst : Number((cgst + sgst).toFixed(2));
            const profit = Number((taxable - totalItemLanded).toFixed(2));
            totalSubtotal += taxable;
            totalCgst += cgst;
            totalSgst += sgst;
            totalIgst += igst;
            totalTax += itemTax;
            totalLandedCost += totalItemLanded;
            totalProfit += profit;
            processedItems.push({
                token_model_id: it.token_model_id || 'tm-1',
                model_name: it.model_name || 'Cryptographic USB Token',
                quantity: q,
                unit_price: price,
                taxable_amount: taxable,
                gst_rate: gstRate,
                cgst_amount: cgst,
                sgst_amount: sgst,
                igst_amount: igst,
                total_tax: itemTax,
                line_total: Number((taxable + itemTax).toFixed(2)),
                historical_landed_cost: historicalLandedCost,
                total_landed_cost: totalItemLanded,
                gross_profit: profit
            });
        }
        const grandTotal = Number((totalSubtotal + totalTax).toFixed(2));
        const invoiceId = `tsi-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nowIso = new Date().toISOString();
        const initialStatus = is_post_immediately ? 'POSTED' : 'DRAFT';
        // Determine credit period and snapshot due date
        const creditCfg = await (0, tokenSalesStore_1.getPartyCreditConfig)(orgId, customer_id);
        const custCreditDays = creditCfg ? creditCfg.credit_period_days : Number(customer.credit_period_days || 0);
        const invDate = invoice_date || nowIso.slice(0, 10);
        const calculatedDueDate = due_date || new Date(new Date(invDate).getTime() + (custCreditDays * 86400000)).toISOString().slice(0, 10);
        const invoice = {
            id: invoiceId,
            organization_id: orgId,
            company_profile_id,
            customer_id,
            series_id: seriesConfig.id,
            invoice_number: invoiceNumber,
            invoice_date: invDate,
            due_date: calculatedDueDate,
            credit_period_days: custCreditDays,
            subtotal: totalSubtotal,
            cgst_amount: totalCgst,
            sgst_amount: totalSgst,
            igst_amount: totalIgst,
            total_tax: totalTax,
            grand_total: grandTotal,
            paid_amount: 0,
            outstanding_balance: grandTotal,
            status: initialStatus,
            company_profile_snapshot: profile,
            customer_snapshot: customer,
            items: processedItems,
            total_landed_cost: Number(totalLandedCost.toFixed(2)),
            total_profit: Number(totalProfit.toFixed(2)),
            posted_by: is_post_immediately ? user.id : null,
            posted_at: is_post_immediately ? nowIso : null,
            created_by: user.id,
            created_at: nowIso,
            updated_at: nowIso
        };
        // IF POSTED IMMEDIATELY -> DEDUCT STOCK ATOMICALLY
        if (is_post_immediately) {
            for (const it of processedItems) {
                const stock = await (0, supabase_1.queryOne)('SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?', [orgId, company_profile_id, it.token_model_id]);
                if (stock) {
                    const newQty = Math.max(0, Number(stock.quantity_on_hand || 0) - it.quantity);
                    const newIssued = Number(stock.issued_quantity || 0) + it.quantity;
                    await supabase_1.supabase.from('token_profile_stocks').update({
                        quantity_on_hand: newQty,
                        issued_quantity: newIssued,
                        last_updated_at: nowIso
                    }).eq('id', stock.id);
                }
            }
        }
        await (0, tokenSalesStore_1.saveSalesInvoice)(invoice);
        return res.status(201).json({ success: true, invoice });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST / CONFIRM SALES INVOICE (TRANSITION DRAFT -> POSTED & DEDUCT INVENTORY)
exports.tokenSalesRouter.post('/token-sales/invoices/:id/post', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const id = String(req.params.id);
        const invoice = await (0, tokenSalesStore_1.getSalesInvoiceById)(orgId, id);
        if (!invoice)
            return res.status(404).json({ error: 'Sales Invoice not found.' });
        if (invoice.status === 'POSTED') {
            return res.status(400).json({ error: 'Invoice has already been posted.' });
        }
        if (invoice.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Cancelled invoices cannot be posted.' });
        }
        const nowIso = new Date().toISOString();
        // Deduct stock from profile inventory
        for (const it of invoice.items) {
            const stock = await (0, supabase_1.queryOne)('SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?', [orgId, invoice.company_profile_id, it.token_model_id]);
            if (stock) {
                const newQty = Math.max(0, Number(stock.quantity_on_hand || 0) - it.quantity);
                const newIssued = Number(stock.issued_quantity || 0) + it.quantity;
                await supabase_1.supabase.from('token_profile_stocks').update({
                    quantity_on_hand: newQty,
                    issued_quantity: newIssued,
                    last_updated_at: nowIso
                }).eq('id', stock.id);
            }
        }
        invoice.status = 'POSTED';
        invoice.posted_by = user.id;
        invoice.posted_at = nowIso;
        invoice.updated_at = nowIso;
        await (0, tokenSalesStore_1.saveSalesInvoice)(invoice);
        return res.json({ success: true, message: `Invoice ${invoice.invoice_number} successfully posted. Inventory deducted.`, invoice });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// CANCEL SALES INVOICE WITH CONFIGURABLE NUMBER REUSE
exports.tokenSalesRouter.post('/token-sales/invoices/:id/cancel', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const id = String(req.params.id);
        const { cancellation_reason } = req.body;
        const invoice = await (0, tokenSalesStore_1.getSalesInvoiceById)(orgId, id);
        if (!invoice)
            return res.status(404).json({ error: 'Invoice not found.' });
        if (invoice.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Invoice is already cancelled.' });
        }
        const nowIso = new Date().toISOString();
        const prevStatus = invoice.status;
        // If invoice was POSTED, restore inventory stock
        if (prevStatus === 'POSTED' || prevStatus === 'PARTIALLY_PAID') {
            for (const it of invoice.items) {
                const stock = await (0, supabase_1.queryOne)('SELECT * FROM token_profile_stocks WHERE organization_id = ? AND company_profile_id = ? AND token_model_id = ?', [orgId, invoice.company_profile_id, it.token_model_id]);
                if (stock) {
                    const restoredQty = Number(stock.quantity_on_hand || 0) + it.quantity;
                    const restoredIssued = Math.max(0, Number(stock.issued_quantity || 0) - it.quantity);
                    await supabase_1.supabase.from('token_profile_stocks').update({
                        quantity_on_hand: restoredQty,
                        issued_quantity: restoredIssued,
                        last_updated_at: nowIso
                    }).eq('id', stock.id);
                }
            }
        }
        // Number reuse evaluation
        const { numberReused } = await (0, tokenSalesStore_1.handleSalesInvoiceCancellationNumbering)(orgId, invoice.company_profile_id, invoice.series_id, invoice.invoice_number);
        invoice.status = 'CANCELLED';
        invoice.cancelled_by = user.id;
        invoice.cancelled_at = nowIso;
        invoice.cancellation_reason = cancellation_reason || 'Administrative cancellation';
        invoice.is_number_reused = numberReused;
        invoice.outstanding_balance = 0;
        invoice.updated_at = nowIso;
        await (0, tokenSalesStore_1.saveSalesInvoice)(invoice);
        return res.json({
            success: true,
            message: `Invoice ${invoice.invoice_number} cancelled. Number reused: ${numberReused}.`,
            invoice
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 3. CUSTOMER PAYMENTS & EXCESS/SHORTAGE
// ----------------------------------------------------------------------------
exports.tokenSalesRouter.get('/token-sales/payments', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { invoice_id } = req.query;
        const list = await (0, tokenSalesStore_1.getSalesPayments)(orgId, invoice_id ? String(invoice_id) : undefined);
        return res.json({ payments: list });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.tokenSalesRouter.post('/token-sales/payments', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const user = req.user;
        const { invoice_id, payment_date, amount, payment_mode, transaction_reference_utr, proof_url, notes } = req.body;
        const payAmount = Number(amount);
        if (!invoice_id || isNaN(payAmount) || payAmount <= 0) {
            return res.status(400).json({ error: 'invoice_id and positive payment amount are required.' });
        }
        const invoice = await (0, tokenSalesStore_1.getSalesInvoiceById)(orgId, invoice_id);
        if (!invoice)
            return res.status(404).json({ error: 'Invoice not found.' });
        if (invoice.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Cannot record payment for cancelled invoice.' });
        }
        // UTR Duplicate Check
        if (transaction_reference_utr && transaction_reference_utr.trim()) {
            const existingPayments = await (0, tokenSalesStore_1.getSalesPayments)(orgId);
            const dup = existingPayments.find(p => { var _a; return ((_a = p.transaction_reference_utr) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) === transaction_reference_utr.trim().toLowerCase(); });
            if (dup) {
                return res.status(409).json({ error: `Payment with UTR / Reference '${transaction_reference_utr}' has already been recorded.` });
            }
        }
        const currentOutstanding = Number(invoice.outstanding_balance || 0);
        let shortage = 0;
        let excess = 0;
        if (payAmount < currentOutstanding) {
            shortage = Number((currentOutstanding - payAmount).toFixed(2));
        }
        else if (payAmount > currentOutstanding) {
            excess = Number((payAmount - currentOutstanding).toFixed(2));
        }
        const newPaid = Number((Number(invoice.paid_amount || 0) + payAmount).toFixed(2));
        const newOutstanding = Math.max(0, Number((currentOutstanding - payAmount).toFixed(2)));
        const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';
        const paymentId = `tsp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const receiptNum = `RCP-TKN/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`;
        const nowIso = new Date().toISOString();
        const payment = {
            id: paymentId,
            organization_id: orgId,
            company_profile_id: invoice.company_profile_id,
            invoice_id: invoice.id,
            customer_id: invoice.customer_id,
            payment_number: `PAY-${Date.now().toString().slice(-6)}`,
            payment_date: payment_date || nowIso.slice(0, 10),
            amount: payAmount,
            payment_mode: payment_mode || 'NEFT',
            transaction_reference_utr: (transaction_reference_utr === null || transaction_reference_utr === void 0 ? void 0 : transaction_reference_utr.trim()) || null,
            proof_url: proof_url || null,
            notes: notes || null,
            shortage_amount: shortage,
            excess_amount: excess,
            receipt_number: receiptNum,
            created_by: user.id,
            created_at: nowIso
        };
        await (0, tokenSalesStore_1.saveSalesPayment)(payment);
        // Update invoice balance
        invoice.paid_amount = newPaid;
        invoice.outstanding_balance = newOutstanding;
        invoice.status = newStatus;
        invoice.updated_at = nowIso;
        await (0, tokenSalesStore_1.saveSalesInvoice)(invoice);
        return res.status(201).json({
            success: true,
            payment,
            invoice_balance: {
                total: invoice.grand_total,
                paid: newPaid,
                outstanding: newOutstanding,
                status: newStatus,
                shortage,
                excess
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 4. SERIES NUMBERING CONFIGURATIONS
// ----------------------------------------------------------------------------
exports.tokenSalesRouter.get('/token-sales/series-configs', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { company_profile_id } = req.query;
        const list = await (0, tokenSalesStore_1.getSeriesConfigs)(orgId, company_profile_id ? String(company_profile_id) : undefined);
        return res.json({ configs: list });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.tokenSalesRouter.post('/token-sales/series-configs', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { company_profile_id, series_name, prefix, suffix = '', current_counter = 1000, allow_reuse_on_cancellation = false } = req.body;
        if (!company_profile_id || !series_name || !prefix) {
            return res.status(400).json({ error: 'company_profile_id, series_name, and prefix are required.' });
        }
        const cfgId = `series-${company_profile_id}-${Date.now()}`;
        const config = {
            id: cfgId,
            organization_id: orgId,
            company_profile_id,
            series_name: series_name.trim(),
            prefix: prefix.trim(),
            suffix: suffix.trim(),
            current_counter: parseInt(current_counter, 10) || 1000,
            allow_reuse_on_cancellation: Boolean(allow_reuse_on_cancellation),
            is_active: true
        };
        await (0, tokenSalesStore_1.saveSeriesConfig)(config);
        return res.status(201).json({ success: true, config });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ----------------------------------------------------------------------------
// 5. CUSTOMER & VENDOR ANALYTICS WITH INDIAN FY (APRIL 1 - MARCH 31)
// ----------------------------------------------------------------------------
function getFinancialYearDates(fyString) {
    // If FY given like '2026-27' or '2026-2027'
    if (fyString && fyString.includes('-')) {
        const startYear = parseInt(fyString.split('-')[0], 10);
        return {
            startDate: `${startYear}-04-01`,
            endDate: `${startYear + 1}-03-31`
        };
    }
    // Current Indian FY
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const startYear = month >= 4 ? year : year - 1;
    return {
        startDate: `${startYear}-04-01`,
        endDate: `${startYear + 1}-03-31`
    };
}
// Customer Purchase History & Profit Margin Analytics (Uses Actual Historical Landed Cost)
exports.tokenSalesRouter.get('/token-sales/analytics/customer-history', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { customer_id, financial_year } = req.query;
        const { startDate, endDate } = getFinancialYearDates(financial_year ? String(financial_year) : undefined);
        const allInvoices = await (0, tokenSalesStore_1.getSalesInvoices)(orgId);
        const filtered = allInvoices.filter(inv => {
            const matchCust = !customer_id || inv.customer_id === customer_id;
            const matchDate = inv.invoice_date >= startDate && inv.invoice_date <= endDate;
            const notCancelled = inv.status !== 'CANCELLED';
            return matchCust && matchDate && notCancelled;
        });
        let totalRevenue = 0;
        let totalTaxable = 0;
        let totalLanded = 0;
        let totalGrossProfit = 0;
        let totalTokensSold = 0;
        const purchases = filtered.map(inv => {
            var _a;
            totalRevenue += inv.grand_total;
            totalTaxable += inv.subtotal;
            totalLanded += (inv.total_landed_cost || 0);
            totalGrossProfit += (inv.total_profit || 0);
            const tokenQty = inv.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
            totalTokensSold += tokenQty;
            return {
                invoice_id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                customer_name: ((_a = inv.customer_snapshot) === null || _a === void 0 ? void 0 : _a.company_name) || 'Customer',
                total_amount: inv.grand_total,
                taxable_value: inv.subtotal,
                tokens_count: tokenQty,
                landed_cost: inv.total_landed_cost || 0,
                gross_profit: inv.total_profit || 0,
                profit_margin_pct: inv.subtotal > 0 ? Number(((inv.total_profit / inv.subtotal) * 100).toFixed(2)) : 0,
                status: inv.status
            };
        });
        const overallMarginPct = totalTaxable > 0 ? Number(((totalGrossProfit / totalTaxable) * 100).toFixed(2)) : 0;
        return res.json({
            financial_year: financial_year || `${startDate.slice(0, 4)}-${endDate.slice(2, 4)}`,
            date_range: { startDate, endDate },
            summary: {
                total_invoices: filtered.length,
                total_tokens_sold: totalTokensSold,
                total_taxable_revenue: Number(totalTaxable.toFixed(2)),
                total_revenue_with_gst: Number(totalRevenue.toFixed(2)),
                total_actual_landed_cost: Number(totalLanded.toFixed(2)),
                total_gross_profit: Number(totalGrossProfit.toFixed(2)),
                overall_gross_profit_margin_pct: overallMarginPct
            },
            purchases
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Vendor Purchase & Rate History Analytics
exports.tokenSalesRouter.get('/token-sales/analytics/vendor-history', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { vendor_party_id, financial_year } = req.query;
        const { startDate, endDate } = getFinancialYearDates(financial_year ? String(financial_year) : undefined);
        let sql = `
      SELECT pb.*,
             p.party_name as vendor_name,
             prof.legal_name as company_name
      FROM token_purchase_bills pb
      JOIN token_purchase_parties p ON pb.vendor_party_id = p.id
      JOIN purchase_internal_profiles prof ON pb.company_profile_id = prof.id
      WHERE pb.organization_id = ?
        AND pb.status = 'POSTED'
        AND pb.accounting_date >= ?
        AND pb.accounting_date <= ?
    `;
        const params = [orgId, startDate, endDate];
        if (vendor_party_id) {
            sql += ' AND pb.vendor_party_id = ?';
            params.push(String(vendor_party_id));
        }
        sql += ' ORDER BY pb.accounting_date DESC';
        const bills = await (0, supabase_1.queryAll)(sql, params);
        const billIds = bills.map((b) => b.id);
        let allItems = [];
        if (billIds.length > 0) {
            allItems = await (0, supabase_1.queryAll)('SELECT * FROM token_purchase_bill_items WHERE organization_id = ? ORDER BY created_at ASC', [orgId]);
        }
        const itemsByBill = {};
        allItems.forEach((it) => {
            if (!itemsByBill[it.purchase_bill_id])
                itemsByBill[it.purchase_bill_id] = [];
            itemsByBill[it.purchase_bill_id].push(it);
        });
        let totalProcuredQty = 0;
        let totalSpend = 0;
        let totalFreight = 0;
        const history = bills.map((b) => {
            const items = itemsByBill[b.id] || [];
            const bQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
            const bFreight = parseFloat(b.freight_amount) || 0;
            totalProcuredQty += bQty;
            totalSpend += parseFloat(b.grand_total) || 0;
            totalFreight += bFreight;
            return {
                bill_id: b.id,
                voucher_number: b.voucher_number,
                accounting_date: b.accounting_date,
                vendor_name: b.vendor_name,
                company_name: b.company_name,
                total_quantity: bQty,
                subtotal: b.subtotal,
                freight_amount: bFreight,
                grand_total: b.grand_total,
                items: items.map((it) => ({
                    model_name: it.description,
                    quantity: it.quantity,
                    unit_rate: it.unit_rate,
                    freight_allocation: it.freight_allocation || 0,
                    landed_cost: it.landed_cost || it.unit_rate
                }))
            };
        });
        return res.json({
            financial_year: financial_year || `${startDate.slice(0, 4)}-${endDate.slice(2, 4)}`,
            date_range: { startDate, endDate },
            summary: {
                total_bills: bills.length,
                total_procured_quantity: totalProcuredQty,
                total_procurement_spend: Number(totalSpend.toFixed(2)),
                total_freight_paid: Number(totalFreight.toFixed(2)),
                average_effective_landed_rate: totalProcuredQty > 0 ? Number((totalSpend / totalProcuredQty).toFixed(2)) : 0
            },
            history
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Multi-Vendor Comparison Engine (Recommends Lowest Landed Cost, not just Base Price)
exports.tokenSalesRouter.get('/token-sales/analytics/vendor-comparison', requireAuth, async (req, res) => {
    try {
        const orgId = getAuthOrg(req);
        const { token_model_id, quantity = '100', destination_state = 'DL' } = req.query;
        const qty = parseInt(String(quantity), 10) || 100;
        // Retrieve active vendor quotes and active vendors
        const quotes = await (0, supabase_1.queryAll)("SELECT q.*, p.party_name, p.state_id as vendor_state FROM token_vendor_quotes q JOIN token_purchase_parties p ON q.party_id = p.id WHERE q.organization_id = ? AND q.status = 'ACTIVE'", [orgId]);
        const quoteIds = quotes.map((q) => q.id);
        let slabs = [];
        if (quoteIds.length > 0) {
            slabs = await (0, supabase_1.queryAll)('SELECT * FROM token_vendor_quote_slabs WHERE organization_id = ? ORDER BY min_quantity ASC', [orgId]);
        }
        // Historical average freight estimation per unit
        const recentBills = await (0, supabase_1.queryAll)("SELECT freight_amount, subtotal FROM token_purchase_bills WHERE organization_id = ? AND status = 'POSTED' ORDER BY accounting_date DESC LIMIT 10", [orgId]);
        let avgFreightPerUnit = 5.00; // Default nominal ₹5/token freight
        if (recentBills.length > 0) {
            const totFreight = recentBills.reduce((s, b) => s + (parseFloat(b.freight_amount) || 0), 0);
            if (totFreight > 0) {
                avgFreightPerUnit = Number((totFreight / (recentBills.length * 100)).toFixed(2));
            }
        }
        const comparisons = [];
        for (const q of quotes) {
            // Find matching slab for requested quantity
            const qSlabs = slabs.filter((s) => s.quote_id === q.id);
            const matchedSlab = qSlabs.find((s) => {
                const min = Number(s.min_quantity);
                const max = s.max_quantity ? Number(s.max_quantity) : Infinity;
                return qty >= min && qty <= max;
            }) || qSlabs[0];
            if (matchedSlab) {
                const baseRate = parseFloat(matchedSlab.unit_rate) || 0;
                const isInterstate = q.vendor_state && q.vendor_state !== destination_state;
                // Inter-state freight modifier (+15% higher shipping)
                const estimatedFreight = isInterstate ? Number((avgFreightPerUnit * 1.25).toFixed(2)) : avgFreightPerUnit;
                const landedUnitRate = Number((baseRate + estimatedFreight).toFixed(2));
                const totalLandedCost = Number((qty * landedUnitRate).toFixed(2));
                const baseTotal = Number((qty * baseRate).toFixed(2));
                comparisons.push({
                    vendor_id: q.party_id,
                    vendor_name: q.party_name,
                    quote_number: q.quote_number,
                    vendor_state: q.vendor_state || 'N/A',
                    is_interstate: isInterstate,
                    quantity: qty,
                    base_unit_rate: baseRate,
                    base_total: baseTotal,
                    estimated_freight_per_unit: estimatedFreight,
                    total_estimated_freight: Number((qty * estimatedFreight).toFixed(2)),
                    landed_unit_cost: landedUnitRate,
                    total_landed_cost: totalLandedCost
                });
            }
        }
        // Sort by TOTAL LANDED COST (lowest first)
        comparisons.sort((a, b) => a.landed_unit_cost - b.landed_unit_cost);
        const recommended = comparisons.length > 0 ? Object.assign(Object.assign({}, comparisons[0]), { recommendation_reason: `Recommended lowest landed cost (₹${comparisons[0].landed_unit_cost}/unit factoring estimated freight), saving ₹${comparisons.length > 1 ? (comparisons[comparisons.length - 1].landed_unit_cost - comparisons[0].landed_unit_cost).toFixed(2) : '0'}/unit compared to alternatives.` }) : null;
        return res.json({
            evaluated_quantity: qty,
            destination_state,
            vendors_compared: comparisons.length,
            recommended_vendor: recommended,
            all_options: comparisons
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
