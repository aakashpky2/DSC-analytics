'use client'

import React, { useState, useEffect } from 'react'
import { Plus, X, Calculator } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddTokenBatchModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [tokenModels, setTokenModels] = useState<any[]>([])
  const [hardwareVendors, setHardwareVendors] = useState<any[]>([])

  const [formData, setFormData] = useState({
    token_model: '',
    vendor_name: '',
    quantity_purchased: 500,
    base_unit_price: 340,
    inward_shipping_cost: 3000,
    customs_or_taxes: 8000,
    handling_charges: 1000,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load active token models and hardware vendors dynamically from DB
  useEffect(() => {
    fetch('/api/dsc/masters/all')
      .then((r) => r.json())
      .then((d) => {
        const activeModels = (d.tokenModels || []).filter((m: any) => m.is_active !== 0)
        const activeVendors = (d.hardwareVendors || []).filter((v: any) => v.is_active !== 0)

        setTokenModels(activeModels)
        setHardwareVendors(activeVendors)

        setFormData((prev) => ({
          ...prev,
          token_model: prev.token_model || activeModels[0]?.model_name || '',
          vendor_name: prev.vendor_name || activeVendors[0]?.vendor_name || '',
        }))
      })
      .catch((err) => console.error(err))
  }, [])

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
              <label className="block text-slate-300 font-medium mb-1">Token Model (Database Master)</label>
              <select
                required
                value={formData.token_model}
                onChange={(e) => setFormData({ ...formData, token_model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              >
                {tokenModels.map((m) => (
                  <option key={m.id || m.model_name} value={m.model_name}>
                    {m.model_name} ({m.manufacturer})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Vendor Name (Database Master) *</label>
              <select
                required
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              >
                {hardwareVendors.map((v) => (
                  <option key={v.id || v.vendor_name} value={v.vendor_name}>
                    {v.vendor_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Quantity Purchased (Units) *</label>
              <input
                required
                type="number"
                min="1"
                value={formData.quantity_purchased}
                onChange={(e) => setFormData({ ...formData, quantity_purchased: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Base Unit Price (₹ / token) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formData.base_unit_price}
                onChange={(e) => setFormData({ ...formData, base_unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Inward Freight (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.inward_shipping_cost}
                onChange={(e) => setFormData({ ...formData, inward_shipping_cost: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Customs / GST (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.customs_or_taxes}
                onChange={(e) => setFormData({ ...formData, customs_or_taxes: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Handling Fees (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.handling_charges}
                onChange={(e) => setFormData({ ...formData, handling_charges: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 border border-cyan-500/20 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span>Total Landed Inward Cost:</span>
              <span className="font-mono text-cyan-400 font-bold text-sm">₹{totalCost.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Calculated Cost Per Token:</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">₹{costPerToken}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || formData.quantity_purchased <= 0}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Save Inward Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
