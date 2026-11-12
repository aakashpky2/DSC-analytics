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

export const FALLBACK_ROLE_MODULE_PERMISSIONS: RoleModulePermissionRecord[] = [
  // Super Admin (Level 0)
  { id: 'rmp-admin-dashboard', role_id: 'role-super-admin', module_id: 'mod-dashboard', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-crm', role_id: 'role-super-admin', module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-partners', role_id: 'role-super-admin', module_id: 'mod-partners', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-dsc', role_id: 'role-super-admin', module_id: 'mod-dsc', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-inventory', role_id: 'role-super-admin', module_id: 'mod-inventory', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-billing', role_id: 'role-super-admin', module_id: 'mod-billing', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-courier', role_id: 'role-super-admin', module_id: 'mod-courier', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-admin-users', role_id: 'role-super-admin', module_id: 'mod-users', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },

  // Field Staff / Tele-caller (Level 4)
  { id: 'rmp-field-dashboard', role_id: 'role-field-staff', module_id: 'mod-dashboard', can_view: 1, can_create: 1, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-crm', role_id: 'role-field-staff', module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-partners', role_id: 'role-field-staff', module_id: 'mod-partners', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-dsc', role_id: 'role-field-staff', module_id: 'mod-dsc', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-inventory', role_id: 'role-field-staff', module_id: 'mod-inventory', can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-services', role_id: 'role-field-staff', module_id: 'mod-services', can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-billing', role_id: 'role-field-staff', module_id: 'mod-billing', can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-courier', role_id: 'role-field-staff', module_id: 'mod-courier', can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },
  { id: 'rmp-field-users', role_id: 'role-field-staff', module_id: 'mod-users', can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 1 },

  // Senior Executive / Staff (Level 3)
  { id: 'rmp-senior-dashboard', role_id: 'role-senior-staff', module_id: 'mod-dashboard', can_view: 1, can_create: 1, can_edit: 0, can_delete: 0, can_export: 0, mask_pii_fields: 0 },
  { id: 'rmp-senior-crm', role_id: 'role-senior-staff', module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 0, mask_pii_fields: 0 },
  { id: 'rmp-senior-partners', role_id: 'role-senior-staff', module_id: 'mod-partners', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 0, mask_pii_fields: 0 },
  { id: 'rmp-senior-dsc', role_id: 'role-senior-staff', module_id: 'mod-dsc', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 0, mask_pii_fields: 0 },

  // Branch Manager (Level 2)
  { id: 'rmp-branch-dashboard', role_id: 'role-branch-mgr', module_id: 'mod-dashboard', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-branch-crm', role_id: 'role-branch-mgr', module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, can_export: 1, mask_pii_fields: 0 },

  // Regional Admin (Level 1)
  { id: 'rmp-reg-dashboard', role_id: 'role-partner-admin', module_id: 'mod-dashboard', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
  { id: 'rmp-reg-crm', role_id: 'role-partner-admin', module_id: 'mod-crm', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_export: 1, mask_pii_fields: 0 },
];

export function getFallbackRolePermission(roleId: string, moduleKey: string): RoleModulePermissionRecord | null {
  const mod = FALLBACK_APP_MODULES.find((m) => m.module_key === moduleKey);
  if (!mod) return null;

  const normalizedRoleId = roleId.startsWith('role-') ? roleId : `role-${roleId}`;
  const perm = FALLBACK_ROLE_MODULE_PERMISSIONS.find(
    (p) => (p.role_id === roleId || p.role_id === normalizedRoleId) && p.module_id === mod.id
  );
  return perm || null;
}
