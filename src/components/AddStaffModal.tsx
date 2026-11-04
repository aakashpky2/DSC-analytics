'use client'

import React, { useState } from 'react'
import { X, UserPlus, ShieldAlert } from 'lucide-react'

interface AddStaffModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddStaffModal({ isOpen, onClose, onSuccess }: AddStaffModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    hierarchy_level_id: 'tier-4',
    role_id: 'role-field-staff',
    initial_password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tier = e.target.value
    let roleId = 'role-field-staff'
    if (tier === 'tier-1') roleId = 'role-partner-admin'
    if (tier === 'tier-2') roleId = 'role-branch-mgr'
    if (tier === 'tier-3') roleId = 'role-senior-exec'
    if (tier === 'tier-4') roleId = 'role-field-staff'

    setFormData((prev) => ({
      ...prev,
      hierarchy_level_id: tier,
      role_id: roleId,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create staff account.')
        setLoading(false)
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError('A network error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Add New Staff Member</h3>
              <p className="text-[11px] text-slate-400">Set up login credentials and role level for office staff</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Employee Full Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company Email *</label>
              <input
                required
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Mobile Number</label>
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Access Level *</label>
              <select
                value={formData.hierarchy_level_id}
                onChange={handleRoleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="tier-1">Level 1 - Regional Partner Admin</option>
                <option value="tier-2">Level 2 - Branch Manager</option>
                <option value="tier-3">Level 3 - Operations Executive</option>
                <option value="tier-4">Level 4 - Field Staff / Tele-caller</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Initial Password *</label>
              <input
                required
                type="text"
                placeholder="At least 8 characters"
                value={formData.initial_password}
                onChange={(e) => setFormData({ ...formData, initial_password: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                minLength={8}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
