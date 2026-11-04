// Module 05: Omnichannel Follow-Up Agenda (/crm/follow-ups)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, PhoneCall, MessageSquare, Mail, Calendar, CheckCircle, Clock } from 'lucide-react'

async function getFollowUpsData() {
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

export default async function CrmFollowUpsPage() {
  const leads = await getFollowUpsData()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/crm/leads" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> CRM Leads
            </Link>
            <span>/</span>
            <span className="text-white">Follow-Up Agenda</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Daily Omnichannel Follow-Up Agenda</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Module 05 Agenda
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Schedule and log Phone Calls, WhatsApp callbacks, and Email follow-ups with quick dispositions.
          </p>
        </div>
      </div>

      {/* Agenda Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Scheduled Calls</div>
            <div className="text-xl font-bold text-white mt-0.5">8 Pending</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">WhatsApp Follow-ups</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">14 Today</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Email Proposals Sent</div>
            <div className="text-xl font-bold text-purple-400 mt-0.5">5 Awaiting Reply</div>
          </div>
        </div>
      </div>

      {/* Follow-up Tasks Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Today's Callback Cadence</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Lead Code</th>
                <th className="p-3">Company & Contact</th>
                <th className="p-3">Phone & Email</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Scheduled Time</th>
                <th className="p-3">Quick Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leads.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono text-purple-300 font-semibold">{l.lead_code}</td>
                  <td className="p-3">
                    <div className="font-semibold text-white">{l.company_name}</div>
                    <div className="text-[11px] text-slate-400">{l.contact_person}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-slate-200">{l.phone}</div>
                    <div className="text-[11px] text-slate-400">{l.email}</div>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      <MessageSquare className="w-3 h-3" /> WhatsApp
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-400">11:30 AM</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <button className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700">
                        Interested
                      </button>
                      <button className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700">
                        Callback
                      </button>
                      <button className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700">
                        Snooze
                      </button>
                    </div>
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

