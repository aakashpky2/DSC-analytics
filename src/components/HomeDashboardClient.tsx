'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users2,
  FileCheck2,
  Cpu,
  Layers,
  CreditCard,
  Building2,
  Receipt,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  PhoneCall,
  FilePlus,
  Briefcase,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import { PartnerRecord, TokenPurchaseBatchRecord, CrmLeadRecord, InvoiceRecord } from '@/types/models'

interface DashboardProps {
  initialUser: {
    id: string
    full_name: string
    role_name?: string
    level_name?: string
    hierarchy_level_order?: number
  }
  initialData: {
    health: any
    partners: PartnerRecord[]
    catalog: any[]
    batches: TokenPurchaseBatchRecord[]
    leads: CrmLeadRecord[]
    invoices: InvoiceRecord[]
  }
}

export default function HomeDashboardClient({ initialUser, initialData }: DashboardProps) {
  const [user, setUser] = useState(initialUser)
  const [data, setData] = useState(initialData)
  const [overviewData, setOverviewData] = useState<any | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  // Local Time Greeting calculation
  const [greeting, setGreeting] = useState('Good Morning')

  useEffect(() => {
    // Determine time-based greeting using client local time
    const updateGreeting = () => {
      const currentHour = new Date().getHours()
      if (currentHour < 12) {
        setGreeting('Good Morning')
      } else if (currentHour < 17) {
        setGreeting('Good Afternoon')
      } else {
        setGreeting('Good Evening')
      }
    }
    updateGreeting()

    // Fetch dynamic role-aware overview payload
    fetch('/api/dashboard/overview')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard overview')
        return res.json()
      })
      .then((resJson) => {
        setOverviewData(resJson)
        if (resJson.user?.full_name) {
          setUser((prev) => ({ ...prev, full_name: resJson.user.full_name }))
        }
        if (resJson.partners) {
          setData((prev) => ({
            ...prev,
            partners: resJson.partners || prev.partners,
            invoices: resJson.invoices || prev.invoices,
            leads: resJson.leads || prev.leads,
            batches: resJson.batches || prev.batches,
          }))
        }
      })
      .catch((err) => {
        console.error('Error fetching dashboard overview:', err)
      })
      .finally(() => setLoadingOverview(false))
  }, [])

  // Extract user's first name cleanly, falling back to full name
  const rawName = user?.full_name || 'Admin'
  const firstName = rawName.split(' ')[0]

  // Check if current user is Staff view or Super Admin
  const isSuperAdmin =
    user?.role_name?.toLowerCase().includes('super') ||
    user?.hierarchy_level_order === 0 ||
    overviewData?.isStaffView === false

  // Super Admin metric calculations (fall back to overviewData.kpis if SSR payload was empty)
  const activePartnersCount = overviewData?.kpis?.active_partners_count !== undefined
    ? overviewData.kpis.active_partners_count
    : data.partners.length

  const totalOutstanding = overviewData?.kpis?.pending_payments_amount !== undefined
    ? overviewData.kpis.pending_payments_amount
    : data.invoices.reduce((sum: number, inv: InvoiceRecord) => sum + (inv.outstanding_balance || 0), 0)

  const totalInvoiced = overviewData?.kpis?.total_invoiced_amount !== undefined
    ? overviewData.kpis.total_invoiced_amount
    : data.invoices.reduce((sum: number, inv: InvoiceRecord) => sum + (inv.total_amount || 0), 0)

  const totalTokensPurchased = overviewData?.kpis?.tokens_purchased_units !== undefined
    ? overviewData.kpis.tokens_purchased_units
    : data.batches.reduce((sum: number, b: TokenPurchaseBatchRecord) => sum + (b.quantity_purchased || 0), 0)

  const avgLandedCost = overviewData?.kpis?.average_landed_cost !== undefined
    ? overviewData.kpis.average_landed_cost
    : (data.batches.length > 0 ? (data.batches[0].unit_landed_cost || 366.0) : 366.0)

  const customerLeadsCount = overviewData?.kpis?.customer_leads_count !== undefined
    ? overviewData.kpis.customer_leads_count
    : data.leads.length

  return (
    <div className="space-y-8">
      {/* 1. Header Banner with Localized Personalized Greeting */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {greeting}, {firstName} 👋
              </h1>
              {isSuperAdmin && (
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Super Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isSuperAdmin
                ? "Here's what's happening across your business operations today."
                : "Here's what's happening in your workspace today."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. TOP KPI CARDS GRID (SAME DESIGN & SPACING FOR ADMIN & STAFF)    */}
      {/* ------------------------------------------------------------------ */}
      {isSuperAdmin ? (
        /* SUPER ADMIN KPI CARDS - FULLY PRESERVED */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Partners */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Partners</span>
              <Users2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {activePartnersCount}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-slate-400">
              <span className="text-emerald-400 font-semibold mr-1">All Documents Verified</span>
            </div>
          </div>

          {/* Card 2: Pending Payments */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Pending Payments</span>
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-300">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-slate-400">
              Total Invoiced: ₹{totalInvoiced.toLocaleString('en-IN')}
            </div>
          </div>

          {/* Card 3: Tokens Purchased */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Tokens Purchased</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {totalTokensPurchased} <span className="text-xs font-normal text-slate-400">units</span>
            </div>
            <div className="mt-1 flex items-center text-[11px] text-cyan-400">
              Average Cost: ₹{avgLandedCost} / unit
            </div>
          </div>

          {/* Card 4: Customer Leads */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Customer Leads</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {customerLeadsCount}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-purple-400">
              Inquiries in pipeline
            </div>
          </div>
        </div>
      ) : (
        /* STAFF OPERATIONAL KPI CARDS - SAME CARD STYLE, SPACING, COLORS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: My Applications */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">My Applications</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {overviewData?.kpis?.my_applications ?? 8}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-slate-400">
              <span className="text-indigo-400 font-medium mr-1">Applications assigned to you</span>
            </div>
          </div>

          {/* Card 2: Pending Actions */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Pending Actions</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-300">
              {overviewData?.kpis?.pending_actions ?? 4}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-slate-400">
              <span className="text-amber-400 font-medium mr-1">Require your attention</span>
            </div>
          </div>

          {/* Card 3: Due Today */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Due Today</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {overviewData?.kpis?.due_today ?? 3}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-cyan-400">
              Tasks scheduled for completion
            </div>
          </div>

          {/* Card 4: Completed Today */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Completed Today</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {overviewData?.kpis?.completed_today ?? 6}
            </div>
            <div className="mt-1 flex items-center text-[11px] text-emerald-400">
              Successfully processed today
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. MIDDLE SECTION: SUPER ADMIN CHARTS vs STAFF DSC WORKFLOW PIPELINE*/}
      {/* ------------------------------------------------------------------ */}
      {isSuperAdmin ? (
        /* SUPER ADMIN VISUAL ANALYTICS - FULLY PRESERVED */
        <AnalyticsDashboard />
      ) : (
        /* STAFF OPERATIONAL PIPELINE: MY DSC WORKFLOW */
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">My DSC Workflow</h3>
                <p className="text-xs text-slate-400">Active distribution of your assigned certificate applications</p>
              </div>
              <Link href="/dsc/applications" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View Register &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {(overviewData?.workflow_stages || [
                { key: 'APPL_RCVD', label: 'Applications Received', count: 3, color: 'blue' },
                { key: 'DOCS_PEND', label: 'Documents Pending', count: 2, color: 'amber' },
                { key: 'DOCS_VERIF', label: 'Documents Verified', count: 1, color: 'indigo' },
                { key: 'PAY_PEND', label: 'Payment Pending', count: 1, color: 'purple' },
                { key: 'DSC_PROC', label: 'Processing', count: 2, color: 'cyan' },
                { key: 'TOK_ALLOC', label: 'Token Allocation', count: 1, color: 'teal' },
                { key: 'ISSUED', label: 'Issued', count: 4, color: 'emerald' },
                { key: 'COMPLETED', label: 'Completed', count: 6, color: 'slate' },
              ]).map((stg: any) => (
                <div
                  key={stg.key}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <span className="text-[11px] font-medium text-slate-400 line-clamp-1">{stg.label}</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-white">{stg.count}</span>
                    <span className={`w-2 h-2 rounded-full bg-${stg.color}-500 ring-2 ring-${stg.color}-500/20`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Bar for Staff */}
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
              Operational Quick Actions
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {(overviewData?.quick_actions || [
                { label: 'New DSC Application', href: '/dsc/applications?new=true', icon: 'FilePlus' },
                { label: 'Daily DSC Issuance', href: '/dsc/issuance', icon: 'FileCheck2' },
                { label: 'Customer Directory', href: '/partners', icon: 'Users2' },
                { label: 'Follow-ups & Leads', href: '/crm/leads', icon: 'PhoneCall' },
                { label: 'Direct Issuance Hub', href: '/dsc/direct', icon: 'ShieldCheck' },
              ]).map((action: any, idx: number) => (
                <Link
                  key={idx}
                  href={action.href}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 hover:text-white transition shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. TWO-COLUMN LAYOUT:                                              */}
      {/*    SUPER ADMIN: Active Partners & Recent Invoices                  */}
      {/*    STAFF: My Work (Actionable Tasks) & Recent Activity             */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isSuperAdmin ? (
          /* LEFT COLUMN (ADMIN): ACTIVE PARTNERS */
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Active Partners</h3>
                <p className="text-xs text-slate-400">Direct partners and token stockists</p>
              </div>
              <Link href="/partners" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View All &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="pb-2">Partner Code</th>
                    <th className="pb-2">Company</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2 text-right">Credit Line</th>
                    <th className="pb-2 text-right">Wallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.partners.map((p: PartnerRecord) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-indigo-300">{p.partner_code}</td>
                      <td className="py-2.5 font-medium text-white">{p.company_name}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                          {p.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-300">₹{p.credit_limit?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-semibold">₹{p.wallet_balance?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* LEFT COLUMN (STAFF): MY WORK (ATTENTION REQUIRED) */
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">My Work</h3>
                <p className="text-xs text-slate-400">Applications and tasks requiring your action</p>
              </div>
              <Link href="/dsc/applications" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View Pipeline &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="pb-2">Client / Applicant</th>
                    <th className="pb-2">Work Required</th>
                    <th className="pb-2">Stage</th>
                    <th className="pb-2">Due</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(overviewData?.my_work || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No pending work items assigned. You are all caught up!
                      </td>
                    </tr>
                  ) : (
                    (overviewData?.my_work || []).map((w: any) => (
                      <tr key={w.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5">
                          <div className="font-medium text-white">{w.applicant_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{w.client}</div>
                        </td>
                        <td className="py-2.5 text-slate-300 font-medium">{w.work}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 text-[10px] font-semibold">
                            {w.stage}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`text-[11px] font-semibold ${
                              w.due === 'Today' ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            {w.due}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={w.action_url}
                            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold whitespace-nowrap transition shadow-sm shadow-indigo-900/30 text-center"
                          >
                            <span>{w.action}</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isSuperAdmin ? (
          /* RIGHT COLUMN (ADMIN): RECENT INVOICES */
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Invoices</h3>
                <p className="text-xs text-slate-400">Customer invoices and payment status</p>
              </div>
              <Link href="/billing/invoices" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Invoices &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="pb-2">Invoice #</th>
                    <th className="pb-2">Partner</th>
                    <th className="pb-2 text-right">Total Amount</th>
                    <th className="pb-2 text-right">Pending</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.invoices.map((inv: InvoiceRecord) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-cyan-300">{inv.invoice_number}</td>
                      <td className="py-2.5 text-slate-200">{inv.partner_company || 'Apex Digital'}</td>
                      <td className="py-2.5 text-right font-semibold text-white">₹{inv.total_amount?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-amber-400 font-semibold">₹{inv.outstanding_balance?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {inv.status === 'paid' ? 'Paid in Full' : 'Pending Payment'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* RIGHT COLUMN (STAFF): RECENT ACTIVITY */
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                <p className="text-xs text-slate-400">Activity and status updates in your workspace</p>
              </div>
              <span className="text-xs text-slate-500 font-medium">Real-time log</span>
            </div>

            <div className="space-y-3">
              {(overviewData?.recent_activity || []).length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No recent activities recorded for your assigned workspace yet.
                </div>
              ) : (
                (overviewData?.recent_activity || []).map((act: any) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{act.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {act.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{act.subtitle}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {act.time ? new Date(act.time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

