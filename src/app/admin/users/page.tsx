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
          <h2 className="text-xl font-bold text-white tracking-tight">Staff & Roles</h2>
          <p className="text-xs text-slate-400">Manage internal operator accounts, tier hierarchy, and granular overrides</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Strict Role-Based Access Active</span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role Tier</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Security Policy</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading staff members...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No staff members found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {u.role_name || u.role_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {u.phone_number || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {u.status === 'active' ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.permissions_frozen ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          <Lock className="w-3 h-3" /> Overrides Frozen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Unlock className="w-3 h-3 text-slate-500" /> Standard Inherited
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role_id === 'role-super-admin' ? (
                        <span className="text-[11px] text-slate-600 font-medium">System Root</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedUserForPerms(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                            title="Manage Granular Permissions"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleFreeze(u.id, u.permissions_frozen)}
                            disabled={actionLoading === u.id}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              u.permissions_frozen
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                            title={u.permissions_frozen ? 'Unfreeze Permissions' : 'Freeze Current Permissions'}
                          >
                            {u.permissions_frozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
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
