// Module 04: Hardware Token Inventory & Landed Costing (/inventory/tokens)
import React from 'react'
import { Cpu, Calculator, PackageCheck, AlertTriangle } from 'lucide-react'

async function getInventory() {
  const port = process.env.PORT || '3000'
  try {
    const [batchesRes, stockRes] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/inventory/batches`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/inventory/branches`, { cache: 'no-store' }),
    ])

    return {
      batches: batchesRes.ok ? (await batchesRes.json()).batches : [],
      stock: stockRes.ok ? (await stockRes.json()).stock : [],
    }
  } catch {
    return { batches: [], stock: [] }
  }
}

export default async function InventoryTokensPage() {
  const { batches, stock } = await getInventory()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Hardware Token Inventory & Landed Costing</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Module 04
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Section 6.1 True Landed Cost Equation: (Base × Qty) + Freight + Customs + Handling = True Unit Landed Cost.
          </p>
        </div>
      </div>

      {/* Batches Table with Landed Cost breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Inward Purchase Batches & Landed Cost Breakdown</div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> FIFO Landed Margin Engine
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Batch Number</th>
                <th className="p-3">Model</th>
                <th className="p-3">Vendor</th>
                <th className="p-3 text-right">Inward Qty</th>
                <th className="p-3 text-right">Base Price</th>
                <th className="p-3 text-right">Freight</th>
                <th className="p-3 text-right">Customs/Tax</th>
                <th className="p-3 text-right">Handling</th>
                <th className="p-3 text-right font-bold text-white">Total Landed</th>
                <th className="p-3 text-right font-bold text-cyan-400">Unit Landed Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {batches.map((b: any) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch Stock Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Branch Inventory & Faulty Token Quarantine</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Branch Name</th>
                <th className="p-3">Branch Code</th>
                <th className="p-3">Token Model</th>
                <th className="p-3 text-right">Available On Hand</th>
                <th className="p-3 text-right">Quarantine Damaged</th>
                <th className="p-3 text-right">Min Threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stock.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-white">{s.branch_name}</td>
                  <td className="p-3 font-mono text-indigo-300">{s.branch_code}</td>
                  <td className="p-3 text-slate-200 uppercase">{s.token_model.replace('_', ' ')}</td>
                  <td className="p-3 text-right font-bold text-emerald-400">{s.quantity_on_hand}</td>
                  <td className="p-3 text-right text-red-400">{s.quarantine_damaged}</td>
                  <td className="p-3 text-right text-slate-400">{s.min_threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

