// Module 05: CRM with Deduplication & Flexible Follow-Ups (/crm/leads)
import React from 'react'
import { Layers, ShieldAlert, GitMerge, UserCheck, Calendar } from 'lucide-react'

async function getLeads() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/crm/leads?mask=true`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.leads || []
  } catch {
    return []
  }
}

export default async function CrmLeadsPage() {
  const leads = await getLeads()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">CRM Leads & Deduplication Engine</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Module 05
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Section 6.2 Deduplication: GSTIN (+50), Phone (+40), Email (+35), PAN (+30), Fuzzy Name (+20) with threshold &ge; 40 pts.
          </p>
        </div>
      </div>

      {/* Deduplication Status Banner */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-purple-300">Automated Lead Deduplication Active:</span> Leads matching GSTIN, Phone, or Email are automatically flagged for 1-click side-by-side merging.
          </div>
        </div>
        <div className="font-mono text-xs text-purple-400 font-semibold px-2 py-1 rounded bg-purple-900/40 border border-purple-700/50">
          Threshold: 40 pts
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active Pipeline Leads</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Lead Code</th>
                <th className="p-3">Company Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Merge Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leads.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono text-purple-300 font-semibold">{l.lead_code}</td>
                  <td className="p-3 font-medium text-white">{l.company_name}</td>
                  <td className="p-3">
                    <div className="text-slate-200">{l.contact_person}</div>
                    <div className="text-[11px] text-slate-400">{l.phone} &bull; {l.email}</div>
                  </td>
                  <td className="p-3 font-mono text-slate-300">{l.gstin || 'N/A'}</td>
                  <td className="p-3 text-slate-400 max-w-xs truncate">{l.requirement_summary}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <UserCheck className="w-3.5 h-3.5" /> Primary Lead
                    </span>
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

