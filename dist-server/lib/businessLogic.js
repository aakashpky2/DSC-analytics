"use strict";
/**
 * Section 6: Mathematical Formulations & Business Logic Algorithms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLandedCost = calculateLandedCost;
exports.calculateBundleGrossProfit = calculateBundleGrossProfit;
exports.evaluateLeadDuplicates = evaluateLeadDuplicates;
exports.calculateGst = calculateGst;
function calculateLandedCost(input) {
    const { quantityPurchased, baseUnitPrice, inwardShippingCost = 0, customsOrTaxes = 0, handlingCharges = 0, } = input;
    if (quantityPurchased <= 0) {
        throw new Error('Quantity purchased must be greater than zero');
    }
    const baseTotal = quantityPurchased * baseUnitPrice;
    const totalBatchLandedCost = baseTotal + inwardShippingCost + customsOrTaxes + handlingCharges;
    const unitLandedCost = Number((totalBatchLandedCost / quantityPurchased).toFixed(2));
    return {
        totalBatchLandedCost: Number(totalBatchLandedCost.toFixed(2)),
        unitLandedCost,
    };
}
function calculateBundleGrossProfit(invoiceSalePrice, dscCaBaseFee, unitLandedCost) {
    return Number((invoiceSalePrice - (dscCaBaseFee + unitLandedCost)).toFixed(2));
}
/**
 * Standard Levenshtein Distance calculation for fuzzy company name comparison
 */
function levenshteinSimilarity(s1, s2) {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b)
        return 1.0;
    if (!a.length || !b.length)
        return 0.0;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
}
function evaluateLeadDuplicates(newLead, existingLeads) {
    var _a, _b, _c, _d, _e;
    const results = [];
    const cleanGstin = (_a = newLead.gstin) === null || _a === void 0 ? void 0 : _a.trim().toUpperCase();
    const cleanPhone = (_b = newLead.phone) === null || _b === void 0 ? void 0 : _b.replace(/[^0-9]/g, '').slice(-10);
    const cleanEmail = (_c = newLead.email) === null || _c === void 0 ? void 0 : _c.trim().toLowerCase();
    const cleanPan = (_d = newLead.pan) === null || _d === void 0 ? void 0 : _d.trim().toUpperCase();
    const cleanCompany = (_e = newLead.companyName) === null || _e === void 0 ? void 0 : _e.trim();
    for (const lead of existingLeads) {
        let score = 0;
        const reasons = [];
        // 1. GSTIN Match (+50 Points)
        if (cleanGstin && lead.gstin && lead.gstin.trim().toUpperCase() === cleanGstin) {
            score += 50;
            reasons.push('Exact GSTIN match (+50)');
        }
        // 2. Phone Match (+40 Points)
        if (cleanPhone && lead.phone) {
            const existingPhone = lead.phone.replace(/[^0-9]/g, '').slice(-10);
            if (existingPhone === cleanPhone && cleanPhone.length === 10) {
                score += 40;
                reasons.push('Exact Phone match (+40)');
            }
        }
        // 3. Email Match (+35 Points)
        if (cleanEmail && lead.email && lead.email.trim().toLowerCase() === cleanEmail) {
            score += 35;
            reasons.push('Exact Email match (+35)');
        }
        // 4. PAN Match (+30 Points)
        if (cleanPan && lead.pan && lead.pan.trim().toUpperCase() === cleanPan) {
            score += 30;
            reasons.push('Exact PAN match (+30)');
        }
        // 5. Fuzzy Company Name Match (+20 Points if similarity > 85%)
        if (cleanCompany && lead.companyName) {
            const sim = levenshteinSimilarity(cleanCompany, lead.companyName);
            if (sim >= 0.85) {
                score += 20;
                reasons.push(`Fuzzy company name similarity (${Math.round(sim * 100)}%) (+20)`);
            }
        }
        if (score > 0) {
            results.push({
                matchedLeadId: lead.id,
                matchScore: score,
                reasons,
                isDuplicateAlert: score >= 40,
            });
        }
    }
    return results.sort((a, b) => b.matchScore - a.matchScore);
}
function calculateGst(subtotal, clientStateCode, companyStateCode = '27', // Default Maharashtra 27
gstRate = 0.18 // Standard 18%
) {
    const isInterstate = clientStateCode.trim() !== companyStateCode.trim();
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (isInterstate) {
        igst = Number((subtotal * gstRate).toFixed(2));
    }
    else {
        cgst = Number(((subtotal * gstRate) / 2).toFixed(2));
        sgst = Number(((subtotal * gstRate) / 2).toFixed(2));
    }
    const total = Number((subtotal + cgst + sgst + igst).toFixed(2));
    return {
        subtotal: Number(subtotal.toFixed(2)),
        cgst,
        sgst,
        igst,
        total,
        isInterstate,
    };
}
