import fs from 'fs'
import path from 'path'

const NAV_STORE_PATH = path.join(process.cwd(), 'data', 'admin_master_navigation.json')

export interface MasterNavigationItem {
  id: string
  parent_id: string | null
  name: string
  code: string
  type: 'MODULE' | 'SUB_MODULE' | 'MASTER'
  route?: string | null
  icon?: string | null
  display_order: number
  is_active: number
  permission_key?: string | null
  master_resource?: string | null
  created_at: string
  updated_at: string
}

// Initial seed migration hierarchy representing existing masters + requested Lead Management sub-module
export const INITIAL_MASTER_NAVIGATION: MasterNavigationItem[] = [
  // 1. MODULE: Business & Organization
  {
    id: 'nav-mod-organization',
    parent_id: null,
    name: 'Business & Organization',
    code: 'MOD_ORGANIZATION',
    type: 'MODULE',
    icon: 'Building2',
    display_order: 1,
    is_active: 1,
    permission_key: 'admin_users',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Sub-module: General Organization
  {
    id: 'nav-sub-organization-general',
    parent_id: 'nav-mod-organization',
    name: 'Organization Structure',
    code: 'SUB_ORG_GENERAL',
    type: 'SUB_MODULE',
    icon: 'Building2',
    display_order: 1,
    is_active: 1,
    permission_key: 'admin_users',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Masters under Organization Structure
  {
    id: 'nav-mast-company',
    parent_id: 'nav-sub-organization-general',
    name: 'Company Profile & Tax Legal Entities',
    code: 'company',
    type: 'MASTER',
    route: '/admin/settings?key=company',
    master_resource: 'company',
    display_order: 1,
    is_active: 1,
    permission_key: 'admin_users',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-partner-types',
    parent_id: 'nav-sub-organization-general',
    name: 'B2B Partner Categories & Channels',
    code: 'partner_types',
    type: 'MASTER',
    route: '/admin/settings?key=partner_types',
    master_resource: 'partner_types',
    display_order: 2,
    is_active: 1,
    permission_key: 'admin_users',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-branches',
    parent_id: 'nav-sub-organization-general',
    name: 'Branch Office Locations',
    code: 'branches',
    type: 'MASTER',
    route: '/admin/settings?key=branches',
    master_resource: 'branches',
    display_order: 3,
    is_active: 1,
    permission_key: 'admin_users',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 2. MODULE: DSC Certificates
  {
    id: 'nav-mod-dsc',
    parent_id: null,
    name: 'DSC Certificates',
    code: 'MOD_DSC',
    type: 'MODULE',
    icon: 'ShieldCheck',
    display_order: 2,
    is_active: 1,
    permission_key: 'dsc',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-sub-dsc-issuance',
    parent_id: 'nav-mod-dsc',
    name: 'DSC Authorities & Products',
    code: 'SUB_DSC_PRODUCTS',
    type: 'SUB_MODULE',
    icon: 'ShieldCheck',
    display_order: 1,
    is_active: 1,
    permission_key: 'dsc',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-ca',
    parent_id: 'nav-sub-dsc-issuance',
    name: 'Certifying Authorities',
    code: 'ca',
    type: 'MASTER',
    route: '/admin/settings?key=ca',
    master_resource: 'ca',
    display_order: 1,
    is_active: 1,
    permission_key: 'dsc',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-catalog',
    parent_id: 'nav-sub-dsc-issuance',
    name: 'DSC Certificate Catalog & Pricing',
    code: 'catalog',
    type: 'MASTER',
    route: '/admin/settings?key=catalog',
    master_resource: 'catalog',
    display_order: 2,
    is_active: 1,
    permission_key: 'dsc',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 3. MODULE: Hardware Tokens
  {
    id: 'nav-mod-tokens',
    parent_id: null,
    name: 'Hardware Tokens',
    code: 'MOD_TOKENS',
    type: 'MODULE',
    icon: 'Cpu',
    display_order: 3,
    is_active: 1,
    permission_key: 'inventory',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-sub-tokens-procurement',
    parent_id: 'nav-mod-tokens',
    name: 'Token Inventory & Vendors',
    code: 'SUB_TOKENS_PROCUREMENT',
    type: 'SUB_MODULE',
    icon: 'Cpu',
    display_order: 1,
    is_active: 1,
    permission_key: 'inventory',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-token-models',
    parent_id: 'nav-sub-tokens-procurement',
    name: 'Hardware USB Token Models',
    code: 'token_models',
    type: 'MASTER',
    route: '/admin/settings?key=token_models',
    master_resource: 'token_models',
    display_order: 1,
    is_active: 1,
    permission_key: 'inventory',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-vendors',
    parent_id: 'nav-sub-tokens-procurement',
    name: 'Hardware Procurement Vendors',
    code: 'vendors',
    type: 'MASTER',
    route: '/admin/settings?key=vendors',
    master_resource: 'vendors',
    display_order: 2,
    is_active: 1,
    permission_key: 'inventory',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-reasons',
    parent_id: 'nav-sub-tokens-procurement',
    name: 'Stock Adjustment & Quarantine Reasons',
    code: 'reasons',
    type: 'MASTER',
    route: '/admin/settings?key=reasons',
    master_resource: 'reasons',
    display_order: 3,
    is_active: 1,
    permission_key: 'inventory',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 4. MODULE: Customer CRM
  {
    id: 'nav-mod-crm',
    parent_id: null,
    name: 'Customer CRM',
    code: 'MOD_CRM',
    type: 'MODULE',
    icon: 'Tag',
    display_order: 4,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  // Sub-module: Lead Management (Required in Task Section 5)
  {
    id: 'nav-sub-crm-lead-mgmt',
    parent_id: 'nav-mod-crm',
    name: 'Lead Management',
    code: 'SUB_CRM_LEAD_MGMT',
    type: 'SUB_MODULE',
    icon: 'Layers',
    display_order: 1,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-crm-sources',
    parent_id: 'nav-sub-crm-lead-mgmt',
    name: 'Lead Sources',
    code: 'lead_sources',
    type: 'MASTER',
    route: '/admin/settings?key=lead_sources',
    master_resource: 'lead_sources',
    display_order: 1,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-crm-categories',
    parent_id: 'nav-sub-crm-lead-mgmt',
    name: 'Lead Categories',
    code: 'lead_categories',
    type: 'MASTER',
    route: '/admin/settings?key=lead_categories',
    master_resource: 'lead_categories',
    display_order: 2,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-crm-statuses',
    parent_id: 'nav-sub-crm-lead-mgmt',
    name: 'Lead Statuses',
    code: 'lead_statuses',
    type: 'MASTER',
    route: '/admin/settings?key=lead_statuses',
    master_resource: 'lead_statuses',
    display_order: 3,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-crm-channels',
    parent_id: 'nav-sub-crm-lead-mgmt',
    name: 'Communication Channels',
    code: 'communication_channels',
    type: 'MASTER',
    route: '/admin/settings?key=communication_channels',
    master_resource: 'communication_channels',
    display_order: 4,
    is_active: 1,
    permission_key: 'crm',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 5. MODULE: Business Services
  {
    id: 'nav-mod-services',
    parent_id: null,
    name: 'Business Services',
    code: 'MOD_SERVICES',
    type: 'MODULE',
    icon: 'Sparkles',
    display_order: 5,
    is_active: 1,
    permission_key: 'services',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-sub-services-catalog',
    parent_id: 'nav-mod-services',
    name: 'Compliance Catalog',
    code: 'SUB_SERVICES_CATALOG',
    type: 'SUB_MODULE',
    icon: 'Sparkles',
    display_order: 1,
    is_active: 1,
    permission_key: 'services',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-services',
    parent_id: 'nav-sub-services-catalog',
    name: 'Business Compliance Services Catalog',
    code: 'services',
    type: 'MASTER',
    route: '/admin/settings?key=services',
    master_resource: 'services',
    display_order: 1,
    is_active: 1,
    permission_key: 'services',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 6. MODULE: Billing & Payments
  {
    id: 'nav-mod-billing',
    parent_id: null,
    name: 'Billing & Payments',
    code: 'MOD_BILLING',
    type: 'MODULE',
    icon: 'CreditCard',
    display_order: 6,
    is_active: 1,
    permission_key: 'billing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-sub-billing-accounts',
    parent_id: 'nav-mod-billing',
    name: 'Banking & Accounts',
    code: 'SUB_BILLING_ACCOUNTS',
    type: 'SUB_MODULE',
    icon: 'CreditCard',
    display_order: 1,
    is_active: 1,
    permission_key: 'billing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-bank-accounts',
    parent_id: 'nav-sub-billing-accounts',
    name: 'Settlement Bank & UPI Accounts',
    code: 'bank_accounts',
    type: 'MASTER',
    route: '/admin/settings?key=bank_accounts',
    master_resource: 'bank_accounts',
    display_order: 1,
    is_active: 1,
    permission_key: 'billing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },

  // 7. MODULE: Courier & Logistics
  {
    id: 'nav-mod-logistics',
    parent_id: null,
    name: 'Courier & Logistics',
    code: 'MOD_LOGISTICS',
    type: 'MODULE',
    icon: 'Truck',
    display_order: 7,
    is_active: 1,
    permission_key: 'courier',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-sub-logistics-carriers',
    parent_id: 'nav-mod-logistics',
    name: 'Carriers & Dispatch',
    code: 'SUB_LOGISTICS_CARRIERS',
    type: 'SUB_MODULE',
    icon: 'Truck',
    display_order: 1,
    is_active: 1,
    permission_key: 'courier',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'nav-mast-couriers',
    parent_id: 'nav-sub-logistics-carriers',
    name: 'Logistics & Courier Delivery Partners',
    code: 'couriers',
    type: 'MASTER',
    route: '/admin/settings?key=couriers',
    master_resource: 'couriers',
    display_order: 1,
    is_active: 1,
    permission_key: 'courier',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export function loadMasterNavigation(): MasterNavigationItem[] {
  try {
    if (!fs.existsSync(NAV_STORE_PATH)) {
      saveMasterNavigation(INITIAL_MASTER_NAVIGATION)
      return INITIAL_MASTER_NAVIGATION
    }
    const data = fs.readFileSync(NAV_STORE_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Error loading master navigation store:', err)
    return INITIAL_MASTER_NAVIGATION
  }
}

export function saveMasterNavigation(items: MasterNavigationItem[]): void {
  try {
    const dir = path.dirname(NAV_STORE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(NAV_STORE_PATH, JSON.stringify(items, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error saving master navigation store:', err)
  }
}
