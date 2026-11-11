"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSalesPrice = resolveSalesPrice;
exports.evaluateCustomerLevel = evaluateCustomerLevel;
const tokenPricingStore_1 = require("./tokenPricingStore");
const tokenSalesStore_1 = require("./tokenSalesStore");
const supabase_1 = require("./supabase");
/**
 * Resolves the unit selling rate following strict statutory and business rules:
 * Step 1: Check manual override (if provided and authorized).
 * Step 2: Determine customer's active pricing categories on the transaction date.
 * Step 3: Sort categories by priority (highest first) and identify applicable category rates.
 * Step 4: Follow resolution chain: Customer-Specific Rate -> Applicable Category Rate -> General Rate.
 * Step 5: Evaluate quantity slabs if the resolved rate is slab-based.
 * Step 6: Verify effective date bounds.
 * Step 7: Block with descriptive error if no active rate exists.
 */
async function resolveSalesPrice(context) {
    const { organization_id, company_profile_id, customer_id, token_model_id, quantity, override_rate, override_reason } = context;
    const date = context.date || new Date().toISOString().slice(0, 10);
    if (quantity <= 0) {
        throw new Error('Quantity must be greater than zero to resolve sales rate.');
    }
    // 1. Fetch customer details (from partners table)
    let customerName = customer_id;
    try {
        const { data: part } = await supabase_1.supabase.from('partners').select('id, company_name, contact_person').eq('id', customer_id).single();
        if (part) {
            customerName = part.company_name || part.contact_person || customer_id;
        }
    }
    catch (_) { }
    // 2. Fetch customer level (for reporting and audit explanation)
    const levelAssignments = await (0, tokenPricingStore_1.getCustomerLevelAssignments)(organization_id, customer_id);
    let activeLevel = null;
    let customerLevelName = null;
    if (levelAssignments.length > 0) {
        activeLevel = levelAssignments[0];
        const allLevels = await (0, tokenPricingStore_1.getCustomerLevels)(organization_id);
        const lvl = allLevels.find(l => l.id === (activeLevel === null || activeLevel === void 0 ? void 0 : activeLevel.current_level_id));
        customerLevelName = (lvl === null || lvl === void 0 ? void 0 : lvl.level_name) || activeLevel.current_level_id;
    }
    // 3. Manual override check
    if (override_rate !== undefined && override_rate !== null && override_rate > 0) {
        const taxableValue = Number((override_rate * quantity).toFixed(2));
        return {
            token_model_id,
            customer_id,
            customer_name: customerName,
            quantity,
            date,
            profile_id: company_profile_id,
            unit_rate: override_rate,
            taxable_value: taxableValue,
            source: 'CUSTOMER_SPECIFIC',
            customer_level_id: (activeLevel === null || activeLevel === void 0 ? void 0 : activeLevel.current_level_id) || null,
            customer_level_name: customerLevelName,
            rate_type: 'FIXED',
            applicable_slab: null,
            effective_rate_id: 'MANUAL_OVERRIDE',
            is_override: true,
            override_reason: override_reason || 'Manual pricing override applied',
            explanation: `Manual override applied: ₹${override_rate}/token by user. Reason: ${override_reason || 'None specified'}.`
        };
    }
    // 4. Fetch all active candidate sales rates for this token and organization
    const allRates = await (0, tokenPricingStore_1.getSalesRates)(organization_id, {
        tokenModelId: token_model_id,
        profileId: company_profile_id,
        activeOnly: true
    });
    // Filter rates by effective date
    const dateValidRates = allRates.filter(r => {
        if (r.effective_from && r.effective_from > date)
            return false;
        if (r.effective_to && r.effective_to < date)
            return false;
        return true;
    });
    // 5. Step A: Check customer-specific rate override
    const customerSpecificRate = dateValidRates
        .filter(r => r.customer_id === customer_id)
        .sort((a, b) => b.priority - a.priority)[0];
    if (customerSpecificRate) {
        const { unitRate, slab, slabDesc } = evaluateRateValue(customerSpecificRate, quantity);
        const taxableValue = Number((unitRate * quantity).toFixed(2));
        return {
            token_model_id,
            model_name: customerSpecificRate.model_name,
            customer_id,
            customer_name: customerName,
            quantity,
            date,
            profile_id: company_profile_id,
            unit_rate: unitRate,
            taxable_value: taxableValue,
            source: 'CUSTOMER_SPECIFIC',
            customer_level_id: (activeLevel === null || activeLevel === void 0 ? void 0 : activeLevel.current_level_id) || null,
            customer_level_name: customerLevelName,
            rate_type: customerSpecificRate.rate_type,
            applicable_slab: slab,
            effective_rate_id: customerSpecificRate.id,
            is_override: false,
            explanation: `Customer-specific rate resolved (${customerSpecificRate.rate_type}${slabDesc ? `, ${slabDesc}` : ''}): ₹${unitRate}/token.`
        };
    }
    // 6. Step B: Fetch customer's active category memberships
    const assignments = await (0, tokenPricingStore_1.getCustomerCategoryAssignments)(organization_id, customer_id);
    const activeAssignments = assignments.filter(a => {
        if (!a.is_active)
            return false;
        if (a.assignment_type === 'DATE_BASED') {
            if (a.effective_from && a.effective_from > date)
                return false;
            if (a.effective_to && a.effective_to < date)
                return false;
        }
        return true;
    });
    const allCategories = await (0, tokenPricingStore_1.getPricingCategories)(organization_id, company_profile_id);
    const activeCategories = [];
    for (const assign of activeAssignments) {
        const cat = allCategories.find(c => c.id === assign.customer_category_id && c.is_active);
        if (cat) {
            if (cat.effective_from && cat.effective_from > date)
                continue;
            if (cat.effective_to && cat.effective_to < date)
                continue;
            activeCategories.push({ category: cat, assignment: assign });
        }
    }
    // Check for ambiguous equal priority categories
    if (activeCategories.length > 1) {
        const priorities = activeCategories.map(c => c.category.priority);
        const maxPriority = Math.max(...priorities);
        const topCategories = activeCategories.filter(c => c.category.priority === maxPriority);
        if (topCategories.length > 1) {
            // Find if both have conflicting rates for this token
            const conflictingRates = dateValidRates.filter(r => topCategories.some(tc => tc.category.id === r.customer_category_id));
            const distinctCategoryRates = new Set(conflictingRates.map(r => r.customer_category_id));
            if (distinctCategoryRates.size > 1) {
                throw new Error(`Multiple pricing categories (${topCategories.map(c => c.category.category_name).join(', ')}) have the same priority (${maxPriority}). Please configure category priorities to resolve pricing ambiguity.`);
            }
        }
    }
    // Sort active categories by priority descending
    activeCategories.sort((a, b) => b.category.priority - a.category.priority);
    // Try each applicable category in priority order
    for (const { category } of activeCategories) {
        // Find rate for this category
        const catRate = dateValidRates
            .filter(r => r.customer_category_id === category.id)
            .sort((a, b) => b.priority - a.priority)[0];
        if (catRate) {
            const { unitRate, slab, slabDesc } = evaluateRateValue(catRate, quantity);
            const taxableValue = Number((unitRate * quantity).toFixed(2));
            return {
                token_model_id,
                model_name: catRate.model_name,
                customer_id,
                customer_name: customerName,
                quantity,
                date,
                profile_id: company_profile_id,
                unit_rate: unitRate,
                taxable_value: taxableValue,
                source: 'CATEGORY_RATE',
                matched_category_id: category.id,
                matched_category_name: category.category_name,
                matched_category_priority: category.priority,
                customer_level_id: (activeLevel === null || activeLevel === void 0 ? void 0 : activeLevel.current_level_id) || null,
                customer_level_name: customerLevelName,
                rate_type: catRate.rate_type,
                applicable_slab: slab,
                effective_rate_id: catRate.id,
                is_override: false,
                explanation: `Category rate resolved from "${category.category_name}" (Priority ${category.priority}, ${catRate.rate_type}${slabDesc ? `, ${slabDesc}` : ''}): ₹${unitRate}/token.`
            };
        }
    }
    // 7. Step C: Fallback to General Rate (customer_category_id is null / undefined)
    const generalRate = dateValidRates
        .filter(r => !r.customer_category_id && !r.customer_id)
        .sort((a, b) => b.priority - a.priority)[0];
    if (generalRate) {
        const { unitRate, slab, slabDesc } = evaluateRateValue(generalRate, quantity);
        const taxableValue = Number((unitRate * quantity).toFixed(2));
        return {
            token_model_id,
            model_name: generalRate.model_name,
            customer_id,
            customer_name: customerName,
            quantity,
            date,
            profile_id: company_profile_id,
            unit_rate: unitRate,
            taxable_value: taxableValue,
            source: 'GENERAL_RATE',
            customer_level_id: (activeLevel === null || activeLevel === void 0 ? void 0 : activeLevel.current_level_id) || null,
            customer_level_name: customerLevelName,
            rate_type: generalRate.rate_type,
            applicable_slab: slab,
            effective_rate_id: generalRate.id,
            is_override: false,
            explanation: `General default selling rate applied (${generalRate.rate_type}${slabDesc ? `, ${slabDesc}` : ''}): ₹${unitRate}/token.`
        };
    }
    // If no rate exists at all, strictly block
    throw new Error('No active sales rate configured for this token.');
}
/**
 * Helper to calculate the unit rate based on FIXED or SLAB
 */
