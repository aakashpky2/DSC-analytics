'use client'

import React, { useState } from 'react'
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
  const [tokenModel, setTokenModel] = useState(preselectedStock?.token_model || 'epass2003_auto')
  const [quantity, setQuantity] = useState('')
  const [remarks, setRemarks] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successInfo, setSuccessInfo] = useState<{ challanNumber: string } | null>(null)

  if (!isOpen) return null

  // Calculate live available usable stock at source branch
  const currentSourceStock = allStock.find(
    (s) => s.branch_id === sourceBranchId && s.token_model === tokenModel
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
        setLoading(false)
        return
      }

      setSuccessInfo({ challanNumber: data.challan_number })
      onSuccess()
    } catch {
      setError('A network error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleDownloadPdf = () => {
    if (successInfo) {
      window.open(`/api/inventory/transfers/pdf?challan_number=${successInfo.challanNumber}`, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Issue Delivery Note</h3>
              <p className="text-[11px] text-slate-400">Transfer hardware token stock between office branches</p>
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
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successInfo ? (
          <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-semibold text-white">Delivery Note Created Successfully</div>
            <p className="text-xs text-slate-300">
              Challan <span className="font-mono text-emerald-300 font-bold">{successInfo.challanNumber}</span> has been dispatched and source branch stock deducted.
            </p>
            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> View Delivery Challan PDF
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Stock Availability Callout */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[11px]">Usable Stock Available: </span>
                <span className="text-emerald-400 font-bold text-sm ml-1">{availableOnHand} units</span>
              </div>
              {damagedUnits > 0 && (
                <div className="text-[11px] text-amber-400">
                  {damagedUnits} units quarantined (excluded)
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Transfer Date *</label>
                <input
                  required
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Token Model *</label>
                <select
                  value={tokenModel}
                  onChange={(e) => setTokenModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="epass2003_auto">ePass2003 Auto</option>
                  <option value="watchdata_proxkey">Watchdata Proxkey</option>
                  <option value="mtoken_crypto">mToken Crypto</option>
                  <option value="trustkey">TrustKey</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">From Source Branch *</label>
                <select
                  value={sourceBranchId}
                  onChange={(e) => setSourceBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">To Destination Branch *</label>
                <select
                  value={destBranchId}
                  onChange={(e) => setDestBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.id === sourceBranchId}>
                      {b.branch_name} ({b.branch_code}) {b.id === sourceBranchId ? '(Source)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Quantity to Transfer * <span className="text-slate-500 font-normal">(Max: {availableOnHand})</span>
              </label>
              <input
                required
                type="number"
                min={1}
                max={availableOnHand || 1}
                placeholder="e.g. 25"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Remarks / Transfer Purpose</label>
              <input
                type="text"
                placeholder="e.g. Stock replenishment for North Zone partners"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
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
                disabled={loading || availableOnHand <= 0}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-md shadow-cyan-600/20 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? 'Creating...' : 'Issue Delivery Note'} <Send className="w-3 h-3" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
