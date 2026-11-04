'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  LogOut,
  BellRing
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
  tier?: string
}

const navItems: NavItem[] = [
  { name: 'Executive Overview', href: '/', icon: LayoutDashboard },
  { name: 'User Admin & RBAC', href: '/admin/users', icon: ShieldCheck, tier: 'L0-L2' },
  { name: 'Partner Network', href: '/partners', icon: Users2 },
  { name: 'DSC Catalog & Pipeline', href: '/dsc/catalog', icon: FileCheck2 },
  { name: 'Token Landed Cost', href: '/inventory/tokens', icon: Cpu },
  { name: 'CRM & Deduplication', href: '/crm/leads', icon: Layers, badge: 'Smart' },
  { name: 'Business Services', href: '/services', icon: Sparkles },
  { name: 'Billing & Ledger', href: '/billing/invoices', icon: Receipt },
  { name: 'Courier & POD', href: '/courier', icon: Truck },
]

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [maskPii, setMaskPii] = useState(true)

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      {/* Persistent Enterprise Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              SS
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                SignSync B2B
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  v2.4
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Enterprise Platform</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Core Modules
            </div>
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                  {item.tier && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.tier}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom User & PII Masking Bar */}
        <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-900/80">
          {/* PII Masking Control */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              {maskPii ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[11px] font-medium">Field PII Masking</span>
            </div>
            <button
              onClick={() => setMaskPii(!maskPii)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition ${
                maskPii
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {maskPii ? 'Active' : 'Unmasked'}
            </button>
          </div>

          {/* User Profile Summary */}
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400">
                SA
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">Master Admin</div>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Level 0 Root
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>SignSync Enterprise</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-200 font-medium">B2B Core System</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Hostinger VPS Ready
            </div>
          </div>
        </header>

        {/* Routed Pages */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}

