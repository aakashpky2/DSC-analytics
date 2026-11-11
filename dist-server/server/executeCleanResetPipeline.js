"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCleanResetPipeline = executeCleanResetPipeline;
const supabase_1 = require("./supabase");
async function executeCleanResetPipeline() {
    console.log('--- STARTING CLEAN DEPENDENCY-ORDERED RESET ---');
    // Step 1: Retain target partners
    // Must include the ones referenced by the 5 retained dsc_applications:
    // part-001, part-1793773661120, part-1793876808772, part-1793773676773, part-002
    const keepPartnerIds = [
        'part-001',
        'part-002',
        'part-1793773661120',
        'part-1793876808772',
        'part-1793773676773'
    ];
    // Step 2: Invoices & Payments Received
    // Pick 5 invoices that belong to keepPartnerIds
    const { data: allInvoices } = await supabase_1.supabase.from('invoices').select('id, partner_id');
    const keepInvoices = (allInvoices || [])
        .filter(inv => keepPartnerIds.includes(inv.partner_id))
        .slice(0, 5);
    const keepInvoiceIds = keepInvoices.map(inv => inv.id);
    console.log('Retaining 5 invoices:', keepInvoiceIds);
    // Delete payments_received for invoices NOT in keepInvoiceIds
    const { data: allPayments } = await supabase_1.supabase.from('payments_received').select('id, invoice_id');
    const paymentsToDelete = (allPayments || [])
        .filter(p => !keepInvoiceIds.includes(p.invoice_id))
        .map(p => p.id);
    if (paymentsToDelete.length > 0) {
        console.log(`Pruning ${paymentsToDelete.length} payments_received...`);
        await supabase_1.supabase.from('payments_received').delete().in('id', paymentsToDelete);
    }
    // Now delete unkept invoices
    const invoicesToDelete = (allInvoices || [])
        .filter(inv => !keepInvoiceIds.includes(inv.id))
        .map(inv => inv.id);
    if (invoicesToDelete.length > 0) {
        console.log(`Pruning ${invoicesToDelete.length} invoices...`);
        for (let i = 0; i < invoicesToDelete.length; i += 50) {
            await supabase_1.supabase.from('invoices').delete().in('id', invoicesToDelete.slice(i, i + 50));
        }
    }
    // Step 3: CRM Leads and Follow Ups
    const { data: allLeads } = await supabase_1.supabase.from('crm_leads').select('id');
    const keepLeadIds = (allLeads || []).slice(0, 5).map(l => l.id);
    const leadsToDelete = (allLeads || []).filter(l => !keepLeadIds.includes(l.id)).map(l => l.id);
    // Prune crm_follow_ups for unkept leads
    const { data: allFollowUps } = await supabase_1.supabase.from('crm_follow_ups').select('id, lead_id');
    const followUpsToDelete = (allFollowUps || [])
        .filter(fu => leadsToDelete.includes(fu.lead_id))
        .map(fu => fu.id);
    if (followUpsToDelete.length > 0) {
        console.log(`Pruning ${followUpsToDelete.length} crm_follow_ups...`);
        for (let i = 0; i < followUpsToDelete.length; i += 50) {
            await supabase_1.supabase.from('crm_follow_ups').delete().in('id', followUpsToDelete.slice(i, i + 50));
        }
    }
    // Now delete unkept crm_leads
    if (leadsToDelete.length > 0) {
        console.log(`Pruning ${leadsToDelete.length} crm_leads...`);
        for (let i = 0; i < leadsToDelete.length; i += 50) {
            await supabase_1.supabase.from('crm_leads').delete().in('id', leadsToDelete.slice(i, i + 50));
        }
    }
    // Step 4: Partners pruning
    const { data: allPartners } = await supabase_1.supabase.from('partners').select('id');
    const partnersToDelete = (allPartners || [])
        .filter(p => !keepPartnerIds.includes(p.id))
        .map(p => p.id);
    if (partnersToDelete.length > 0) {
        console.log(`Pruning ${partnersToDelete.length} partners...`);
        // Clear any lead links to partners being deleted
        await supabase_1.supabase.from('crm_leads').update({ linked_partner_id: null }).in('linked_partner_id', partnersToDelete);
        for (let i = 0; i < partnersToDelete.length; i += 50) {
            const { error: pErr } = await supabase_1.supabase.from('partners').delete().in('id', partnersToDelete.slice(i, i + 50));
            if (pErr)
                console.error('Partner delete error:', pErr.message);
        }
    }
    // Step 5: Token Models & Profile Stocks
    // Retain models: tm-1, tm-2, tm-3, tm-gate-1794306769683, tm-1793960313811
    const keepModelIds = ['tm-1', 'tm-2', 'tm-3', 'tm-gate-1794306769683', 'tm-1793960313811'];
    const { data: allModels } = await supabase_1.supabase.from('token_models').select('id');
    const modelsToDelete = (allModels || []).filter(m => !keepModelIds.includes(m.id)).map(m => m.id);
    if (modelsToDelete.length > 0) {
        console.log(`Pruning ${modelsToDelete.length} token_models...`);
        // Delete profile stocks for unkept models
        await supabase_1.supabase.from('token_profile_stocks').delete().in('token_model_id', modelsToDelete);
        for (let i = 0; i < modelsToDelete.length; i += 50) {
            const { error: mErr } = await supabase_1.supabase.from('token_models').delete().in('id', modelsToDelete.slice(i, i + 50));
            if (mErr)
                console.error('Model delete error:', mErr.message);
        }
    }
    // Step 6: User Profiles & Delegations
    const keepUserIds = [
        'usr-admin-root',
        'usr-emp-anjali',
        'usr-emp-rahul',
        'usr-1793788284469',
        'usr-1793788284356'
    ];
    const { data: allUsers } = await supabase_1.supabase.from('user_profiles').select('id');
    const usersToDelete = (allUsers || []).filter(u => !keepUserIds.includes(u.id)).map(u => u.id);
    if (usersToDelete.length > 0) {
        console.log(`Pruning ${usersToDelete.length} user_profiles...`);
        // Nullify or reassign assigned_to on retained crm_leads
        await supabase_1.supabase.from('crm_leads').update({ assigned_to: 'usr-admin-root' }).in('assigned_to', usersToDelete);
        // Delete delegations for unkept users
        await supabase_1.supabase.from('temporary_delegations').delete().not('delegator_id', 'in', `(${keepUserIds.join(',')})`);
        // Delete sessions for unkept users
        await supabase_1.supabase.from('sessions').delete().not('user_id', 'in', `(${keepUserIds.join(',')})`);
        for (let i = 0; i < usersToDelete.length; i += 50) {
            const { error: uErr } = await supabase_1.supabase.from('user_profiles').delete().in('id', usersToDelete.slice(i, i + 50));
            if (uErr)
                console.error('User delete error:', uErr.message);
        }
    }
    console.log('--- RESET PIPELINE EXECUTION COMPLETED ---');
}
executeCleanResetPipeline().catch(console.error);
