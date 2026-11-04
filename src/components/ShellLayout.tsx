'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShieldCheck,
  Users2,
  FileCheck2,
  Cpu,
  Layers,
  Sparkles,
  Receipt,
  Truck,
  Eye,
  EyeOff,
  Building2,
  ChevronRight,
  Clock,
  Landmark,
  CheckCircle2,
  LogOut,
  Pin,
  PinOff,
} from 'lucide-react'
import { UI_TERMS } from '@/lib/terms'

interface SubItem {
  name: string
  href: string
  badge?: string
}

interface NavGroup {
  name: string
  icon: React.ElementType
  basePath?: string
  badge?: string
  minTier?: number
  items: SubItem[]
}

const navigationGroups: NavGroup[] = [
  {
    name: 'Home Dashboard',
    icon: LayoutDashboard,
    basePath: '/',
    items: [
      { name: 'Dashboard Overview', href: '/' }
    ]
  },
  {
    name: 'Partner Network',
    icon: Users2,
    basePath: '/partners',
    items: [
      { name: 'Partner Directory', href: '/partners' }
    ]
  },
  {
    name: 'DSC Certificates',
    icon: FileCheck2,
    basePath: '/dsc',
    items: [
      { name: 'Product Catalog', href: '/dsc/catalog' },
      { name: 'Application Workflow', href: '/dsc/applications' }
    ]
  },
  {
    name: 'Hardware Tokens',
    icon: Cpu,
    basePath: '/inventory',
    items: [
      { name: 'Stock Register', href: '/inventory/tokens' },
      { name: 'Branch Hubs', href: '/inventory/branches' }
    ]
  },
  {
    name: 'Customer CRM',
    icon: Layers,
    basePath: '/crm',
    badge: 'Smart',
    items: [
      { name: 'Lead Manager', href: '/crm/leads', badge: 'Dedupe' },
      { name: 'Follow-Up Agenda', href: '/crm/follow-ups' }
    ]
  },
  {
    name: 'Business Services',
    icon: Sparkles,
    basePath: '/services',
    items: [
      { name: 'Services Hub', href: '/services' }
    ]
  },
  {
    name: 'Invoices & Billing',
    icon: Receipt,
    basePath: '/billing',
    items: [
      { name: 'Invoice Register', href: '/billing/invoices' },
      { name: 'Invoice Builder', href: '/billing/invoices/new' },
      { name: 'Bank Accounts', href: '/billing/accounts' }
    ]
  },
  {
    name: 'Payments & Ledger',
    icon: CheckCircle2,
    basePath: '/billing',
    badge: 'Audit',
    items: [
      { name: 'Verification Queue', href: '/billing/payments', badge: 'Audit' },
      { name: 'Financial Ledger', href: '/billing/ledger' }
    ]
  },
  {
    name: 'Courier Logistics',
    icon: Truck,
    basePath: '/courier',
    items: [
      { name: 'Logistics Hub', href: '/courier' }
    ]
  },
  {
    name: 'System Admin',
    icon: ShieldCheck,
    basePath: '/admin',
    minTier: 1,
    items: [
      { name: 'User Management', href: '/admin/users' },
      { name: 'Hierarchy Levels', href: '/admin/roles' },
      { name: 'Permissions Delegation', href: '/admin/delegations' },
      { name: 'Master Settings', href: '/admin/settings' },
      { name: 'Audit History', href: '/admin/audit' }
    ]
  }
]

interface CurrentUser {
  id: string
  email: string
  full_name: string
  role_name: string
  hierarchy_level_order: number
  level_name: string
}

