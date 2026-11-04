// Staff & Roles (/admin/users)
import React from 'react'
import { Shield, UserCheck, Lock, Unlock, EyeOff } from 'lucide-react'

async function getUsers() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/users?mask=true`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.users || []
  } catch {
    return []
  }
}

export default async function UsersPage() {
  const users = await getUsers()

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
      </div>

      {/* Staff Roles Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {[
          { title: 'Administrator', desc: 'Full office & company access', color: 'border-indigo-500/40 text-indigo-400' },
          { title: 'Regional Partner Admin', desc: 'Partner network & pricing', color: 'border-blue-500/40 text-blue-400' },
          { title: 'Branch Manager', desc: 'Branch stock & approvals', color: 'border-cyan-500/40 text-cyan-400' },
          { title: 'Operations Executive', desc: 'DSC applications & invoicing', color: 'border-emerald-500/40 text-emerald-400' },
          { title: 'Sales Staff', desc: 'Customer inquiries & calls', color: 'border-amber-500/40 text-amber-400' },
        ].map((tier, idx) => (
          <div key={idx} className={`p-3 rounded-xl bg-slate-900/60 border ${tier.color} space-y-1`}>
            <div className="text-xs font-semibold text-white">{tier.title}</div>
            <div className="text-[10px] text-slate-400">{tier.desc}</div>
          </div>
        ))}
      </div>

      {/* Users Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Employee Accounts</div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="text-[11px]">Personal contact details hidden</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Staff Name & Contact</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Role Type</th>
                <th className="p-3">Can Grant Access</th>
                <th className="p-3">Account Status</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="p-3">
                    <div className="font-semibold text-white">{u.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {u.role_name || 'Staff Member'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-indigo-300 font-medium">
                      {u.level_name || 'Office Staff'}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.can_grant_permissions ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">Standard</span>
                    )}
                  </td>
                  <td className="p-3">
                    {u.permissions_frozen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] border border-red-500/30">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                        <Unlock className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
