'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { History, ShieldAlert, Search, ArrowRight, UserCheck } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

interface AuditLogRecord {
  id: string
  user_id: string
  staff_name?: string
  staff_email?: string
  action_type: string
  module_key: string
  table_affected: string
  record_id?: string
  old_value_json?: string
  new_value_json?: string
  reason?: string
  delegation_id?: string
  ip_address?: string
  created_at: string
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionTypeFilter, setActionTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadLogs = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (searchTerm.trim()) params.append('search', searchTerm.trim())
    if (actionTypeFilter) params.append('action_type', actionTypeFilter)

    fetch(`/api/admin/audit-logs?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, searchTerm, actionTypeFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Administrative Audit History</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Tamper-Proof Audit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete immutable log of master data updates, role changes, payment verifications, and delegations.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">System Security & Modification Logs</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff, action, record..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52"
              />
            </div>
            <select
              value={actionTypeFilter}
              onChange={(e) => {
                setActionTypeFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Action Types</option>
              <option value="UPDATE_ROLE_PERMISSIONS">Update Role Matrix</option>
              <option value="FREEZE_USER_PERMISSIONS">Freeze Permissions</option>
              <option value="UNFREEZE_USER_PERMISSIONS">Unfreeze Permissions</option>
              <option value="GRANT_DELEGATION">Grant Delegation</option>
              <option value="REVOKE_DELEGATION">Revoke Delegation</option>
              <option value="VERIFY_PAYMENT">Verify Payment</option>
              <option value="REJECT_PAYMENT">Reject Payment</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Staff Member</th>
                <th className="p-3">Action Type</th>
                <th className="p-3">Module / Table</th>
                <th className="p-3">Record ID</th>
                <th className="p-3">Details / Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No administrative changes recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-white">{log.staff_name || 'System Admin'}</div>
                      <div className="text-[10px] text-slate-400">{log.staff_email || 'admin@signsync.io'}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-200 capitalize">{log.module_key}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.table_affected}</div>
                    </td>
                    <td className="p-3 font-mono text-purple-300 text-[11px]">
                      {log.record_id || 'N/A'}
                    </td>
                    <td className="p-3 text-slate-300 max-w-sm truncate text-[11px]">
                      {log.new_value_json ? log.new_value_json : log.reason || 'Normal operation'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
