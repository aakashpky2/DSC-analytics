// Stock Given to Branch (/inventory/branches)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, FileText } from 'lucide-react'

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
              <ArrowLeft className="w-3.5 h-3.5" /> Token Stock
            </Link>
            <span>/</span>
            <span className="text-white">Branch Locations</span>
          </div>
          <h1 className="text-xl font-bold text-white">Stock Given to Branch</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track token balances across branch offices, damaged pieces, and delivery notes.
          </p>
        </div>
      </div>

      {/* Branch Stock Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Branch Stock & Damaged Units</div>
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
                <th className="p-3 text-center">Delivery Note</th>
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
                      <FileText className="w-2.5 h-2.5" /> Issue Delivery Note
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
