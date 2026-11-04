// Module 08: Receivables Aging & Partner Statements (/billing/ledger)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar, AlertTriangle, Send } from 'lucide-react'
import { FinancialLedgerRecord, PartnerRecord } from '@/types/models'

async function getLedgerData() {
  const port = process.env.PORT || '3000'
  try {
    const [partnersRes, invoicesRes] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/partners?mask=true`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/billing/invoices`, { cache: 'no-store' }),
    ])

    return {
      partners: partnersRes.ok ? (await partnersRes.json()).partners : [],
      invoices: invoicesRes.ok ? (await invoicesRes.json()).invoices : [],
    }
  } catch {
    return { partners: [], invoices: [] }
  }
}

export default async function LedgerAgingPage() {
  const { partners, invoices } = await getLedgerData()

  // Receivables Aging Calculation (0-30, 31-60, 61-90, 90+ Days)
  let bucket0to30 = 0
  let bucket31to60 = 0
  let bucket61to90 = 0
  let bucket90Plus = 0

  invoices.forEach((inv: any) => {
    const outstanding = inv.outstanding_balance || 0
    if (outstanding <= 0) return

    const dueDate = new Date(inv.due_date).getTime()
    const now = new Date().getTime()
    const diffDays = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)))

    if (diffDays <= 30) bucket0to30 += outstanding
    else if (diffDays <= 60) bucket31to60 += outstanding
    else if (diffDays <= 90) bucket61to90 += outstanding
    else bucket90Plus += outstanding
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/billing/invoices" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Billing Invoices
            </Link>
            <span>/</span>
            <span className="text-white">Receivables Aging & Ledger</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Receivables Aging Analysis & Partner Ledgers</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Module 08
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Overdue bucket analysis (0-30, 31-60, 61-90, 90+ days) with automated WhatsApp & Email payment reminders.
          </p>
        </div>
      </div>

      {/* Aging Analysis Buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Current / 0-30 Days</div>
          <div className="text-2xl font-bold text-white mt-1">₹{bucket0to30.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">Within standard credit terms</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">31-60 Days Overdue</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">₹{bucket31to60.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">First reminder notice issued</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-orange-500/30">
          <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">61-90 Days Overdue</div>
          <div className="text-2xl font-bold text-orange-300 mt-1">₹{bucket61to90.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">Escalated payment follow-up</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-500/30">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">90+ Days Critical</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">₹{bucket90Plus.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-rose-400 mt-1">Credit hold automatically applied</div>
        </div>
      </div>

      {/* Partner Ledger Summaries */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Partner Credit Limits & Running Balances</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Partner Code</th>
                <th className="p-3">Company Name</th>
                <th className="p-3">Credit Term</th>
                <th className="p-3 text-right">Credit Line</th>
                <th className="p-3 text-right">Wallet Balance</th>
                <th className="p-3 text-right font-semibold text-amber-400">Ledger Outstanding</th>
                <th className="p-3 text-center">Reminders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {partners.map((p: any) => {
                const partnerInvoices = invoices.filter((inv: any) => inv.partner_id === p.id)
                const outstanding = partnerInvoices.reduce((sum: number, inv: any) => sum + (inv.outstanding_balance || 0), 0)

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-indigo-400 font-semibold">{p.partner_code}</td>
                    <td className="p-3 font-medium text-white">{p.company_name}</td>
                    <td className="p-3 text-slate-400">Net-{p.credit_period_days} Days</td>
                    <td className="p-3 text-right text-slate-300">₹{p.credit_limit?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right text-emerald-400 font-semibold">₹{p.wallet_balance?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-amber-400">
                      ₹{outstanding.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium text-[10px] border border-indigo-500/40 inline-flex items-center gap-1"
                        title="Send payment statement via WhatsApp & Email"
                      >
                        <Send className="w-2.5 h-2.5" /> Send Reminder
                      </button>
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

