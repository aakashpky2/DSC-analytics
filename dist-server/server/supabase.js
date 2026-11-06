"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.supabase = void 0;
exports.queryAll = queryAll;
exports.queryOne = queryOne;
exports.run = run;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
dotenv_1.default.config();
let rawUrl = process.env.SUPABASE_URL || 'https://kbqwsfmfiomcakbhclca.supabase.co';
// Auto-correct common truncated env var issues (e.g. Hostinger trailing .c instead of .co)
if (rawUrl.endsWith('.supabase.c')) {
    rawUrl += 'o';
}
else if (rawUrl.endsWith('.supabase.')) {
    rawUrl += 'co';
}
else if (!rawUrl.includes('.supabase.co') && rawUrl.includes('kbqwsfmfiomcakbhclca')) {
    rawUrl = 'https://kbqwsfmfiomcakbhclca.supabase.co';
}
const supabaseUrl = rawUrl;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase server environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.');
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
exports.db = exports.supabase;
// ============================================================================
// Direct Supabase Query & Multi-Table Relational Join Resolver
// ============================================================================
function extractTableName(sql) {
    const match = sql.match(/(?:from|into|update)\s+([a-z_0-9]+)/i);
    return match ? match[1].toLowerCase() : '';
}
// Helper to apply in-memory filtering, sorting, and pagination (LIMIT/OFFSET) for complex JOINs
function applySqlFilteringAndPagination(items, sql, params) {
    let result = [...items];
    // Extract limit & offset
    let limit = null;
    let offset = 0;
    const limitParamMatch = sql.match(/limit\s+\?\s+offset\s+\?/i);
    if (limitParamMatch && params.length >= 2) {
        limit = parseInt(String(params[params.length - 2]), 10);
        offset = parseInt(String(params[params.length - 1]), 10);
        // Remove the limit and offset params from the filter params slice
        params = params.slice(0, -2);
    }
    else {
        const limitNumMatch = sql.match(/limit\s+(\d+)(?:\s+offset\s+(\d+))?/i);
        if (limitNumMatch) {
            limit = parseInt(limitNumMatch[1], 10);
            if (limitNumMatch[2]) {
                offset = parseInt(limitNumMatch[2], 10);
            }
        }
    }
    // Filter if WHERE clause exists
    const whereIdx = sql.toLowerCase().indexOf('where');
    if (whereIdx !== -1) {
        const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0].trim();
        // Check if there are search LIKE params
        const likeParams = params.filter(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
        if (likeParams.length > 0) {
            const searchTerm = likeParams[0].slice(1, -1).toLowerCase();
            result = result.filter(item => {
                const itemStr = Object.values(item)
                    .map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v || '')))
                    .join(' ')
                    .toLowerCase();
                return itemStr.includes(searchTerm);
            });
        }
    }
    // Pagination slice
    if (limit !== null && !isNaN(limit)) {
        result = result.slice(offset, offset + limit);
    }
    return result;
}
async function queryAll(sql, params = []) {
    const table = extractTableName(sql);
    if (!table)
        return [];
    try {
        // 1. Roles with hierarchy & user counts
        if (table === 'roles' && sql.includes('hierarchy_levels')) {
            const { data: roles } = await exports.supabase.from('roles').select('*, hierarchy_levels(level_order, level_name)');
            const { data: users } = await exports.supabase.from('user_profiles').select('id, role_id');
            const counts = {};
            users === null || users === void 0 ? void 0 : users.forEach(u => { counts[u.role_id] = (counts[u.role_id] || 0) + 1; });
            const res = (roles === null || roles === void 0 ? void 0 : roles.map(r => {
                var _a, _b;
                return (Object.assign(Object.assign({}, r), { level_order: (_a = r.hierarchy_levels) === null || _a === void 0 ? void 0 : _a.level_order, level_name: (_b = r.hierarchy_levels) === null || _b === void 0 ? void 0 : _b.level_name, staff_count: counts[r.id] || 0 }));
            })) || [];
            res.sort((a, b) => (a.level_order || 0) - (b.level_order || 0));
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 2. User profiles with relations
        if (table === 'user_profiles' && sql.includes('JOIN')) {
            const { data: users } = await exports.supabase.from('user_profiles').select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)');
            const res = (users === null || users === void 0 ? void 0 : users.map(u => {
                var _a, _b, _c, _d;
                return (Object.assign(Object.assign({}, u), { role_name: (_a = u.roles) === null || _a === void 0 ? void 0 : _a.name, level_order: (_b = u.hierarchy_levels) === null || _b === void 0 ? void 0 : _b.level_order, level_name: (_c = u.hierarchy_levels) === null || _c === void 0 ? void 0 : _c.level_name, branch_name: (_d = u.branches) === null || _d === void 0 ? void 0 : _d.branch_name }));
            })) || [];
            res.sort((a, b) => (a.level_order || 0) - (b.level_order || 0));
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 3. DSC Applications with partner & product relations
        if (table === 'dsc_applications' && sql.includes('JOIN')) {
            const { data: apps } = await exports.supabase.from('dsc_applications').select('*, partners(company_name), dsc_catalog(class_type, certificate_type, validity_years)');
            const res = (apps === null || apps === void 0 ? void 0 : apps.map(a => {
                var _a, _b, _c, _d;
                return (Object.assign(Object.assign({}, a), { partner_company: (_a = a.partners) === null || _a === void 0 ? void 0 : _a.company_name, class_type: ((_b = a.dsc_catalog) === null || _b === void 0 ? void 0 : _b.class_type) || a.class_type, certificate_type: (_c = a.dsc_catalog) === null || _c === void 0 ? void 0 : _c.certificate_type, validity_years: (_d = a.dsc_catalog) === null || _d === void 0 ? void 0 : _d.validity_years }));
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 4. Branch token stocks with branch relations
        if (table === 'branch_token_stocks' && sql.includes('JOIN branches')) {
            const { data: stocks } = await exports.supabase.from('branch_token_stocks').select('*, branches(branch_name, branch_code)');
            const res = (stocks === null || stocks === void 0 ? void 0 : stocks.map(s => {
                var _a, _b;
                return (Object.assign(Object.assign({}, s), { branch_name: (_a = s.branches) === null || _a === void 0 ? void 0 : _a.branch_name, branch_code: (_b = s.branches) === null || _b === void 0 ? void 0 : _b.branch_code }));
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 5. CRM Leads with assigned agent
        if (table === 'crm_leads' && sql.includes('JOIN')) {
            const { data: leads } = await exports.supabase.from('crm_leads').select('*, user_profiles(full_name)');
            let res = (leads === null || leads === void 0 ? void 0 : leads.map(l => {
                var _a;
                return (Object.assign(Object.assign({}, l), { assigned_agent_name: (_a = l.user_profiles) === null || _a === void 0 ? void 0 : _a.full_name }));
            })) || [];
            if (sql.includes('is_merged = 0')) {
                res = res.filter(l => Number(l.is_merged) === 0);
            }
            else if (sql.includes('is_merged = 1')) {
                res = res.filter(l => Number(l.is_merged) === 1);
            }
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 6. Service orders with partner relations
        if (table === 'service_orders' && sql.includes('JOIN')) {
            const { data: orders } = await exports.supabase.from('service_orders').select('*, partners(company_name)');
            const res = (orders === null || orders === void 0 ? void 0 : orders.map(o => {
                var _a;
                return (Object.assign(Object.assign({}, o), { partner_company: (_a = o.partners) === null || _a === void 0 ? void 0 : _a.company_name }));
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 7. Temporary delegations with grantor details
        if (table === 'temporary_delegations' && sql.includes('JOIN')) {
            const { data: delegs } = await exports.supabase.from('temporary_delegations').select('*');
            const { data: users } = await exports.supabase.from('user_profiles').select('id, full_name, permissions_frozen, status');
            const userMap = new Map(users === null || users === void 0 ? void 0 : users.map(u => [u.id, u]));
            const res = (delegs === null || delegs === void 0 ? void 0 : delegs.map(d => {
                const grantor = userMap.get(d.grantor_user_id);
                const recipient = userMap.get(d.recipient_user_id);
                return Object.assign(Object.assign({}, d), { grantor_name: grantor === null || grantor === void 0 ? void 0 : grantor.full_name, recipient_name: recipient === null || recipient === void 0 ? void 0 : recipient.full_name, grantor_frozen: grantor === null || grantor === void 0 ? void 0 : grantor.permissions_frozen, grantor_status: grantor === null || grantor === void 0 ? void 0 : grantor.status });
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 8. Audit logs with user details
        if (table === 'audit_logs' && sql.includes('JOIN')) {
            const { data: logs } = await exports.supabase.from('audit_logs').select('*, user_profiles(full_name, email)');
            const res = (logs === null || logs === void 0 ? void 0 : logs.map(a => {
                var _a, _b;
                return (Object.assign(Object.assign({}, a), { staff_name: (_a = a.user_profiles) === null || _a === void 0 ? void 0 : _a.full_name, staff_email: (_b = a.user_profiles) === null || _b === void 0 ? void 0 : _b.email }));
            })) || [];
            res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 9. Invoices with partner & bank details
        if (table === 'invoices' && sql.includes('JOIN')) {
            const { data: invs } = await exports.supabase.from('invoices').select('*, partners(company_name, partner_code), bank_accounts(account_nickname, bank_name)');
            const res = (invs === null || invs === void 0 ? void 0 : invs.map(i => {
                var _a, _b, _c;
                return (Object.assign(Object.assign({}, i), { company_name: (_a = i.partners) === null || _a === void 0 ? void 0 : _a.company_name, partner_code: (_b = i.partners) === null || _b === void 0 ? void 0 : _b.partner_code, account_nickname: (_c = i.bank_accounts) === null || _c === void 0 ? void 0 : _c.account_nickname }));
            })) || [];
            res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 10. Payments Received queue with invoices and partner joins
        if (table === 'payments_received' && sql.includes('JOIN invoices')) {
            const { data: queue } = await exports.supabase
                .from('payments_received')
                .select('*, invoices(invoice_number, total_amount, outstanding_balance, line_items), partners(company_name), bank_accounts(bank_name, account_number)')
                .order('created_at', { ascending: false });
            const res = (queue === null || queue === void 0 ? void 0 : queue.map(p => {
                var _a, _b, _c, _d, _e, _f, _g;
                return (Object.assign(Object.assign({}, p), { invoice_number: (_a = p.invoices) === null || _a === void 0 ? void 0 : _a.invoice_number, total_amount: (_b = p.invoices) === null || _b === void 0 ? void 0 : _b.total_amount, outstanding_balance: (_c = p.invoices) === null || _c === void 0 ? void 0 : _c.outstanding_balance, line_items: (_d = p.invoices) === null || _d === void 0 ? void 0 : _d.line_items, partner_company: (_e = p.partners) === null || _e === void 0 ? void 0 : _e.company_name, bank_name: (_f = p.bank_accounts) === null || _f === void 0 ? void 0 : _f.bank_name, account_number: (_g = p.bank_accounts) === null || _g === void 0 ? void 0 : _g.account_number }));
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 11. CRM Follow-ups with leads and staff joins
        if (table === 'crm_follow_ups' && sql.includes('JOIN')) {
            const { data: followUps } = await exports.supabase
                .from('crm_follow_ups')
                .select('*, crm_leads(company_name, contact_person, phone, email, lead_code), user_profiles(full_name)')
                .order('scheduled_at', { ascending: true });
            const res = (followUps === null || followUps === void 0 ? void 0 : followUps.map(f => {
                var _a, _b, _c, _d, _e, _f;
                return (Object.assign(Object.assign({}, f), { contact_mode: f.channel, follow_up_date: f.scheduled_at, company_name: (_a = f.crm_leads) === null || _a === void 0 ? void 0 : _a.company_name, contact_person: (_b = f.crm_leads) === null || _b === void 0 ? void 0 : _b.contact_person, phone: (_c = f.crm_leads) === null || _c === void 0 ? void 0 : _c.phone, email: (_d = f.crm_leads) === null || _d === void 0 ? void 0 : _d.email, lead_code: (_e = f.crm_leads) === null || _e === void 0 ? void 0 : _e.lead_code, conducted_by_name: (_f = f.user_profiles) === null || _f === void 0 ? void 0 : _f.full_name }));
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // 12. Delivery challans with branches joins
        if (table === 'delivery_challans' && sql.includes('JOIN')) {
            const { data: challans } = await exports.supabase.from('delivery_challans').select('*');
            const { data: branches } = await exports.supabase.from('branches').select('id, branch_name, branch_code');
            const branchMap = new Map(branches === null || branches === void 0 ? void 0 : branches.map(b => [b.id, b]));
            const res = (challans === null || challans === void 0 ? void 0 : challans.map(dc => {
                const sb = branchMap.get(dc.source_branch_id);
                const db = branchMap.get(dc.destination_branch_id);
                return Object.assign(Object.assign({}, dc), { source_branch_name: sb === null || sb === void 0 ? void 0 : sb.branch_name, source_branch_code: sb === null || sb === void 0 ? void 0 : sb.branch_code, destination_branch_name: db === null || db === void 0 ? void 0 : db.branch_name, destination_branch_code: db === null || db === void 0 ? void 0 : db.branch_code });
            })) || [];
            return applySqlFilteringAndPagination(res, sql, params);
        }
        // Default query builder
        let query = exports.supabase.from(table).select('*');
        // Handle parameterized WHERE clauses
        const whereIdx = sql.toLowerCase().indexOf('where');
        if (whereIdx !== -1) {
            const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0];
            const conditions = wherePart.split(/\s+and\s+/i);
            let paramIndex = 0;
            for (const cond of conditions) {
                const trimmedCond = cond.trim();
                if (trimmedCond.includes('is_active = 1')) {
                    query = query.eq('is_active', 1);
                }
                else if (trimmedCond.includes('is_active = 0')) {
                    query = query.eq('is_active', 0);
                }
                else if (trimmedCond.includes('is_merged = 0')) {
                    query = query.eq('is_merged', 0);
                }
                else if (trimmedCond.includes('is_merged = 1')) {
                    query = query.eq('is_merged', 1);
                }
                else if (trimmedCond.includes(' OR ') || trimmedCond.includes(' or ')) {
                    // Compound OR search condition, e.g. (col1 LIKE ? OR col2 LIKE ?)
                    const orCols = [];
                    const re = /([a-z_0-9\.]+)\s*(?:like|ilike)\s*\?/gi;
                    let m;
                    let searchVal = '';
                    while ((m = re.exec(trimmedCond)) !== null) {
                        orCols.push(m[1].replace(/^[a-z0-9_]+\./i, ''));
                        if (paramIndex < params.length) {
                            searchVal = String(params[paramIndex++]);
                        }
                    }
                    if (orCols.length > 0 && searchVal) {
                        const cleanVal = searchVal.replace(/%/g, '');
                        const orClause = orCols.map(c => `${c}.ilike.%${cleanVal}%`).join(',');
                        query = query.or(orClause);
                    }
                }
                else {
                    const match = trimmedCond.match(/([a-z_0-9\.]+)\s*(=|!=|<>|>|<|>=|<=|like|ilike)\s*\?/i);
                    if (match && paramIndex < params.length) {
                        const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '');
                        const op = match[2].toLowerCase();
                        const val = params[paramIndex++];
                        if (op === '=') {
                            query = query.eq(rawCol, val);
                        }
                        else if (op === '!=' || op === '<>') {
                            query = query.neq(rawCol, val);
                        }
                        else if (op === '>') {
                            query = query.gt(rawCol, val);
                        }
                        else if (op === '>=') {
                            query = query.gte(rawCol, val);
                        }
                        else if (op === '<') {
                            query = query.lt(rawCol, val);
                        }
                        else if (op === '<=') {
                            query = query.lte(rawCol, val);
                        }
                        else if (op === 'like' || op === 'ilike') {
                            query = query.ilike(rawCol, val);
                        }
                    }
                }
            }
        }
        // Handle sanitized single-column ORDER BY
        const orderMatch = sql.match(/order\s+by\s+([a-z_0-9\.]+)(\s+(?:asc|desc))?/i);
        if (orderMatch) {
            const col = orderMatch[1].replace(/^.*\./, '');
            const asc = orderMatch[2] ? orderMatch[2].trim().toLowerCase() !== 'desc' : true;
            query = query.order(col, { ascending: asc });
        }
        // Handle LIMIT / OFFSET
        let limitNum = null;
        let offsetNum = 0;
        const limitParamMatch = sql.match(/limit\s+\?\s+offset\s+\?/i);
        if (limitParamMatch && params.length >= 2) {
            limitNum = parseInt(String(params[params.length - 2]), 10);
            offsetNum = parseInt(String(params[params.length - 1]), 10);
        }
        else {
            const limitMatch = sql.match(/limit\s+(\d+)(\s+offset\s+(\d+))?/i);
            if (limitMatch) {
                limitNum = parseInt(limitMatch[1], 10);
                offsetNum = limitMatch[3] ? parseInt(limitMatch[3], 10) : 0;
            }
        }
        if (limitNum !== null && !isNaN(limitNum)) {
            query = query.range(offsetNum, offsetNum + limitNum - 1);
        }
        const { data, error } = await query;
        if (error) {
            console.error(`queryAll error on ${table}:`, error.message);
            return [];
        }
        return (data || []);
    }
    catch (err) {
        console.error(`queryAll exception on ${table}:`, err.message);
        return [];
    }
}
async function queryOne(sql, params = []) {
    var _a, _b, _c, _d, _e, _f, _g;
    const table = extractTableName(sql);
    if (!table)
        return null;
    try {
        // 0. Handle COUNT(*) queries directly
        if (/select\s+count\s*\(\s*\*\s*\)\s*(?:as\s+count)?/i.test(sql)) {
            const allRows = await queryAll(sql.replace(/select\s+count\s*\(\s*\*\s*\)\s*(?:as\s+count)?/i, 'SELECT *'), params);
            return { count: allRows.length };
        }
        // 1. User Profiles join lookup
        if (table === 'user_profiles' && (sql.includes('JOIN') || sql.includes('join'))) {
            const isEmailQuery = /lower\s*\(\s*(?:u\.)?email\s*\)\s*=\s*\?|(?:u\.)?email\s*=\s*\?/i.test(sql);
            const paramVal = params[0];
            let query = exports.supabase
                .from('user_profiles')
                .select('*, roles(name), hierarchy_levels(level_order, level_name), branches(branch_name)');
            if (isEmailQuery) {
                query = query.ilike('email', String(paramVal).trim().toLowerCase());
            }
            else {
                query = query.eq('id', paramVal);
            }
            const { data, error } = await query.maybeSingle();
            if (error || !data)
                return null;
            return Object.assign(Object.assign({}, data), { role_name: (_a = data.roles) === null || _a === void 0 ? void 0 : _a.name, hierarchy_level_order: (_b = data.hierarchy_levels) === null || _b === void 0 ? void 0 : _b.level_order, level_order: (_c = data.hierarchy_levels) === null || _c === void 0 ? void 0 : _c.level_order, level_name: (_d = data.hierarchy_levels) === null || _d === void 0 ? void 0 : _d.level_name, branch_name: (_e = data.branches) === null || _e === void 0 ? void 0 : _e.branch_name });
        }
        // 2. Direct user_profiles by lowercase email without join
        if (table === 'user_profiles' && /lower\s*\(\s*email\s*\)\s*=\s*\?/i.test(sql)) {
            const { data } = await exports.supabase
                .from('user_profiles')
                .select('*')
                .ilike('email', String(params[0]).trim().toLowerCase())
                .maybeSingle();
            return (data || null);
        }
        // 3. User permission overrides lookup with subquery
        if (table === 'user_permission_overrides' && sql.includes('app_modules')) {
            const userId = params[0];
            const moduleKey = params[1];
            const { data: mod } = await exports.supabase.from('app_modules').select('id').eq('module_key', moduleKey).maybeSingle();
            if (!mod)
                return null;
            const { data: override } = await exports.supabase
                .from('user_permission_overrides')
                .select('*')
                .eq('user_id', userId)
                .eq('module_id', mod.id)
                .maybeSingle();
            return (override || null);
        }
        // 4. Role module permissions lookup with subquery
        if (table === 'role_module_permissions' && sql.includes('app_modules')) {
            const roleId = params[0];
            const moduleKey = params[1];
            const { data: mod } = await exports.supabase.from('app_modules').select('id').eq('module_key', moduleKey).maybeSingle();
            if (!mod)
                return null;
            const { data: perm } = await exports.supabase
                .from('role_module_permissions')
                .select('*')
                .eq('role_id', roleId)
                .eq('module_id', mod.id)
                .maybeSingle();
            return (perm || null);
        }
        // 5. Temporary delegations active grant check
        if (table === 'temporary_delegations' && sql.includes('JOIN user_profiles')) {
            const recipientUserId = params[0];
            const moduleKey = params[1];
            const actionKey = params[2];
            const nowIso = params[3] || new Date().toISOString();
            const { data: delegs } = await exports.supabase
                .from('temporary_delegations')
                .select('*, user_profiles!temporary_delegations_grantor_user_id_fkey(permissions_frozen, status)')
                .eq('recipient_user_id', recipientUserId)
                .eq('module_key', moduleKey)
                .eq('status', 'active')
                .lte('valid_from', nowIso)
                .gte('valid_until', nowIso);
            if (!delegs || delegs.length === 0)
                return null;
            const matched = delegs.find(d => d.action_key === actionKey || d.action_key === 'all');
            if (!matched)
                return null;
            return Object.assign(Object.assign({}, matched), { grantor_frozen: (_f = matched.user_profiles) === null || _f === void 0 ? void 0 : _f.permissions_frozen, grantor_status: (_g = matched.user_profiles) === null || _g === void 0 ? void 0 : _g.status });
        }
        // 6. Generic query builder handling ALL AND conditions
        let query = exports.supabase.from(table).select('*');
        const whereIdx = sql.toLowerCase().indexOf('where');
        if (whereIdx !== -1) {
            const wherePart = sql.substring(whereIdx + 5).split(/order\s+by|limit/i)[0];
            const conditions = wherePart.split(/\s+and\s+/i);
            let paramIndex = 0;
            for (const cond of conditions) {
                const trimmedCond = cond.trim();
                if (trimmedCond.includes('is_active = 1')) {
                    query = query.eq('is_active', 1);
                }
                else if (trimmedCond.includes('is_active = 0')) {
                    query = query.eq('is_active', 0);
                }
                else if (trimmedCond.includes('is_merged = 0')) {
                    query = query.eq('is_merged', 0);
                }
                else if (trimmedCond.includes('is_merged = 1')) {
                    query = query.eq('is_merged', 1);
                }
                else if (trimmedCond.includes('used = 0')) {
                    query = query.eq('used', 0);
                }
                else {
                    const match = trimmedCond.match(/([a-z_0-9\.]+)\s*(=|!=|<>|>|<|>=|<=|like|ilike)\s*\?/i);
                    if (match && paramIndex < params.length) {
                        const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '');
                        const op = match[2].toLowerCase();
                        const val = params[paramIndex++];
                        if (op === '=') {
                            query = query.eq(rawCol, val);
                        }
                        else if (op === '!=' || op === '<>') {
                            query = query.neq(rawCol, val);
                        }
                        else if (op === '>') {
                            query = query.gt(rawCol, val);
                        }
                        else if (op === '>=') {
                            query = query.gte(rawCol, val);
                        }
                        else if (op === '<') {
                            query = query.lt(rawCol, val);
                        }
                        else if (op === '<=') {
                            query = query.lte(rawCol, val);
                        }
                        else if (op === 'like' || op === 'ilike') {
                            query = query.ilike(rawCol, val);
                        }
                    }
                }
            }
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error) {
            console.error(`queryOne error on ${table}:`, error.message);
            return null;
        }
        return (data || null);
    }
    catch (err) {
        console.error(`queryOne exception on ${table}:`, err.message);
        return null;
    }
}
async function run(sql, params = []) {
    const table = extractTableName(sql);
    if (!table)
        return { lastID: 0, changes: 0 };
    const trimmed = sql.trim().toLowerCase();
    try {
        if (trimmed.startsWith('insert into')) {
            const colsMatch = sql.match(/\(([^)]+)\)\s*values/i);
            if (colsMatch) {
                const cols = colsMatch[1].split(',').map(c => c.trim());
                const row = {};
                cols.forEach((col, idx) => {
                    row[col] = params[idx];
                });
                const { error } = await exports.supabase.from(table).insert(row);
                if (error)
                    throw error;
                return { lastID: 1, changes: 1 };
            }
        }
        else if (trimmed.startsWith('update')) {
            // 1. Handle stock updates with arithmetic increments/decrements
            if (table === 'branch_token_stocks') {
                const branchMatch = sql.match(/branch_id\s*=\s*\?/i);
                const tokenMatch = sql.match(/token_model\s*=\s*\?/i);
                if (branchMatch && tokenMatch) {
                    // Identify branch_id and token_model in params
                    // Standard pattern: [qty, branch_id, token_model] or [qty, qty, branch_id, token_model]
                    const branchId = params[params.length - 2];
                    const tokenModel = params[params.length - 1];
                    const { data: currentStock } = await exports.supabase
                        .from('branch_token_stocks')
                        .select('*')
                        .eq('branch_id', branchId)
                        .eq('token_model', tokenModel)
                        .maybeSingle();
                    if (currentStock) {
                        let newQty = currentStock.quantity_on_hand;
                        let newDamaged = currentStock.quarantine_damaged;
                        if (sql.includes('quantity_on_hand = quantity_on_hand - ?')) {
                            newQty -= Number(params[0]);
                        }
                        else if (sql.includes('quantity_on_hand = quantity_on_hand + ?')) {
                            newQty += Number(params[0]);
                        }
                        if (sql.includes('quarantine_damaged = quarantine_damaged + ?')) {
                            newDamaged += Number(params[1]);
                        }
                        await exports.supabase
                            .from('branch_token_stocks')
                            .update({ quantity_on_hand: newQty, quarantine_damaged: newDamaged })
                            .eq('branch_id', branchId)
                            .eq('token_model', tokenModel);
                        return { lastID: 0, changes: 1 };
                    }
                }
            }
            // 2. Standard update parsing with multiple WHERE conditions
            const setMatch = sql.match(/set\s+([\s\S]+?)\s+where/i);
            const whereMatch = sql.match(/where\s+([\s\S]+)$/i);
            if (setMatch && whereMatch) {
                // Split by comma outside parentheses
                const setStr = setMatch[1].trim();
                const setParts = [];
                let current = '';
                let depth = 0;
                for (let i = 0; i < setStr.length; i++) {
                    const char = setStr[i];
                    if (char === '(')
                        depth++;
                    else if (char === ')')
                        depth--;
                    if (char === ',' && depth === 0) {
                        setParts.push(current.trim());
                        current = '';
                    }
                    else {
                        current += char;
                    }
                }
                if (current.trim()) {
                    setParts.push(current.trim());
                }
                const row = {};
                let paramIdx = 0;
                for (const sp of setParts) {
                    const eqIdx = sp.indexOf('=');
                    if (eqIdx === -1)
                        continue;
                    const col = sp.substring(0, eqIdx).trim();
                    // Check if this SET clause has a placeholder '?'
                    if (sp.includes('?')) {
                        const val = params[paramIdx++];
                        // Skip updating with null/undefined if it is wrapped in COALESCE
                        if (sp.toLowerCase().includes('coalesce(') && (val === undefined || val === null)) {
                            continue;
                        }
                        row[col] = val;
                    }
                    else {
                        // Expression like updated_at = CURRENT_TIMESTAMP or updated_at = NOW()
                        if (col === 'updated_at') {
                            row[col] = new Date().toISOString();
                        }
                    }
                }
                let query = exports.supabase.from(table).update(row);
                const whereConditions = whereMatch[1].split(/\s+and\s+/i);
                for (const wc of whereConditions) {
                    const match = wc.match(/([a-z_0-9\.]+)\s*(=|!=|<>)\s*\?/i);
                    if (match && paramIdx < params.length) {
                        const rawCol = match[1].replace(/^[a-z0-9_]+\./i, '');
                        query = query.eq(rawCol, params[paramIdx++]);
                    }
                }
                const { error } = await query;
                if (error)
                    throw error;
                return { lastID: 0, changes: 1 };
            }
        }
        else if (trimmed.startsWith('delete from')) {
            const whereMatch = sql.match(/where\s+([a-z_0-9]+)\s*=\s*\?/i);
            if (whereMatch) {
                const { error } = await exports.supabase.from(table).delete().eq(whereMatch[1], params[0]);
                if (error)
                    throw error;
                return { lastID: 0, changes: 1 };
            }
        }
    }
    catch (err) {
        console.error(`run exception on ${table}:`, err.message);
        throw err;
    }
    return { lastID: 0, changes: 0 };
}
