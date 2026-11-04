'use client'

import React, { useState } from 'react'
import { X, Save } from 'lucide-react'

interface EditPartnerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  partner: any
}

export function EditPartnerModal({
  isOpen,
  onClose,
  onSuccess,
  partner,
}: EditPartnerModalProps) {
  const [formData, setFormData] = useState({
    company_name: partner?.company_name || '',
    contact_person: partner?.contact_person || '',
    email: partner?.email || '',
    phone: partner?.phone || '',
    billing_address: partner?.billing_address || '',
    state_code: partner?.state_code || '27',
    credit_limit: String(partner?.credit_limit || 50000),
    credit_period_days: String(partner?.credit_period_days || 30),
    status: partner?.status || 'active',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !partner) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update partner details.')
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-white text-sm">Edit Partner & Credit Controls</h3>
            <span className="font-mono text-indigo-400 text-[11px]">{partner.partner_code}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
              <input
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Contact Person *</label>
              <input
                required
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email *</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Phone *</label>
              <input
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Credit Limit (₹) *</label>
              <input
                required
                type="number"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Credit Period (Days) *</label>
              <input
                required
                type="number"
                value={formData.credit_period_days}
                onChange={(e) => setFormData({ ...formData, credit_period_days: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Billing State Code (GST) *</label>
              <input
                required
                value={formData.state_code}
                onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Account Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white capitalize"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Billing Address</label>
            <textarea
              rows={2}
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {submitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

