// Check Payments (/billing/payments)
import React from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, ArrowLeft, Landmark, Image as ImageIcon } from 'lucide-react'
import { PaymentReceivedRecord } from '@/types/models'

async function getQueue(): Promise<PaymentReceivedRecord[]> {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/billing/payments/queue`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.queue || []
  } catch {
    return []
  }
}

export default async function PaymentsVerificationPage() {
  const queue = await getQueue()

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
          <h1 className="text-xl font-bold text-white">Check Payments</h1>
          <p className="text-xs text-slate-400 mt-1">
            Verify customer payment receipts and UTR numbers to credit partner accounts.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
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

              {/* Split Screen Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                {/* Left Screen: Payment Proof Screenshot Viewport */}
                <div className="p-5 flex flex-col justify-center items-center bg-slate-950/70 min-h-[260px]">
                  {p.screenshot_proof_url ? (
                    <img
                      src={p.screenshot_proof_url}
                      alt="Payment Receipt"
                      className="max-h-64 rounded-lg border border-slate-800 object-contain shadow-lg"
                    />
                  ) : (
                    <div className="text-center space-y-2 text-slate-500">
                      <ImageIcon className="w-12 h-12 mx-auto stroke-1" />
                      <div className="text-xs font-mono">Bank Reference Slip</div>
                      <div className="text-[11px] text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                        UTR: {p.transaction_reference_utr || 'Direct NEFT/RTGS'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Screen: Invoice Audit Details & Actions */}
                <div className="p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Payment Verification Details
                    </div>

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
                      <form action="/api/billing/payments/verify" method="POST" className="flex-1">
                        <input type="hidden" name="payment_id" value={p.id} />
                        <input type="hidden" name="action" value="verified" />
                        <button
                          type="submit"
                          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Payment
                        </button>
                      </form>

                      <form action="/api/billing/payments/verify" method="POST" className="flex-1">
                        <input type="hidden" name="payment_id" value={p.id} />
                        <input type="hidden" name="action" value="rejected" />
                        <button
                          type="submit"
                          className="w-full py-2 px-3 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject Payment
                        </button>
                      </form>
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
