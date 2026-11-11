import sqliteDump from '../../data/sqlite_dump.json';

export interface RoleModulePermissionRecord {
  id: string;
  role_id: string;
  module_id: string;
  can_view: number | boolean;
  can_create: number | boolean;
  can_edit: number | boolean;
  can_delete: number | boolean;
  can_export: number | boolean;
  mask_pii_fields: number | boolean;
}

export interface AppConfigModuleRecord {
  id: string;
  module_key: string;
  display_name: string;
  route_path: string;
}

export const FALLBACK_APP_MODULES: AppConfigModuleRecord[] = [
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

export const FALLBACK_ROLE_MODULE_PERMISSIONS: RoleModulePermissionRecord[] = (sqliteDump.role_module_permissions || []) as any[];

export function getFallbackRolePermission(roleId: string, moduleKey: string): RoleModulePermissionRecord | null {
  const mod = FALLBACK_APP_MODULES.find((m) => m.module_key === moduleKey);
  if (!mod) return null;

  const perm = FALLBACK_ROLE_MODULE_PERMISSIONS.find(
    (p) => (p.role_id === roleId || p.role_id === `role-${roleId}`) && p.module_id === mod.id
  );
  return perm || null;
}

