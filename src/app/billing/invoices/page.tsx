// Invoices (/billing/invoices)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Receipt, Landmark, QrCode, CreditCard, ArrowRight, Plus, Search } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function BillingInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) params.append('search', search.trim())
    if (statusFilter) params.append('status', statusFilter)

    Promise.all([
      fetch(`/api/billing/invoices?${params.toString()}`).then((r) => r.json()),
      fetch('/api/billing/accounts').then((r) => r.json()),
    ])
      .then(([invData, accData]) => {
        setInvoices(invData.invoices || [])
        setTotalCount(invData.totalCount || 0)
        setTotalPages(invData.totalPages || 1)
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
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">Invoice Records & Balance ({totalCount})</div>
          
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-md px-2.5 py-1.5 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="unpaid">Payment Pending</option>
              <option value="paid">Paid in Full</option>
              <option value="partially_paid">Partially Paid</option>
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
                <th className="p-3 font-semibold whitespace-nowrap">Partner Company</th>
                <th className="p-3 font-semibold whitespace-nowrap">Date</th>
                <th className="p-3 font-semibold whitespace-nowrap">Payment Due</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Subtotal</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Total Tax (GST)</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Total Amount</th>
                <th className="p-3 text-right font-semibold text-amber-400 whitespace-nowrap">Pending Amount</th>
                <th className="p-3 font-semibold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 whitespace-nowrap">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 whitespace-nowrap">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const totalGst = (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 h-12">
                      <td className="p-3 font-mono text-cyan-300 font-semibold whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="p-3 font-medium text-white whitespace-nowrap">{inv.partner_company}</td>
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">{inv.invoice_date}</td>
                      <td className="p-3 text-slate-400 font-mono whitespace-nowrap">{inv.due_date}</td>
                      <td className="p-3 text-right text-slate-300 whitespace-nowrap">₹{inv.subtotal?.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right text-slate-400 whitespace-nowrap">₹{totalGst.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-bold text-white whitespace-nowrap">₹{inv.total_amount?.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-bold text-amber-400 whitespace-nowrap">
                        ₹{inv.outstanding_balance?.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {inv.status === 'paid' ? 'Paid in Full' : 'Payment Pending'}
                        </span>
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
    </div>
  )
}
