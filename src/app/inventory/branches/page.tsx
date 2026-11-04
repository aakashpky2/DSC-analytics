// Stock Given to Branch (/inventory/branches)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, FileText, CheckCircle2, Truck, Plus, RefreshCw, Eye } from 'lucide-react'
import { IssueDeliveryNoteModal } from '@/components/IssueDeliveryNoteModal'
import { Pagination } from '@/components/Pagination'

export default function BranchInventoryPage() {
  const [stock, setStock] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<any | null>(null)
  const [receiveLoading, setReceiveLoading] = useState<string | null>(null)

  // Pagination states for Branch Stock
  const [stockPage, setStockPage] = useState(1)
  const [stockPageSize, setStockPageSize] = useState(5)
  const [stockTotalCount, setStockTotalCount] = useState(0)
  const [stockTotalPages, setStockTotalPages] = useState(1)

  // Pagination states for Transfers History
  const [transferPage, setTransferPage] = useState(1)
  const [transferPageSize, setTransferPageSize] = useState(5)
  const [transferTotalCount, setTransferTotalCount] = useState(0)
  const [transferTotalPages, setTransferTotalPages] = useState(1)

  const loadData = useCallback(() => {
    setLoading(true)
    const stockParams = new URLSearchParams({
      page: String(stockPage),
      limit: String(stockPageSize),
    })
    const transferParams = new URLSearchParams({
      page: String(transferPage),
      limit: String(transferPageSize),
    })

    Promise.all([
      fetch(`/api/inventory/branches?${stockParams.toString()}`).then((r) => r.json()),
      fetch(`/api/inventory/transfers?${transferParams.toString()}`).then((r) => r.json()),
    ])
      .then(([bData, tData]) => {
        setStock(bData.stock || [])
        setStockTotalCount(bData.totalCount || 0)
        setStockTotalPages(bData.totalPages || 1)
        setBranches(bData.branches || [])

        setTransfers(tData.challans || [])
        setTransferTotalCount(tData.totalCount || 0)
        setTransferTotalPages(tData.totalPages || 1)
      })
      .catch((err) => {
        console.error('Failed to load branch stock:', err)
      })
      .finally(() => setLoading(false))
  }, [stockPage, stockPageSize, transferPage, transferPageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenTransferModal = (rowStock?: any) => {
    setSelectedStock(rowStock || stock[0] || null)
    setIsModalOpen(true)
  }

  const handleReceiveChallan = async (challanId: string) => {
    setReceiveLoading(challanId)
    try {
      const res = await fetch(`/api/inventory/transfers/${challanId}/receive`, {
        method: 'PATCH',
      })
      if (res.ok) {
        loadData()
      }
    } finally {
      setReceiveLoading(null)
    }
  }

  const handleViewPdf = (challanNumber: string) => {
    window.open(`/api/inventory/transfers/pdf?challan_number=${challanNumber}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/inventory/tokens" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Token Stock
            </Link>
            <span>/</span>
            <span className="text-white">Branch Locations</span>
          </div>
          <h1 className="text-xl font-bold text-white">Stock Given to Branch</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track token balances across branch offices, damaged pieces, and inter-branch delivery challans.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh Stock Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenTransferModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md shadow-cyan-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Issue Delivery Note
          </button>
        </div>
      </div>

      {/* Branch Stock Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Branch Stock & Damaged Units</div>
          <div className="text-[11px] text-slate-400 font-mono">
            {stock.reduce((acc, curr) => acc + (curr.quantity_on_hand || 0), 0)} Total Usable Tokens
          </div>
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
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 text-xs">
                    Loading branch inventory...
                  </td>
                </tr>
              ) : stock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500 text-xs">
                    No branch stock records found.
                  </td>
                </tr>
              ) : (
                stock.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{s.branch_name}</td>
                    <td className="p-3 font-mono text-cyan-400">{s.branch_code}</td>
                    <td className="p-3 text-slate-300 uppercase">{s.token_model.replace('_', ' ')}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{s.quantity_on_hand}</td>
                    <td className="p-3 text-right text-red-400 font-semibold">{s.quarantine_damaged}</td>
                    <td className="p-3 text-right text-slate-400">{s.min_threshold}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenTransferModal(s)}
                        className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 font-medium text-[10px] border border-cyan-500/40 inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <FileText className="w-2.5 h-2.5" /> Issue Delivery Note
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination for Branch Stock */}
        <Pagination
          currentPage={stockPage}
          pageSize={stockPageSize}
          totalCount={stockTotalCount}
          totalPages={stockTotalPages}
          onPageChange={setStockPage}
          onPageSizeChange={(sz) => {
            setStockPageSize(sz)
            setStockPage(1)
          }}
          isLoading={loading}
        />
      </div>

      {/* Inter-Branch Transfer History & Delivery Challan Log */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" />
            <span>Delivery Challan & Stock Transfer History</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {transfers.length} Recorded Movement{transfers.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Challan Number</th>
                <th className="p-3">Transfer Date</th>
                <th className="p-3">From Branch</th>
                <th className="p-3">To Branch</th>
                <th className="p-3">Token Model</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Delivery Challan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                    Loading transfer history...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 text-xs">
                    No delivery notes or branch transfers issued yet.
                  </td>
                </tr>
              ) : (
                transfers.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-semibold text-cyan-300">{t.challan_number}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">{t.created_at?.split('T')[0] || t.created_at}</td>
                    <td className="p-3 text-slate-300">
                      {t.source_branch_name} <span className="text-slate-500 font-mono text-[10px]">({t.source_branch_code})</span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {t.destination_branch_name} <span className="text-slate-500 font-mono text-[10px]">({t.destination_branch_code})</span>
                    </td>
                    <td className="p-3 uppercase font-medium text-slate-200">{t.token_model.replace('_', ' ')}</td>
                    <td className="p-3 text-right font-bold text-white">{t.quantity}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                          t.status === 'received'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        }`}
                      >
                        {t.status === 'received' ? <CheckCircle2 className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === 'dispatched' && (
                          <button
                            onClick={() => handleReceiveChallan(t.id)}
                            disabled={receiveLoading === t.id}
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-medium transition cursor-pointer"
                          >
                            {receiveLoading === t.id ? 'Confirming...' : 'Confirm Receipt'}
                          </button>
                        )}
                        <button
                          onClick={() => handleViewPdf(t.challan_number)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> PDF Challan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination for Transfers */}
        <Pagination
          currentPage={transferPage}
          pageSize={transferPageSize}
          totalCount={transferTotalCount}
          totalPages={transferTotalPages}
          onPageChange={setTransferPage}
          onPageSizeChange={(sz) => {
            setTransferPageSize(sz)
            setTransferPage(1)
          }}
          isLoading={loading}
        />
      </div>

      <IssueDeliveryNoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        preselectedStock={selectedStock}
        branches={branches}
        allStock={stock}
      />
    </div>
  )
}
