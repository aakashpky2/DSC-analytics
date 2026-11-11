"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanFinalFks = cleanFinalFks;
const supabase_1 = require("./supabase");
async function cleanFinalFks() {
    const keepPartnerIds = [
        'part-001',
        'part-002',
        'part-1793773661120',
        'part-1793876808772',
        'part-1793773676773'
    ];
    const keepUserIds = [
        'usr-admin-root',
        'usr-emp-anjali',
        'usr-emp-rahul',
        'usr-1793788284469',
        'usr-1793788284356'
    ];
    // 1. Delete crm_lead_conversion_links not referencing keepPartnerIds
    const { data: convLinks } = await supabase_1.supabase.from('crm_lead_conversion_links').select('id, partner_id');
    const convToDelete = (convLinks || [])
        .filter(c => !keepPartnerIds.includes(c.partner_id))
        .map(c => c.id);
    if (convToDelete.length > 0) {
        console.log(`Pruning ${convToDelete.length} crm_lead_conversion_links...`);
        await supabase_1.supabase.from('crm_lead_conversion_links').delete().in('id', convToDelete);
    }
    // 2. Prune partners now
    const { data: allPartners } = await supabase_1.supabase.from('partners').select('id');
    const partnersToDelete = (allPartners || [])
        .filter(p => !keepPartnerIds.includes(p.id))
        .map(p => p.id);
    if (partnersToDelete.length > 0) {
        console.log(`Pruning ${partnersToDelete.length} partners...`);
        for (let i = 0; i < partnersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('partners').delete().in('id', partnersToDelete.slice(i, i + 50));
            if (error)
                console.error('Partner error:', error.message);
        }
    }
    // 3. Delete temporary_delegations where grantor or recipient is not in keepUserIds
    const { data: allDelegs } = await supabase_1.supabase.from('temporary_delegations').select('id, grantor_user_id, recipient_user_id');
    const delegsToDelete = (allDelegs || [])
        .filter(d => !keepUserIds.includes(d.grantor_user_id) || !keepUserIds.includes(d.recipient_user_id))
        .map(d => d.id);
    if (delegsToDelete.length > 0) {
        console.log(`Pruning ${delegsToDelete.length} temporary_delegations...`);
        for (let i = 0; i < delegsToDelete.length; i += 50) {
            await supabase_1.supabase.from('temporary_delegations').delete().in('id', delegsToDelete.slice(i, i + 50));
        }
    }
    // 4. Prune user_profiles now
    const { data: allUsers } = await supabase_1.supabase.from('user_profiles').select('id');
    const usersToDelete = (allUsers || [])
        .filter(u => !keepUserIds.includes(u.id))
        .map(u => u.id);
    if (usersToDelete.length > 0) {
        console.log(`Pruning ${usersToDelete.length} user_profiles...`);
        for (let i = 0; i < usersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('user_profiles').delete().in('id', usersToDelete.slice(i, i + 50));
            if (error)
                console.error('User error:', error.message);
        }
    }
    console.log('--- FINAL PRUNING COMPLETE ---');
}
cleanFinalFks().catch(console.error);
