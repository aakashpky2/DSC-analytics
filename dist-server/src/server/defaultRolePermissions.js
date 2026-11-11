"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_ROLE_MODULE_PERMISSIONS = exports.FALLBACK_APP_MODULES = void 0;
exports.getFallbackRolePermission = getFallbackRolePermission;
const sqlite_dump_json_1 = __importDefault(require("../../data/sqlite_dump.json"));
exports.FALLBACK_APP_MODULES = [
    { id: 'mod-dashboard', module_key: 'dashboard', display_name: 'Executive Dashboard', route_path: '/' },
    { id: 'mod-users', module_key: 'admin_users', display_name: 'User Administration & RBAC', route_path: '/admin/users' },
    { id: 'mod-partners', module_key: 'partners', display_name: 'Partner Network', route_path: '/partners' },
    { id: 'mod-dsc', module_key: 'dsc', display_name: 'DSC Catalogue & Pipeline', route_path: '/dsc/catalog' },
    { id: 'mod-inventory', module_key: 'inventory', display_name: 'Token Inventory & Landed Cost', route_path: '/inventory/tokens' },
    { id: 'mod-crm', module_key: 'crm', display_name: 'CRM Leads & Deduplication', route_path: '/crm/leads' },
    { id: 'mod-services', module_key: 'services', display_name: 'Business Services Hub', route_path: '/services' },
    { id: 'mod-billing', module_key: 'billing', display_name: 'Multi-Account Billing & Ledger', route_path: '/billing/invoices' },
    { id: 'mod-courier', module_key: 'courier', display_name: 'Courier & POD Tracking', route_path: '/courier' },
];
exports.FALLBACK_ROLE_MODULE_PERMISSIONS = (sqlite_dump_json_1.default.role_module_permissions || []);
function getFallbackRolePermission(roleId, moduleKey) {
    const mod = exports.FALLBACK_APP_MODULES.find((m) => m.module_key === moduleKey);
    if (!mod)
        return null;
    const perm = exports.FALLBACK_ROLE_MODULE_PERMISSIONS.find((p) => (p.role_id === roleId || p.role_id === `role-${roleId}`) && p.module_id === mod.id);
    return perm || null;
}
