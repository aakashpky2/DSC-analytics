// Bank Accounts Configuration (/billing/accounts)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Landmark, QrCode, Plus, X, PowerOff, CheckCircle2 } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function BillingAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [formData, setFormData] = useState({
    account_nickname: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: '',
    account_holder_name: '',
    upi_id: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadAccounts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })

    fetch(`/api/billing/accounts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/billing/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsModalOpen(false)
        setFormData({
          account_nickname: '',
          bank_name: '',
          account_number: '',
          ifsc_code: '',
          branch_name: '',
          account_holder_name: '',
          upi_id: '',
        })
        loadAccounts()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this bank account?')) return
    await fetch(`/api/billing/accounts/${id}/deactivate`, { method: 'PATCH' })
    loadAccounts()
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
            <span className="text-white">Bank Accounts</span>
          </div>
          <h1 className="text-xl font-bold text-white">Bank Accounts & Payment QR</h1>
          <p className="text-xs text-slate-400 mt-1">
            Official company bank accounts, UPI IDs, and dynamic payment QR codes attached to invoices.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Company Bank Account
        </button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="p-8 text-center text-slate-500 col-span-2">Loading corporate accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 col-span-2">No active accounts found. Add one above.</div>
        ) : (
          accounts.map((acc: any) => (
            <div key={acc.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex justify-between items-center relative overflow-hidden group">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">{acc.account_nickname}</span>
                </div>
                <div className="text-xs text-slate-200">{acc.bank_name} &bull; A/C: {acc.account_number}</div>
                <div className="text-xs text-slate-400">Account Holder: {acc.account_holder_name}</div>
                <div className="text-[11px] text-slate-400">IFSC: {acc.ifsc_code} &bull; Branch: {acc.branch_name}</div>
                <div className="text-xs text-cyan-400 font-mono">UPI ID: {acc.upi_id || 'Not set'}</div>

                {acc.id !== 'bank-hdfc-01' && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleDeactivate(acc.id)}
                      className="text-[10px] text-red-400 hover:underline inline-flex items-center gap-1"
                    >
                      <PowerOff className="w-3 h-3" /> Deactivate Account
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center shrink-0">
                <QrCode className="w-10 h-10 text-white mx-auto" />
                <span className="text-[9px] text-emerald-400 font-mono mt-1 block">Active UPI QR</span>
              </div>
            </div>
          ))
        )}
      </div>

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

      {/* Add Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Add Company Bank Account</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Nickname *</label>
                <input
                  required
                  placeholder="e.g. ICICI Current Primary"
                  value={formData.account_nickname}
                  onChange={(e) => setFormData({ ...formData, account_nickname: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bank Name *</label>
                  <input
                    required
                    placeholder="e.g. ICICI Bank Ltd"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Number *</label>
                  <input
                    required
                    placeholder="Account Number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">IFSC Code *</label>
                  <input
                    required
                    placeholder="e.g. ICIC0001234"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Branch Location</label>
                  <input
                    placeholder="e.g. Bandra Kurla Complex"
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Holder Legal Name *</label>
                <input
                  required
                  placeholder="e.g. SignSync Enterprise Solutions Pvt Ltd"
                  value={formData.account_holder_name}
                  onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">UPI ID for Dynamic Invoice QR</label>
                <input
                  placeholder="e.g. signsync@icici"
                  value={formData.upi_id}
                  onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-cyan-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
