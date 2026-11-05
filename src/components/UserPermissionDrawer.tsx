'use client'

import React, { useState, useEffect } from 'react'
import { X, Shield, Lock, Unlock, Eye, EyeOff, Save, CheckCircle2 } from 'lucide-react'

interface UserPermissionDrawerProps {
  isOpen: boolean
  user: any | null
  onClose: () => void
  onSuccess: () => void
}

export function UserPermissionDrawer({ isOpen, user, onClose, onSuccess }: UserPermissionDrawerProps) {
  const [modules, setModules] = useState<any[]>([])
  const [permissions, setPermissions] = useState<Record<string, {
    can_view: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
    mask_pii_fields: boolean
  }>>({})
  const [frozen, setFrozen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !user) return

    setFrozen(Boolean(user.permissions_frozen))
    setLoading(true)

    // Fetch app modules and user overrides / role perms
    Promise.all([
      fetch('/api/admin/roles').then(r => r.json()),
      fetch(`/api/admin/users/${user.id}/permissions`).then(r => r.json()).catch(() => ({ perms: [] }))
    ])
      .then(([roleData, userPermsData]) => {
        const mods = roleData.modules || []
        setModules(mods)

        const permMap: Record<string, any> = {}
        const userOverrides = userPermsData.overrides || []
        const rolePerms = roleData.rolePermissions?.filter((rp: any) => rp.role_id === user.role_id) || []

        mods.forEach((m: any) => {
          const override = userOverrides.find((o: any) => o.module_id === m.id)
          const roleDef = rolePerms.find((r: any) => r.module_id === m.id)

          permMap[m.id] = {
            can_view: override ? Boolean(override.can_view) : (roleDef ? Boolean(roleDef.can_view) : false),
            can_create: override ? Boolean(override.can_create) : (roleDef ? Boolean(roleDef.can_create) : false),
            can_edit: override ? Boolean(override.can_edit) : (roleDef ? Boolean(roleDef.can_edit) : false),
            can_delete: override ? Boolean(override.can_delete) : (roleDef ? Boolean(roleDef.can_delete) : false),
            mask_pii_fields: override ? Boolean(override.mask_pii_fields) : (roleDef ? Boolean(roleDef.mask_pii_fields) : true)
          }
        })

        setPermissions(permMap)
      })
      .finally(() => setLoading(false))
  }, [isOpen, user])

  if (!isOpen || !user) return null

  const handleToggle = (moduleId: string, field: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [field]: !prev[moduleId]?.[field as keyof typeof prev[string]]
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccessMsg('')
    try {
      // 1. Update freeze switch
      await fetch(`/api/admin/users/${user.id}/freeze`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frozen: frozen ? 1 : 0 })
      })

      // 2. Save individual overrides
      const payload = Object.entries(permissions).map(([moduleId, perms]) => ({
        module_id: moduleId,
        ...perms
      }))

      await fetch(`/api/admin/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: payload })
      })

      setSuccessMsg('Permissions and access policies successfully updated.')
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (e: any) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Permission Editor: {user.full_name}
              </h2>
              <p className="text-[11px] text-slate-400">
                {user.email} &bull; <span className="text-indigo-400 font-medium">{user.role_name}</span> (Tier {user.level_order})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Super Admin Freeze Switch Banner */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              {frozen ? <Lock className="w-3.5 h-3.5 text-red-400" /> : <Unlock className="w-3.5 h-3.5 text-emerald-400" />}
              Super Admin Freeze Permissions Switch
            </div>
            <p className="text-[10px] text-slate-400">
              When frozen, this account is restricted from executing sensitive delegations or role changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFrozen(!frozen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
              frozen
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {frozen ? 'Frozen (Locked)' : 'Active (Normal)'}
          </button>
        </div>

        {successMsg && (
          <div className="m-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Granular CRUD & PII Masking Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-xs font-semibold text-white">Granular Module Permissions & PII Masking</div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading permissions matrix...</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <th className="p-3">Module</th>
                    <th className="p-3 text-center">View</th>
                    <th className="p-3 text-center">Create</th>
                    <th className="p-3 text-center">Edit</th>
                    <th className="p-3 text-center">Delete</th>
                    <th className="p-3 text-center">Mask PII</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {modules.map((m: any) => {
                    const p = permissions[m.id] || {
                      can_view: false,
                      can_create: false,
                      can_edit: false,
                      can_delete: false,
                      mask_pii_fields: true
                    }
                    return (
                      <tr key={m.id} className="hover:bg-slate-900/50">
                        <td className="p-3 font-medium text-white">{m.display_name}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.can_view}
                            onChange={() => handleToggle(m.id, 'can_view')}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.can_create}
                            onChange={() => handleToggle(m.id, 'can_create')}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.can_edit}
                            onChange={() => handleToggle(m.id, 'can_edit')}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.can_delete}
                            onChange={() => handleToggle(m.id, 'can_delete')}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.mask_pii_fields}
                            onChange={() => handleToggle(m.id, 'mask_pii_fields')}
                            className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}
