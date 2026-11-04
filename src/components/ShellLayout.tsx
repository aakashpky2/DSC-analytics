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
} from 'lucide-react'
import { UI_TERMS } from '@/lib/terms'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
  minTier?: number // 0: Super Admin only, 1: Partner Admin, etc.
}

interface CurrentUser {
  id: string
  email: string
  full_name: string
  role_name: string
  hierarchy_level_order: number
  level_name: string
}

const mainNavItems: NavItem[] = [
  { name: UI_TERMS.dashboard, href: '/', icon: LayoutDashboard },
  { name: UI_TERMS.partners, href: '/partners', icon: Users2 },
  { name: UI_TERMS.dscCatalog, href: '/dsc/catalog', icon: FileCheck2 },
  { name: UI_TERMS.dscPipeline, href: '/dsc/applications', icon: Clock },
  { name: UI_TERMS.tokenStock, href: '/inventory/tokens', icon: Cpu },
  { name: UI_TERMS.branchStock, href: '/inventory/branches', icon: Building2 },
  { name: UI_TERMS.crmLeads, href: '/crm/leads', icon: Layers, badge: 'Smart' },
  { name: UI_TERMS.crmFollowUps, href: '/crm/follow-ups', icon: Clock },
  { name: UI_TERMS.services, href: '/services', icon: Sparkles },
  { name: UI_TERMS.billingInvoices, href: '/billing/invoices', icon: Receipt },
  { name: UI_TERMS.billingPayments, href: '/billing/payments', icon: CheckCircle2, badge: 'Audit' },
  { name: UI_TERMS.billingLedger, href: '/billing/ledger', icon: Receipt },
  { name: UI_TERMS.billingAccounts, href: '/billing/accounts', icon: Landmark },
  { name: UI_TERMS.courier, href: '/courier', icon: Truck },
  { name: UI_TERMS.users, href: '/admin/users', icon: ShieldCheck, minTier: 1 },
  { name: 'Business Settings', href: '/admin/settings', icon: Building2, minTier: 1 },
]

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [maskPii, setMaskPii] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

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

  // Filter navigation items based on current staff member's hierarchy tier
  const visibleNavItems = mainNavItems.filter((item) => {
    if (item.minTier !== undefined && currentUser) {
      // If item requires tier <= minTier (where 0 is Super Admin, 1 is Partner Admin)
      return currentUser.hierarchy_level_order <= item.minTier
    }
    return true
  })

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
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
            <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/signsync-logo.png"
                alt="SignSync"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                SignSync Portal
              </div>
              <div className="text-[11px] text-slate-400">Office & Partner Workspace</div>
            </div>
          </div>

          {/* Navigation Links with Simple Business Terms */}
          <nav className="p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-190px)]">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Work Sections
            </div>
            {visibleNavItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Staff Info, Privacy Control & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-900/90">
          {/* Privacy Switch */}
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

          {/* Logged in Employee Info & Logout Button */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                {initials}
              </div>
              <div className="text-left overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {currentUser?.full_name || 'Signed In Staff'}
                </div>
                <div className="text-[10px] text-emerald-400 font-medium truncate">
                  {currentUser?.role_name || currentUser?.level_name || 'Active Session'}
                </div>
              </div>
            </div>

            {/* Logout Action Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              disabled={loggingOut}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
