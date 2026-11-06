// Billing & Invoices Management (/billing/invoices)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Receipt,
  Landmark,
  QrCode,
  CreditCard,
  ArrowRight,
  Plus,
  Search,
  FileDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign
} from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function BillingInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Payment Recording Modal State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('UPI')
  const [utrNumber, setUtrNumber] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) params.append('search', search.trim())
    if (statusFilter) params.append('status', statusFilter)

    Promise.all([
      fetch(`/api/billing/invoices/extended?${params.toString()}`).then((r) => r.json()),
      fetch('/api/billing/accounts').then((r) => r.json()),
    ])
      .then(([invData, accData]) => {
        setInvoices(invData.invoices || [])
        setTotalCount(invData.pagination?.totalCount || 0)
        setTotalPages(invData.pagination?.totalPages || 1)
        setAccounts(accData.accounts || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, search, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (st: string) => {
    setStatusFilter(st)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const openPaymentModal = (inv: any) => {
    setSelectedInvoice(inv)
    setPayAmount(String(inv.outstanding_balance || ''))
    setPayMode('UPI')
    setUtrNumber('')
    setFeedbackMsg('')
    setErrorMsg('')
    setPayModalOpen(true)
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoice) return
    setIsRecording(true)
    setErrorMsg('')
    setFeedbackMsg('')

    try {
      const res = await fetch('/api/billing/payments/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: selectedInvoice.id,
          amount_paid: parseFloat(payAmount),
          payment_mode: payMode,
          transaction_reference_utr: utrNumber || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setFeedbackMsg(`Receipt ${data.receipt_number} issued! Outstanding: ₹${data.outstanding_balance}`)
        setTimeout(() => {
          setPayModalOpen(false)
          loadData()
        }, 1200)
      } else {
        setErrorMsg(data.error || 'Payment failed')
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsRecording(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            Invoicing & Billing Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Database single source of truth for GST invoices, real-time ledger debits, receipts, and receivables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/billing/invoices/new"
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Connected Bank Accounts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc: any) => (
          <div
            key={acc.id}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">{acc.account_nickname}</span>
              </div>
              <div className="text-xs text-slate-300">
                {acc.bank_name} &bull; A/C: {acc.account_number}
              </div>
              <div className="text-[11px] text-slate-400">
                IFSC: {acc.ifsc_code} &bull; Branch: {acc.branch_name}
              </div>
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
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">
            Authoritative Invoice Records ({totalCount})
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-md px-2.5 py-1.5 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft (Editable)</option>
              <option value="unpaid">Payment Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid in Full</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice number or partner..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold whitespace-nowrap">Invoice Number</th>
                <th className="p-3 font-semibold whitespace-nowrap">Customer / Partner</th>
                <th className="p-3 font-semibold whitespace-nowrap">Date</th>
                <th className="p-3 font-semibold whitespace-nowrap">Due Date</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Taxable Value</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">GST Total</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Grand Total</th>
                <th className="p-3 text-right font-semibold text-amber-400 whitespace-nowrap">
                  Outstanding
                </th>
                <th className="p-3 font-semibold whitespace-nowrap">Status</th>
                <th className="p-3 text-center font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 whitespace-nowrap">
                    Loading authoritative invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 whitespace-nowrap">
                    No invoice records found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const totalGst = (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)
                  const isPaid = inv.status === 'paid'
                  const isDraft = inv.status === 'draft'
                  const isCancelled = inv.status === 'cancelled'

                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 h-12">
                      <td className="p-3 font-mono text-cyan-300 font-semibold whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="p-3 font-medium text-white whitespace-nowrap">
                        {inv.partner_company}
                      </td>
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">{inv.invoice_date}</td>
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">{inv.due_date}</td>
                      <td className="p-3 text-right text-slate-300 whitespace-nowrap">
                        ₹{Number(inv.subtotal || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-slate-400 whitespace-nowrap">
                        ₹{totalGst.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-bold text-white whitespace-nowrap">
                        ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-400 whitespace-nowrap">
                        ₹{Number(inv.outstanding_balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isDraft
                              ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              : isCancelled
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {inv.status?.toUpperCase() || 'UNPAID'}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* PDF Download */}
                          <a
                            href={`/api/invoices/pdf?invoice_number=${inv.invoice_number}&download=true`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-slate-400 hover:text-white"
                            title="Download PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </a>

                          {/* Record Payment Button */}
                          {!isPaid && !isCancelled && !isDraft && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] font-medium border border-emerald-500/30 flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" /> Pay
                            </button>
                          )}
                        </div>
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

      {/* Record Payment Modal */}
      {payModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Record Payment & Issue Receipt
              </h3>
              <button
                onClick={() => setPayModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice:</span>
                <span className="font-mono text-cyan-300 font-bold">{selectedInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-slate-200">{selectedInvoice.partner_company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Outstanding:</span>
                <span className="font-mono text-amber-400 font-bold">
                  ₹{Number(selectedInvoice.outstanding_balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {feedbackMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedInvoice.outstanding_balance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="NEFT">NEFT Bank Transfer</option>
                  <option value="IMPS">IMPS Instant Transfer</option>
                  <option value="RTGS">RTGS High-Value</option>
                  <option value="BANK_TRANSFER">Direct Net Banking</option>
                  <option value="CHEQUE">Bank Cheque</option>
                  <option value="CASH">Counter Cash</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Transaction Reference / UTR
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR998877661122"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecording}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs disabled:opacity-50"
                >
                  {isRecording ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
