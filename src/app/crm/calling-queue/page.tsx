'use client'

import React, { useState, useEffect } from 'react'
import {
  PhoneCall,
  Clock,
  AlertCircle,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Mail,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  ArrowRight
} from 'lucide-react'

export default function CallingQueuePage() {
  const [queue, setQueue] = useState<any[]>([])
  const [counts, setCounts] = useState<any>({ total: 0, overdue: 0, dueToday: 0, upcoming: 0, unscheduled: 0 })
  const [filterBucket, setFilterBucket] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  // Interaction Logging State
  const [channels, setChannels] = useState<any[]>([])
  const [channelId, setChannelId] = useState('')
  const [outcome, setOutcome] = useState('Interested')
  const [reason, setReason] = useState('')
  const [conversationNotes, setConversationNotes] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [supervisorOverride, setSupervisorOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')
  const [logSuccess, setLogSuccess] = useState('')

  // Conversion Modal State
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [convertData, setConvertData] = useState<any>({})
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [convertSuccess, setConvertSuccess] = useState('')

  const loadQueue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/calling-queue')
      if (res.ok) {
        const data = await res.json()
        setQueue(data.queue || [])
        setCounts(data.counts || {})
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
    fetch('/api/crm/communication-channels')
      .then(res => res.json())
      .then(d => {
        setChannels(d.channels || [])
        if (d.channels?.length > 0) setChannelId(d.channels[0].id)
      })
      .catch(() => {})
  }, [])

  const handleOpenLead = (lead: any) => {
    setSelectedLead(lead)
    setReason('')
    setConversationNotes('')
    setNextFollowUpDate('')
    setSupervisorOverride(false)
    setOverrideReason('')
    setLogError('')
    setLogSuccess('')
  }

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return
    setLogLoading(true)
    setLogError('')
    setLogSuccess('')

    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          outcome,
          reason,
          conversation_notes: conversationNotes,
          next_follow_up_date: nextFollowUpDate || undefined,
          supervisor_override: supervisorOverride,
          override_reason: overrideReason
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record interaction')
      }

      setLogSuccess('Interaction successfully recorded into immutable history.')
      setTimeout(() => {
        setSelectedLead(null)
        loadQueue()
      }, 1500)
    } catch (err: any) {
      setLogError(err.message || 'Error recording call')
    } finally {
      setLogLoading(false)
    }
  }

  const handleOpenConvert = (lead: any) => {
    setConvertData({
      company_name: lead.company_name || lead.alternate_name || '',
      contact_person: lead.contact_person || '',
      email: lead.email || '',
      phone: lead.phone || '',
      billing_address: lead.address || '',
      state_code: lead.state ? '27' : '27',
      gstin: lead.gstin || '',
      pan: lead.pan || '',
      type: 'dsc_partner'
    })
    setConvertError('')
    setConvertSuccess('')
    setConvertModalOpen(true)
  }

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return
    setConvertLoading(true)
    setConvertError('')
    setConvertSuccess('')

    try {
      const res = await fetch(`/api/crm/leads/${selectedLead.id}/convert-partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertData)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to convert lead')
      }

      setConvertSuccess(`Successfully converted to Partner: ${data.partner_code}`)
      setTimeout(() => {
        setConvertModalOpen(false)
        setSelectedLead(null)
        loadQueue()
      }, 1800)
    } catch (err: any) {
      setConvertError(err.message || 'Error converting lead to partner')
    } finally {
      setConvertLoading(false)
    }
  }

  const filteredQueue = queue.filter(item => {
    if (filterBucket !== 'ALL' && item.priorityBucket !== filterBucket) return false
    if (search) {
      const s = search.toLowerCase()
      const matchComp = (item.company_name || '').toLowerCase().includes(s)
      const matchContact = (item.contact_person || '').toLowerCase().includes(s)
      const matchPhone = (item.phone || '').includes(s)
      const matchCode = (item.lead_code || '').toLowerCase().includes(s)
      if (!matchComp && !matchContact && !matchPhone && !matchCode) return false
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Executive Calling & Outreach Queue</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Prioritized work queue enforcing configurable Calling TAT (LM-04, LM-15) and Category-based data isolation (LM-16).
          </p>
        </div>
        <button
          onClick={loadQueue}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-medium border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Urgency Priority Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => setFilterBucket(filterBucket === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={`p-4 rounded-xl border text-left transition ${
            filterBucket === 'OVERDUE'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 ring-1 ring-rose-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Overdue Calls</span>
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{counts.overdue}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Immediate outreach required</div>
        </button>

        <button
          onClick={() => setFilterBucket(filterBucket === 'DUE_TODAY' ? 'ALL' : 'DUE_TODAY')}
          className={`p-4 rounded-xl border text-left transition ${
            filterBucket === 'DUE_TODAY'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Due Today</span>
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{counts.dueToday}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">SLA / Scheduled for today</div>
        </button>

        <button
          onClick={() => setFilterBucket(filterBucket === 'UPCOMING' ? 'ALL' : 'UPCOMING')}
          className={`p-4 rounded-xl border text-left transition ${
            filterBucket === 'UPCOMING'
              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Upcoming Scheduled</span>
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{counts.upcoming}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Future appointments</div>
        </button>

        <button
          onClick={() => setFilterBucket(filterBucket === 'UNSCHEDULED' ? 'ALL' : 'UNSCHEDULED')}
          className={`p-4 rounded-xl border text-left transition ${
            filterBucket === 'UNSCHEDULED'
              ? 'bg-slate-700/40 border-slate-600 text-slate-200 ring-1 ring-slate-500/50'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">New In-TAT Intake</div>
          <div className="text-2xl font-bold text-white mt-1.5">{counts.unscheduled}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Within SLA window</div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search lead code, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="font-semibold text-white">{filteredQueue.length}</span> prioritized leads
        </div>
      </div>

      {/* Main Queue List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Priority</th>
                <th className="py-3.5 px-4 font-semibold">Lead Info</th>
                <th className="py-3.5 px-4 font-semibold">Contact Details</th>
                <th className="py-3.5 px-4 font-semibold">Service Intent</th>
                <th className="py-3.5 px-4 font-semibold">Partner Match (LM-08)</th>
                <th className="py-3.5 px-4 font-semibold">Due Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Loading prioritized work queue...
                  </td>
                </tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No leads pending in this queue bucket.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      {item.priorityBucket === 'OVERDUE' && (
                        <span className="px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-[10px]">
                          OVERDUE
                        </span>
                      )}
                      {item.priorityBucket === 'DUE_TODAY' && (
                        <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[10px]">
                          DUE TODAY
                        </span>
                      )}
                      {item.priorityBucket === 'UPCOMING' && (
                        <span className="px-2.5 py-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium text-[10px]">
                          UPCOMING
                        </span>
                      )}
                      {item.priorityBucket === 'UNSCHEDULED' && (
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[10px]">
                          NEW INTAKE
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{item.company_name || item.alternate_name || '(Unnamed Lead)'}</div>
                      <div className="text-[11px] text-slate-400">{item.lead_code} {item.contact_person && `• ${item.contact_person}`}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{item.phone || <span className="text-slate-500 italic">No phone</span>}</div>
                      <div className="text-[11px] text-slate-400">{item.email || ''}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700 text-[11px]">
                        {item.service_intent || 'Undecided'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.callBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          <span>CALL BLOCKED</span>
                        </span>
                      ) : item.match_status === 'NAME_REVIEW' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                          Name Review
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No Match</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {item.effectiveDueDate}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenLead(item)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
                      >
                        Action Call
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Call Action & Interaction Logging */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Log Call & Contact (LM-18 to LM-24)</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedLead.lead_code} • {selectedLead.company_name || selectedLead.contact_person || 'Lead Record'}
                </p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Call Block Alert Banner */}
            {selectedLead.callBlocked && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Existing Partner Match Detected (LM-08, LM-14)</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  Direct outreach is strictly blocked on server because this phone/email matches an active registered partner.
                  You may only log contact if an authorized supervisor provides an explicit override reason.
                </p>
                <div className="pt-2 border-t border-rose-500/20">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={supervisorOverride}
                      onChange={(e) => setSupervisorOverride(e.target.checked)}
                      className="rounded bg-slate-950 border-rose-500 text-rose-600 focus:ring-0"
                    />
                    <span>Authorized Supervisor Override (LM-24)</span>
                  </label>
                  {supervisorOverride && (
                    <input
                      type="text"
                      placeholder="Mandatory override authorization reason..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full mt-2 bg-slate-950 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  )}
                </div>
              </div>
            )}

            {logError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {logError}
              </div>
            )}

            {logSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{logSuccess}</span>
              </div>
            )}

            <form onSubmit={handleLogInteraction} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Communication Channel (LM-22) *</label>
                  <select
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>{c.channel_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Call Outcome (LM-19) *</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Interested">Interested</option>
                    <option value="Partially Interested">Partially Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Not Relevant">Not Relevant</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Mandatory Outcome Reason (LM-20) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Budget approved for 50 tokens; requested proposal"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              {(outcome === 'Interested' || outcome === 'Partially Interested') && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Next Follow-Up Date (LM-21) *</label>
                  <input
                    required
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Conversation Notes</label>
                <textarea
                  rows={2}
                  placeholder="Discussion details..."
                  value={conversationNotes}
                  onChange={(e) => setConversationNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenConvert(selectedLead)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 font-medium text-xs flex items-center gap-1.5 transition"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Convert to Partner (LM-25)</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLead(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={logLoading || (selectedLead.callBlocked && !supervisorOverride)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                  >
                    {logLoading ? 'Saving...' : 'Save Interaction'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lead to Partner Onboarding (LM-25) */}
      {convertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Lead-to-Partner Onboarding (LM-25)</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Prefilled from captured lead details with full audit link</p>
              </div>
              <button onClick={() => setConvertModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {convertError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {convertError}
              </div>
            )}

            {convertSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{convertSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company / Organization *</label>
                  <input
                    required
                    type="text"
                    value={convertData.company_name}
                    onChange={(e) => setConvertData({ ...convertData, company_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={convertData.contact_person}
                    onChange={(e) => setConvertData({ ...convertData, contact_person: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mobile / Primary Phone *</label>
                  <input
                    required
                    type="tel"
                    value={convertData.phone}
                    onChange={(e) => setConvertData({ ...convertData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Official Email</label>
                  <input
                    type="email"
                    value={convertData.email}
                    onChange={(e) => setConvertData({ ...convertData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={convertData.gstin}
                    onChange={(e) => setConvertData({ ...convertData, gstin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">PAN</label>
                  <input
                    type="text"
                    value={convertData.pan}
                    onChange={(e) => setConvertData({ ...convertData, pan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Billing / Registered Address</label>
                <input
                  type="text"
                  value={convertData.billing_address}
                  onChange={(e) => setConvertData({ ...convertData, billing_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConvertModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={convertLoading}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
                >
                  {convertLoading ? 'Creating Partner...' : 'Confirm Partner Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

