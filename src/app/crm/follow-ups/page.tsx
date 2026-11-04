// Customer Follow-ups (/crm/follow-ups)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, PhoneCall, MessageSquare, Mail, Plus, X, CheckCircle2, Clock } from 'lucide-react'

export default function CrmFollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    lead_id: '',
    contact_mode: 'phone_call',
    follow_up_date: new Date().toISOString().split('T')[0],
    notes: '',
    disposition: 'Interested in Class 3 combo',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/crm/follow-ups').then((r) => r.json()),
      fetch('/api/crm/leads?mask=true').then((r) => r.json()),
    ])
      .then(([fData, lData]) => {
        setFollowUps(fData.followUps || [])
        const activeLeads = lData.leads || []
        setLeads(activeLeads)
        if (activeLeads.length > 0 && !formData.lead_id) {
          setFormData((prev) => ({ ...prev, lead_id: activeLeads[0].id }))
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/crm/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsModalOpen(false)
        loadData()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async (id: string, disposition: string) => {
    await fetch(`/api/crm/follow-ups/${id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disposition }),
    })
    loadData()
  }

  const pendingCalls = followUps.filter((f) => f.status === 'pending' && f.contact_mode === 'phone_call').length
  const pendingWhatsapp = followUps.filter((f) => f.status === 'pending' && f.contact_mode === 'whatsapp').length
  const completedToday = followUps.filter((f) => f.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/crm/leads" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Customer Leads
            </Link>
            <span>/</span>
            <span className="text-white">Customer Follow-ups</span>
          </div>
          <h1 className="text-xl font-bold text-white">Daily Customer Follow-up Agenda</h1>
          <p className="text-xs text-slate-400 mt-1">
            Schedule customer phone calls, WhatsApp messages, and email callbacks.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Schedule Follow-up
        </button>
      </div>

      {/* Dynamic Agenda Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Scheduled Calls</div>
            <div className="text-xl font-bold text-white mt-0.5">{pendingCalls} Scheduled</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">WhatsApp Messages</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{pendingWhatsapp} Scheduled</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Completed Follow-ups</div>
            <div className="text-xl font-bold text-purple-400 mt-0.5">{completedToday} Completed</div>
          </div>
        </div>
      </div>

      {/* Follow-up Tasks Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active Follow-up Schedule ({followUps.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Customer Code</th>
                <th className="p-3">Company & Contact</th>
                <th className="p-3">Phone & Email</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Scheduled Date</th>
                <th className="p-3">Disposition / Notes</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading follow-up agenda...
                  </td>
                </tr>
              ) : followUps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No customer callbacks scheduled. Click Schedule Follow-up above to add one.
                  </td>
                </tr>
              ) : (
                followUps.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-purple-300 font-semibold">{f.lead_code}</td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{f.company_name}</div>
                      <div className="text-[11px] text-slate-400">{f.contact_person}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-200">{f.phone}</div>
                      <div className="text-[11px] text-slate-400">{f.email}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium capitalize">
                        {f.contact_mode === 'phone_call' ? <PhoneCall className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                        {f.contact_mode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{f.follow_up_date?.split('T')[0] || f.follow_up_date}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{f.disposition || f.notes || 'Pending discussion'}</td>
                    <td className="p-3 text-right">
                      {f.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleComplete(f.id, 'Interested in Quotation')}
                            className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-[10px] border border-emerald-500/30 transition cursor-pointer"
                          >
                            Interested
                          </button>
                          <button
                            onClick={() => handleComplete(f.id, 'Call Rescheduled Later')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition cursor-pointer"
                          >
                            Call Later
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Schedule Customer Follow-up</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Customer Lead *</label>
                <select
                  required
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name} ({l.contact_person})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Contact Mode</label>
                  <select
                    value={formData.contact_mode}
                    onChange={(e) => setFormData({ ...formData, contact_mode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="phone_call">Phone Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Follow-up Date *</label>
                  <input
                    required
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Purpose / Notes</label>
                <input
                  placeholder="e.g. Discuss bulk pricing for 50 DSC tokens"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
