/**
 * Centralized Route Permission Guard
 *
 * Defines which routes require which minimum hierarchy level or permissions.
 * Numerical levels:
 * 0: Super Administrator (Root - Unrestricted)
 * 1: Regional Partner Admin
 * 2: Branch Manager
 * 3: Operations Executive
 * 4: Field Staff / Tele-caller
 */

export interface RoutePermissionRule {
  pathPrefix: string
  exact?: boolean
  minLevelOrder?: number // Maximum allowed hierarchy_level_order (e.g. 1 means level 0 and 1 only; 3 means 0, 1, 2, 3)
  moduleKey?: string
  actionKey?: string
  deniedMessage?: string
}

export const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  // 1. System Administration: Level 0 (Super Admin) and Level 1 (Partner Admin) only
  {
    pathPrefix: '/admin',
    minLevelOrder: 1,
    deniedMessage: 'Access denied. Administrator privileges required to access System Administration.',
  },

  // 2. Revenue Dashboard & Analytics: Level 0, 1, 2, 3 only (Level 4 restricted)
  {
    pathPrefix: '/reports/revenue',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to view revenue analytics.',
  },

  // 3. DSC Product Catalog & Pricing: Management/Admin only (Levels 0, 1, 2, 3)
  {
    pathPrefix: '/dsc/catalog',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to manage the DSC Product Catalog or Pricing.',
  },

  // 4. Partner Commissions & Payouts Engine: Level 0 and Level 1 only
  {
    pathPrefix: '/dsc/commissions',
    minLevelOrder: 1,
    deniedMessage: 'Access denied. You do not have permission to manage Partner Commissions or CA Payouts.',
  },

  // 5. Hardware Token Stock & Procurement: Management/Operations only (Level 4 restricted)
  {
    pathPrefix: '/inventory/procurement',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to access Token Procurement and Purchase Orders.',
  },
  {
    pathPrefix: '/inventory/tokens',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to manage Hardware Token Stock.',
  },
  {
    pathPrefix: '/inventory/branches',
    minLevelOrder: 2,
    deniedMessage: 'Access denied. You do not have permission to manage Branch Inventory Hubs.',
  },

  // 6. Direct Issuance & Associates Management: Level 0, 1, 2, 3 only
  {
    pathPrefix: '/dsc/direct',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to access Direct Issuance Hub.',
  },

  // 7. Daily DSC Issuance & Reports: Level 0, 1, 2, 3 only
  {
    pathPrefix: '/dsc/issuance',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to access Daily DSC Issuance management.',
  },

  // 8. Invoices & Billing Management: Level 0, 1, 2, 3 only
  {
    pathPrefix: '/billing',
    minLevelOrder: 3,
    deniedMessage: 'Access denied. You do not have permission to access Billing & Financial Ledgers.',
  },
]

/**
 * Evaluates whether a given user session can access a route path.
 */
export function canAccessRoute(
  path: string,
  user?: { hierarchy_level_order?: number; role_id?: string } | null
): { allowed: boolean; message?: string } {
  // If no user is present, route check defers to auth redirect
  if (!user) return { allowed: false, message: 'Authentication required.' }

  const levelOrder = user.hierarchy_level_order ?? 99

  // Super Admin (Level 0) always has unrestricted root access
  if (levelOrder === 0 || user.role_id === 'role-super-admin') {
    return { allowed: true }
  }

  for (const rule of ROUTE_PERMISSION_RULES) {
    const matches = rule.exact
      ? path === rule.pathPrefix
      : path === rule.pathPrefix || path.startsWith(`${rule.pathPrefix}/`)

    if (matches) {
      if (rule.minLevelOrder !== undefined && levelOrder > rule.minLevelOrder) {
        return {
          allowed: false,
          message: rule.deniedMessage || 'Access denied. You do not have permission to view this resource.',
        }
      }
    }
  }

  return { allowed: true }
}

