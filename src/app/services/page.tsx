// Module 06: Additional Business Services (/services)
import React from 'react'
import { Sparkles, FileText, CheckCircle2, Clock } from 'lucide-react'

async function getServices() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/services/orders`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.orders || []
  } catch {
    return []
  }
}

export default async function ServicesPage() {
  const orders = await getServices()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Business Services Hub</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500/20 text-pink-400 border border-pink-500/30">
              Module 06
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking Trademark filings, FSSAI licenses (Basic, State, Central), GST registrations & Company Incorporation.
          </p>
        </div>
      </div>

      {/* Services Portfolio Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { title: 'Trademark Filings', stage: 'Draft & Govt Search', color: 'border-pink-500/40 text-pink-400' },
          { title: 'FSSAI Licensing', stage: 'Basic / State / Central', color: 'border-amber-500/40 text-amber-400' },
          { title: 'GST Registration', stage: 'Portal Ack & Certificate', color: 'border-cyan-500/40 text-cyan-400' },
          { title: 'Company Incorporation', stage: 'SPICe+ MOA / AOA', color: 'border-indigo-500/40 text-indigo-400' },
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl bg-slate-900/60 border ${item.color} space-y-1`}>
            <div className="text-xs font-semibold text-white">{item.title}</div>
            <div className="text-[11px] text-slate-400">{item.stage}</div>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Service Orders Lifecycle Tracking</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Order Number</th>
                <th className="p-3">Service Type</th>
                <th className="p-3">Client Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-right">Govt Fee</th>
                <th className="p-3 text-right">Prof. Fee</th>
                <th className="p-3">Current Milestone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active service orders in progress. Orders will populate upon partner submission.
                  </td>
                </tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-pink-300 font-semibold">{o.order_number}</td>
                    <td className="p-3 uppercase text-white font-medium">{o.service_type.replace('_', ' ')}</td>
                    <td className="p-3 text-slate-200">{o.client_name}</td>
                    <td className="p-3 text-slate-400">{o.client_contact}</td>
                    <td className="p-3 text-right text-slate-400">₹{o.government_fees}</td>
                    <td className="p-3 text-right text-emerald-400 font-semibold">₹{o.professional_fees}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                        {o.stage.replace('_', ' ')}
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

