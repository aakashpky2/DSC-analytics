// Check Payments (/billing/payments)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowLeft, Landmark, Image as ImageIcon, ExternalLink, X } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { PaymentReceivedRecord } from '@/types/models'

export default function PaymentsVerificationPage() {
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadQueue = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })

    fetch(`/api/billing/payments/queue?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setQueue(d.queue || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

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
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left: Payment Proof Screenshot */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Payment Proof Screenshot</span>
                    </div>
                    {p.screenshot_proof_url && (
                      <button
                        type="button"
                        onClick={() => setViewingImage(p.screenshot_proof_url)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View Full Image</span>
                      </button>
                    )}
                  </div>

                  {p.screenshot_proof_url ? (
                    <div className="rounded-xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center max-h-[300px] overflow-hidden group">
                      <img
                        src={p.screenshot_proof_url}
                        alt="Payment Screenshot"
                        className="max-h-[284px] w-auto max-w-full object-contain rounded-lg cursor-pointer transition hover:opacity-90"
                        onClick={() => setViewingImage(p.screenshot_proof_url)}
                      />
                    </div>
                  ) : (
                    <div className="h-[105px] rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center p-3 text-center">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Landmark className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-medium text-slate-300">No payment screenshot uploaded</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        UTR / Ref: {p.transaction_reference_utr || p.transaction_ref || 'Direct Portal Transfer'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Reconciliation Details */}
                <div className="flex flex-col space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2.5">Reconciliation Details</div>
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
                      <div className="flex justify-between py-1 border-b border-slate-800/80">
                        <span className="text-slate-400">Payment Mode:</span>
                        <span className="text-slate-300 uppercase">{p.payment_mode}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Transaction Ref:</span>
                        <span className="text-slate-300 font-mono text-[11px]">{p.transaction_ref || p.transaction_reference_utr || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar immediately below details */}
                  {p.verified_status === 'pending_verification' && (
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
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

          {/* Database Pagination */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
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
        </div>
      )}

      {/* Lightbox / Full Image Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setViewingImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-800 text-xs text-slate-300">
              <span className="font-medium flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> Payment Proof Full View
              </span>
              <button
                onClick={() => setViewingImage(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center max-h-[80vh]">
              <img
                src={viewingImage}
                alt="Payment Screenshot Full"
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
