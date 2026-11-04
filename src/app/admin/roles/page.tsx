// Module 01: User Roles Management (/admin/roles)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, Users, CheckCircle, Plus, Edit2, X, Lock } from 'lucide-react'

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([])
  const [hierarchyLevels, setHierarchyLevels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    setLoading(true)
    fetch('/api/admin/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || [])
        setHierarchyLevels(d.levels || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/admin/users" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Staff & Roles
        </Link>
        <span>/</span>
        <span className="text-white">Role Definitions</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Staff Roles & Permissions</h1>
          <p className="text-xs text-slate-400 mt-1">
            Five-tier authority structure ensuring downward delegation rules and privacy enforcement.
          </p>
        </div>
      </div>

      {/* Hierarchy Levels Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {hierarchyLevels.map((lvl) => (
          <div key={lvl.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-indigo-400">Level {lvl.level_order}</span>
              {lvl.can_delegate_default ? (
                <span className="text-[9px] px-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Delegates</span>
              ) : (
                <span className="text-[9px] px-1.5 rounded bg-slate-800 text-slate-400">No Delegation</span>
              )}
            </div>
            <div className="text-xs font-semibold text-white">{lvl.level_name}</div>
          </div>
        ))}
      </div>

      {/* System Roles Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs font-semibold text-white">Configured Roles Directory ({roles.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Role Name</th>
                <th className="p-3">Authority Tier</th>
                <th className="p-3">Responsibilities & Scope</th>
                <th className="p-3 text-right">Active Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Loading role configurations...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No roles found.
                  </td>
                </tr>
              ) : (
                roles.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{r.name}</span>
                    </td>
                    <td className="p-3 font-mono text-indigo-400">
                      Tier {r.level_order} ({r.level_name})
                    </td>
                    <td className="p-3 text-slate-300">{r.description}</td>
                    <td className="p-3 text-right font-bold text-white">{r.staff_count || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
