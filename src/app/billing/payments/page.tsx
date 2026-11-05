// Check Payments (/billing/payments)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  Landmark, 
  Image as ImageIcon, 
  ExternalLink, 
  X, 
  Plus, 
  Upload, 
  FileText, 
  Check,
  Receipt,
  FileCheck2,
  Eye,
  Search,
  ChevronDown
} from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { PaymentReceivedRecord } from '@/types/models'

export default function PaymentsVerificationPage() {
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [recordLoading, setRecordLoading] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [recordSuccess, setRecordSuccess] = useState('')

  const [paymentForm, setPaymentForm] = useState({
    invoice_id: '',
    amount_paid: '',
    payment_mode: 'neft',
    bank_account_id: '',
    transaction_reference_utr: '',
    screenshot_proof_url: '',
  })

  // Invoice Combobox State (Filter & 5 items pagination)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [isInvoiceDropdownOpen, setIsInvoiceDropdownOpen] = useState(false)
  const [invoiceDropdownPage, setInvoiceDropdownPage] = useState(1)
  const INVOICE_ITEMS_PER_PAGE = 5

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

  const loadModalDependencies = useCallback(() => {
    Promise.all([
      fetch('/api/billing/invoices?status=unpaid&limit=100').then((r) => r.json()).catch(() => ({ invoices: [] })),
      fetch('/api/billing/accounts?limit=100').then((r) => r.json()).catch(() => ({ accounts: [] })),
    ]).then(([invData, accData]) => {
      const invs = invData.invoices || []
      const accs = accData.accounts || []
      setUnpaidInvoices(invs)
      setBankAccounts(accs)
      if (invs.length > 0 && !paymentForm.invoice_id) {
        setPaymentForm((prev) => ({
          ...prev,
          invoice_id: invs[0].id,
          amount_paid: String(invs[0].outstanding_balance || invs[0].total_amount || '')
        }))
      }
      if (accs.length > 0 && !paymentForm.bank_account_id) {
        setPaymentForm((prev) => ({ ...prev, bank_account_id: accs[0].id }))
      }
    })
  }, [paymentForm.invoice_id, paymentForm.bank_account_id])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const handleOpenRecordModal = () => {
    loadModalDependencies()
    setRecordError('')
    setRecordSuccess('')
    setUploadSuccess(false)
    setInvoiceSearch('')
    setInvoiceDropdownPage(1)
    setIsInvoiceDropdownOpen(false)
    setIsRecordModalOpen(true)
  }

  const handleInvoiceSelect = (invId: string) => {
    const inv = unpaidInvoices.find((i) => i.id === invId)
    setPaymentForm((prev) => ({
      ...prev,
      invoice_id: invId,
      amount_paid: inv ? String(inv.outstanding_balance || inv.total_amount || '') : prev.amount_paid
    }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setRecordError('')
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1]
          const res = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'payment',
              fileName: file.name,
              fileBase64: base64Data,
              contentType: file.type || 'image/jpeg',
            }),
          })

          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.error || 'Failed to upload payment proof')
          }

          setPaymentForm((prev) => ({ ...prev, screenshot_proof_url: data.fullUrl || data.signedUrl }))
          setUploadSuccess(true)
        } catch (uploadErr: any) {
          setRecordError(uploadErr.message || 'Payment proof upload failed')
        } finally {
          setUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      setRecordError(err.message || 'Failed to read file')
      setUploading(false)
    }
  }

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecordLoading(true)
    setRecordError('')
    setRecordSuccess('')

    try {
      const selectedInvoice = unpaidInvoices.find((i) => i.id === paymentForm.invoice_id)
      const res = await fetch('/api/billing/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: paymentForm.invoice_id,
          partner_id: selectedInvoice?.partner_id,
          bank_account_id: paymentForm.bank_account_id || undefined,
          amount_paid: Number(paymentForm.amount_paid),
          payment_mode: paymentForm.payment_mode,
          transaction_reference_utr: paymentForm.transaction_reference_utr.trim() || `UTR-${Date.now()}`,
          screenshot_proof_url: paymentForm.screenshot_proof_url || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to record payment.')
      }

      setRecordSuccess('Payment recorded successfully! Queued for verification.')
      loadQueue()
      setTimeout(() => {
        setIsRecordModalOpen(false)
        setRecordSuccess('')
      }, 1200)
    } catch (err: any) {
      setRecordError(err.message || 'Error recording payment receipt')
    } finally {
      setRecordLoading(false)
    }
  }

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

        <button
          onClick={handleOpenRecordModal}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
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
                      {p.screenshot_proof_url.toLowerCase().endsWith('.pdf') || p.screenshot_proof_url.includes('/pdf') ? (
                        <div 
                          onClick={() => setViewingImage(p.screenshot_proof_url)}
                          className="flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-slate-900/60 rounded-lg transition w-full h-[180px]"
                        >
                          <FileText className="w-10 h-10 text-cyan-400 mb-2" />
                          <span className="text-xs font-medium text-slate-200">PDF Payment Receipt</span>
                          <span className="text-[11px] text-cyan-400 mt-1 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Click to View Document
                          </span>
                        </div>
                      ) : (
                        <img
                          src={p.screenshot_proof_url}
                          alt="Payment Screenshot"
                          className="max-h-[284px] w-auto max-w-full object-contain rounded-lg cursor-pointer transition hover:opacity-90"
                          onClick={() => setViewingImage(p.screenshot_proof_url)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-[105px] rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col items-center justify-center p-3 text-center">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Landmark className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-medium text-slate-300">No payment proof uploaded</span>
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

      {/* Lightbox / Full Image / PDF Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setViewingImage(null)}
        >
          <div 
            className="relative max-w-4xl w-full max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-2 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-slate-800 text-xs text-slate-300">
              <span className="font-medium flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-cyan-400" /> Payment Proof Full View
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={viewingImage}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3" /> Open in New Tab
                </a>
                <button
                  onClick={() => setViewingImage(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center max-h-[80vh] min-h-[300px]">
              {viewingImage.toLowerCase().endsWith('.pdf') || viewingImage.includes('/pdf') ? (
                <iframe
                  src={viewingImage}
                  title="Payment Proof PDF"
                  className="w-full h-[70vh] rounded-lg border border-slate-800"
                />
              ) : (
                <img
                  src={viewingImage}
                  alt="Payment Screenshot Full"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setIsRecordModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Record Customer Payment</h2>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recordError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {recordError}
              </div>
            )}

            {recordSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {recordSuccess}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="space-y-4 text-xs">
              {/* Select Unpaid Invoice */}
              <div className="relative">
                <label className="block text-slate-300 font-medium mb-1">Select Invoice *</label>
                
                {/* Custom Trigger Button */}
                {(() => {
                  const selectedInv = unpaidInvoices.find((i) => i.id === paymentForm.invoice_id)
                  const filteredInvoices = unpaidInvoices.filter((inv) => {
                    const q = invoiceSearch.toLowerCase().trim()
                    if (!q) return true
                    const num = (inv.invoice_number || '').toLowerCase()
                    const company = (inv.partners?.company_name || inv.partner_company || '').toLowerCase()
                    return num.includes(q) || company.includes(q)
                  })
                  const totalFilteredPages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICE_ITEMS_PER_PAGE))
                  const currentPageClamped = Math.min(invoiceDropdownPage, totalFilteredPages)
                  const startIndex = (currentPageClamped - 1) * INVOICE_ITEMS_PER_PAGE
                  const visibleInvoices = filteredInvoices.slice(startIndex, startIndex + INVOICE_ITEMS_PER_PAGE)

                  return (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsInvoiceDropdownOpen(!isInvoiceDropdownOpen)}
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 text-left text-white flex items-center justify-between transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        {selectedInv ? (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-cyan-400 font-semibold">{selectedInv.invoice_number}</span>
                            <span className="text-slate-400">—</span>
                            <span className="truncate text-slate-200">{selectedInv.partners?.company_name || selectedInv.partner_company || 'Partner'}</span>
                            <span className="text-amber-400 font-semibold shrink-0 ml-auto mr-1">
                              (Due: ₹{(selectedInv.outstanding_balance ?? selectedInv.total_amount)?.toLocaleString('en-IN')})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Select an unpaid invoice...</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isInvoiceDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {isInvoiceDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-2">
                          {/* Search Input */}
                          <div className="relative mb-2">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search invoice # or partner..."
                              value={invoiceSearch}
                              onChange={(e) => {
                                setInvoiceSearch(e.target.value)
                                setInvoiceDropdownPage(1)
                              }}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          {/* 5-Item Display List */}
                          <div className="space-y-1">
                            {visibleInvoices.length === 0 ? (
                              <div className="py-4 text-center text-slate-500 text-xs">
                                No matching unpaid invoices
                              </div>
                            ) : (
                              visibleInvoices.map((inv) => {
                                const isSelected = inv.id === paymentForm.invoice_id
                                return (
                                  <button
                                    key={inv.id}
                                    type="button"
                                    onClick={() => {
                                      handleInvoiceSelect(inv.id)
                                      setIsInvoiceDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between transition-colors ${
                                      isSelected 
                                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-white' 
                                        : 'hover:bg-slate-800/70 text-slate-300'
                                    }`}
                                  >
                                    <div className="flex flex-col min-w-0 mr-2">
                                      <span className="font-mono text-cyan-400 font-semibold text-xs">
                                        {inv.invoice_number}
                                      </span>
                                      <span className="text-[11px] text-slate-400 truncate">
                                        {inv.partners?.company_name || inv.partner_company || 'Partner'}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-amber-400 font-semibold text-xs">
                                        ₹{(inv.outstanding_balance ?? inv.total_amount)?.toLocaleString('en-IN')}
                                      </div>
                                      <span className="text-[10px] text-slate-500">outstanding</span>
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>

                          {/* Pagination Footer (capped to 5 items per view) */}
                          {filteredInvoices.length > INVOICE_ITEMS_PER_PAGE && (
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 px-1">
                              <span>
                                Showing {startIndex + 1}–{Math.min(startIndex + INVOICE_ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentPageClamped <= 1}
                                  onClick={() => setInvoiceDropdownPage((p) => Math.max(1, p - 1))}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white text-[10px]"
                                >
                                  Prev
                                </button>
                                <span className="px-1 text-slate-500 text-[10px]">
                                  {currentPageClamped}/{totalFilteredPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={currentPageClamped >= totalFilteredPages}
                                  onClick={() => setInvoiceDropdownPage((p) => Math.min(totalFilteredPages, p + 1))}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white text-[10px]"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount Paid */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount Paid (₹) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={paymentForm.amount_paid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Mode *</label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase"
                  >
                    <option value="neft">NEFT</option>
                    <option value="rtgs">RTGS</option>
                    <option value="imps">IMPS</option>
                    <option value="upi">UPI</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Receiving Bank Account */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receiving Bank</label>
                  <select
                    value={paymentForm.bank_account_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, bank_account_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Default Bank Account</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.account_nickname || 'Account'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* UTR / Transaction Reference */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">UTR / Ref Number *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={paymentForm.transaction_reference_utr}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transaction_reference_utr: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Upload Payment Proof Field */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Upload Payment Proof (JPG, JPEG, PNG, PDF)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    {uploading ? 'Uploading...' : uploadSuccess ? 'Replace Proof' : 'Upload Proof'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {uploadSuccess && (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Proof saved
                    </span>
                  )}
                </div>
                {paymentForm.screenshot_proof_url && (
                  <div className="mt-1.5 text-[11px] text-cyan-400 truncate max-w-sm font-mono">
                    {paymentForm.screenshot_proof_url.split('/').pop()}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordLoading || uploading || !paymentForm.invoice_id}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  {recordLoading ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
