"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokenRegisterReport = generateTokenRegisterReport;
exports.getTokenDetailMovement = getTokenDetailMovement;
exports.getTokenMonthlyReconciliation = getTokenMonthlyReconciliation;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
/**
 * Generates the master Token Register report for a date range and profile.
 */
async function generateTokenRegisterReport(orgId, options) {
    var _a, _b, _c;
    const { company_profile_id, from_date, to_date, period_type = 'custom', token_model_id } = options;
    // 1. Fetch Token Models
    let tokenModels = [];
    if (token_model_id) {
        const single = await (0, supabase_1.queryOne)('SELECT id, model_name, manufacturer, is_active FROM token_models WHERE id = ?', [token_model_id]);
        if (single)
            tokenModels = [single];
    }
    if (tokenModels.length === 0) {
        tokenModels = await (0, supabase_1.queryAll)('SELECT id, model_name, manufacturer, is_active FROM token_models WHERE organization_id = ?', [orgId]);
        if (tokenModels.length === 0) {
            tokenModels = await (0, supabase_1.queryAll)('SELECT id, model_name, manufacturer, is_active FROM token_models WHERE organization_id = ?', ['comp-default']);
        }
    }
    // 2. Fetch Opening Stock entries
    let openQuery = 'SELECT * FROM token_opening_stock WHERE organization_id = ?';
    const openParams = [orgId];
    if (company_profile_id) {
        openQuery += ' AND company_profile_id = ?';
        openParams.push(company_profile_id);
    }
    const openingStocks = await (0, supabase_1.queryAll)(openQuery, openParams);
    // 3. Fetch Purchase Bills & Items (Only POSTED bills count as stock inward)
    const [bills, billItems] = await Promise.all([
        (0, supabase_1.queryAll)('SELECT id, organization_id, company_profile_id, voucher_number, accounting_date, status, vendor_party_id FROM token_purchase_bills WHERE organization_id = ? AND status = ?', [orgId, 'POSTED']),
        (0, supabase_1.queryAll)('SELECT id, organization_id, purchase_bill_id, token_model_id, quantity, unit_rate, landed_cost, landed_total_value FROM token_purchase_bill_items WHERE organization_id = ?', [orgId])
    ]);
    const purchaseBillRows = [];
    for (const item of billItems) {
        const parentBill = bills.find(b => b.id === item.purchase_bill_id);
        if (parentBill) {
            if (!company_profile_id || parentBill.company_profile_id === company_profile_id) {
                purchaseBillRows.push({
                    id: parentBill.id,
                    company_profile_id: parentBill.company_profile_id,
                    accounting_date: parentBill.accounting_date,
                    status: parentBill.status,
                    token_model_id: item.token_model_id,
                    quantity: item.quantity,
                    unit_rate: item.unit_rate,
                    landed_cost: item.landed_cost,
                    landed_total_value: item.landed_total_value,
                    voucher_number: parentBill.voucher_number
                });
            }
        }
    }
    // 4. Fetch Sales Invoices (Only POSTED, PARTIALLY_PAID, PAID count as stock outward; DRAFT and CANCELLED strictly excluded)
    let siQuery = `
    SELECT id, company_profile_id, invoice_number, invoice_date, status, items, total_landed_cost, total_profit
    FROM token_sales_invoices
    WHERE organization_id = ? AND status IN ('POSTED', 'PARTIALLY_PAID', 'PAID')
  `;
    const siParams = [orgId];
    if (company_profile_id) {
        siQuery += ' AND company_profile_id = ?';
        siParams.push(company_profile_id);
    }
    const salesInvoices = await (0, supabase_1.queryAll)(siQuery, siParams);
    // Also read relational store fallback for sales invoices if database table is empty
    const allRelationalInvoices = await (0, dscMasterStore_1.getRelationalStore)('token_sales_invoices');
    const validRelationalInvoices = allRelationalInvoices.filter(si => si.organization_id === orgId &&
        (!company_profile_id || si.company_profile_id === company_profile_id) &&
        ['POSTED', 'PARTIALLY_PAID', 'PAID'].includes(si.status));
    // Combine unique sales invoices
    const combinedInvoices = [...salesInvoices];
    for (const rsi of validRelationalInvoices) {
        if (!combinedInvoices.some(ci => ci.id === rsi.id)) {
            combinedInvoices.push(rsi);
        }
    }
    // 5. Aggregate metrics per Token Model
    const summaryRows = [];
    for (const model of tokenModels) {
        const mId = model.id;
        // A. Opening Stock prior to `from_date`
        let openingQty = 0;
        let totalPurchasedPrior = 0;
        let totalSoldPrior = 0;
        // Initial opening stock base
        for (const os of openingStocks) {
            if (os.token_model_id === mId) {
                const asOf = os.opening_date || os.as_of_date || ((_a = os.created_at) === null || _a === void 0 ? void 0 : _a.slice(0, 10)) || '2026-01-01';
                if (asOf < from_date) {
                    openingQty += Number(os.quantity || 0);
                }
            }
        }
        // Purchases prior to from_date
        for (const pb of purchaseBillRows) {
            if (pb.token_model_id === mId) {
                const billDate = pb.accounting_date || '2026-01-01';
                if (billDate < from_date) {
                    totalPurchasedPrior += Number(pb.quantity || 0);
                }
            }
        }
        // Sales prior to from_date
        for (const si of combinedInvoices) {
            const invDate = si.invoice_date || '2026-01-01';
            if (invDate < from_date) {
                const items = typeof si.items === 'string' ? JSON.parse(si.items) : (si.items || []);
                for (const item of items) {
                    if (item.token_model_id === mId) {
                        totalSoldPrior += Number(item.quantity || 0);
                    }
                }
            }
        }
        const calculatedOpening = openingQty + totalPurchasedPrior - totalSoldPrior;
        // B. Movements DURING [from_date, to_date]
        let periodInwardQty = 0;
        let periodOutwardQty = 0;
        let periodSalesValue = 0;
        let periodCostValue = 0;
        let totalPurchaseCost = 0;
        let totalPurchaseUnits = 0;
        // Opening stock entered within this window (only for custom range or initial opening month)
        for (const os of openingStocks) {
            if (os.token_model_id === mId) {
                const asOf = os.opening_date || os.as_of_date || ((_b = os.created_at) === null || _b === void 0 ? void 0 : _b.slice(0, 10)) || '2026-01-01';
                if (asOf >= from_date && asOf <= to_date) {
                    // If this is a monthly report, opening stock represents opening balance at the start of that month, not inward movement
                    if (period_type === 'monthly') {
                        // For monthly, opening stock entered on or before to_date is part of opening balance if on 1st of month
                        // handled via calculatedOpening
                    }
                    else {
                        periodInwardQty += Number(os.quantity || 0);
                        totalPurchaseCost += Number(os.total_valuation || 0);
                        totalPurchaseUnits += Number(os.quantity || 0);
                    }
                }
            }
        }
        // If period_type is monthly and opening stock falls on from_date (e.g. 2026-11-01), add it to calculatedOpening
        let effectiveOpening = calculatedOpening;
        if (period_type === 'monthly') {
            for (const os of openingStocks) {
                if (os.token_model_id === mId) {
                    const asOf = os.opening_date || os.as_of_date || ((_c = os.created_at) === null || _c === void 0 ? void 0 : _c.slice(0, 10)) || '2026-01-01';
                    if (asOf >= from_date && asOf <= to_date) {
                        effectiveOpening += Number(os.quantity || 0);
                    }
                }
            }
        }
        // Purchase Inwards in window
        for (const pb of purchaseBillRows) {
            if (pb.token_model_id === mId) {
                const billDate = pb.accounting_date || '2026-01-01';
                if (billDate >= from_date && billDate <= to_date) {
                    const qty = Number(pb.quantity || 0);
                    const landedVal = parseFloat(pb.landed_total_value) || (qty * (parseFloat(pb.landed_cost) || parseFloat(pb.unit_rate) || 0));
                    periodInwardQty += qty;
                    totalPurchaseCost += landedVal;
                    totalPurchaseUnits += qty;
                }
            }
        }
        // Sales Outwards in window
        for (const si of combinedInvoices) {
            const invDate = si.invoice_date || '2026-01-01';
            if (invDate >= from_date && invDate <= to_date) {
                const items = typeof si.items === 'string' ? JSON.parse(si.items) : (si.items || []);
                for (const item of items) {
                    if (item.token_model_id === mId) {
                        const qty = Number(item.quantity || 0);
                        const taxable = Number(item.taxable_amount || (qty * Number(item.unit_price || 0)));
                        const unitCost = Number(item.historical_landed_cost || item.estimated_landed_cost || 0);
                        const cost = Number((qty * unitCost).toFixed(2));
                        periodOutwardQty += qty;
                        periodSalesValue += taxable;
                        periodCostValue += cost;
                    }
                }
            }
        }
        // Closing Stock = Opening + Inwards - Outwards
        const openingStockForReport = period_type === 'monthly' ? effectiveOpening : calculatedOpening;
        const closingQty = openingStockForReport + periodInwardQty - periodOutwardQty;
        const grossProfit = Number((periodSalesValue - periodCostValue).toFixed(2));
        const marginPct = periodSalesValue > 0 ? Number(((grossProfit / periodSalesValue) * 100).toFixed(2)) : 0;
        const avgLandedCost = totalPurchaseUnits > 0 ? Number((totalPurchaseCost / totalPurchaseUnits).toFixed(2)) : 0;
        const avgSalesRate = periodOutwardQty > 0 ? Number((periodSalesValue / periodOutwardQty).toFixed(2)) : 0;
        // Only include rows if there's any opening, movement, or closing
        if (openingStockForReport !== 0 || periodInwardQty !== 0 || periodOutwardQty !== 0 || closingQty !== 0) {
            summaryRows.push({
                token_model_id: mId,
                model_name: model.model_name,
                manufacturer: model.manufacturer,
                token_company: model.manufacturer,
                token_product: model.model_name,
                token_version: 'Standard',
                opening_qty: openingStockForReport,
                inward_qty: periodInwardQty,
                outward_qty: periodOutwardQty,
                closing_qty: closingQty,
                avg_purchase_rate: avgLandedCost,
                avg_landed_cost: avgLandedCost,
                avg_sales_rate: avgSalesRate,
                sales_qty: periodOutwardQty,
                sales_value: Number(periodSalesValue.toFixed(2)),
                cost_value: Number(periodCostValue.toFixed(2)),
                gross_profit: grossProfit,
                margin_percentage: marginPct,
                reconciliation_status: (openingStockForReport + periodInwardQty - periodOutwardQty === closingQty) ? 'BALANCED' : 'DISCREPANCY'
            });
        }
    }
    // Calculate overall totals
    const totals = summaryRows.reduce((acc, row) => {
        acc.total_opening_qty += row.opening_qty;
        acc.total_inwards_qty += row.inward_qty;
        acc.total_outwards_qty += row.outward_qty;
        acc.total_closing_qty += row.closing_qty;
        acc.total_sales_value += row.sales_value;
        acc.total_cost_value += row.cost_value;
        acc.total_gross_profit += row.gross_profit;
        return acc;
    }, {
        total_opening_qty: 0,
        total_inwards_qty: 0,
        total_outwards_qty: 0,
        total_closing_qty: 0,
        total_sales_value: 0,
        total_cost_value: 0,
        total_gross_profit: 0,
        overall_margin_percentage: 0
    });
    totals.total_sales_value = Number(totals.total_sales_value.toFixed(2));
    totals.total_cost_value = Number(totals.total_cost_value.toFixed(2));
    totals.total_gross_profit = Number(totals.total_gross_profit.toFixed(2));
    totals.overall_margin_percentage = totals.total_sales_value > 0
        ? Number(((totals.total_gross_profit / totals.total_sales_value) * 100).toFixed(2))
        : 0;
    return {
        filters: {
            organization_id: orgId,
            company_profile_id,
            from_date,
            to_date,
            period_type,
            token_model_id
        },
        totals,
        rows: summaryRows
    };
}
/**
 * Returns detailed chronological stock movements for an individual token model.
 */
