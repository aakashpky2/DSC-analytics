// Module 01: User Roles Management & Interactive Permission Matrix (/admin/roles)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Shield,
  Users,
  CheckCircle,
  Plus,
  Edit2,
  X,
  Lock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Check,
} from 'lucide-react'

interface RoleItem {
  id: string
  name: string
  description: string
  hierarchy_level_id: string
  level_order: number
  level_name: string
  staff_count: number
}

interface HierarchyLevel {
  id: string
  level_order: number
  level_name: string
  can_delegate_default: number
}

interface AppModule {
  id: string
  module_key: string
  display_name: string
  route_path: string
}

interface RolePermission {
  id?: string
  role_id: string
  module_id: string
  can_view: number | boolean
  can_create: number | boolean
  can_edit: number | boolean
  can_delete: number | boolean
  can_export: number | boolean
  mask_pii_fields: number | boolean
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([])
  const [modules, setModules] = useState<AppModule[]>([])
  const [allPermissions, setAllPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)

  // Selected role for editing permissions
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null)
  const [editedPerms, setEditedPerms] = useState<Record<string, {
    can_view: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
    can_export: boolean
    mask_pii_fields: boolean
  }>>({})

  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = () => {
    setLoading(true)
    fetch('/api/admin/roles')
      .then((r) => r.json())
      .then((d) => {
        setRoles(d.roles || [])
        setHierarchyLevels(d.levels || [])
        setModules(d.modules || [])
        setAllPermissions(d.rolePermissions || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  // When a role is clicked for editing, load its specific permissions
  const handleOpenEdit = (role: RoleItem) => {
    if (role.level_order === 0) {
      alert('Super Administrator holds absolute root authority across all modules and cannot be restricted.')
      return
    }

    setSelectedRole(role)
    setErrorMsg('')
    setSuccessMsg('')

    const permsMap: Record<string, any> = {}
    modules.forEach((m) => {
      const match = allPermissions.find((p) => p.role_id === role.id && p.module_id === m.id)
      permsMap[m.id] = {
        can_view: match ? Boolean(match.can_view) : false,
        can_create: match ? Boolean(match.can_create) : false,
        can_edit: match ? Boolean(match.can_edit) : false,
        can_delete: match ? Boolean(match.can_delete) : false,
        can_export: match ? Boolean(match.can_export) : false,
        mask_pii_fields: match ? Boolean(match.mask_pii_fields) : true,
      }
    })
    setEditedPerms(permsMap)
  }

  const handleToggle = (moduleId: string, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_export' | 'mask_pii_fields') => {
    setEditedPerms((prev) => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [field]: !prev[moduleId]?.[field],
      },
    }))
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const payload = modules.map((m) => ({
        module_id: m.id,
        can_view: editedPerms[m.id]?.can_view || false,
        can_create: editedPerms[m.id]?.can_create || false,
        can_edit: editedPerms[m.id]?.can_edit || false,
        can_delete: editedPerms[m.id]?.can_delete || false,
        can_export: editedPerms[m.id]?.can_export || false,
        mask_pii_fields: editedPerms[m.id]?.mask_pii_fields || false,
      }))

      const res = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: payload }),
      })

      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to update permissions')

      setSuccessMsg(`Permissions for "${selectedRole.name}" updated successfully.`)
      loadData()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

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
            Five-tier authority structure ensuring downward delegation rules and field-level privacy enforcement.
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
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Configured Roles Directory ({roles.length})</div>
          <div className="text-[11px] text-slate-400">Click &ldquo;Configure Permissions&rdquo; on any role to adjust operational privileges</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Role Name</th>
                <th className="p-3">Authority Tier</th>
                <th className="p-3">Responsibilities & Scope</th>
                <th className="p-3 text-center">Active Staff</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Loading role configurations...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No roles found.
                  </td>
                </tr>
              ) : (
                roles.map((r: RoleItem) => {
                  const isSuper = r.level_order === 0
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 cursor-pointer" onClick={() => handleOpenEdit(r)}>
                      <td className="p-3 font-semibold text-white flex items-center gap-2">
                        <Shield className={`w-3.5 h-3.5 ${isSuper ? 'text-amber-400' : 'text-indigo-400'}`} />
                        <span>{r.name}</span>
                      </td>
                      <td className="p-3 font-mono text-indigo-400">
                        Tier {r.level_order} ({r.level_name})
                      </td>
                      <td className="p-3 text-slate-300">{r.description}</td>
                      <td className="p-3 text-center font-bold text-white">{r.staff_count || 0}</td>
                      <td className="p-3 text-right">
                        {isSuper ? (
                          <span className="px-2 py-1 rounded bg-slate-800/60 text-slate-500 text-[10px] font-mono flex items-center justify-end gap-1">
                            <Lock className="w-3 h-3" /> Root Authority
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ml-auto"
                          >
                            <Sliders className="w-3 h-3" /> Configure Permissions
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Configuration Panel / Modal */}
      {selectedRole && (
        <div className="rounded-2xl border border-indigo-900/50 bg-slate-900/90 p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  Permission Matrix: <span className="text-indigo-300">{selectedRole.name}</span>
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Tier {selectedRole.level_order}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure module privileges and privacy masking for all staff members assigned to this role.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePermissions}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Matrix Grid */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <th className="p-3 font-semibold">Application Module</th>
                  <th className="p-3 text-center font-semibold">View / Read</th>
                  <th className="p-3 text-center font-semibold">Create / Issue</th>
                  <th className="p-3 text-center font-semibold">Edit / Verify</th>
                  <th className="p-3 text-center font-semibold">Delete / Deactivate</th>
                  <th className="p-3 text-center font-semibold">Export Data</th>
                  <th className="p-3 text-center font-semibold">Mask Personal Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {modules.map((m) => {
                  const perm = editedPerms[m.id] || {
                    can_view: false,
                    can_create: false,
                    can_edit: false,
                    can_delete: false,
                    can_export: false,
                    mask_pii_fields: true,
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-900/50">
                      <td className="p-3">
                        <div className="font-semibold text-white">{m.display_name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{m.route_path}</div>
                      </td>

                      {/* View Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_view}
                          onChange={() => handleToggle(m.id, 'can_view')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Create Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_create}
                          onChange={() => handleToggle(m.id, 'can_create')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Edit Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_edit}
                          onChange={() => handleToggle(m.id, 'can_edit')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Delete Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_delete}
                          onChange={() => handleToggle(m.id, 'can_delete')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Export Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_export}
                          onChange={() => handleToggle(m.id, 'can_export')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Mask PII Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={perm.mask_pii_fields}
                          onChange={() => handleToggle(m.id, 'mask_pii_fields')}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-slate-400">
              * Changes take effect immediately for all active employees assigned to this role upon save.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePermissions}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Permission Matrix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
