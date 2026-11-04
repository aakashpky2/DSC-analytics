// Module 04: Token Stock Management with Record Purchase Modal & Simple Wording
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Calculator, PackageCheck, AlertTriangle, Plus } from 'lucide-react'
import { AddTokenBatchModal } from '@/components/AddTokenBatchModal'
import { Pagination } from '@/components/Pagination'
import { TokenPurchaseBatchRecord, BranchStockRecord } from '@/types/models'
import { UI_TERMS } from '@/lib/terms'

export default function InventoryTokensPage() {
  const [batches, setBatches] = useState<TokenPurchaseBatchRecord[]>([])
  const [stock, setStock] = useState<BranchStockRecord[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Pagination states for Batches
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Pagination states for Branch Stock matrix
  const [stockPage, setStockPage] = useState(1)
  const [stockPageSize, setStockPageSize] = useState(5)

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
    loadData()
  }, [loadData])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  // Paginated view for Branch Stock matrix
  const paginatedStock = stock.slice((stockPage - 1) * stockPageSize, stockPage * stockPageSize)
  const stockTotalPages = Math.max(1, Math.ceil(stock.length / stockPageSize))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{UI_TERMS.tokenStock}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Module 04
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track inward token purchases, vendor prices, freight, taxes, and true cost per token.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
        >
          <Plus className="w-4 h-4" /> Record Token Purchase
        </button>
      </div>

      {/* Batches Table with Total Purchase Cost breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Purchase Entries & Total Purchase Cost Breakdown</div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Accurate Purchase Cost Calculation
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Batch Number</th>
                <th className="p-3">Token Model</th>
                <th className="p-3">Vendor</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Base Price</th>
                <th className="p-3 text-right">Freight</th>
                <th className="p-3 text-right">Customs/Tax</th>
                <th className="p-3 text-right">Handling</th>
                <th className="p-3 text-right font-bold text-white">Total Purchase Cost</th>
                <th className="p-3 text-right font-bold text-cyan-400">Cost Per Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    Loading batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-500">
                    No purchase batches found.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300 font-semibold">{b.batch_number}</td>
                    <td className="p-3 text-white uppercase">{b.token_model.replace('_', ' ')}</td>
                    <td className="p-3 text-slate-300">{b.vendor_name}</td>
                    <td className="p-3 text-right font-semibold text-white">{b.quantity_purchased}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.base_unit_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.inward_shipping_cost?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.customs_or_taxes?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-400">₹{b.handling_charges?.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-white">₹{b.total_landed_cost?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-bold text-cyan-400 bg-cyan-950/20">
                      ₹{b.unit_landed_cost?.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination for Batches */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>

      {/* Branch Stock Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Stock in Branch & Damaged Token Quarantine ({stock.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Branch Location</th>
                <th className="p-3">Branch Code</th>
                <th className="p-3">Token Model</th>
                <th className="p-3 text-right">Available in Stock</th>
                <th className="p-3 text-right">Damaged Stock</th>
                <th className="p-3 text-right">Low Stock Alert Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No branch stock records.
                  </td>
                </tr>
              ) : (
                paginatedStock.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{s.branch_name}</td>
                    <td className="p-3 font-mono text-indigo-300">{s.branch_code}</td>
                    <td className="p-3 text-slate-200 uppercase">{s.token_model.replace('_', ' ')}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{s.quantity_on_hand}</td>
                    <td className="p-3 text-right text-red-400">{s.quarantine_damaged}</td>
                    <td className="p-3 text-right text-slate-400">{s.min_threshold}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination for Branch Stock */}
        <Pagination
          currentPage={stockPage}
          pageSize={stockPageSize}
          totalCount={stock.length}
          totalPages={stockTotalPages}
          onPageChange={setStockPage}
          onPageSizeChange={(sz) => {
            setStockPageSize(sz)
            setStockPage(1)
          }}
        />
      </div>

      <AddTokenBatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  )
}
