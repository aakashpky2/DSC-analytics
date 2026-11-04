// DSC Pricing & Products (/dsc/catalog)
import React from 'react'
import Link from 'next/link'
import { FileCheck2, Tag } from 'lucide-react'

async function getCatalog() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/dsc/catalog`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.catalog || []
  } catch {
    return []
  }
}

export default async function DscCatalogPage() {
  const catalog = await getCatalog()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">DSC Products & Pricing</h1>
          <p className="text-xs text-slate-400 mt-1">
            Price list for Class 3, DGFT, and Foreign National certificates (1, 2, and 3 Years).
          </p>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active Product Prices</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Class Type</th>
                <th className="p-3">Certificate Type</th>
                <th className="p-3">Validity</th>
                <th className="p-3 text-right">Base Cost</th>
                <th className="p-3 text-right">Partner Price</th>
                <th className="p-3 text-right">Retail MRP</th>
                <th className="p-3 text-right">Profit / Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {catalog.map((c: any) => {
                const margin = c.partner_price - c.vendor_base_price
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white capitalize">
                      {c.class_type.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3 text-slate-300 capitalize">
                      {c.certificate_type.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">
                        {c.validity_years.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-400">₹{c.vendor_base_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-indigo-400 font-semibold">₹{c.partner_price?.toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-200">₹{c.mrp?.toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">
                      +₹{margin.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
