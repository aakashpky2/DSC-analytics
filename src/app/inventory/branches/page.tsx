// Module 04: Branch Inventory & Delivery Challans (/inventory/branches)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, FileText, Send, AlertTriangle } from 'lucide-react'

async function getBranchData() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/inventory/branches`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.stock || []
  } catch {
    return []
  }
}

export default async function BranchInventoryPage() {
  const stock = await getBranchData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/inventory/tokens" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Token Landed Cost
            </Link>
            <span>/</span>
            <span className="text-white">Branch Hubs & Stock Transfers</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Branch Inventory & Delivery Challans (DC)</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Module 04 Branch DC
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inter-branch stock rebalancing, low-threshold alarms & automated Delivery Challan logging.
          </p>
        </div>
      </div>

      {/* Branch Stock Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Branch Stocks & Damaged Token Quarantine</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Branch Name</th>
                <th className="p-3">Branch Code</th>
                <th className="p-3">Token Model</th>
                <th className="p-3 text-right">Available On Hand</th>
                <th className="p-3 text-right">Quarantined / Faulty</th>
                <th className="p-3 text-right">Min Threshold</th>
                <th className="p-3 text-center">Delivery Challan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stock.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-white">{s.branch_name}</td>
                  <td className="p-3 font-mono text-cyan-400">{s.branch_code}</td>
                  <td className="p-3 text-slate-300 uppercase">{s.token_model.replace('_', ' ')}</td>
                  <td className="p-3 text-right font-bold text-emerald-400">{s.quantity_on_hand}</td>
                  <td className="p-3 text-right text-red-400 font-semibold">{s.quarantine_damaged}</td>
                  <td className="p-3 text-right text-slate-400">{s.min_threshold}</td>
                  <td className="p-3 text-center">
                    <button
                      className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 font-medium text-[10px] border border-cyan-500/40 inline-flex items-center gap-1"
                    >
                      <FileText className="w-2.5 h-2.5" /> Issue Challan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

