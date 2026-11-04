// Courier Dispatches (/courier)
import React from 'react'
import { Truck } from 'lucide-react'

async function getDispatches() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/courier/dispatches`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.dispatches || []
  } catch {
    return []
  }
}

export default async function CourierPage() {
  const dispatches = await getDispatches()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Courier Dispatches</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch records across Blue Dart, DTDC, Speed Post, and Delhivery with tracking numbers.
          </p>
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Shipment Records</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Dispatch #</th>
                <th className="p-3">Courier Partner</th>
                <th className="p-3">Tracking Number</th>
                <th className="p-3">Recipient & Phone</th>
                <th className="p-3">Package Contents</th>
                <th className="p-3">Dispatched Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active dispatches. Shipments generated from delivery notes will appear here.
                  </td>
                </tr>
              ) : (
                dispatches.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300 font-semibold">{d.dispatch_number}</td>
                    <td className="p-3 font-semibold text-white">{d.carrier_name}</td>
                    <td className="p-3 font-mono text-indigo-300">{d.awb_number}</td>
                    <td className="p-3">
                      <div className="text-slate-200">{d.recipient_name}</div>
                      <div className="text-[11px] text-slate-400">{d.recipient_phone}</div>
                    </td>
                    <td className="p-3 text-slate-300">{d.package_contents}</td>
                    <td className="p-3 text-slate-400 font-mono">{d.dispatched_at}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                        {d.status === 'manifested' ? 'Booked & Manifested' : d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