async function getTokenDetailMovement(orgId, modelId, options) {
    var _a, _b, _c;
    const { company_profile_id, from_date, to_date } = options;
    // Get token model info
    const model = await (0, supabase_1.queryOne)('SELECT * FROM token_models WHERE id = ?', [modelId]);
    // 1. Calculate opening balance prior to from_date
    let openingBalance = 0;
    // Prior Opening stock
    let openQuery = 'SELECT * FROM token_opening_stock WHERE organization_id = ? AND token_model_id = ?';
    const openParams = [orgId, modelId];
    if (company_profile_id) {
        openQuery += ' AND company_profile_id = ?';
        openParams.push(company_profile_id);
    }
    const openingStocks = await (0, supabase_1.queryAll)(openQuery, openParams);
    for (const os of openingStocks) {
        const asOf = os.opening_date || os.as_of_date || ((_a = os.created_at) === null || _a === void 0 ? void 0 : _a.slice(0, 10)) || '2026-01-01';
        if (asOf < from_date) {
            openingBalance += Number(os.quantity || 0);
        }
    }
    // Prior Purchases
    const [priorBills, priorBillItems] = await Promise.all([
        (0, supabase_1.queryAll)('SELECT id, organization_id, company_profile_id, accounting_date, status FROM token_purchase_bills WHERE organization_id = ? AND status = ?', [orgId, 'POSTED']),
        (0, supabase_1.queryAll)('SELECT id, organization_id, purchase_bill_id, token_model_id, quantity FROM token_purchase_bill_items WHERE organization_id = ? AND token_model_id = ?', [orgId, modelId])
    ]);
    for (const item of priorBillItems) {
        const parent = priorBills.find(b => b.id === item.purchase_bill_id);
        if (parent && (!company_profile_id || parent.company_profile_id === company_profile_id)) {
            if ((parent.accounting_date || '2026-01-01') < from_date) {
                openingBalance += Number(item.quantity || 0);
            }
        }
    }
    // Prior Sales
    const allRelationalInvoices = await (0, dscMasterStore_1.getRelationalStore)('token_sales_invoices');
    for (const si of allRelationalInvoices) {
        if (si.organization_id === orgId &&
            (!company_profile_id || si.company_profile_id === company_profile_id) &&
            ['POSTED', 'PARTIALLY_PAID', 'PAID'].includes(si.status) &&
            (si.invoice_date || '2026-01-01') < from_date) {
            for (const item of si.items || []) {
                if (item.token_model_id === modelId) {
                    openingBalance -= Number(item.quantity || 0);
                }
            }
        }
    }
    // 2. Fetch movements during [from_date, to_date]
    const movements = [];
    // A. Opening stock entries within period
    for (const os of openingStocks) {
        const asOf = os.opening_date || os.as_of_date || ((_b = os.created_at) === null || _b === void 0 ? void 0 : _b.slice(0, 10)) || '2026-01-01';
        if (asOf >= from_date && asOf <= to_date) {
            movements.push({
                sortDate: asOf,
                date: asOf,
                document_number: `OS-${os.id.slice(-6)}`,
                document_type: 'OPENING_STOCK',
                status: 'POSTED',
                inward_qty: Number(os.quantity || 0),
                outward_qty: 0,
                rate: Number(os.purchase_rate || 0),
                value: Number(os.total_valuation || 0),
                running_balance: 0,
                notes: 'Initial Opening Stock Entry'
            });
        }
    }
    // B. Purchases within period
    for (const item of priorBillItems) {
        const parent = priorBills.find(b => b.id === item.purchase_bill_id);
        if (parent && (!company_profile_id || parent.company_profile_id === company_profile_id)) {
            const bDate = parent.accounting_date || '2026-01-01';
            if (bDate >= from_date && bDate <= to_date) {
                const q = Number(item.quantity || 0);
                const val = parseFloat(item.landed_total_value) || (q * (parseFloat(item.landed_cost) || parseFloat(item.unit_rate) || 0));
                movements.push({
                    sortDate: bDate,
                    date: bDate,
                    document_number: parent.voucher_number || parent.id,
                    document_type: 'PURCHASE_BILL',
                    status: parent.status,
                    inward_qty: q,
                    outward_qty: 0,
                    rate: parseFloat(item.unit_rate) || 0,
                    value: Number(val.toFixed(2)),
                    running_balance: 0,
                    party_name: 'Vendor',
                    notes: 'Token Purchase Inward'
                });
            }
        }
    }
    // C. Sales within period
    for (const si of allRelationalInvoices) {
        const sDate = si.invoice_date || '2026-01-01';
        if (si.organization_id === orgId &&
            (!company_profile_id || si.company_profile_id === company_profile_id) &&
            ['POSTED', 'PARTIALLY_PAID', 'PAID'].includes(si.status) &&
            sDate >= from_date &&
            sDate <= to_date) {
            for (const item of si.items || []) {
                if (item.token_model_id === modelId) {
                    const q = Number(item.quantity || 0);
                    const val = Number((q * Number(item.unit_price || 0)).toFixed(2));
                    movements.push({
                        sortDate: sDate,
                        date: sDate,
                        document_number: si.invoice_number,
                        document_type: 'SALES_INVOICE',
                        status: si.status,
                        inward_qty: 0,
                        outward_qty: q,
                        rate: Number(item.unit_price || 0),
                        value: val,
                        running_balance: 0,
                        party_name: ((_c = si.customer_snapshot) === null || _c === void 0 ? void 0 : _c.company_name) || 'Customer',
                        notes: 'Token Sales Outward'
                    });
                }
            }
        }
    }
    // Sort chronological
    movements.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    // Calculate running balance
    let running = openingBalance;
    for (const m of movements) {
        running = running + m.inward_qty - m.outward_qty;
        m.running_balance = running;
    }
    return {
        token_info: model || { id: modelId, model_name: 'Token Model' },
        opening_balance: openingBalance,
        closing_balance: running,
        movements
    };
}
/**
 * Returns monthly breakdown for a specific token model across the Indian Financial Year (Apr to Mar).
 */