function evaluateRateValue(rate, quantity) {
    if (rate.rate_type === 'FIXED') {
        return { unitRate: rate.rate, slab: null };
    }
    if (rate.rate_type === 'SLAB') {
        const slabs = rate.quantity_slabs || [];
        if (slabs.length === 0) {
            return { unitRate: rate.rate, slab: null };
        }
        // Sort slabs
        const sorted = [...slabs].sort((a, b) => a.min_quantity - b.min_quantity);
        for (const slab of sorted) {
            const min = slab.min_quantity;
            const max = slab.max_quantity !== undefined && slab.max_quantity !== null ? slab.max_quantity : Infinity;
            if (quantity >= min && quantity <= max) {
                const slabDesc = max === Infinity ? `Quantity > ${min}` : `Quantity slab ${min}–${max}`;
                return {
                    unitRate: slab.unit_rate,
                    slab,
                    slabDesc
                };
            }
        }
        // If quantity is below the lowest slab or doesn't match, return base rate or lowest slab
        return { unitRate: rate.rate, slab: null, slabDesc: 'No slab matched, default rate' };
    }
    return { unitRate: rate.rate, slab: null };
}
/**
 * Evaluates customer level based on actual POSTED Sales Invoices volume.
 * Strictly ignores Estimates, Drafts, and Cancelled invoices.
 * Respects Manual Overrides unless expired.
 */
