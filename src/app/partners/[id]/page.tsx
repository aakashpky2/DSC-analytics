// Module 02: Partner 360 View (/partners/[id])
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CreditCard, Wallet, FileText, CheckCircle2 } from 'lucide-react'

async function getPartnerDetails(id: string) {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/partners/${id}?mask=true`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPartnerDetails(id)

  if (!data || !data.partner) {
    return (
      <div className="p-8 text-center text-slate-400">
        Partner not found.{' '}
        <Link href="/partners" className="text-indigo-400 underline">
          Back to Directory
        </Link>
      </div>
    )
  }

  const { partner, orders, invoices, ledger } = data

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/partners" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Partners
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{partner.company_name}</span>
      </div>

      {/* Partner Overview Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{partner.company_name}</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {partner.partner_code}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1">
            <div>Contact: {partner.contact_person} &bull; {partner.phone} &bull; {partner.email}</div>
            <div>GSTIN: {partner.gstin} &bull; State: {partner.state_code} &bull; PAN: {partner.pan}</div>
            <div>Billing: {partner.billing_address}</div>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-xs text-slate-400">Wallet Balance</div>
            <div className="text-xl font-bold text-emerald-400">₹{partner.wallet_balance?.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Credit Limit</div>
            <div className="text-xl font-bold text-indigo-400">₹{partner.credit_limit?.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500">Net-{partner.credit_period_days} Days</div>
          </div>
        </div>
      </div>

      {/* Tabbed Content Sections: Financial Ledger & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Financial Ledger */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Financial Statement & Ledger</h3>
            <span className="text-xs text-slate-400">Real-time debit/credit entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Debit</th>
                  <th className="pb-2 text-right">Credit</th>
                  <th className="pb-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ledger.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-2 text-slate-400 font-mono">{item.entry_date}</td>
                    <td className="py-2 text-slate-300 capitalize">{item.transaction_type.replace('_', ' ')}</td>
                    <td className="py-2 text-right text-red-400">₹{item.debit?.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right text-emerald-400">₹{item.credit?.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right font-semibold text-white">₹{item.running_balance?.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Invoices */}
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Associated Billing Invoices</h3>
            <span className="text-xs text-slate-400">GST Tax & Non-GST Bills</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2">Invoice #</th>
                  <th className="pb-2">Due Date</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Outstanding</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="py-2 font-mono text-cyan-300">{inv.invoice_number}</td>
                    <td className="py-2 text-slate-400 font-mono">{inv.due_date}</td>
                    <td className="py-2 text-right font-medium text-white">₹{inv.total_amount?.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right text-amber-400 font-semibold">₹{inv.outstanding_balance?.toLocaleString('en-IN')}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
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
    </div>
  )
}

