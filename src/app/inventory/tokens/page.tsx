// Module 04: Token Stock Management & Barcode Scanning Intake (/inventory/tokens)
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Cpu,
  Calculator,
  PackageCheck,
  AlertTriangle,
  Plus,
  Barcode,
  Search,
  CheckCircle2,
  X,
  History,
  ShieldCheck,
  RefreshCw,
  Truck,
  RotateCcw,
} from 'lucide-react'
import { AddTokenBatchModal } from '@/components/AddTokenBatchModal'
import { Pagination } from '@/components/Pagination'
import { TokenPurchaseBatchRecord, BranchStockRecord } from '@/types/models'
import { UI_TERMS } from '@/lib/terms'

export default function InventoryTokensPage() {
  const [batches, setBatches] = useState<TokenPurchaseBatchRecord[]>([])
  const [stock, setStock] = useState<BranchStockRecord[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Masters
  const [tokenModels, setTokenModels] = useState<any[]>([])
  const [rmaReasons, setRmaReasons] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])

  // Barcode / Serial Intake Modal
  const [isScanModalOpen, setIsScanModalOpen] = useState(false)
  const [scanModel, setScanModel] = useState('')
  const [scanBranch, setScanBranch] = useState('')
  const [scannedSerials, setScannedSerials] = useState<string[]>([])
  const [currentInputSerial, setCurrentInputSerial] = useState('')
  const [scanError, setScanError] = useState('')
  const [scanSuccessMessage, setScanSuccessMessage] = useState('')
  const [isSubmittingSerials, setIsSubmittingSerials] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // RMA Return Modal
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false)
  const [rmaDefectiveSerial, setRmaDefectiveSerial] = useState('')
  const [rmaReasonCode, setRmaReasonCode] = useState('')
  const [rmaReplacementSerial, setRmaReplacementSerial] = useState('')
  const [rmaNotes, setRmaNotes] = useState('')
  const [rmaStatusMsg, setRmaStatusMsg] = useState('')
  const [rmaError, setRmaError] = useState('')
  const [isSubmittingRma, setIsSubmittingRma] = useState(false)

  // Audit Trail Modal
  const [auditSerial, setAuditSerial] = useState('')
  const [auditTrail, setAuditTrail] = useState<any[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)

  // Pagination states for Batches
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Load Masters & Ledger
  const loadMastersAndLedger = useCallback(() => {
    Promise.all([
      fetch('/api/dsc/masters/all').then((r) => r.json()),
      fetch('/api/reports/token-stock-ledger').then((r) => r.json()),
      fetch('/api/inventory/branches').then((r) => r.json()),
    ])
      .then(([mastersData, ledgerData, branchData]) => {
        const models = (mastersData.tokenModels || []).filter((m: any) => m.is_active !== 0)
        setTokenModels(models)
        setRmaReasons(mastersData.rmaReasons || [])
        setLedger(ledgerData.ledger || [])
        const brs = branchData.branches || []
        setBranches(brs)

        if (models.length > 0 && !scanModel) setScanModel(models[0].model_name)
        if (brs.length > 0 && !scanBranch) setScanBranch(brs[0].id)
        if ((mastersData.rmaReasons || []).length > 0 && !rmaReasonCode) {
          setRmaReasonCode(mastersData.rmaReasons[0].code)
        }
      })
      .catch((err) => console.error(err))
  }, [scanModel, scanBranch, rmaReasonCode])

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })

    Promise.all([
      fetch(`/api/inventory/batches?${params.toString()}`).then((r) => r.json()),
      fetch('/api/inventory/branches').then((r) => r.json()),
    ])
      .then(([bData, sData]) => {
        setBatches(bData.batches || [])
        setTotalCount(bData.totalCount || 0)
        setTotalPages(bData.totalPages || 1)
        setStock(sData.stock || [])
      })
      .finally(() => setLoading(false))
  }, [currentPage, pageSize])

  useEffect(() => {
    loadMastersAndLedger()
    loadData()
  }, [loadMastersAndLedger, loadData])

  // Barcode sequential scanner handler
  const handleAddScannedSerial = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = currentInputSerial.trim().toUpperCase()
    if (!clean) return

    if (scannedSerials.includes(clean)) {
      setScanError(`Serial number '${clean}' already scanned in this session.`)
      return
    }

    setScannedSerials((prev) => [clean, ...prev])
    setCurrentInputSerial('')
    setScanError('')
    if (scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }

  const handleSaveScannedSerials = async () => {
    if (scannedSerials.length === 0 || !scanModel || !scanBranch) {
      setScanError('Please scan at least one serial and select token model & branch.')
      return
    }

    setIsSubmittingSerials(true)
    setScanError('')
    setScanSuccessMessage('')

    try {
      const res = await fetch('/api/inventory/tokens/serials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial_numbers: scannedSerials,
          token_model: scanModel,
          branch_id: scanBranch,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setScanError(data.error || 'Failed to save token serials.')
        return
      }

      setScanSuccessMessage(
        `Successfully registered ${data.inserted?.length || scannedSerials.length} tokens into inventory.`
      )
      setScannedSerials([])
      loadMastersAndLedger()
      loadData()
    } catch (err: any) {
      setScanError(err.message || 'Error communicating with server')
    } finally {
      setIsSubmittingSerials(false)
    }
  }

  // RMA Submit Handler
  const handleExecuteRma = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rmaDefectiveSerial || !rmaReasonCode) return

    setIsSubmittingRma(true)
    setRmaError('')
    setRmaStatusMsg('')

    try {
      const res = await fetch('/api/inventory/tokens/rma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defective_serial: rmaDefectiveSerial,
          rma_reason_code: rmaReasonCode,
          replacement_serial: rmaReplacementSerial || undefined,
          notes: rmaNotes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setRmaError(data.error || 'RMA registration failed.')
        return
      }

      setRmaStatusMsg(`RMA recorded successfully for serial ${rmaDefectiveSerial}.`)
      setRmaDefectiveSerial('')
      setRmaReplacementSerial('')
      setRmaNotes('')
      loadMastersAndLedger()
    } catch (err: any) {
      setRmaError(err.message || 'Error processing RMA')
    } finally {
      setIsSubmittingRma(false)
    }
  }

  // Fetch Serial Audit Trail
  const handleViewAuditTrail = async (serial: string) => {
    setAuditSerial(serial)
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/reports/token-serials/${encodeURIComponent(serial)}/audit`)
      const data = await res.json()
      setAuditTrail(data.audit_trail || [])
    } catch (err) {
      console.error(err)
    } finally {
      setAuditLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{UI_TERMS.tokenStock}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Database Master-Driven
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Barcode/QR intake, sequential serial scanning, atomic reservations, dynamic stock ledger & RMA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRmaModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium text-xs flex items-center gap-1.5 border border-amber-500/30 transition"
          >
            <RotateCcw className="w-4 h-4" /> Process RMA Return
          </button>

          <button
            onClick={() => setIsScanModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <Barcode className="w-4 h-4" /> Scan Inward Barcodes
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Record Purchase
          </button>
        </div>
      </div>

      {/* Dynamic Token Stock Ledger per Database Model */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Live Hardware Token Stock Ledger (Full Lifecycle Statuses)
          </div>
          <button
            onClick={loadMastersAndLedger}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold">Token Model</th>
                <th className="p-3 font-semibold">Manufacturer</th>
                <th className="p-3 text-right font-semibold">Available</th>
                <th className="p-3 text-right font-semibold">Reserved</th>
                <th className="p-3 text-right font-semibold">Configured</th>
                <th className="p-3 text-right font-semibold">Dispatched</th>
                <th className="p-3 text-right font-semibold">Delivered</th>
                <th className="p-3 text-right font-semibold">Defective</th>
                <th className="p-3 text-right font-semibold">RMA</th>
                <th className="p-3 text-right font-semibold">Min Threshold</th>
                <th className="p-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-500 font-sans">
                    Loading ledger data from database...
                  </td>
                </tr>
              ) : (
                ledger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3 font-bold text-white flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {item.model_name}
                    </td>
                    <td className="p-3 text-slate-400 font-sans">{item.manufacturer}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">{item.available}</td>
                    <td className="p-3 text-right text-blue-400">{item.reserved}</td>
                    <td className="p-3 text-right text-purple-400">{item.configured}</td>
                    <td className="p-3 text-right text-amber-400">{item.dispatched}</td>
                    <td className="p-3 text-right text-teal-400">{item.delivered}</td>
                    <td className="p-3 text-right text-red-400">{item.defective}</td>
                    <td className="p-3 text-right text-orange-400">{item.returned_rma}</td>
                    <td className="p-3 text-right text-slate-400">{item.min_threshold}</td>
                    <td className="p-3 text-center">
                      {item.is_low_stock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 font-sans font-medium">
                          LOW STOCK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans font-medium">
                          HEALTHY
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batches Table with Total Purchase Cost breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Purchase Entries & Total Purchase Cost Breakdown</div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Accurate Purchase Cost Calculation
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold">Batch Number</th>
                <th className="p-3 font-semibold">Token Model</th>
                <th className="p-3 font-semibold">Vendor</th>
                <th className="p-3 text-right font-semibold">Quantity</th>
                <th className="p-3 text-right font-semibold">Base Price</th>
                <th className="p-3 text-right font-semibold">Inward Freight</th>
                <th className="p-3 text-right font-semibold">Customs/GST</th>
                <th className="p-3 text-right font-semibold">Handling</th>
                <th className="p-3 text-right font-semibold">Total Cost</th>
                <th className="p-3 text-right font-semibold">Cost / Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 font-sans">
                    Loading inward batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500 font-sans">
                    No token batches recorded. Click Record Token Purchase to get started.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3 font-bold text-cyan-400">{b.batch_number}</td>
                    <td className="p-3 text-white">{b.token_model}</td>
                    <td className="p-3 text-slate-300 font-sans">{b.vendor_name}</td>
                    <td className="p-3 text-right text-slate-200">{b.quantity_purchased}</td>
                    <td className="p-3 text-right text-slate-300">₹{b.base_unit_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.inward_shipping_cost?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.customs_or_taxes?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.handling_charges?.toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">
                      ₹{b.total_landed_cost?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right text-cyan-300 font-bold">
                      ₹{b.unit_landed_cost?.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          isLoading={loading}
        />
      </div>

      {/* Barcode Sequential Scanner Modal */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Sequential Barcode / QR Inward Intake</h3>
              </div>
              <button
                onClick={() => setIsScanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {scanError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {scanError}
              </div>
            )}

            {scanSuccessMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {scanSuccessMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Token Model *</label>
                <select
                  value={scanModel}
                  onChange={(e) => setScanModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {tokenModels.map((m) => (
                    <option key={m.id || m.model_name} value={m.model_name}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Destination Branch *</label>
                <select
                  value={scanBranch}
                  onChange={(e) => setScanBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sequential Input form */}
            <form onSubmit={handleAddScannedSerial} className="space-y-2">
              <label className="block text-slate-300 font-medium">
                Scan or Type Token Serial Number (Press Enter after each scan)
              </label>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  autoFocus
                  type="text"
                  placeholder="e.g. FT-2026-0005"
                  value={currentInputSerial}
                  onChange={(e) => setCurrentInputSerial(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
                >
                  Add Serial
                </button>
              </div>
            </form>

            {/* Scanned Serials List */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                <span>Scanned Serials Queue ({scannedSerials.length} units ready)</span>
                {scannedSerials.length > 0 && (
                  <button
                    onClick={() => setScannedSerials([])}
                    className="text-red-400 hover:text-red-300 text-[10px]"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {scannedSerials.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic text-[11px]">
                  No barcodes scanned yet. Connect USB/Bluetooth barcode scanner or type serials above.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {scannedSerials.map((s, idx) => (
                    <div
                      key={s}
                      className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300"
                    >
                      <span>
                        #{scannedSerials.length - idx} {s}
                      </span>
                      <button
                        onClick={() => setScannedSerials((prev) => prev.filter((x) => x !== s))}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsScanModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveScannedSerials}
                disabled={isSubmittingSerials || scannedSerials.length === 0}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition disabled:opacity-50"
              >
                {isSubmittingSerials
                  ? 'Saving to Database...'
                  : `Commit ${scannedSerials.length} Serials to Stock`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RMA Return Modal */}
      {isRmaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">Token RMA Return & Defective Replacement</h3>
              </div>
              <button
                onClick={() => setIsRmaModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {rmaError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {rmaError}
              </div>
            )}

            {rmaStatusMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {rmaStatusMsg}
              </div>
            )}

            <form onSubmit={handleExecuteRma} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Defective Token Serial *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. FT-2026-0003"
                  value={rmaDefectiveSerial}
                  onChange={(e) => setRmaDefectiveSerial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">RMA Reason (Database Master) *</label>
                <select
                  required
                  value={rmaReasonCode}
                  onChange={(e) => setRmaReasonCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {rmaReasons.map((r) => (
                    <option key={r.id || r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Replacement Token Serial (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. FT-2026-0004"
                  value={rmaReplacementSerial}
                  onChange={(e) => setRmaReplacementSerial(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  If supplied, the replacement serial will be reserved for the customer.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Diagnostic Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter RMA failure symptoms or transit damage details..."
                  value={rmaNotes}
                  onChange={(e) => setRmaNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRmaModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRma || !rmaDefectiveSerial}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingRma ? 'Submitting RMA...' : 'Confirm RMA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Inward Batch Modal */}
      <AddTokenBatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadMastersAndLedger()
          loadData()
        }}
      />
    </div>
  )
}
