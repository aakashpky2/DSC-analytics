// Staff & Roles (/admin/users)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Shield, UserCheck, Lock, Unlock, EyeOff, Plus, UserPlus, Search, Sliders } from 'lucide-react'
import { AddStaffModal } from '@/components/AddStaffModal'
import { UserPermissionDrawer } from '@/components/UserPermissionDrawer'
import { Pagination } from '@/components/Pagination'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      mask: 'false',
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) params.append('search', search.trim())

    fetch(`/api/admin/users?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized')
        return res.json()
      })
      .then((data) => {
        setUsers(data.users || [])
        setTotalCount(data.totalCount || 0)
        setTotalPages(data.totalPages || 1)
      })
      .catch((err) => {
        console.error('Failed to load users:', err)
      })
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, search])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleToggleFreeze = async (userId: string, currentFrozen: number) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/freeze`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frozen: currentFrozen ? 0 : 1 }),
      })
      if (res.ok) {
        fetchUsers()
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    setActionLoading(userId)
    try {
      const newStatus = currentStatus === 'active' ? 'deactivated' : 'active'
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        fetchUsers()
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
          <h1 className="text-xl font-bold text-white">Staff & Access Roles</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage employee accounts, assign business roles, and control access to company records.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {/* Staff Roles Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {[
          { title: 'Super Admin', desc: 'Full office & company access', color: 'border-indigo-500/40 text-indigo-400' },
          { title: 'Regional Partner Admin', desc: 'Partner network & pricing', color: 'border-blue-500/40 text-blue-400' },
          { title: 'Branch Manager', desc: 'Branch stock & approvals', color: 'border-cyan-500/40 text-cyan-400' },
          { title: 'Operations Executive', desc: 'DSC applications & invoicing', color: 'border-emerald-500/40 text-emerald-400' },
          { title: 'Field Staff', desc: 'Customer inquiries & calls', color: 'border-amber-500/40 text-amber-400' },
        ].map((tier, idx) => (
          <div key={idx} className={`p-3 rounded-xl bg-slate-900/60 border ${tier.color} space-y-1`}>
            <div className="text-xs font-semibold text-white">{tier.title}</div>
            <div className="text-[10px] text-slate-400">{tier.desc}</div>
          </div>
        ))}
      </div>

      {/* Users Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white">Employee Accounts ({totalCount})</span>
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <EyeOff className="w-3.5 h-3.5" />
              <span className="text-[11px]">Field staff see masked contacts</span>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff name, email, role..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold whitespace-nowrap">Staff Name & Contact</th>
                <th className="p-3 font-semibold whitespace-nowrap">Assigned Role</th>
                <th className="p-3 font-semibold whitespace-nowrap">Role Tier</th>
                <th className="p-3 font-semibold whitespace-nowrap">Can Grant Access</th>
                <th className="p-3 font-semibold whitespace-nowrap">Access State</th>
                <th className="p-3 font-semibold whitespace-nowrap">Account Status</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 text-xs whitespace-nowrap">
                    Loading staff members...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 text-xs whitespace-nowrap">
                    No staff records found.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 h-12">
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                        {u.role_name || 'Staff Member'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-indigo-300 font-medium whitespace-nowrap">
                        {u.level_name || `Tier ${u.level_order}`}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {u.can_grant_permissions ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium whitespace-nowrap">
                          <UserCheck className="w-3.5 h-3.5" /> Allowed
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium whitespace-nowrap">Standard</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {u.permissions_frozen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] border border-red-500/30 whitespace-nowrap">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] whitespace-nowrap">
                          <Unlock className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] border capitalize whitespace-nowrap ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {u.id !== 'usr-admin-root' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUserForPerms(u)}
                            className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                            title="Edit granular permissions & PII masking"
                          >
                            <Sliders className="w-3 h-3" /> Permissions
                          </button>
                          <button
                            onClick={() => handleToggleFreeze(u.id, u.permissions_frozen)}
                            disabled={actionLoading === u.id}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                              u.permissions_frozen
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {u.permissions_frozen ? 'Unlock' : 'Lock'}
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u.id, u.status)}
                            disabled={actionLoading === u.id}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                              u.status === 'active'
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                                : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {u.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
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
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>

      <AddStaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchUsers}
      />

      <UserPermissionDrawer
        isOpen={Boolean(selectedUserForPerms)}
        user={selectedUserForPerms}
        onClose={() => setSelectedUserForPerms(null)}
        onSuccess={fetchUsers}
      />
    </div>
  )
}
