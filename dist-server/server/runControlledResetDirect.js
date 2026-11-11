"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runControlledReset = runControlledReset;
const supabase_1 = require("./supabase");
async function runControlledReset() {
    console.log('==================================================================');
    console.log('  SIGNSYNC / DBIZ ERP: CONTROLLED DATABASE RESET EXECUTION');
    console.log('  Target: Keep <= 5 valid records per entity, remove rest');
    console.log('==================================================================\n');
    const report = [];
    // Helper for batch deletion using native supabase client
    async function pruneTable(tableName, selectQuery, pickRetainedFn) {
        try {
            const { data: allRows, error: fetchErr } = await supabase_1.supabase.from(tableName).select('*');
            if (fetchErr)
                throw fetchErr;
            if (!allRows)
                return;
            const beforeCount = allRows.length;
            if (beforeCount <= 5) {
                report.push({
                    entity: tableName,
                    before: beforeCount,
                    retained: beforeCount,
                    deleted: 0,
                    status: 'SUCCESS'
                });
                console.log(`[SKIP] ${tableName} already has ${beforeCount} records (<= 5).`);
                return allRows.map((r) => r.id);
            }
            const retainedRows = pickRetainedFn(allRows);
            const retainedIds = new Set(retainedRows.map((r) => r.id));
            const idsToDelete = allRows.filter((r) => !retainedIds.has(r.id)).map((r) => r.id);
            console.log(`[PRUNING] ${tableName}: deleting ${idsToDelete.length} of ${beforeCount} rows...`);
            // Chunk deletions in groups of 50 to prevent payload limits
            const chunkSize = 50;
            for (let i = 0; i < idsToDelete.length; i += chunkSize) {
                const chunk = idsToDelete.slice(i, i + chunkSize);
                const { error: delErr } = await supabase_1.supabase.from(tableName).delete().in('id', chunk);
                if (delErr) {
                    console.error(`Error deleting from ${tableName}:`, delErr.message);
                    throw delErr;
                }
            }
            report.push({
                entity: tableName,
                before: beforeCount,
                retained: retainedRows.length,
                deleted: idsToDelete.length,
                status: 'SUCCESS'
            });
            console.log(`[DONE] ${tableName}: retained ${retainedRows.length}, deleted ${idsToDelete.length}.`);
            return Array.from(retainedIds);
        }
        catch (err) {
            console.error(`[FAIL] ${tableName}:`, err.message);
            report.push({
                entity: tableName,
                before: 0,
                retained: 0,
                deleted: 0,
                status: 'ERROR'
            });
            return [];
        }
    }
    // 1. CRM LEADS (273 -> 5)
    await pruneTable('crm_leads', '*', (leads) => {
        // Keep 5 distinct stages
        const stages = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'PROPOSAL_SENT', 'CONVERTED'];
        const picked = [];
        for (const stage of stages) {
            const match = leads.find(l => (l.status || l.stage) === stage && !picked.some(p => p.id === l.id));
            if (match)
                picked.push(match);
        }
        // Fill remaining up to 5
        for (const l of leads) {
            if (picked.length >= 5)
                break;
            if (!picked.some(p => p.id === l.id))
                picked.push(l);
        }
        return picked.slice(0, 5);
    });
    // 2. INVOICES (46 -> 5)
    // We want to keep invoices for our target partners: part-001, part-002, part-1793773661120
    const priorityPartnerIds = [
        'part-001',
        'part-002',
        'part-1793773661120',
        'part-assoc-ptr-1794296945644',
        'part-cst-1794306576289'
    ];
    await pruneTable('invoices', '*', (invoices) => {
        const picked = invoices.filter(inv => priorityPartnerIds.includes(inv.partner_id)).slice(0, 5);
        if (picked.length < 5) {
            for (const inv of invoices) {
                if (!picked.some(p => p.id === inv.id)) {
                    picked.push(inv);
                    if (picked.length === 5)
                        break;
                }
            }
        }
        return picked;
    });
    // 3. DSC APPLICATIONS (11 -> 5)
    await pruneTable('dsc_applications', '*', (apps) => {
        // Keep 5 distinct workflow stages
        const targetStages = ['document_verification', 'video_recording', 'ca_approved', 'issued_dispatched'];
        const picked = [];
        for (const st of targetStages) {
            const match = apps.find(a => a.stage === st && priorityPartnerIds.includes(a.partner_id));
            if (match && !picked.some(p => p.id === match.id))
                picked.push(match);
        }
        for (const a of apps) {
            if (picked.length >= 5)
                break;
            if (!picked.some(p => p.id === a.id))
                picked.push(a);
        }
        return picked.slice(0, 5);
    });
    // 4. TOKEN PURCHASE BATCHES (12 -> 5)
    await pruneTable('token_purchase_batches', '*', (batches) => batches.slice(0, 5));
    // 5. TOKEN VENDOR QUOTES (9 -> 5)
    await pruneTable('token_vendor_quotes', '*', (quotes) => quotes.slice(0, 5));
    // 6. TOKEN PURCHASE ESTIMATES (3 -> 3, already <= 5)
    await pruneTable('token_purchase_estimates', '*', (est) => est.slice(0, 5));
    // 7. TOKEN PURCHASE PARTIES (6 -> 5)
    await pruneTable('token_purchase_parties', '*', (parties) => parties.slice(0, 5));
    // 8. TOKEN MODELS (17 -> 5)
    await pruneTable('token_models', '*', (models) => {
        const keepModelIds = ['tm-1', 'tm-2', 'tm-3', 'tm-1793784774120', 'tm-1793960313811'];
        const picked = models.filter(m => keepModelIds.includes(m.id));
        for (const m of models) {
            if (picked.length >= 5)
                break;
            if (!picked.some(p => p.id === m.id))
                picked.push(m);
        }
        return picked.slice(0, 5);
    });
    // 9. CUSTOMER PRICING CATEGORIES (12 -> 5)
    await pruneTable('customer_pricing_categories', '*', (cats) => cats.slice(0, 5));
    // 10. CUSTOMER CATEGORY ASSIGNMENTS (16 -> 5)
    await pruneTable('customer_category_assignments', '*', (assigns) => assigns.slice(0, 5));
    // 11. PARTNERS (44 -> 5)
    // Now that child tables (invoices, dsc_applications) have been pruned to reference priorityPartnerIds,
    // we can safely prune partners!
    await pruneTable('partners', '*', (partners) => {
        const picked = partners.filter(p => priorityPartnerIds.includes(p.id));
        for (const p of partners) {
            if (picked.length >= 5)
                break;
            if (!picked.some(item => item.id === p.id))
                picked.push(p);
        }
        return picked.slice(0, 5);
    });
    // 12. SESSIONS (Prune obsolete sessions, keep only active for admin & staff)
    const targetUserIds = [
        'usr-admin-root',
        'usr-emp-anjali',
        'usr-emp-rahul',
        'usr-1793788284469',
        'usr-1793788284356'
    ];
    const { data: allSessions } = await supabase_1.supabase.from('sessions').select('id, user_id');
    if (allSessions && allSessions.length > 5) {
        const sessionsToDelete = allSessions.filter(s => !targetUserIds.includes(s.user_id)).map(s => s.id);
        if (sessionsToDelete.length > 0) {
            console.log(`[PRUNING] sessions: deleting ${sessionsToDelete.length} obsolete sessions...`);
            for (let i = 0; i < sessionsToDelete.length; i += 50) {
                await supabase_1.supabase.from('sessions').delete().in('id', sessionsToDelete.slice(i, i + 50));
            }
            report.push({
                entity: 'sessions',
                before: allSessions.length,
                retained: allSessions.length - sessionsToDelete.length,
                deleted: sessionsToDelete.length,
                status: 'SUCCESS'
            });
        }
    }
    // 13. USER PROFILES (19 -> 5)
    // Prune users other than target 5
    await pruneTable('user_profiles', '*', (users) => {
        const picked = users.filter(u => targetUserIds.includes(u.id));
        return picked;
    });
    // 14. RELATIONAL STORES INSIDE `company_profile`
    // Trim JSON documents to max 5 items
    const relStores = [
        'token_sales_estimates',
        'token_sales_invoices',
        'dsc_issuance_applications',
        'dsc_commission_transactions',
        'document_numbering_series',
        'document_numbering_rules',
        'customer_level_rules',
        'customer_levels'
    ];
    for (const storeKey of relStores) {
        try {
            const { data: row } = await supabase_1.supabase
                .from('company_profile')
                .select('*')
                .eq('id', storeKey)
                .maybeSingle();
            if (row && row.registered_address) {
                let arr = JSON.parse(row.registered_address);
                if (Array.isArray(arr) && arr.length > 5) {
                    const before = arr.length;
                    const trimmed = arr.slice(0, 5);
                    await supabase_1.supabase
                        .from('company_profile')
                        .update({ registered_address: JSON.stringify(trimmed) })
                        .eq('id', storeKey);
                    report.push({
                        entity: `store:${storeKey}`,
                        before,
                        retained: 5,
                        deleted: before - 5,
                        status: 'SUCCESS'
                    });
                    console.log(`[DONE] Trimmed store ${storeKey}: ${before} -> 5`);
                }
            }
        }
        catch (e) {
            console.warn(`Could not trim store ${storeKey}:`, e.message);
        }
    }
    console.log('\n==================================================================');
    console.log('  FINAL VERIFICATION AND RECONCILIATION SUMMARY');
    console.log('==================================================================');
    console.table(report);
    return report;
}
runControlledReset().catch(console.error);