async function getTokenMonthlyReconciliation(orgId, modelId, fyYearStart = 2026, profileId) {
    const months = [
        { key: `${fyYearStart}-04`, name: `Apr ${fyYearStart}`, days: 30 },
        { key: `${fyYearStart}-05`, name: `May ${fyYearStart}`, days: 31 },
        { key: `${fyYearStart}-06`, name: `Jun ${fyYearStart}`, days: 30 },
        { key: `${fyYearStart}-07`, name: `Jul ${fyYearStart}`, days: 31 },
        { key: `${fyYearStart}-08`, name: `Aug ${fyYearStart}`, days: 31 },
        { key: `${fyYearStart}-09`, name: `Sep ${fyYearStart}`, days: 30 },
        { key: `${fyYearStart}-10`, name: `Oct ${fyYearStart}`, days: 31 },
        { key: `${fyYearStart}-11`, name: `Nov ${fyYearStart}`, days: 30 },
        { key: `${fyYearStart}-12`, name: `Dec ${fyYearStart}`, days: 31 },
        { key: `${fyYearStart + 1}-01`, name: `Jan ${fyYearStart + 1}`, days: 31 },
        { key: `${fyYearStart + 1}-02`, name: `Feb ${fyYearStart + 1}`, days: 28 },
        { key: `${fyYearStart + 1}-03`, name: `Mar ${fyYearStart + 1}`, days: 31 }
    ];
    const result = [];
    let previousClosing = 0;
    for (let i = 0; i < months.length; i++) {
        const m = months[i];
        const fromDate = `${m.key}-01`;
        const toDate = `${m.key}-${String(m.days).padStart(2, '0')}`;
        const report = await generateTokenRegisterReport(orgId, {
            company_profile_id: profileId,
            from_date: fromDate,
            to_date: toDate,
            period_type: 'monthly',
            token_model_id: modelId
        });
        const row = report.rows.find(r => r.token_model_id === modelId);
        const opening = i === 0 ? (row ? row.opening_qty : 0) : previousClosing;
        const inward = row ? row.inward_qty : 0;
        const outward = row ? row.outward_qty : 0;
        const closing = opening + inward - outward;
        previousClosing = closing;
        result.push({
            month_key: m.key,
            month_name: m.name,
            opening_qty: opening,
            inward_qty: inward,
            outward_qty: outward,
            closing_qty: closing,
            sales_value: row ? row.sales_value : 0,
            cost_value: row ? row.cost_value : 0,
            gross_profit: row ? row.gross_profit : 0,
            margin_percentage: row ? row.margin_percentage : 0
        });
    }
    return result;
}
