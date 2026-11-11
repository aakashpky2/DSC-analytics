"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeControlledReset = executeControlledReset;
const supabase_1 = require("./supabase");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function executeControlledReset() {
    console.log('=== STARTING CONTROLLED DATABASE RESET (MAX 5 RECORDS PER ENTITY) ===');
    // 1. BACKUP CURRENT DATA
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `db_pre_cleanup_${timestamp}.json`);
    const tables = [
        'user_profiles',
        'partners',
        'purchase_internal_profiles',
        'dsc_catalog',
        'dsc_applications',
        'token_purchase_batches',
        'invoices',
        'crm_leads',
        'courier_dispatches',
        'token_models',
        'customer_pricing_categories',
        'customer_category_assignments',
        'token_vendor_quotes',
        'token_purchase_estimates',
        'token_purchase_parties',
        'temporary_delegations',
        'sessions',
        'company_profile'
    ];
    const fullBackup = {};
    for (const t of tables) {
        try {
            const rows = await (0, supabase_1.queryAll)(`SELECT * FROM ${t}`);
            fullBackup[t] = rows;
            console.log(`Backed up ${t}: ${rows.length} records`);
        }
        catch (e) {
            console.warn(`Could not backup ${t}:`, e.message);
        }
    }
    fs.writeFileSync(backupFile, JSON.stringify(fullBackup, null, 2));
    console.log(`Snapshot safely saved to: ${backupFile}`);
    const matrix = [];
    // -------------------------------------------------------------
    // ENTITY 1: USER PROFILES
    // Retain Super Admin + small set of test staff
    // usr-admin-root, usr-emp-anjali, usr-emp-rahul, usr-1793788284469, usr-1793788284356
    // -------------------------------------------------------------
    const allUsers = await (0, supabase_1.queryAll)('SELECT id, email FROM user_profiles');
    const keepUserIds = [
        'usr-admin-root',
        'usr-emp-anjali',
        'usr-emp-rahul',
        'usr-1793788284469',
        'usr-1793788284356'
    ];
    const usersToDelete = allUsers.filter((u) => !keepUserIds.includes(u.id)).map((u) => u.id);
    if (usersToDelete.length > 0) {
        // Delete dependent sessions first
        await (0, supabase_1.run)(`DELETE FROM sessions WHERE user_id NOT IN ('${keepUserIds.join("','")}')`);
        await (0, supabase_1.run)(`DELETE FROM temporary_delegations WHERE delegator_id NOT IN ('${keepUserIds.join("','")}') OR delegatee_id NOT IN ('${keepUserIds.join("','")}')`);
        await (0, supabase_1.run)(`DELETE FROM user_profiles WHERE id NOT IN ('${keepUserIds.join("','")}')`);
    }
    matrix.push({
        table: 'user_profiles',
        before: allUsers.length,
        retained: keepUserIds.length,
        deleted: usersToDelete.length,
        retainedIds: keepUserIds
    });
    // -------------------------------------------------------------
    // ENTITY 2: PARTNERS
    // Retain 5 distinct business cases:
    // 1. part-001 (Apex Digital Certifications LLP - GST Registered MH)
    // 2. part-002 (Northern Cyber Tech Solutions - Token Customer DL)
    // 3. part-1793773661120 (Test Partner Solutions - Dual DSC+Token MH)
    // 4. part-assoc-ptr-1794296945644 (Associate Partner Solutions)
    // 5. part-gap-cst-1794329369827 (Kerala Unregistered / Direct Customer)
    // (Fallback if part-gap-cst doesn't exist: pick first available Kerala or customer partner)
    // -------------------------------------------------------------
    const allPartners = await (0, supabase_1.queryAll)('SELECT id, company_name, state_code FROM partners');
    let keepPartnerIds = [
        'part-001',
        'part-002',
        'part-1793773661120',
        'part-assoc-ptr-1794296945644',
        'part-cst-1794306576289' // Kerala Enterprise Legal Corp
    ];
    // Verify existence
    const existingPartnerIds = allPartners.map((p) => p.id);
    keepPartnerIds = keepPartnerIds.filter(id => existingPartnerIds.includes(id));
    if (keepPartnerIds.length < 5) {
        for (const p of allPartners) {
            if (!keepPartnerIds.includes(p.id)) {
                keepPartnerIds.push(p.id);
                if (keepPartnerIds.length === 5)
                    break;
            }
        }
    }
    // -------------------------------------------------------------
    // ENTITY 3: INVOICES (keep 5 linked to retained partners)
    // -------------------------------------------------------------
    const allInvoices = await (0, supabase_1.queryAll)('SELECT id, invoice_number, partner_id FROM invoices');
    const retainedInvoices = allInvoices
        .filter((inv) => keepPartnerIds.includes(inv.partner_id))
        .slice(0, 5);
    const keepInvoiceIds = retainedInvoices.map((inv) => inv.id);
    // -------------------------------------------------------------
    // ENTITY 4: DSC APPLICATIONS (keep 5 linked to retained partners across distinct stages)
    // -------------------------------------------------------------
    const allDscApps = await (0, supabase_1.queryAll)('SELECT id, application_number, partner_id, stage FROM dsc_applications');
    const retainedDscApps = allDscApps
        .filter((a) => keepPartnerIds.includes(a.partner_id))
        .slice(0, 5);
    const keepDscAppIds = retainedDscApps.map((a) => a.id);
    // -------------------------------------------------------------
    // ENTITY 5: COURIER DISPATCHES (keep <= 5)
    // -------------------------------------------------------------
    const allCouriers = await (0, supabase_1.queryAll)('SELECT id FROM courier_dispatches');
    const keepCourierIds = allCouriers.slice(0, 5).map((c) => c.id);
    // -------------------------------------------------------------
    // ENTITY 6: CRM LEADS (keep 5)
    // -------------------------------------------------------------
    const allLeads = await (0, supabase_1.queryAll)('SELECT id FROM crm_leads');
    const keepLeadIds = allLeads.slice(0, 5).map((l) => l.id);
    // -------------------------------------------------------------
    // ENTITY 7: TOKEN PURCHASE BATCHES (keep <= 5)
    // -------------------------------------------------------------
    const allBatches = await (0, supabase_1.queryAll)('SELECT id FROM token_purchase_batches');
    const keepBatchIds = allBatches.slice(0, 5).map((b) => b.id);
    // -------------------------------------------------------------
    // ENTITY 8: TOKEN MODELS (keep 5 active models)
    // -------------------------------------------------------------
    const allModels = await (0, supabase_1.queryAll)('SELECT id FROM token_models');
    const keepModelIds = ['tm-1', 'tm-2', 'tm-3', 'tm-1793784774120', 'tm-1793960313811'].filter(id => allModels.some((m) => m.id === id));
    if (keepModelIds.length < 5) {
        for (const m of allModels) {
            if (!keepModelIds.includes(m.id)) {
                keepModelIds.push(m.id);
                if (keepModelIds.length === 5)
                    break;
            }
        }
    }
    // -------------------------------------------------------------
    // ENTITY 9: TOKEN VENDOR QUOTES & ESTIMATES & PARTIES
    // -------------------------------------------------------------
    const allQuotes = await (0, supabase_1.queryAll)('SELECT id FROM token_vendor_quotes');
    const keepQuoteIds = allQuotes.slice(0, 5).map((q) => q.id);
    const allEstimates = await (0, supabase_1.queryAll)('SELECT id FROM token_purchase_estimates');
    const keepEstimateIds = allEstimates.slice(0, 5).map((e) => e.id);
    const allParties = await (0, supabase_1.queryAll)('SELECT id FROM token_purchase_parties');
    const keepPartyIds = allParties.slice(0, 5).map((p) => p.id);
    // -------------------------------------------------------------
    // ENTITY 10: PRICING CATEGORIES & ASSIGNMENTS
    // -------------------------------------------------------------
    const allCats = await (0, supabase_1.queryAll)('SELECT id FROM customer_pricing_categories');
    const keepCatIds = allCats.slice(0, 5).map((c) => c.id);
    const allCatAssigns = await (0, supabase_1.queryAll)('SELECT id FROM customer_category_assignments');
    const keepCatAssignIds = allCatAssigns.slice(0, 5).map((c) => c.id);
    // =============================================================
    // EXECUTE SAFE DELETIONS (CHILDREN FIRST, THEN PARENTS)
    // =============================================================
    console.log('Executing safe deletions in dependency order...');
    // 1. Couriers
    if (allCouriers.length > keepCourierIds.length) {
        await (0, supabase_1.run)(`DELETE FROM courier_dispatches WHERE id NOT IN ('${keepCourierIds.join("','")}')`);
    }
    matrix.push({
        table: 'courier_dispatches',
        before: allCouriers.length,
        retained: keepCourierIds.length,
        deleted: allCouriers.length - keepCourierIds.length,
        retainedIds: keepCourierIds
    });
    // 2. Invoices
    if (allInvoices.length > keepInvoiceIds.length) {
        await (0, supabase_1.run)(`DELETE FROM invoices WHERE id NOT IN ('${keepInvoiceIds.join("','")}')`);
    }
    matrix.push({
        table: 'invoices',
        before: allInvoices.length,
        retained: keepInvoiceIds.length,
        deleted: allInvoices.length - keepInvoiceIds.length,
        retainedIds: keepInvoiceIds
    });
    // 3. DSC Applications
    if (allDscApps.length > keepDscAppIds.length) {
        await (0, supabase_1.run)(`DELETE FROM dsc_applications WHERE id NOT IN ('${keepDscAppIds.join("','")}')`);
    }
    matrix.push({
        table: 'dsc_applications',
        before: allDscApps.length,
        retained: keepDscAppIds.length,
        deleted: allDscApps.length - keepDscAppIds.length,
        retainedIds: keepDscAppIds
    });
    // 4. CRM Leads
    if (allLeads.length > keepLeadIds.length) {
        await (0, supabase_1.run)(`DELETE FROM crm_leads WHERE id NOT IN ('${keepLeadIds.join("','")}')`);
    }
    matrix.push({
        table: 'crm_leads',
        before: allLeads.length,
        retained: keepLeadIds.length,
        deleted: allLeads.length - keepLeadIds.length,
        retainedIds: keepLeadIds
    });
    // 5. Token Batches
    if (allBatches.length > keepBatchIds.length) {
        await (0, supabase_1.run)(`DELETE FROM token_purchase_batches WHERE id NOT IN ('${keepBatchIds.join("','")}')`);
    }
    matrix.push({
        table: 'token_purchase_batches',
        before: allBatches.length,
        retained: keepBatchIds.length,
        deleted: allBatches.length - keepBatchIds.length,
        retainedIds: keepBatchIds
    });
    // 6. Token Vendor Quotes & Estimates
    if (allQuotes.length > keepQuoteIds.length) {
        await (0, supabase_1.run)(`DELETE FROM token_vendor_quotes WHERE id NOT IN ('${keepQuoteIds.join("','")}')`);
    }
    matrix.push({
        table: 'token_vendor_quotes',
        before: allQuotes.length,
        retained: keepQuoteIds.length,
        deleted: allQuotes.length - keepQuoteIds.length,
        retainedIds: keepQuoteIds
    });
    if (allEstimates.length > keepEstimateIds.length) {
        await (0, supabase_1.run)(`DELETE FROM token_purchase_estimates WHERE id NOT IN ('${keepEstimateIds.join("','")}')`);
    }
    matrix.push({
        table: 'token_purchase_estimates',
        before: allEstimates.length,
        retained: keepEstimateIds.length,
        deleted: allEstimates.length - keepEstimateIds.length,
        retainedIds: keepEstimateIds
    });
    // 7. Token Purchase Parties
    if (allParties.length > keepPartyIds.length) {
        await (0, supabase_1.run)(`DELETE FROM token_purchase_parties WHERE id NOT IN ('${keepPartyIds.join("','")}')`);
    }
    matrix.push({
        table: 'token_purchase_parties',
        before: allParties.length,
        retained: keepPartyIds.length,
        deleted: allParties.length - keepPartyIds.length,
        retainedIds: keepPartyIds
    });
    // 8. Partners
    if (allPartners.length > keepPartnerIds.length) {
        await (0, supabase_1.run)(`DELETE FROM partners WHERE id NOT IN ('${keepPartnerIds.join("','")}')`);
    }
    matrix.push({
        table: 'partners',
        before: allPartners.length,
        retained: keepPartnerIds.length,
        deleted: allPartners.length - keepPartnerIds.length,
        retainedIds: keepPartnerIds
    });
    // 9. Token Models
    if (allModels.length > keepModelIds.length) {
        await (0, supabase_1.run)(`DELETE FROM token_models WHERE id NOT IN ('${keepModelIds.join("','")}')`);
    }
    matrix.push({
        table: 'token_models',
        before: allModels.length,
        retained: keepModelIds.length,
        deleted: allModels.length - keepModelIds.length,
        retainedIds: keepModelIds
    });
    // 10. Pricing Categories & Assignments
    if (allCats.length > keepCatIds.length) {
        await (0, supabase_1.run)(`DELETE FROM customer_pricing_categories WHERE id NOT IN ('${keepCatIds.join("','")}')`);
    }
    matrix.push({
        table: 'customer_pricing_categories',
        before: allCats.length,
        retained: keepCatIds.length,
        deleted: allCats.length - keepCatIds.length,
        retainedIds: keepCatIds
    });
    if (allCatAssigns.length > keepCatAssignIds.length) {
        await (0, supabase_1.run)(`DELETE FROM customer_category_assignments WHERE id NOT IN ('${keepCatAssignIds.join("','")}')`);
    }
    matrix.push({
        table: 'customer_category_assignments',
        before: allCatAssigns.length,
        retained: keepCatAssignIds.length,
        deleted: allCatAssigns.length - keepCatAssignIds.length,
        retainedIds: keepCatAssignIds
    });
    // -------------------------------------------------------------
    // RELATIONAL STORES INSIDE `company_profile`
    // Trim document arrays to 5 records max
    // -------------------------------------------------------------
    const relationalStoreKeys = [
        'token_sales_estimates',
        'token_sales_invoices',
        'dsc_issuance_applications',
        'dsc_commission_transactions',
        'document_numbering_series',
        'document_numbering_rules',
        'customer_level_rules',
        'customer_levels'
    ];
    for (const storeKey of relationalStoreKeys) {
        try {
            const rows = await (0, supabase_1.queryAll)(`SELECT registered_address FROM company_profile WHERE id = '${storeKey}'`);
            if (rows && rows[0] && rows[0].registered_address) {
                const parsed = JSON.parse(rows[0].registered_address);
                if (Array.isArray(parsed) && parsed.length > 5) {
                    const beforeCount = parsed.length;
                    const trimmed = parsed.slice(0, 5);
                    const updatedJson = JSON.stringify(trimmed).replace(/'/g, "''");
                    await (0, supabase_1.run)(`UPDATE company_profile SET registered_address = '${updatedJson}' WHERE id = '${storeKey}'`);
                    matrix.push({
                        table: `rel_store:${storeKey}`,
                        before: beforeCount,
                        retained: 5,
                        deleted: beforeCount - 5,
                        retainedIds: trimmed.map((item) => item.id || 'item')
                    });
                    console.log(`Trimmed relational store ${storeKey}: ${beforeCount} -> 5`);
                }
            }
        }
        catch (e) {
            console.warn(`Error processing store ${storeKey}:`, e.message);
        }
    }
    console.log('\n=== CONTROLLED RESET COMPLETE ===');
    console.table(matrix.map(m => ({ Table: m.table, Before: m.before, Retained: m.retained, Deleted: m.deleted })));
    return matrix;
}
executeControlledReset().catch(console.error);