async function evaluateCustomerLevel(orgId, customerId, evaluationDate) {
    const evalDate = evaluationDate || new Date().toISOString().slice(0, 10);
    const existingAssignments = await (0, tokenPricingStore_1.getCustomerLevelAssignments)(orgId, customerId);
    const current = existingAssignments[0];
    // Check if active manual override exists
    if (current && current.assignment_type === 'MANUAL_OVERRIDE') {
        if (!current.effective_to || current.effective_to >= evalDate) {
            const levels = await (0, tokenPricingStore_1.getCustomerLevels)(orgId);
            const lvl = levels.find(l => l.id === current.current_level_id);
            return {
                customer_id: customerId,
                previous_level_id: current.previous_level_id,
                new_level_id: current.current_level_id,
                new_level_name: (lvl === null || lvl === void 0 ? void 0 : lvl.level_name) || current.current_level_id,
                qualification_volume: current.qualification_volume || 0,
                rule_matched_id: null,
                calculated_period: current.calculated_period || 'MANUAL_OVERRIDE',
                assignment_type: 'MANUAL_OVERRIDE',
                calculated_at: new Date().toISOString()
            };
        }
    }
    // Fetch all POSTED sales invoices for this customer
    const invoices = await (0, tokenSalesStore_1.getSalesInvoices)(orgId);
    const postedInvoices = invoices.filter(inv => {
        return inv.customer_id === customerId && inv.status === 'POSTED';
    });
    // Calculate Monthly volume (current month)
    const year = evalDate.slice(0, 4);
    const month = evalDate.slice(5, 7);
    const monthStart = `${year}-${month}-01`;
    const monthEnd = `${year}-${month}-31`;
    const monthlyVolume = postedInvoices
        .filter(inv => inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd)
        .reduce((sum, inv) => {
        const itemQty = (inv.items || []).reduce((q, item) => q + (Number(item.quantity) || 0), 0);
        return sum + itemQty;
    }, 0);
    // Calculate Annual FY volume (Apr 1 to Mar 31)
    const evalYear = parseInt(year, 10);
    const evalMonthNum = parseInt(month, 10);
    const fyStart = evalMonthNum >= 4 ? `${evalYear}-04-01` : `${evalYear - 1}-04-01`;
    const fyEnd = evalMonthNum >= 4 ? `${evalYear + 1}-03-31` : `${evalYear}-03-31`;
    const annualVolume = postedInvoices
        .filter(inv => inv.invoice_date >= fyStart && inv.invoice_date <= fyEnd)
        .reduce((sum, inv) => {
        const itemQty = (inv.items || []).reduce((q, item) => q + (Number(item.quantity) || 0), 0);
        return sum + itemQty;
    }, 0);
    // Fetch active level rules
    const rules = await (0, tokenPricingStore_1.getCustomerLevelRules)(orgId);
    const activeRules = rules.filter(r => r.is_active);
    const allLevels = await (0, tokenPricingStore_1.getCustomerLevels)(orgId);
    // Evaluate candidate matching rules
    let winningRule = null;
    let winningLevel = null;
    let qualificationVolume = 0;
    let calculatedPeriod = `FY ${fyStart.slice(0, 4)}-${fyEnd.slice(2, 4)}`;
    // Sort rules by priority descending, then min_purchase_volume descending
    const sortedRules = [...activeRules].sort((a, b) => {
        if (b.priority !== a.priority)
            return b.priority - a.priority;
        return b.min_purchase_volume - a.min_purchase_volume;
    });
    for (const rule of sortedRules) {
        const level = allLevels.find(l => l.id === rule.customer_level_id && l.is_active);
        if (!level)
            continue;
        let volume = 0;
        if (rule.period_type === 'MONTHLY') {
            volume = monthlyVolume;
        }
        else if (rule.period_type === 'ANNUAL') {
            volume = annualVolume;
        }
        else if (rule.period_type === 'CUSTOM' && rule.custom_period_from && rule.custom_period_to) {
            volume = postedInvoices
                .filter(inv => inv.invoice_date >= rule.custom_period_from && inv.invoice_date <= rule.custom_period_to)
                .reduce((sum, inv) => sum + (inv.items || []).reduce((q, item) => q + (Number(item.quantity) || 0), 0), 0);
        }
        if (volume >= rule.min_purchase_volume) {
            winningRule = rule;
            winningLevel = level;
            qualificationVolume = volume;
            calculatedPeriod = rule.period_type === 'MONTHLY' ? `${year}-${month}` : calculatedPeriod;
            break;
        }
    }
    // Fallback to lowest level or default
    if (!winningLevel) {
        const sortedLevels = [...allLevels].filter(l => l.is_active).sort((a, b) => a.priority - b.priority);
        winningLevel = sortedLevels[0] || {
            id: 'level-default',
            organization_id: orgId,
            level_name: 'STANDARD',
            level_code: 'STD',
            priority: 0,
            is_active: true,
            assignment_mode: 'AUTOMATIC',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        qualificationVolume = annualVolume;
    }
    const result = {
        customer_id: customerId,
        previous_level_id: (current === null || current === void 0 ? void 0 : current.current_level_id) || null,
        new_level_id: winningLevel.id,
        new_level_name: winningLevel.level_name,
        qualification_volume: qualificationVolume,
        rule_matched_id: (winningRule === null || winningRule === void 0 ? void 0 : winningRule.id) || null,
        calculated_period: calculatedPeriod,
        assignment_type: 'AUTOMATIC',
        calculated_at: new Date().toISOString()
    };
    // Save new assignment
    await (0, tokenPricingStore_1.saveCustomerLevelAssignment)({
        id: `cla-${customerId}`,
        organization_id: orgId,
        company_profile_id: null,
        customer_id: customerId,
        current_level_id: winningLevel.id,
        previous_level_id: (current === null || current === void 0 ? void 0 : current.current_level_id) || null,
        assignment_type: 'AUTOMATIC',
        qualification_volume: qualificationVolume,
        matched_rule_id: (winningRule === null || winningRule === void 0 ? void 0 : winningRule.id) || null,
        calculated_period: calculatedPeriod,
        calculated_at: result.calculated_at,
        created_at: (current === null || current === void 0 ? void 0 : current.created_at) || result.calculated_at,
        updated_at: result.calculated_at
    });
    return result;
}
