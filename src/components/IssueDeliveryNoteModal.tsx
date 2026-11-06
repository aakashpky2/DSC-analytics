'use client'

import React, { useState, useEffect } from 'react'
import { X, Send, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'

interface BranchStockRecord {
  id: string
  branch_id: string
  branch_name: string
  branch_code: string
  token_model: string
  quantity_on_hand: number
  quarantine_damaged: number
  min_threshold: number
}

interface BranchOption {
  id: string
  branch_name: string
  branch_code: string
  city: string
}

interface IssueDeliveryNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedStock: BranchStockRecord | null
  branches: BranchOption[]
  allStock: BranchStockRecord[]
}

export function IssueDeliveryNoteModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedStock,
  branches,
  allStock,
}: IssueDeliveryNoteModalProps) {
  const [sourceBranchId, setSourceBranchId] = useState(preselectedStock?.branch_id || branches[0]?.id || '')
  const [destBranchId, setDestBranchId] = useState(
    branches.find((b) => b.id !== (preselectedStock?.branch_id || branches[0]?.id))?.id || ''
  )
  const [tokenModels, setTokenModels] = useState<any[]>([])
  const [tokenModel, setTokenModel] = useState(preselectedStock?.token_model || '')
  const [quantity, setQuantity] = useState('')
  const [remarks, setRemarks] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ challanNumber: string } | null>(null)

  // Fetch token models from DB master
  useEffect(() => {
    fetch('/api/dsc/masters/all')
      .then((r) => r.json())
      .then((d) => {
        const models = (d.tokenModels || []).filter((m: any) => m.is_active !== 0)
        setTokenModels(models)
        if (!tokenModel && models.length > 0) {
          setTokenModel(preselectedStock?.token_model || models[0].model_name)
        }
      })
      .catch((err) => console.error(err))
  }, [preselectedStock, tokenModel])

  if (!isOpen) return null

  // Calculate live available usable stock at source branch
  const currentSourceStock = allStock.find(
    (s) => s.branch_id === sourceBranchId && s.token_model.toUpperCase() === tokenModel.toUpperCase()
  )
  const availableOnHand = currentSourceStock ? currentSourceStock.quantity_on_hand : 0
  const damagedUnits = currentSourceStock ? currentSourceStock.quarantine_damaged : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (sourceBranchId === destBranchId) {
      setError('Please select another branch. Source and destination branches must differ.')
      return
    }

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive whole number.')
      return
    }

    if (qty > availableOnHand) {
      setError(`Not enough stock available. Maximum usable units at selected branch is ${availableOnHand}.`)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_branch_id: sourceBranchId,
          destination_branch_id: destBranchId,
          token_model: tokenModel,
          quantity: qty,
          remarks: remarks.trim() || 'Inter-branch stock transfer',
          transfer_date: transferDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to issue delivery note.')
        return
      }

      setSuccessInfo({ challanNumber: data.challan_number })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Network error occurred while creating transfer note.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!successInfo) return
    window.open(`/api/inventory/transfers/pdf?challan_number=${encodeURIComponent(successInfo.challanNumber)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Issue Delivery Note (Challan)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Delivery Note Created Successfully!</div>
                <div className="mt-1 text-slate-300">
                  Challan Reference:{' '}
                  <span className="font-mono text-emerald-300 font-bold">{successInfo.challanNumber}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Stock has been deducted from origin branch and transfer status is marked as In Transit.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
              >
                Download PDF Challan
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Source Branch (From) *</label>
                <select
                  required
                  value={sourceBranchId}
                  onChange={(e) => setSourceBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Destination Branch (To) *</label>
                <select
                  required
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.id === sourceBranchId}>
                      {b.branch_name} ({b.branch_code}) {b.id === sourceBranchId ? '(Source)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Token Model (Database Master) *</label>
                <select
                  required
                  value={tokenModel}
                  onChange={(e) => setTokenModel(e.target.value)}
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
                <label className="block text-slate-300 font-medium mb-1">Quantity (Units) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max={availableOnHand > 0 ? availableOnHand : 1}
                  placeholder={`Max: ${availableOnHand}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            {/* Live Stock Availability Box */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span>Available Usable Stock at Source:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    availableOnHand > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {availableOnHand} units
                </span>
              </div>
              {damagedUnits > 0 && (
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Quarantined / Defective Units:</span>
                  <span className="font-mono text-amber-400">{damagedUnits} units</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Dispatch Date</label>
                <input
                  required
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Dispatch Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Replenishment for Branch"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || availableOnHand <= 0}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {loading ? 'Issuing...' : 'Issue Delivery Note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
