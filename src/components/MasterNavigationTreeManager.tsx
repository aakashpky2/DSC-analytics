'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  FolderTree,
  Plus,
  Edit2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Tag,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/components/ToastProvider'

export interface NavItem {
  id: string
  parent_id: string | null
  name: string
  code: string
  type: 'MODULE' | 'SUB_MODULE' | 'MASTER'
  route?: string | null
  icon?: string | null
  display_order: number
  is_active: number
  permission_key?: string | null
  master_resource?: string | null
  created_at?: string
  updated_at?: string
}

interface MasterNavigationTreeManagerProps {
  onSelectMaster?: (resourceKey: string) => void
  currentResourceKey?: string
}

export function MasterNavigationTreeManager({
  onSelectMaster,
  currentResourceKey
}: MasterNavigationTreeManagerProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<NavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [targetType, setTargetType] = useState<'MODULE' | 'SUB_MODULE' | 'MASTER'>('MODULE')
  const [parentSelection, setParentSelection] = useState<string>('')
  const [editingItem, setEditingItem] = useState<NavItem | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    route: '',
    icon: '',
    display_order: 1,
    permission_key: '',
    master_resource: '',
    is_active: 1
  })

  const [submitting, setSubmitting] = useState(false)

  const loadNavigation = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/master-navigation')
      const json = await res.json()
      if (res.ok && json.items) {
        setItems(json.items)
        // Auto expand all top-level modules
        const expanded: Record<string, boolean> = {}
        json.items.forEach((item: NavItem) => {
          if (item.type === 'MODULE' || item.type === 'SUB_MODULE') {
            expanded[item.id] = true
          }
        })
        setExpandedNodes(expanded)
      } else {
        showToast({
          type: 'error',
          status: res.status,
          title: 'Failed to Load Navigation',
          message: json.error || 'Unable to load master navigation tree.'
        })
      }
    } catch {
      showToast({
        type: 'error',
        status: 500,
        title: 'Connection Error',
        message: 'Could not connect to master navigation service.'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNavigation()
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Hierarchy grouping
  const modules = useMemo(() => {
    return items
      .filter((i) => i.type === 'MODULE')
      .sort((a, b) => a.display_order - b.display_order)
  }, [items])

  const subModulesByParent = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    items
      .filter((i) => i.type === 'SUB_MODULE')
      .forEach((sub) => {
        if (!sub.parent_id) return
        const list = map.get(sub.parent_id) || []
        list.push(sub)
        map.set(sub.parent_id, list)
      })
    // Sort each group
    map.forEach((list) => list.sort((a, b) => a.display_order - b.display_order))
    return map
  }, [items])

  const mastersByParent = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    items
      .filter((i) => i.type === 'MASTER')
      .forEach((mast) => {
        if (!mast.parent_id) return
        const list = map.get(mast.parent_id) || []
        list.push(mast)
        map.set(mast.parent_id, list)
      })
    map.forEach((list) => list.sort((a, b) => a.display_order - b.display_order))
    return map
  }, [items])

  const handleOpenCreateModal = (type: 'MODULE' | 'SUB_MODULE' | 'MASTER', parentId?: string) => {
    setModalMode('create')
    setTargetType(type)
    setParentSelection(parentId || '')
    setEditingItem(null)
    setFormData({
      name: '',
      code: '',
      route: type === 'MASTER' ? '/admin/settings?key=' : '',
      icon: type === 'MODULE' ? 'Building2' : type === 'SUB_MODULE' ? 'Layers' : 'Tag',
      display_order: items.length + 1,
      permission_key: 'admin_users',
      master_resource: '',
      is_active: 1
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: NavItem) => {
    setModalMode('edit')
    setTargetType(item.type)
    setParentSelection(item.parent_id || '')
    setEditingItem(item)
    setFormData({
      name: item.name,
      code: item.code,
      route: item.route || '',
      icon: item.icon || '',
      display_order: item.display_order,
      permission_key: item.permission_key || '',
      master_resource: item.master_resource || '',
      is_active: item.is_active
    })
    setIsModalOpen(true)
  }

  const handleToggleStatus = async (item: NavItem) => {
    const newStatus = item.is_active ? 0 : 1
    try {
      const res = await fetch(`/api/admin/master-navigation/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      })
      const json = await res.json()
      if (res.ok) {
        showToast({
          type: 'success',
          status: 200,
          title: 'Status Updated',
          message: `${item.name} is now ${newStatus ? 'Active' : 'Inactive'}.`
        })
        loadNavigation()
      } else {
        showToast({
          type: 'error',
          status: res.status,
          title: 'Status Update Failed',
          message: json.error || 'Unable to update status.'
        })
      }
    } catch {
      showToast({
        type: 'error',
        status: 500,
        title: 'Error',
        message: 'Could not contact server.'
      })
    }
  }

  const handleReorder = async (item: NavItem, direction: 'up' | 'down') => {
    // Find siblings
    const siblings = items
      .filter((i) => i.type === item.type && i.parent_id === item.parent_id)
      .sort((a, b) => a.display_order - b.display_order)

    const index = siblings.findIndex((s) => s.id === item.id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === siblings.length - 1) return

    const swapTarget = direction === 'up' ? siblings[index - 1] : siblings[index + 1]

    const orderings = [
      { id: item.id, display_order: swapTarget.display_order },
      { id: swapTarget.id, display_order: item.display_order }
    ]

    try {
      const res = await fetch('/api/admin/master-navigation/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderings })
      })
      if (res.ok) {
        loadNavigation()
      }
    } catch (e) {
      console.error('Failed to reorder:', e)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.code.trim()) {
      showToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please provide both a Name and Code.'
      })
      return
    }

    setSubmitting(true)
    try {
      const url = modalMode === 'create'
        ? '/api/admin/master-navigation'
        : `/api/admin/master-navigation/${editingItem?.id}`
      const method = modalMode === 'create' ? 'POST' : 'PUT'

      const payload = {
        ...formData,
        type: targetType,
        parent_id: parentSelection || null
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (res.ok) {
        showToast({
          type: 'success',
          status: res.status,
          title: modalMode === 'create' ? 'Created Successfully' : 'Updated Successfully',
          message: json.message || `${formData.name} saved successfully.`
        })
        setIsModalOpen(false)
        loadNavigation()
      } else {
        showToast({
          type: 'error',
          status: res.status,
          title: 'Operation Failed',
          message: json.error || 'Failed to save navigation item.'
        })
      }
    } catch {
      showToast({
        type: 'error',
        status: 500,
        title: 'Error',
        message: 'Unable to communicate with server.'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-400" />
            Configurable Hierarchical Master Navigation (3-Level Architecture)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Module → Sub-Module → Master configuration with granular display orders and access scopes.
          </p>
        </div>

        <button
          onClick={() => handleOpenCreateModal('MODULE')}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Top Module
        </button>
      </div>

      {/* Expandable Navigation Tree */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 divide-y divide-slate-900/80">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Loading master hierarchy configuration...
          </div>
        ) : modules.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No navigation modules configured yet.
          </div>
        ) : (
          modules.map((mod) => {
            const isModExpanded = Boolean(expandedNodes[mod.id])
            const subModules = subModulesByParent.get(mod.id) || []
            // Some masters may directly attach to module if no sub-module
            const directMasters = mastersByParent.get(mod.id) || []

            return (
              <div key={mod.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                {/* Level 1: Module Row */}
                <div className="flex items-center justify-between group p-2 rounded-lg bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(mod.id)}
                      className="p-1 rounded text-slate-400 hover:text-white transition"
                    >
                      {isModExpanded ? (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      LEVEL 1 : MODULE
                    </span>
                    <span className="text-sm font-bold text-white tracking-wide">
                      {mod.name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ({mod.code})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleReorder(mod, 'up')}
                      title="Move Up"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleReorder(mod, 'down')}
                      title="Move Down"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(mod)}
                      title={mod.is_active ? 'Deactivate Module' : 'Activate Module'}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      {mod.is_active ? (
                        <ToggleRight className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-rose-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(mod)}
                      title="Edit Module"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenCreateModal('SUB_MODULE', mod.id)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" /> Sub-Module
                    </button>
                  </div>
                </div>

                {/* Level 2: Sub-Modules */}
                {isModExpanded && (
                  <div className="pl-6 space-y-2 border-l border-indigo-900/30 ml-3">
                    {subModules.length === 0 && directMasters.length === 0 && (
                      <div className="text-xs text-slate-500 py-1 italic">
                        No sub-modules or masters configured under {mod.name}.
                      </div>
                    )}

                    {subModules.map((sub) => {
                      const isSubExpanded = Boolean(expandedNodes[sub.id])
                      const masters = mastersByParent.get(sub.id) || []

                      return (
                        <div key={sub.id} className="space-y-1.5">
                          {/* Sub-module Row */}
                          <div className="flex items-center justify-between group p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 transition">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpand(sub.id)}
                                className="p-1 rounded text-slate-400 hover:text-white transition"
                              >
                                {isSubExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                LEVEL 2 : SUB-MODULE
                              </span>
                              <span className="text-xs font-semibold text-slate-200">
                                {sub.name}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                ({sub.code})
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                              <button
                                onClick={() => handleReorder(sub, 'up')}
                                title="Move Up"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleReorder(sub, 'down')}
                                title="Move Down"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(sub)}
                                title={sub.is_active ? 'Deactivate' : 'Activate'}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                {sub.is_active ? (
                                  <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <ToggleLeft className="w-3.5 h-3.5 text-rose-400" />
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(sub)}
                                title="Edit Sub-module"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleOpenCreateModal('MASTER', sub.id)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-medium flex items-center gap-1 transition"
                              >
                                <Plus className="w-3 h-3" /> Master
                              </button>
                            </div>
                          </div>

                          {/* Level 3: Masters */}
                          {isSubExpanded && (
                            <div className="pl-6 space-y-1 border-l border-purple-900/30 ml-3">
                              {masters.length === 0 ? (
                                <div className="text-[11px] text-slate-500 py-1 italic">
                                  No masters added under this sub-module.
                                </div>
                              ) : (
                                masters.map((mast) => {
                                  const isSelected = currentResourceKey === mast.master_resource

                                  return (
                                    <div
                                      key={mast.id}
                                      className={`flex items-center justify-between group p-1.5 px-2.5 rounded-md text-xs transition border ${
                                        isSelected
                                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                                          : 'bg-slate-900/30 border-slate-800/40 text-slate-300 hover:bg-slate-900/60'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Tag className="w-3 h-3 text-indigo-400" />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onSelectMaster && mast.master_resource) {
                                              onSelectMaster(mast.master_resource)
                                            }
                                          }}
                                          className="font-medium hover:underline text-left cursor-pointer"
                                        >
                                          {mast.name}
                                        </button>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          ({mast.code})
                                        </span>
                                        {!mast.is_active && (
                                          <span className="px-1 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                            Inactive
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                                        {mast.master_resource && onSelectMaster && (
                                          <button
                                            onClick={() => onSelectMaster(mast.master_resource!)}
                                            className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 flex items-center gap-0.5 transition cursor-pointer"
                                            title="Open Master Editor"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5" /> Open
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleReorder(mast, 'up')}
                                          title="Move Up"
                                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleReorder(mast, 'down')}
                                          title="Move Down"
                                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleToggleStatus(mast)}
                                          title={mast.is_active ? 'Deactivate Master' : 'Activate Master'}
                                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                        >
                                          {mast.is_active ? (
                                            <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                                          ) : (
                                            <ToggleLeft className="w-3.5 h-3.5 text-rose-400" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleOpenEditModal(mast)}
                                          title="Edit Master Settings"
                                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit Navigation Node Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                {modalMode === 'create' ? `Add ${targetType}` : `Edit ${targetType}`}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Parent Selector (if Sub-Module or Master) */}
              {targetType === 'SUB_MODULE' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Parent Module <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={parentSelection}
                    onChange={(e) => setParentSelection(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Parent Module...</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'MASTER' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Parent Sub-Module / Module <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={parentSelection}
                    onChange={(e) => setParentSelection(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Select Parent Container...</option>
                    <optgroup label="Sub-Modules (Recommended 3-Level)">
                      {items
                        .filter((i) => i.type === 'SUB_MODULE')
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Direct Modules (Optional 2-Level)">
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Title / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g. Lead Categories"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Identifier Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                  required
                  placeholder="e.g. lead_categories"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Route & Master Resource (for MASTER type) */}
              {targetType === 'MASTER' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Route Path
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) => setFormData((prev) => ({ ...prev, route: e.target.value }))}
                      placeholder="/admin/settings?key=..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Master Resource Key
                    </label>
                    <input
                      type="text"
                      value={formData.master_resource}
                      onChange={(e) => setFormData((prev) => ({ ...prev, master_resource: e.target.value }))}
                      placeholder="e.g. lead_categories"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Display Order & Permission Key */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.display_order}
                    onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Permission Scope Key
                  </label>
                  <input
                    type="text"
                    value={formData.permission_key}
                    onChange={(e) => setFormData((prev) => ({ ...prev, permission_key: e.target.value }))}
                    placeholder="e.g. crm or admin_users"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : modalMode === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
