// Module 01: User Administration & RBAC (/admin/users)
import React from 'react'
import { Shield, ShieldAlert, UserCheck, Lock, Unlock, EyeOff } from 'lucide-react'

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">User Administration & Hierarchical RBAC</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Module 01
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ordered delegation tiers (Level 0 Super Admin down to Level 4 Tele-caller) with sub-permission caps and Super Admin freeze guard.
          </p>
        </div>
      </div>

      {/* Numerical Hierarchy Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {[
          { level: 'Level 0', title: 'Super Admin', desc: 'Root Master, Freeze Guard', color: 'border-red-500/40 text-red-400' },
          { level: 'Level 1', title: 'Partner Admin', desc: 'Regional Partner Network', color: 'border-indigo-500/40 text-indigo-400' },
          { level: 'Level 2', title: 'Operations Mgr', desc: 'Branch Stock & Approvals', color: 'border-cyan-500/40 text-cyan-400' },
          { level: 'Level 3', title: 'Senior Staff', desc: 'DSC Apps & Invoicing', color: 'border-emerald-500/40 text-emerald-400' },
          { level: 'Level 4', title: 'Field Staff', desc: 'CRM Leads (Masked PII)', color: 'border-amber-500/40 text-amber-400' },
        ].map((tier, idx) => (
          <div key={idx} className={`p-3 rounded-xl bg-slate-900/60 border ${tier.color} space-y-1`}>
            <div className="text-[10px] font-mono uppercase tracking-wider font-bold">{tier.level}</div>
            <div className="text-xs font-semibold text-white">{tier.title}</div>
            <div className="text-[10px] text-slate-400">{tier.desc}</div>
          </div>
        ))}
      </div>

      {/* Users Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active System Accounts</div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="text-[11px]">Field-Level PII Masking Applied</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">User & Contact</th>
                <th className="p-3">Role</th>
                <th className="p-3">Hierarchy Tier</th>
                <th className="p-3">Delegation</th>
                <th className="p-3">Freeze Guard</th>
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
                      {u.role_name || 'System Role'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-indigo-400 font-semibold">
                      Level {u.level_order} ({u.level_name})
                    </span>
                  </td>
                  <td className="p-3">
                    {u.can_grant_permissions ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Allowed
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">Restricted</span>
                    )}
                  </td>
                  <td className="p-3">
                    {u.permissions_frozen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] border border-red-500/30">
                        <Lock className="w-3 h-3" /> Frozen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                        <Unlock className="w-3 h-3" /> Normal
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

