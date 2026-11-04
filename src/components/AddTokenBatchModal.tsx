'use client'

import React, { useState } from 'react'
import { Plus, X, Calculator } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddTokenBatchModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState({
    token_model: 'epass2003_auto',
    vendor_name: '',
    quantity_purchased: 500,
    base_unit_price: 340,
    inward_shipping_cost: 3000,
    customs_or_taxes: 8000,
    handling_charges: 1000,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  // Live total purchase cost calculation
  const totalCost =
    formData.quantity_purchased * formData.base_unit_price +
    formData.inward_shipping_cost +
    formData.customs_or_taxes +
    formData.handling_charges
  const costPerToken = formData.quantity_purchased > 0 ? (totalCost / formData.quantity_purchased).toFixed(2) : '0'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Unable to record purchase')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Please check your inputs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Record Token Purchase</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Token Model</label>
              <select
                value={formData.token_model}
                onChange={(e) => setFormData({ ...formData, token_model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              >
                <option value="epass2003_auto">ePass2003 Auto</option>
                <option value="watchdata_proxkey">Watchdata ProxKey</option>
                <option value="mtoken_crypto">mToken Crypto</option>
                <option value="trustkey">TrustKey</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Vendor Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Feitian Tech"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Quantity Purchased *</label>
              <input
                required
                type="number"
                min="1"
                value={formData.quantity_purchased}
                onChange={(e) => setFormData({ ...formData, quantity_purchased: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Base Price per Unit (₹) *</label>
              <input
                required
                type="number"
                step="0.5"
                value={formData.base_unit_price}
                onChange={(e) => setFormData({ ...formData, base_unit_price: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Freight (₹)</label>
              <input
                type="number"
                value={formData.inward_shipping_cost}
                onChange={(e) => setFormData({ ...formData, inward_shipping_cost: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Customs/Tax (₹)</label>
              <input
                type="number"
                value={formData.customs_or_taxes}
                onChange={(e) => setFormData({ ...formData, customs_or_taxes: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Handling (₹)</label>
              <input
                type="number"
                value={formData.handling_charges}
                onChange={(e) => setFormData({ ...formData, handling_charges: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Real-time Total Calculation Box */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Total Purchase Cost:</span>
              <span className="font-bold text-white">₹{totalCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>True Cost per Token:</span>
              <span className="font-bold text-cyan-400">₹{costPerToken} / unit</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Token Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

