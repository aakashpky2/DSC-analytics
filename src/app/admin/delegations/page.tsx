'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Plus, Calendar, Clock, AlertTriangle, CheckCircle2, XCircle, Search, Filter } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { useToast } from '@/components/ToastProvider'

interface DelegationRecord {
  id: string
  grantor_user_id: string
  grantor_name: string
  grantor_email: string
  recipient_user_id: string
  recipient_name: string
  recipient_email: string
  module_key: string
  action_key: string
  valid_from: string
  valid_until: string
  reason: string
  can_delegate_further: number
  status: 'active' | 'revoked' | 'expired'
  created_at: string
}

interface StaffUser {
  id: string
  full_name: string
  email: string
  hierarchy_level_order: number
  level_name: string
}

export default function AdminDelegationsPage() {
  const { showToast } = useToast()
  const [delegations, setDelegations] = useState<DelegationRecord[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    recipient_user_id: '',
    module_key: 'billing',
    action_key: 'can_edit',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
    reason: '',
    can_delegate_further: false,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Search, filter & pagination states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
    if (searchTerm.trim()) params.append('search', searchTerm.trim())
    if (statusFilter) params.append('status', statusFilter)

    Promise.all([
      fetch(`/api/admin/delegations?${params.toString()}`).then((r) => r.json()),
      fetch('/api/admin/users?limit=100').then((r) => r.json()),
    ])
      .then(([delData, usrData]) => {
        setDelegations(delData.delegations || [])
        setTotalCount(delData.totalCount ?? (delData.delegations?.length || 0))
        setTotalPages(delData.totalPages ?? 1)
        setStaff(usrData.users || [])
      })
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, searchTerm, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const fromDate = new Date(form.valid_from)
      const untilDate = new Date(form.valid_until)

      if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
        setError('Please provide valid start and end dates.')
        return
      }

      if (untilDate <= fromDate) {
        setError('End date must be after start date.')
        showToast({
          type: 'error',
          status: 400,
          title: 'Validation Error',
          message: 'End date must be after start date.'
        })
        return
      }

      const res = await fetch('/api/admin/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_user_id: form.recipient_user_id,
          module_key: form.module_key,
          action_key: form.action_key,
          valid_from: fromDate.toISOString(),
          valid_until: untilDate.toISOString(),
          reason: form.reason,
          can_delegate_further: form.can_delegate_further ? 1 : 0,
        }),
      })

      let d: any = {}
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        try {
          d = await res.json()
        } catch {
          d = {}
        }
      }

      if (!res.ok) {
        const errorMsg = d.error || (res.status === 403 ? 'Access denied. You do not have permission to create delegations.' : res.status === 409 ? 'This delegation already exists.' : 'Unable to create delegation. Please try again.')
        setError(errorMsg)
        showToast({
          type: 'error',
          status: res.status,
          title: res.status === 409 ? 'Duplicate Delegation' : 'Delegation Failed',
          message: errorMsg
        })
        return
      }

      setSuccess('Delegation created successfully.')
      showToast({
        type: 'success',
        status: 201,
        title: 'Delegation Created',
        message: 'Delegation created successfully.'
      })
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      setError(err.message || 'Unable to create delegation. Please try again.')
      showToast({
        type: 'error',
        status: 500,
        title: 'Error',
        message: err.message || 'Unable to create delegation. Please try again.'
      })
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this delegation and all dependent sub-delegations?')) return
    try {
      const res = await fetch(`/api/admin/delegations/${id}/revoke`, { method: 'PATCH' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to revoke delegation')
      loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Temporary Permissions Delegation</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Security Tiers 0-1
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grant time-bound, auditable operational privileges to eligible employees with cascading revocation.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Grant Delegation
        </button>
      </div>

      {success && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
          {success}
        </div>
      )}

      {/* Delegations Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">Active & Historical Permission Grants</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff, module, action..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Recipient Staff</th>
                <th className="p-3">Grantor</th>
                <th className="p-3">Module & Action</th>
                <th className="p-3">Validity Window</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && delegations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Loading delegations...
                  </td>
                </tr>
              ) : delegations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active or historical temporary delegations found.
                  </td>
                </tr>
              ) : (
                delegations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-medium text-white">{d.recipient_name}</div>
                      <div className="text-[10px] text-slate-400">{d.recipient_email}</div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div>{d.grantor_name}</div>
                      <div className="text-[10px] text-slate-400">{d.grantor_email}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-indigo-300">{d.module_key}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{d.action_key}</div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(d.valid_from).toLocaleDateString()} &rarr; {new Date(d.valid_until).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{d.reason}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] border capitalize ${
                        d.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {d.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(d.id)}
                          className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
          isLoading={loading}
        />
      </div>

      {/* Grant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-base font-bold text-white">Grant Temporary Delegation</h2>
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
            <form onSubmit={handleGrant} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Recipient Staff *</label>
                <select
                  required
                  value={form.recipient_user_id}
                  onChange={(e) => setForm({ ...form, recipient_user_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                  <option value="">Select an employee...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email}) - {s.level_name || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Module *</label>
                  <select
                    value={form.module_key}
                    onChange={(e) => setForm({ ...form, module_key: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="billing">Billing & Payments</option>
                    <option value="inventory">Inventory & Tokens</option>
                    <option value="crm">CRM Leads</option>
                    <option value="dsc">DSC Catalog</option>
                    <option value="partners">Partners</option>
                    <option value="courier">Courier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Action Granted *</label>
                  <select
                    value={form.action_key}
                    onChange={(e) => setForm({ ...form, action_key: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="can_edit">Edit / Verify</option>
                    <option value="can_create">Create / Issue</option>
                    <option value="can_delete">Delete / Cancel</option>
                    <option value="all">Full Module Access</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Valid From *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Valid Until *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Business Reason *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Covering for Senior Manager during annual leave"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="delegateFurther"
                  checked={form.can_delegate_further}
                  onChange={(e) => setForm({ ...form, can_delegate_further: e.target.checked })}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-600"
                />
                <label htmlFor="delegateFurther" className="text-slate-300 text-xs cursor-pointer">
                  Allow Recipient to Delegate Further (Onward Chain)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
                >
                  Confirm Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

