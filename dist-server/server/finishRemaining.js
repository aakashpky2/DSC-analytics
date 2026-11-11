"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishRemaining = finishRemaining;
const supabase_1 = require("./supabase");
async function finishRemaining() {
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
    // 1. service_orders
    const { data: so } = await supabase_1.supabase.from('service_orders').select('id, partner_id');
    const soToDelete = (so || []).filter(s => !keepPartnerIds.includes(s.partner_id)).map(s => s.id);
    if (soToDelete.length > 0) {
        console.log(`Pruning ${soToDelete.length} service_orders...`);
        await supabase_1.supabase.from('service_orders').delete().in('id', soToDelete);
    }
    // 2. crm_lead_interactions
    const { data: ci } = await supabase_1.supabase.from('crm_lead_interactions').select('id, conducted_by');
    const ciToDelete = (ci || []).filter(c => !keepUserIds.includes(c.conducted_by)).map(c => c.id);
    if (ciToDelete.length > 0) {
        console.log(`Pruning ${ciToDelete.length} crm_lead_interactions...`);
        for (let i = 0; i < ciToDelete.length; i += 50) {
            await supabase_1.supabase.from('crm_lead_interactions').delete().in('id', ciToDelete.slice(i, i + 50));
        }
    }
    // 3. Prune partners
    const { data: allPartners } = await supabase_1.supabase.from('partners').select('id');
    const partnersToDelete = (allPartners || []).filter(p => !keepPartnerIds.includes(p.id)).map(p => p.id);
    if (partnersToDelete.length > 0) {
        console.log(`Pruning ${partnersToDelete.length} partners...`);
        for (let i = 0; i < partnersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('partners').delete().in('id', partnersToDelete.slice(i, i + 50));
            if (error)
                console.error('Partners delete error:', error.message);
        }
    }
    // 4. Prune user_profiles
    const { data: allUsers } = await supabase_1.supabase.from('user_profiles').select('id');
    const usersToDelete = (allUsers || []).filter(u => !keepUserIds.includes(u.id)).map(u => u.id);
    if (usersToDelete.length > 0) {
        console.log(`Pruning ${usersToDelete.length} user_profiles...`);
        for (let i = 0; i < usersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('user_profiles').delete().in('id', usersToDelete.slice(i, i + 50));
            if (error)
                console.error('Users delete error:', error.message);
        }
    }
    console.log('--- ALL CLEANUP FINISHED SUCCESSFULLY ---');
}
finishRemaining().catch(console.error);
