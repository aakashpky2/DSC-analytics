"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishReset = finishReset;
const supabase_1 = require("./supabase");
async function finishReset() {
    console.log('--- COMPLETING PARTNERS & USER_PROFILES RESET ---');
    const keepPartnerIds = [
        'part-001',
        'part-002',
        'part-1793773661120',
        'part-1793876808772',
        'part-1793773676773'
    ];
    // 1. Delete financial_ledger entries for unkept partners
    const { data: allLedgers } = await supabase_1.supabase.from('financial_ledger').select('id, partner_id');
    const ledgersToDelete = (allLedgers || [])
        .filter(l => !keepPartnerIds.includes(l.partner_id))
        .map(l => l.id);
    if (ledgersToDelete.length > 0) {
        console.log(`Pruning ${ledgersToDelete.length} financial_ledger records...`);
        for (let i = 0; i < ledgersToDelete.length; i += 50) {
            await supabase_1.supabase.from('financial_ledger').delete().in('id', ledgersToDelete.slice(i, i + 50));
        }
    }
    // 2. Now prune partners
    const { data: allPartners } = await supabase_1.supabase.from('partners').select('id');
    const partnersToDelete = (allPartners || [])
        .filter(p => !keepPartnerIds.includes(p.id))
        .map(p => p.id);
    if (partnersToDelete.length > 0) {
        console.log(`Pruning ${partnersToDelete.length} partners...`);
        for (let i = 0; i < partnersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('partners').delete().in('id', partnersToDelete.slice(i, i + 50));
            if (error)
                console.error('Partner delete error:', error.message);
        }
    }
    // 3. User Profiles dependencies
    const keepUserIds = [
        'usr-admin-root',
        'usr-emp-anjali',
        'usr-emp-rahul',
        'usr-1793788284469',
        'usr-1793788284356'
    ];
    // Prune crm_lead_assignment_history for unkept users
    const { data: allHist } = await supabase_1.supabase.from('crm_lead_assignment_history').select('id, assigned_to');
    const histToDelete = (allHist || [])
        .filter(h => !keepUserIds.includes(h.assigned_to))
        .map(h => h.id);
    if (histToDelete.length > 0) {
        console.log(`Pruning ${histToDelete.length} assignment history records...`);
        await supabase_1.supabase.from('crm_lead_assignment_history').delete().in('id', histToDelete);
    }
    // Prune audit_logs for unkept users
    const { data: allAudit } = await supabase_1.supabase.from('audit_logs').select('id, user_id');
    const auditToDelete = (allAudit || [])
        .filter(a => !keepUserIds.includes(a.user_id))
        .map(a => a.id);
    if (auditToDelete.length > 0) {
        console.log(`Pruning ${auditToDelete.length} audit logs...`);
        for (let i = 0; i < auditToDelete.length; i += 50) {
            await supabase_1.supabase.from('audit_logs').delete().in('id', auditToDelete.slice(i, i + 50));
        }
    }
    // Prune user_profiles
    const { data: allUsers } = await supabase_1.supabase.from('user_profiles').select('id');
    const usersToDelete = (allUsers || [])
        .filter(u => !keepUserIds.includes(u.id))
        .map(u => u.id);
    if (usersToDelete.length > 0) {
        console.log(`Pruning ${usersToDelete.length} user_profiles...`);
        for (let i = 0; i < usersToDelete.length; i += 50) {
            const { error } = await supabase_1.supabase.from('user_profiles').delete().in('id', usersToDelete.slice(i, i + 50));
            if (error)
                console.error('User delete error:', error.message);
        }
    }
    console.log('--- FINISH RESET COMPLETE ---');
}
finishReset().catch(console.error);
