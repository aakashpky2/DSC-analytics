// Check Payments (/billing/payments)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowLeft, Landmark, Image as ImageIcon, Eye } from 'lucide-react'
import { PaymentReceivedRecord } from '@/types/models'

export default function PaymentsVerificationPage() {
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadQueue = () => {
    setLoading(true)
    fetch('/api/billing/payments/queue')
      .then((r) => r.json())
      .then((d) => setQueue(d.queue || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadQueue()
  }, [])

  const handleAction = async (paymentId: string, action: 'verified' | 'rejected') => {
    setActionLoading(paymentId)
    try {
      const res = await fetch('/api/billing/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId,
          action,
          rejection_remarks: action === 'rejected' ? 'UTR verification failed / screenshot mismatch' : undefined,
        }),
      })
      if (res.ok) {
        loadQueue()
      }
    } finally {
      setActionLoading(null)
    }
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
            <span className="text-white">Check Payments</span>
          </div>
          <h1 className="text-xl font-bold text-white">Check Payments & UTR Audit</h1>
          <p className="text-xs text-slate-400 mt-1">
            Verify customer payment receipts and UTR numbers to credit partner accounts and reconcile invoices.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading verification queue...</div>
      ) : queue.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-semibold text-white">All Payments Verified</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            There are no pending payment receipts to check at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {queue.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              {/* Card Header */}
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-400 font-semibold text-xs">
                    {p.invoice_number}
                  </span>
                  <span className="text-slate-400 text-xs">&bull;</span>
                  <span className="text-white text-xs font-semibold">{p.partner_company}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    p.verified_status === 'verified'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}>
                    {p.verified_status === 'verified' ? 'Confirmed' : 'Awaiting Review'}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    Paid: ₹{p.amount_paid?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Card Body - Split Screen Audit */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Payment Proof Screenshot */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    <span>Payment Proof Screenshot</span>
                  </div>

                  <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-500 relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2 text-cyan-400">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-medium text-slate-300">Bank Transfer / UPI Screenshot</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">UTR: {p.transaction_reference_utr || 'Direct Portal Transfer'}</div>
                  </div>
                </div>

                {/* Right: Reconciliation Details */}
                <div className="flex flex-col justify-between space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-3">Reconciliation Details</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Invoice Total:</span>
                        <span className="font-semibold text-white">₹{p.total_amount?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Pending Amount:</span>
                        <span className="font-semibold text-amber-400">₹{p.outstanding_balance?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Amount Paid:</span>
                        <span className="font-semibold text-emerald-400">₹{p.amount_paid?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Receiving Bank:</span>
                        <span className="text-slate-300 font-mono">{p.bank_name || 'HDFC Bank'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Payment Mode:</span>
                        <span className="text-slate-300 uppercase">{p.payment_mode}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  {p.verified_status === 'pending_verification' && (
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => handleAction(p.id, 'verified')}
                        disabled={actionLoading === p.id}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {actionLoading === p.id ? 'Processing...' : 'Confirm Payment'}
                      </button>

                      <button
                        onClick={() => handleAction(p.id, 'rejected')}
                        disabled={actionLoading === p.id}
                        className="flex-1 py-2 px-3 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
