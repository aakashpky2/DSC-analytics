"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDirectDscPricing = resolveDirectDscPricing;
const dscDirectIssuanceStore_1 = require("./dscDirectIssuanceStore");
const dscMasterStore_1 = require("./dscMasterStore");
/**
 * Resolves commercial pricing across Rate Card types:
 * 1. GENERAL / STANDARD (Default CA master rate or General rate card)
 * 2. DIRECT RETAIL (Configured retail rate card)
 * 3. ASSOCIATE PARTNER (Configured associate rate card under reselling, or commission under commission model)
 */
async function resolveDirectDscPricing(req) {
    const orgId = req.organizationId;
    const dateStr = req.date || new Date().toISOString().split('T')[0];
    const qty = Math.max(1, req.quantity || 1);
    const isAssociate = req.fulfillmentChannel === 'ASSOCIATE_PARTNER';
    // 1. Determine Rate Card Type
    let targetRateCardType = 'GENERAL';
    if (isAssociate) {
        targetRateCardType = 'ASSOCIATE_PARTNER';
    }
    else {
        // Check if a direct retail card exists for this CA/product
        const retailCards = await (0, dscDirectIssuanceStore_1.getDscDirectRateCards)(orgId, {
            rateCardType: 'DIRECT_RETAIL',
            companyProfileId: req.companyProfileId,
            companyId: req.companyId,
            productId: req.productId,
            activeOnly: true,
        });
        const validRetail = retailCards.find((c) => {
            const isDateValid = c.effective_from <= dateStr && (!c.effective_to || c.effective_to >= dateStr);
            const isClassValid = !c.class_id || c.class_id === req.classId;
            const isValidityValid = !c.validity_id || c.validity_id === req.validityId;
            return isDateValid && isClassValid && isValidityValid;
        });
        if (validRetail) {
            targetRateCardType = 'DIRECT_RETAIL';
        }
    }
    // 2. Fetch specific rate cards for target type
    const matchingCards = await (0, dscDirectIssuanceStore_1.getDscDirectRateCards)(orgId, {
        rateCardType: targetRateCardType,
        companyProfileId: req.companyProfileId,
        companyId: req.companyId,
        productId: req.productId,
        activeOnly: true,
    });
    // Match class/validity and date validity
    const activeCard = matchingCards.find((c) => {
        const isDateValid = c.effective_from <= dateStr && (!c.effective_to || c.effective_to >= dateStr);
        const isClassValid = !c.class_id || c.class_id === req.classId;
        const isValidityValid = !c.validity_id || c.validity_id === req.validityId;
        return isDateValid && isClassValid && isValidityValid;
    });
    let unitRate = 0;
    let rateCardId = null;
    let gstPct = 18;
    if (activeCard) {
        unitRate = Number(activeCard.rate);
        rateCardId = activeCard.id;
    }
    else if (targetRateCardType === 'ASSOCIATE_PARTNER') {
        // If Associate Partner rate card is missing, return clear descriptive error
        return {
            success: false,
            rateCardType: 'ASSOCIATE_PARTNER',
            baseUnitRate: 0,
            quantity: qty,
            baseTotalAmount: 0,
            gstRate: 18,
            gstAmount: 0,
            totalAmount: 0,
            billingPartyRole: 'ASSOCIATE_PARTNER',
            explanation: `No active Associate Partner rate card configured for provider ${req.companyId} and product ${req.productId} on date ${dateStr}.`,
            error: `No active Associate Partner rate card found for selected configuration on ${dateStr}.`,
        };
    }
    else {
        // Fallback to DSC Master Rates for GENERAL / STANDARD
        const masterRates = await (0, dscMasterStore_1.getDscRates)({
            company_id: req.companyId,
            product_id: req.productId,
            class_id: req.classId || undefined,
            validity_id: req.validityId || undefined,
            date: dateStr,
        });
        if (masterRates.length === 0) {
            return {
                success: false,
                rateCardType: targetRateCardType,
                baseUnitRate: 0,
                quantity: qty,
                baseTotalAmount: 0,
                gstRate: 18,
                gstAmount: 0,
                totalAmount: 0,
                billingPartyRole: 'CUSTOMER',
                explanation: `No master rate or rate card found for provider ${req.companyId}, product ${req.productId} on date ${dateStr}.`,
                error: `No active DSC rate card or master rate found for ${req.companyId}/${req.productId} on ${dateStr}.`,
            };
        }
        const primary = masterRates[0];
        unitRate = Number(primary.base_rate);
        rateCardId = primary.id;
        if (primary.gst_type === 'PERCENTAGE') {
            gstPct = Number(primary.gst_value || 18);
        }
    }
    // 3. Compute Commercial Totals
    const baseTotalAmount = Number((unitRate * qty).toFixed(2));
    const gstAmount = Number(((baseTotalAmount * gstPct) / 100).toFixed(2));
    const totalAmount = Number((baseTotalAmount + gstAmount).toFixed(2));
    // 4. Fulfillment Channel & Model Mechanics
    let billingPartyRole = 'CUSTOMER';
    let associateCommAmount = 0;
    let associateCommPct = 0;
    if (isAssociate) {
        const assocModel = req.fulfillmentModel || 'COMMISSION';
        const assocConfig = req.associatePartnerId
            ? await (0, dscDirectIssuanceStore_1.getAssociatePartnerByPartnerId)(orgId, req.associatePartnerId)
            : null;
        if (assocModel === 'RESELLING_B2B') {
            // Reselling: Associate Partner is billed directly by D-BIZ
            billingPartyRole = 'ASSOCIATE_PARTNER';
        }
        else {
            // Commission: End customer is billed by D-BIZ; Associate Partner earns commission
            billingPartyRole = 'CUSTOMER';
            associateCommPct = (assocConfig === null || assocConfig === void 0 ? void 0 : assocConfig.commission_percentage) || 10; // Default 10% if unspecified
            associateCommAmount = Number(((baseTotalAmount * associateCommPct) / 100).toFixed(2));
        }
    }
    const explanation = [
        `Resolved Rate Card: [${targetRateCardType}].`,
        `Unit Rate: ₹${unitRate.toFixed(2)}, Qty: ${qty}.`,
        `Base Total: ₹${baseTotalAmount.toFixed(2)}, GST (${gstPct}%): ₹${gstAmount.toFixed(2)}, Total: ₹${totalAmount.toFixed(2)}.`,
        isAssociate
            ? `Fulfillment: Via Associate Partner (${req.fulfillmentModel || 'COMMISSION'}). Billing Party: ${billingPartyRole}.`
            : 'Fulfillment: Direct Sale to Customer.',
    ].join(' ');
    return {
        success: true,
        rateCardType: targetRateCardType,
        rateCardId,
        baseUnitRate: unitRate,
        quantity: qty,
        baseTotalAmount,
        gstRate: gstPct,
        gstAmount,
        totalAmount,
        billingPartyRole,
        associateCommissionAmount: associateCommAmount,
        associateCommissionPercentage: associateCommPct,
        explanation,
    };
}
