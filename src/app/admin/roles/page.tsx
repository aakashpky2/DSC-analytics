// Module 01: User Roles Management (/admin/roles)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, Users, CheckCircle } from 'lucide-react'

async function getRoles() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { cache: 'no-store' })
    const roles = [
      { name: 'Administrator', level: 'Level 0', desc: 'Full office authority and access management', users: 1 },
      { name: 'Regional Partner Admin', level: 'Level 1', desc: 'Partner network and wholesale price slabs', users: 2 },
      { name: 'Branch Manager', level: 'Level 2', desc: 'Branch inventory, payments and approvals', users: 3 },
      { name: 'Operations Executive', level: 'Level 3', desc: 'DSC applications and invoice generation', users: 5 },
      { name: 'Sales Staff', level: 'Level 4', desc: 'Customer inquiries with protected contact details', users: 8 },
    ]
    return roles
  } catch {
    return []
  }
}

export default async function RolesPage() {
  const roles = await getRoles()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/admin/users" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Staff & Roles
        </Link>
        <span>/</span>
        <span className="text-white">Role Definitions</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-white">Staff Roles & Permissions</h1>
        <p className="text-xs text-slate-400 mt-1">
          Five-tier authority structure ensuring downward delegation rules and privacy enforcement.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs font-semibold text-white">System Roles Directory</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Role Name</th>
                <th className="p-3">Authority Tier</th>
                <th className="p-3">Responsibilities & Scope</th>
                <th className="p-3 text-right">Assigned Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {roles.map((r, i) => (
                <tr key={i} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-white">{r.name}</td>
                  <td className="p-3 font-mono text-indigo-400">{r.level}</td>
                  <td className="p-3 text-slate-300">{r.desc}</td>
                  <td className="p-3 text-right font-bold text-white">{r.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