// Determine active group matching current route
function getActiveGroupName(currentPath: string): string | null {
  for (const group of navigationGroups) {
    if (group.items.length > 1) {
      const matches = group.items.some(
        (sub) => currentPath === sub.href || (sub.href !== '/' && currentPath.startsWith(sub.href))
      )
      if (matches) return group.name
    }
  }
  return null
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [maskPii, setMaskPii] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  
  // Controlled accordion: only ONE module group expanded at a time
  // Default to active route group on initial render so server SSR and client initial state immediately match
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => getActiveGroupName(pathname))

  // Auto-collapsing sidebar state: starts collapsed on desktop to maximize table workspace
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const collapseTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  const isExpanded = isPinned || isHovered

  const handleMouseEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (isPinned) return
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    // 10-second inactivity countdown before automatically collapsing
    collapseTimerRef.current = setTimeout(() => {
      setIsHovered(false)
      collapseTimerRef.current = null
    }, 10000)
  }

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current)
      }
    }
  }, [])

  // Sync expanded group with current route on load and route changes
  useEffect(() => {
    const active = getActiveGroupName(pathname)
    if (active) {
      setExpandedGroup(active)
    }
  }, [pathname])

  // Do not render full shell layout on public authentication pages
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')

  useEffect(() => {
    if (!isAuthPage) {
      fetch('/api/auth/me')
        .then((res) => {
          if (!res.ok) {
            router.push('/login')
            return null
          }
          return res.json()
        })
        .then((data) => {
          if (data?.user) {
            setCurrentUser(data.user)
          }
        })
        .catch(() => {
          router.push('/login')
        })
    }
  }, [pathname, isAuthPage, router])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue cleanup regardless
    } finally {
      // Redirect to login page and replace browser history to prevent back navigation
      window.location.href = '/login'
    }
  }

  if (isAuthPage) {
    return <>{children}</>
  }

  // Filter navigation groups based on current staff member's hierarchy tier
  const visibleGroups = navigationGroups.filter((group) => {
    if (group.minTier !== undefined && currentUser) {
      return currentUser.hierarchy_level_order <= group.minTier
    }
    return true
  })

  const toggleGroup = (groupName: string) => {
    setExpandedGroup((prev) => (prev === groupName ? null : groupName))
  }

  // User initials for avatar
  const initials = currentUser?.full_name
    ? currentUser.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SS'

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${
          isExpanded ? 'w-64' : 'w-16'
        } bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out relative z-30`}
      >
        <div className="flex flex-col min-h-0">
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800 shrink-0 overflow-hidden">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src="/signsync-logo.png"
                  alt="SignSync"
                  className="w-full h-full object-cover"
                />
              </div>
              {isExpanded && (
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                    SignSync Portal
                  </div>
                  <div className="text-[11px] text-slate-400">Office & Partner Workspace</div>
                </div>
              )}
            </div>

            {/* Explicit Pin / Unpin Button (Visible when expanded) */}
            {isExpanded && (
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? 'Unpin sidebar (auto-collapse enabled)' : 'Pin sidebar expanded'}
                className={`p-1.5 rounded-lg border text-xs transition cursor-pointer shrink-0 ${
                  isPinned
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent'
                }`}
              >
                {isPinned ? <Pin className="w-3.5 h-3.5 text-indigo-400 rotate-45" /> : <PinOff className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Navigation Groups with Collapsible Subtabs (Single-module accordion, no visible scrollbar) */}
          <nav className="p-2 space-y-1.5 overflow-y-auto max-h-[calc(100vh-190px)] no-scrollbar">
            {isExpanded && (
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Modules & Subtabs
              </div>
            )}

            {visibleGroups.map((group) => {
              const hasSubtabs = group.items.length > 1
              const isGroupActive = group.items.some(
                (sub) => pathname === sub.href || (sub.href !== '/' && pathname.startsWith(sub.href))
              )
              const isOpen = expandedGroup === group.name
              const GroupIcon = group.icon

              // Collapsed sidebar view: Icon-only rail with tooltip & active highlight
              if (!isExpanded) {
                const targetHref = group.items[0]?.href || '/'
                return (
                  <Link
                    key={group.name}
                    href={targetHref}
                    title={group.name}
                    className={`flex items-center justify-center w-12 h-10 rounded-xl transition-all relative group mx-auto ${
                      isGroupActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <GroupIcon className={`w-4 h-4 shrink-0 ${isGroupActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {group.badge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500"></span>
                    )}
                  </Link>
                )
              }

              // Expanded sidebar view
              if (!hasSubtabs) {
                const singleItem = group.items[0]
                const active = pathname === singleItem.href || (singleItem.href !== '/' && pathname.startsWith(singleItem.href))
                return (
                  <Link
                    key={singleItem.href}
                    href={singleItem.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <GroupIcon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{group.name}</span>
                    </div>
                    {group.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800 shrink-0">
                        {group.badge}
                      </span>
                    )}
                  </Link>
                )
              }

              return (
                <div key={group.name} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isGroupActive
                        ? 'text-indigo-300 bg-indigo-950/40 border border-indigo-900/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <GroupIcon className={`w-4 h-4 shrink-0 ${isGroupActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span className="truncate font-semibold">{group.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {group.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800 shrink-0">
                          {group.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                          isOpen ? 'rotate-90 text-indigo-400' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Subtabs list */}
                  {isOpen && (
                    <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-slate-800/80 ml-3">
                      {group.items.map((sub) => {
                        const subActive = pathname === sub.href || (sub.href !== '/' && pathname.startsWith(sub.href))
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                              subActive
                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <span className="truncate">{sub.name}</span>
                            {sub.badge && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800/60">
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Bottom Staff Info, Privacy Control & Logout */}
        <div className="p-2 border-t border-slate-800 space-y-2 bg-slate-900/90 overflow-hidden">
          {/* Privacy Switch (Hidden in collapsed rail) */}
          {isExpanded && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                {maskPii ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="text-[11px] font-medium">Hide Personal Details</span>
              </div>
              <button
                onClick={() => setMaskPii(!maskPii)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded transition cursor-pointer ${
                  maskPii
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {maskPii ? 'On' : 'Off'}
              </button>
            </div>
          )}

          {/* Logged in Employee Info & Logout Button */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <div
                title={currentUser?.full_name || 'Signed In Staff'}
                className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0"
              >
                {initials}
              </div>
              {isExpanded && (
                <div className="text-left overflow-hidden">
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser?.full_name || 'Signed In Staff'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium truncate">
                    {currentUser?.role_name || currentUser?.level_name || 'Active Session'}
                  </div>
                </div>
              )}
            </div>

            {/* Logout Action Button */}
            {isExpanded && (
              <button
                onClick={handleLogout}
                title="Sign Out"
                disabled={loggingOut}
                className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>SignSync</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-slate-200 font-medium">Daily Office Operations</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {currentUser ? currentUser.email : 'System Connected'}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 text-slate-400 text-xs transition border border-slate-700/60 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}
