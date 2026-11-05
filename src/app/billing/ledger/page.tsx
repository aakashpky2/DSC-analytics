// Account Statements & Overdue Payments (/billing/ledger)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { PaymentReminderModal } from '@/components/PaymentReminderModal'

export default function LedgerAgingPage() {
  const [partners, setPartners] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Pagination states for Partners
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Buckets calculation states
  const [buckets, setBuckets] = useState({ b0to30: 0, b31to60: 0, b61to90: 0, b90Plus: 0 })

  // Reminder Modal State
  const [activeReminderPartner, setActiveReminderPartner] = useState<{ id: string; name: string } | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      mask: 'true',
      page: String(currentPage),
      limit: String(pageSize),
    })

    Promise.all([
      fetch(`/api/partners?${params.toString()}`).then((r) => r.json()),
      fetch('/api/billing/invoices').then((r) => r.json()),
    ])
      .then(([partnersRes, invoicesRes]) => {
        setPartners(partnersRes.partners || [])
        setTotalCount(partnersRes.totalCount || 0)
        setTotalPages(partnersRes.totalPages || 1)

        const allInvoices = invoicesRes.invoices || []
        setInvoices(allInvoices)

        let bucket0to30 = 0
        let bucket31to60 = 0
        let bucket61to90 = 0
        let bucket90Plus = 0

        allInvoices.forEach((inv: any) => {
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

        setBuckets({
          b0to30: bucket0to30,
          b31to60: bucket31to60,
          b61to90: bucket61to90,
          b90Plus: bucket90Plus,
        })
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/billing/invoices" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Invoices
            </Link>
            <span>/</span>
            <span className="text-white">Account Statements</span>
          </div>
          <h1 className="text-xl font-bold text-white">Account Statements & Overdue Payments</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track partner running balances, credit lines, and overdue payment aging periods.
          </p>
        </div>
      </div>

      {/* Aging Analysis Buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/30">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Current (0-30 Days)</div>
          <div className="text-2xl font-bold text-white mt-1">₹{buckets.b0to30.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">Within standard credit term</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">31-60 Days Overdue</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">₹{buckets.b31to60.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">First reminder sent</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-orange-500/30">
          <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">61-90 Days Overdue</div>
          <div className="text-2xl font-bold text-orange-300 mt-1">₹{buckets.b61to90.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 mt-1">Payment follow-up needed</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-500/30">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Over 90 Days</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">₹{buckets.b90Plus.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-rose-400 mt-1">Account on hold</div>
        </div>
      </div>

      {/* Partner Ledger Summaries */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Partner Credit Balances & Statements</div>
          <div className="text-xs text-slate-400">Total Partners: {totalCount}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Partner Code</th>
                <th className="p-3">Company Name</th>
                <th className="p-3">Payment Term</th>
                <th className="p-3 text-right">Credit Line</th>
                <th className="p-3 text-right">Wallet Balance</th>
                <th className="p-3 text-right font-semibold text-amber-400">Total Pending</th>
                <th className="p-3 text-center">Reminders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && partners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading account statements...
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No partner records found.
                  </td>
                </tr>
              ) : (
                partners.map((p: any) => {
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
                        {outstanding > 0 ? (
                          <button
                            type="button"
                            onClick={() => setActiveReminderPartner({ id: p.id, name: p.company_name })}
                            className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium text-[10px] border border-indigo-500/40 inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Send className="w-2.5 h-2.5" /> Send Reminder
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> No Dues
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>

      {/* Payment Reminder Modal */}
      {activeReminderPartner && (
        <PaymentReminderModal
          partnerId={activeReminderPartner.id}
          partnerName={activeReminderPartner.name}
          onClose={() => setActiveReminderPartner(null)}
          onReminderLogged={() => {
            // Optional callback when reminder is logged
          }}
        />
      )}
    </div>
  )
}
