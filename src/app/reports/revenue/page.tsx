'use client'

import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  DollarSign,
  FileCheck2,
  Users,
  ShieldCheck,
  Building2,
  Layers,
  Calendar,
  Filter,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Clock,
  Briefcase,
  AlertCircle,
  RefreshCw,
  PieChart,
} from 'lucide-react'

export default function UnifiedRevenueDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  // Filters
  const [period, setPeriod] = useState<string>('current_month')
  const [companyProfileId, setCompanyProfileId] = useState<string>('ALL')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [groupBy, setGroupBy] = useState<string>('month')

  // Drilldown modal
  const [drilldownModal, setDrilldownModal] = useState<boolean>(false)
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false)
  const [drilldownTitle, setDrilldownTitle] = useState<string>('')
  const [drilldownRecords, setDrilldownRecords] = useState<any[]>([])
  const [drilldownTotal, setDrilldownTotal] = useState<number>(0)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('period', period)
      params.append('company_profile_id', companyProfileId)
      params.append('group_by', groupBy)
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)

      const res = await fetch(`/api/reports/revenue?${params.toString()}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to load revenue dashboard`)
      }
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [period, companyProfileId, groupBy])

  const openDrilldown = async (title: string, queryParams: Record<string, string>) => {
    try {
      setDrilldownTitle(title)
      setDrilldownModal(true)
      setDrilldownLoading(true)
      const q = new URLSearchParams()
      q.append('company_profile_id', companyProfileId)
      if (fromDate) q.append('from_date', fromDate)
      if (toDate) q.append('to_date', toDate)
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v) q.append(k, v)
      })

      const res = await fetch(`/api/reports/revenue/drilldown?${q.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to load transaction details')
      }
      const json = await res.json()
      setDrilldownRecords(json.records || [])
      setDrilldownTotal(json.total || 0)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setDrilldownLoading(false)
    }
  }

  const formatCurrency = (val: number | undefined) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0)
  }

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm font-medium text-slate-400">Loading Unified Revenue Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-6 text-center text-red-300 shadow-sm">
          <AlertCircle className="mx-auto mb-2 h-10 w-10 text-red-400" />
          <h2 className="text-lg font-bold text-white">Access Restricted or Error Occurred</h2>
          <p className="mt-1 text-sm text-red-300">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-700"
          >
            Retry Request
          </button>
        </div>
      </div>
    )
  }

  const kpis = data?.kpis || {}
  const profiles = data?.accessibleProfiles || []

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* 1. HEADER & UNIFIED CONTROLS ROW */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Unified Revenue Dashboard</h1>
            <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              Executive View
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Consolidated revenue, commission margins, and operational pipeline across all authorized profiles.
          </p>
        </div>

        {/* Right side controls: Profile, Period, and Refresh on the same row with consistent 42px height */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* PROFILE SELECTOR */}
          <div className="relative flex h-[42px] items-center rounded-xl border border-slate-800 bg-slate-950 px-3 transition hover:border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
            <Building2 className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={companyProfileId}
              onChange={(e) => setCompanyProfileId(e.target.value)}
              className="h-full bg-transparent pr-2 text-xs font-medium text-slate-200 focus:outline-none"
            >
              <option className="bg-slate-950 text-white" value="ALL">All Accessible Profiles ({profiles.length})</option>
              {profiles.map((p: any) => (
                <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                  {p.legal_name}
                </option>
              ))}
            </select>
          </div>

          {/* DATE RANGE SELECTOR */}
          <div className="relative flex h-[42px] items-center rounded-xl border border-slate-800 bg-slate-950 px-3 transition hover:border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
            <Calendar className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value)
                setFromDate('')
                setToDate('')
              }}
              className="h-full bg-transparent pr-2 text-xs font-medium text-slate-200 focus:outline-none"
            >
              <option className="bg-slate-950 text-white" value="today">Today</option>
              <option className="bg-slate-950 text-white" value="this_week">This Week</option>
              <option className="bg-slate-950 text-white" value="current_month">This Month</option>
              <option className="bg-slate-950 text-white" value="last_month">Last Month</option>
              <option className="bg-slate-950 text-white" value="current_fy">Current Financial Year (1 Apr - 31 Mar)</option>
              <option className="bg-slate-950 text-white" value="prev_fy">Previous Financial Year</option>
            </select>
          </div>

          {/* REFRESH BUTTON */}
          <button
            onClick={() => fetchDashboardData()}
            className="flex h-[42px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 2. STANDARDIZED KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Gross Revenue */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm transition hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gross Sales Revenue</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-white">{formatCurrency(kpis.total_gross_revenue)}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-800/80 pt-2.5">
            <p className="text-xs text-slate-400">
              Base: <span className="font-semibold text-slate-300">{formatCurrency(kpis.total_base_revenue)}</span> + GST: <span className="font-semibold text-slate-300">{formatCurrency(kpis.total_gst)}</span>
            </p>
          </div>
        </div>

        {/* 2. Net Retained Revenue */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm transition hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Retained Revenue</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-emerald-400">{formatCurrency(kpis.net_retained_revenue)}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-800/80 pt-2.5">
            <p className="text-xs text-slate-400">
              Margin after provider payouts & partner commissions
            </p>
          </div>
        </div>

        {/* 3. Total DSC Issued */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm transition hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">DSC Certificates Issued</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
                <FileCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black tracking-tight text-white">{kpis.total_certificates_issued || 0}</span>
              <span className="text-xs font-semibold text-indigo-400">
                Avg Base: {formatCurrency(kpis.average_revenue_per_cert)}
              </span>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-800/80 pt-2.5">
            <p className="text-xs text-slate-400">
              Avg Selling Price: <span className="font-semibold text-slate-300">{formatCurrency(kpis.average_selling_price)}</span>
            </p>
          </div>
        </div>

        {/* 4. Total Commissions Paid */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm transition hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Partner & Associate Comm.</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tracking-tight text-amber-400">{formatCurrency(kpis.total_commissions)}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-slate-800/80 pt-2.5">
            <p className="text-xs text-slate-400">
              Associate: <span className="font-semibold text-slate-300">{formatCurrency(kpis.total_associate_commissions)}</span> | Normal: <span className="font-semibold text-slate-300">{formatCurrency(kpis.total_normal_partner_commissions)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. APPLICATION LIFECYCLE PIPELINE */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
        <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-bold text-white">DSC Application Lifecycle Pipeline</h2>
            <p className="text-xs text-slate-400">
              Active pending applications vs finalized certificates in selected timeframe.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400">
              Active: {kpis.active_applications_count || 0}
            </span>
            <span className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              Issued / Completed: {kpis.completed_applications_count || 0}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {(data?.pipelineStages || []).map((stg: any) => (
            <div
              key={stg.key}
              onClick={() => openDrilldown(`Pipeline: ${stg.name}`, { source_type: 'DIRECT' })}
              className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-950 p-3 text-center transition hover:border-indigo-500/40 hover:bg-slate-900"
            >
              <div className="flex min-h-[32px] items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 leading-tight">
                  {stg.name}
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-white group-hover:text-indigo-400 transition-colors">
                {stg.count}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. REVENUE PERFORMANCE TREND */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-bold text-white">Revenue Performance Trend</h2>
            <p className="text-xs text-slate-400">Timeline breakdown of gross sales, net margins, and certificates.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              onClick={() => setGroupBy('month')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                groupBy === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setGroupBy('day')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                groupBy === 'day' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setGroupBy('fy')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                groupBy === 'fy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Financial Year
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-center">Certificates</th>
                <th className="px-4 py-3 text-right">Gross Revenue</th>
                <th className="px-4 py-3 text-right">Net Retained Margin</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(data?.revenueTrend || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No revenue data available for the selected period.
                  </td>
                </tr>
              ) : (
                (data?.revenueTrend || []).map((t: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{t.label}</td>
                    <td className="px-4 py-3 text-center font-medium text-slate-300">{t.certificates}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(t.gross_revenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(t.net_revenue)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDrilldown(`Transactions for ${t.label}`, {})}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
                      >
                        Drill-down <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 2-COLUMN BREAKDOWNS: PRODUCTS & PROVIDERS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PRODUCT BREAKDOWN */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white">DSC Product Breakdown</h2>
              <p className="text-xs text-slate-400">Revenue and volume grouped by DSC certificate product.</p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Product</th>
                  <th className="px-3.5 py-3 text-center">Qty</th>
                  <th className="px-3.5 py-3 text-right">Gross Rev</th>
                  <th className="px-3.5 py-3 text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(data?.productBreakdown || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                      No product sales recorded in this period.
                    </td>
                  </tr>
                ) : (
                  (data?.productBreakdown || []).map((p: any) => (
                    <tr
                      key={p.product_id}
                      onClick={() => openDrilldown(`Product: ${p.product_name}`, { product_id: p.product_id })}
                      className="cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-white">{p.product_name}</td>
                      <td className="px-3.5 py-2.5 text-center">{p.quantity}</td>
                      <td className="px-3.5 py-2.5 text-right font-medium">{formatCurrency(p.gross_revenue)}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400">{formatCurrency(p.net_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROVIDER / CA BREAKDOWN */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white">Certifying Authority (Provider) Breakdown</h2>
              <p className="text-xs text-slate-400">Performance grouped by CA provider (eMudhra, Capricorn, etc.).</p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Provider</th>
                  <th className="px-3.5 py-3 text-center">Certs</th>
                  <th className="px-3.5 py-3 text-right">Payout</th>
                  <th className="px-3.5 py-3 text-right">Net Retained</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(data?.providerBreakdown || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                      No provider transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  (data?.providerBreakdown || []).map((pr: any) => (
                    <tr
                      key={pr.company_id}
                      onClick={() => openDrilldown(`Provider: ${pr.company_name}`, { provider_id: pr.company_id })}
                      className="cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-white">{pr.company_name}</td>
                      <td className="px-3.5 py-2.5 text-center">{pr.certificates}</td>
                      <td className="px-3.5 py-2.5 text-right text-rose-400">{formatCurrency(pr.provider_payout)}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400">{formatCurrency(pr.net_revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. 2-COLUMN BREAKDOWNS: ASSOCIATE PARTNERS & TOP CUSTOMERS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ASSOCIATE PARTNERS BREAKDOWN */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Associate Partners Performance</h2>
                <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                  Fulfillment Layer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Differentiating B2B Reselling revenue vs Commission-model partner payouts.
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Associate Partner</th>
                  <th className="px-3.5 py-3 text-center">Certs</th>
                  <th className="px-3.5 py-3 text-right">B2B Sales</th>
                  <th className="px-3.5 py-3 text-right">Comm. Paid</th>
                  <th className="px-3.5 py-3 text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(data?.associatePartnerBreakdown || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      No associate partner transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  (data?.associatePartnerBreakdown || []).map((ap: any) => (
                    <tr
                      key={ap.associate_partner_id}
                      onClick={() =>
                        openDrilldown(`Associate Partner: ${ap.associate_partner_name}`, {
                          partner_id: ap.associate_partner_id,
                        })
                      }
                      className="cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-white">{ap.associate_partner_name}</td>
                      <td className="px-3.5 py-2.5 text-center">{ap.certificates}</td>
                      <td className="px-3.5 py-2.5 text-right">{formatCurrency(ap.b2b_reselling_revenue)}</td>
                      <td className="px-3.5 py-2.5 text-right text-amber-400">{formatCurrency(ap.commission_paid)}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400">
                        {formatCurrency(ap.net_retained_revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOP CLIENTS / CUSTOMERS */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white">Top Customers by Revenue</h2>
              <p className="text-xs text-slate-400">Highest grossing client accounts within authorized scope.</p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3.5 py-3">Customer</th>
                  <th className="px-3.5 py-3 text-center">State</th>
                  <th className="px-3.5 py-3 text-center">Certs</th>
                  <th className="px-3.5 py-3 text-right">Total Revenue</th>
                  <th className="px-3.5 py-3 text-right">Avg Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(data?.topCustomers || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      No client accounts found.
                    </td>
                  </tr>
                ) : (
                  (data?.topCustomers || []).map((c: any) => (
                    <tr
                      key={c.customer_id}
                      onClick={() => openDrilldown(`Customer: ${c.customer_name}`, { customer_id: c.customer_id })}
                      className="cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-white">{c.customer_name}</td>
                      <td className="px-3.5 py-2.5 text-center text-xs text-slate-400">{c.state_code || '—'}</td>
                      <td className="px-3.5 py-2.5 text-center">{c.certificates}</td>
                      <td className="px-3.5 py-2.5 text-right font-medium">{formatCurrency(c.revenue)}</td>
                      <td className="px-3.5 py-2.5 text-right text-xs text-slate-400">{formatCurrency(c.average_value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. DRILLDOWN MODAL */}
      {drilldownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-white">{drilldownTitle}</h3>
                <p className="text-xs text-slate-400">Underlying transaction records ({drilldownTotal} total)</p>
              </div>
              <button
                onClick={() => setDrilldownModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              {drilldownLoading ? (
                <div className="flex h-36 items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
              ) : drilldownRecords.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No underlying records found.</p>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5">Ref #</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5 text-center">Qty</th>
                      <th className="px-3 py-2.5 text-right">Gross Total</th>
                      <th className="px-3 py-2.5 text-right">Commission</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {drilldownRecords.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-white">{r.reference_number}</td>
                        <td className="px-3 py-2.5 text-slate-400">{r.date}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              r.source_type === 'DIRECT_ISSUANCE'
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {r.source_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">{r.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-white">
                          {formatCurrency(r.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-amber-400">
                          {formatCurrency(r.commission_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 bg-slate-950/80 px-6 py-3">
              <button
                onClick={() => setDrilldownModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
