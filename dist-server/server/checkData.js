"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./supabase");
async function checkEmployees() {
    // Let's check user_profiles
    const profiles = await (0, supabase_1.queryAll)(`SELECT * FROM user_profiles`);
    console.log('User profiles count:', profiles.length);
    console.log('User profiles samples:', profiles.map((p) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        phone_number: p.phone_number,
        role_id: p.role_id,
        hierarchy_level_id: p.hierarchy_level_id,
        status: p.status,
        password_change_required: p.password_change_required
    })));
    // Let's check internal profiles
    const internalProfiles = await (0, supabase_1.queryAll)(`SELECT * FROM purchase_internal_profiles`);
    console.log('Internal company profiles:', internalProfiles.map((ip) => ({
        id: ip.id,
        profile_code: ip.profile_code,
        legal_name: ip.legal_name,
        trade_name: ip.trade_name
    })));
    // Let's check roles & hierarchy levels
    const roles = await (0, supabase_1.queryAll)(`SELECT * FROM roles`);
    console.log('Roles:', roles);
    const tiers = await (0, supabase_1.queryAll)(`SELECT * FROM hierarchy_levels`);
    console.log('Tiers:', tiers);
}
checkEmployees();
