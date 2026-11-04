// Module 09: Courier Dispatch & POD Tracking (/courier)
import React from 'react'
import { Truck, CheckCircle2, Clock, PackageCheck, AlertCircle } from 'lucide-react'

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Logistics & Courier Dispatch Hub</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Module 09
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Waybill dispatch records across DTDC, Blue Dart, Speed Post & Delhivery with Proof of Delivery (POD) uploads.
          </p>
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Dispatch Records & AWB Tracking</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Dispatch #</th>
                <th className="p-3">Carrier</th>
                <th className="p-3">AWB Tracking #</th>
                <th className="p-3">Recipient & Contact</th>
                <th className="p-3">Package Contents</th>
                <th className="p-3">Dispatched Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active dispatches. Waybills generated from Token Delivery Challans will appear here.
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
                        {d.status}
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

