// Invoices (/billing/invoices)
import React from 'react'
import Link from 'next/link'
import { Receipt, Landmark, QrCode, CreditCard, ArrowRight, Plus } from 'lucide-react'

async function getBillingData() {
  const port = process.env.PORT || '3000'
  try {
    const [invRes, accRes, serRes] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/billing/invoices`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/billing/accounts`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/billing/series`, { cache: 'no-store' }),
    ])

    return {
      invoices: invRes.ok ? (await invRes.json()).invoices : [],
      accounts: accRes.ok ? (await accRes.json()).accounts : [],
      series: serRes.ok ? (await serRes.json()).series : [],
    }
  } catch {
    return { invoices: [], accounts: [], series: [] }
  }
}

export default async function BillingInvoicesPage() {
  const { invoices, accounts } = await getBillingData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Invoices</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create and track customer tax invoices and payment statuses.
          </p>
        </div>

        <Link
          href="/billing/invoices/new"
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Create Invoice
        </Link>
      </div>

      {/* Connected Bank Accounts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc: any) => (
          <div key={acc.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">{acc.account_nickname}</span>
              </div>
              <div className="text-xs text-slate-300">{acc.bank_name} &bull; A/C: {acc.account_number}</div>
              <div className="text-[11px] text-slate-400">IFSC: {acc.ifsc_code} &bull; Branch: {acc.branch_name}</div>
              <div className="text-[11px] text-cyan-400 font-mono">UPI ID: {acc.upi_id}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
              <QrCode className="w-8 h-8 text-white mx-auto" />
              <span className="text-[9px] text-slate-400 font-mono mt-1 block">Payment QR</span>
            </div>
          </div>
        ))}
      </div>

      {/* Invoices Register */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Invoice Records & Balance</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Invoice Number</th>
                <th className="p-3">Partner Company</th>
                <th className="p-3">Date</th>
                <th className="p-3">Payment Due</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Total Tax (GST)</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-right font-semibold text-amber-400">Pending Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {invoices.map((inv: any) => {
                const totalGst = (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)
                return (
                  <tr key={inv.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300 font-semibold">{inv.invoice_number}</td>
                    <td className="p-3 font-medium text-white">{inv.partner_company}</td>
                    <td className="p-3 text-slate-400 font-mono">{inv.invoice_date}</td>
                    <td className="p-3 text-slate-400 font-mono">{inv.due_date}</td>
                    <td className="p-3 text-right text-slate-300">₹{inv.subtotal?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-slate-400">₹{totalGst.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-white">₹{inv.total_amount?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-amber-400">
                      ₹{inv.outstanding_balance?.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      }`}>
                        {inv.status === 'paid' ? 'Paid in Full' : 'Payment Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
