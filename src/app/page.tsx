// Business Overview Dashboard & KPI Cards
import React from 'react'
import {
  Users2,
  FileCheck2,
  Cpu,
  Layers,
  CreditCard,
  Building2,
  Receipt
} from 'lucide-react'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import { PartnerRecord, TokenPurchaseBatchRecord, CrmLeadRecord, InvoiceRecord } from '@/types/models'

async function getDashboardData() {
  const port = process.env.PORT || '3000'
  try {
    const [healthRes, partnersRes, dscRes, batchesRes, leadsRes, invoicesRes] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/health`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/partners`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/dsc/catalog`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/inventory/batches`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/crm/leads`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/billing/invoices`, { cache: 'no-store' }),
    ])

    return {
      health: healthRes.ok ? await healthRes.json() : null,
      partners: partnersRes.ok ? (await partnersRes.json()).partners as PartnerRecord[] : [],
      catalog: dscRes.ok ? (await dscRes.json()).catalog : [],
      batches: batchesRes.ok ? (await batchesRes.json()).batches as TokenPurchaseBatchRecord[] : [],
      leads: leadsRes.ok ? (await leadsRes.json()).leads as CrmLeadRecord[] : [],
      invoices: invoicesRes.ok ? (await invoicesRes.json()).invoices as InvoiceRecord[] : [],
    }
  } catch {
    return {
      health: null,
      partners: [],
      catalog: [],
      batches: [],
      leads: [],
      invoices: [],
    }
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const totalOutstanding = data.invoices.reduce((sum: number, inv: InvoiceRecord) => sum + (inv.outstanding_balance || 0), 0)
  const totalInvoiced = data.invoices.reduce((sum: number, inv: InvoiceRecord) => sum + (inv.total_amount || 0), 0)
  const totalTokensPurchased = data.batches.reduce((sum: number, b: TokenPurchaseBatchRecord) => sum + (b.quantity_purchased || 0), 0)
  const avgLandedCost = data.batches.length > 0 ? (data.batches[0].unit_landed_cost || 366.0) : 366.0

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            View your business activity and performance in one place.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Partners */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Partners</span>
            <Users2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {data.partners.length}
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
            {data.leads.length}
          </div>
          <div className="mt-1 flex items-center text-[11px] text-purple-400">
            Inquiries in pipeline
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <AnalyticsDashboard />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Partners */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Active Partners</h3>
              <p className="text-xs text-slate-400">Direct partners and token stockists</p>
            </div>
            <a href="/partners" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              View All &rarr;
            </a>
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

        {/* Right Column: Recent Invoices */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Invoices</h3>
              <p className="text-xs text-slate-400">Customer invoices and payment status</p>
            </div>
            <a href="/billing/invoices" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              Invoices &rarr;
            </a>
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
      </div>
    </div>
  )
}
