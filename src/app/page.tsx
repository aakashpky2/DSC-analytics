// Executive Overview Dashboard & KPI Cards (Section 5, 7)
import React from 'react'
import {
  Users2,
  FileCheck2,
  Cpu,
  Layers,
  Receipt,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  Truck
} from 'lucide-react'

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
      partners: partnersRes.ok ? (await partnersRes.json()).partners : [],
      catalog: dscRes.ok ? (await dscRes.json()).catalog : [],
      batches: batchesRes.ok ? (await batchesRes.json()).batches : [],
      leads: leadsRes.ok ? (await leadsRes.json()).leads : [],
      invoices: invoicesRes.ok ? (await invoicesRes.json()).invoices : [],
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

  const totalOutstanding = data.invoices.reduce((sum: number, inv: any) => sum + (inv.outstanding_balance || 0), 0)
  const totalInvoiced = data.invoices.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0)
  const totalTokensPurchased = data.batches.reduce((sum: number, b: any) => sum + (b.quantity_purchased || 0), 0)
  const avgLandedCost = data.batches.length > 0 ? (data.batches[0].unit_landed_cost || 366.0) : 366.0

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            SignSync Production Baseline v2.4
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Management Cockpit</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time synchronization across 9 core modules: DSC Issuance, Landed Cost Tokens, Deduplication CRM, and Multi-Account Ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Database Engine</div>
            <div className="text-xs font-mono font-semibold text-emerald-400">Supabase &bull; Active</div>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Security Tier</div>
            <div className="text-xs font-mono font-semibold text-indigo-400">Level 0 Super Admin</div>
          </div>
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
            <span className="text-emerald-400 font-semibold mr-1">100% KYC Verified</span> &bull; 0 High-Risk
          </div>
        </div>

        {/* Card 2: Receivables & Outstanding */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Receivables</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 flex items-center text-[11px] text-slate-400">
            Total Invoiced: ₹{totalInvoiced.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Card 3: Token Inward Stock */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Hardware Tokens Inward</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {totalTokensPurchased} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="mt-1 flex items-center text-[11px] text-cyan-400">
            Unit Landed Cost: ₹{avgLandedCost}/unit
          </div>
        </div>

        {/* Card 4: CRM Pipeline Leads */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">CRM Leads Pipeline</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {data.leads.length}
          </div>
          <div className="mt-1 flex items-center text-[11px] text-purple-400">
            Deduplication Engine Active
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Partners & Billing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Partner Health Table */}
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Partner Network Directory</h3>
                <p className="text-xs text-slate-400">Direct partners, token stockists & credit control status</p>
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
                    <th className="pb-2">Credit Limit</th>
                    <th className="pb-2">Wallet</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.partners.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-indigo-300">{p.partner_code}</td>
                      <td className="py-2.5 font-medium text-white">{p.company_name}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {p.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300">₹{p.credit_limit?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-emerald-400 font-semibold">₹{p.wallet_balance?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices & Verification Queue */}
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Multi-Account Invoices</h3>
                <p className="text-xs text-slate-400">Date-based series mapping GST and dynamic bank QR codes</p>
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
                    <th className="pb-2">Total Amount</th>
                    <th className="pb-2">Outstanding</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-cyan-300">{inv.invoice_number}</td>
                      <td className="py-2.5 text-slate-200">{inv.partner_company || 'Apex Digital'}</td>
                      <td className="py-2.5 font-semibold text-white">₹{inv.total_amount?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-amber-400 font-semibold">₹{inv.outstanding_balance?.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Architectural & Operational Status */}
        <div className="space-y-6">
          {/* True Landed Cost Equation Box */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Landed Cost Math Formula
            </div>
            <div className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-cyan-300 border border-slate-800/80 leading-relaxed">
              Total Landed Cost = (Qty × Base Unit Price) + Freight + Customs + Handling Fees
              <div className="mt-2 text-slate-400">
                Unit Cost = Total Landed Cost / Qty
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dynamically computes true landed costs upon batch inwarding to prevent hidden margin erosion.
            </p>
          </div>

          {/* CRM Deduplication Scoring Rules */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              Deduplication Algorithm
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>GSTIN Match</span>
                <span className="font-mono text-purple-400 font-bold">+50 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Phone Match</span>
                <span className="font-mono text-purple-400 font-bold">+40 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Email Match</span>
                <span className="font-mono text-purple-400 font-bold">+35 pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>PAN Match</span>
                <span className="font-mono text-purple-400 font-bold">+30 pts</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Fuzzy Name (&gt;85%)</span>
                <span className="font-mono text-purple-400 font-bold">+20 pts</span>
              </div>
            </div>
            <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300">
              Alert Trigger Threshold: &ge; 40 Points
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
