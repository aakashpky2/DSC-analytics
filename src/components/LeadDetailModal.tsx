'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Clock,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Plus,
  CheckCircle2,
  Tag,
  Layers,
  FileText,
  User,
  History,
  Send,
  Eye
} from 'lucide-react'

interface LeadDetailModalProps {
  leadId: string | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function LeadDetailModal({ leadId, isOpen, onClose, onUpdate }: LeadDetailModalProps) {
  const [lead, setLead] = useState<any | null>(null)
  const [interactions, setInteractions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Action Form States
  const [channels, setChannels] = useState<any[]>([])
  const [channelId, setChannelId] = useState('')
  const [outcome, setOutcome] = useState('Interested')
  const [reason, setReason] = useState('')
  const [conversationNotes, setConversationNotes] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Pipeline Status Update
  const [pipelineStatus, setPipelineStatus] = useState('NEW')
  const [statusLoading, setStatusLoading] = useState(false)

  // Controlled Phone Reveal State (DEF-05)
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null)
  const [revealingPhone, setRevealingPhone] = useState(false)

  const handleRevealPhone = async () => {
    if (!leadId || revealingPhone) return
    setRevealingPhone(true)
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/reveal-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operational tele-call contact via Lead Detail' })
      })
      const data = await res.json()
      if (res.ok && data.phone) {
        setRevealedPhone(data.phone)
      }
    } catch (err) {
      console.error('Failed to reveal phone:', err)
    } finally {
      setRevealingPhone(false)
    }
  }

  const loadLeadDetails = async () => {
    if (!leadId) return
    setLoading(true)
    setError('')
    try {
      // 1. Fetch Lead
      const res = await fetch(`/api/crm/leads?search=${leadId}`)
      const data = await res.json()
      const found = (data.leads || []).find((l: any) => l.id === leadId)
      if (found) {
        setLead(found)
        setPipelineStatus(found.pipeline_status || 'NEW')
      }

      // 2. Fetch Interactions
      const intRes = await fetch(`/api/crm/leads/${leadId}/interactions`)
      if (intRes.ok) {
        const intData = await intRes.json()
        setInteractions(intData.interactions || [])
      }

      // 3. Fetch Channels
      const chanRes = await fetch('/api/crm/communication-channels')
      if (chanRes.ok) {
        const chanData = await chanRes.json()
        setChannels(chanData.channels || [])
        if (chanData.channels?.length > 0) setChannelId(chanData.channels[0].id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && leadId) {
      loadLeadDetails()
    }
  }, [isOpen, leadId])

  if (!isOpen || !leadId) return null

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/pipeline-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_status: newStatus })
      })
      if (res.ok) {
        setPipelineStatus(newStatus)
        onUpdate()
      }
    } catch {
      // ignore
    } finally {
      setStatusLoading(false)
    }
  }

  const handleRecordInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setActionError('')

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          outcome,
          reason,
          conversation_notes: conversationNotes,
          next_follow_up_date: nextFollowUpDate || undefined
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || 'Failed to log interaction.')
      } else {
        setReason('')
        setConversationNotes('')
        setNextFollowUpDate('')
        loadLeadDetails()
        onUpdate()
      }
    } catch (err: any) {
      setActionError(err.message || 'Error recording interaction.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
              {lead?.lead_code || 'LEAD'}
            </span>
            <h2 className="text-base font-bold text-white">
              {lead?.company_name || lead?.contact_person || 'Unidentified Opportunity'}
            </h2>
            {lead?.match_status === 'CONTACT_REVIEW' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-400 border border-red-800/60 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Existing Partner (Call Blocked)
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Panel Workspace */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* LEFT PANEL: Identity, Geography, Service Intent & Assignments */}
          <div className="lg:col-span-5 p-5 space-y-5 overflow-y-auto">
            {/* Status Control */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                CRM Pipeline Stage
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'].map(st => (
                  <button
                    key={st}
                    disabled={statusLoading}
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${
                      pipelineStatus === st
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Identity & Contact</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{lead?.contact_person || 'No Contact Person'}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-mono">{revealedPhone || lead?.phone || 'No Phone Specified'}</span>
                  </div>
                  {!revealedPhone && lead?.phone && lead.phone.includes('*') && (
                    <button
                      onClick={handleRevealPhone}
                      disabled={revealingPhone}
                      title="Reveal full phone number (audited)"
                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 transition font-sans"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{revealingPhone ? 'Revealing...' : 'Reveal'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{lead?.email || 'No Email Specified'}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    {[lead?.city, lead?.district, lead?.state, lead?.pin_code].filter(Boolean).join(', ') || 'No Geography Specified'}
                  </span>
                </div>
              </div>
            </div>

            {/* Service Requirements & Intent */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Service Scope & Activation</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Service Intent:</span>
                <span className="font-medium text-indigo-400">{lead?.service_intent || 'Undecided'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Requirement Notes:</span>
                <span className="text-slate-200 text-right max-w-[200px] truncate">{lead?.requirement_summary || '—'}</span>
              </div>
            </div>

            {/* Assignment & Category */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300">Routing & Workload</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Category:</span>
                <span className="text-slate-200 font-medium">{lead?.category_id || 'Unassigned / Triage'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Assigned Executive:</span>
                <span className="text-slate-200 font-medium">{lead?.assigned_agent_name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Chronological Interaction Timeline & Action Form */}
          <div className="lg:col-span-7 p-5 space-y-5 flex flex-col justify-between overflow-y-auto">
            {/* Timeline Header */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Chronological Communication History
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {interactions.length} Interactions Recorded
                </span>
              </div>

              {/* Interaction List */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {interactions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                    No communication interactions recorded yet. Log the first call below.
                  </div>
                ) : (
                  interactions.map((int: any) => (
                    <div key={int.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          int.outcome === 'Interested'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : int.outcome === 'Partially Interested'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {int.outcome}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(int.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-200 font-medium">{int.reason}</div>
                      {int.conversation_notes && (
                        <div className="text-[11px] text-slate-400 italic">"{int.conversation_notes}"</div>
                      )}
                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-900">
                        <span>Channel: {int.channel_name || 'Direct Call'}</span>
                        {int.next_follow_up_date && (
                          <span className="text-indigo-400 font-medium">
                            Follow-up: {int.next_follow_up_date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Call / Interaction Logger Form */}
            <form onSubmit={handleRecordInteraction} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 mt-4">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-400" />
                Record Outreach / Contact Result
              </div>

              {actionError && (
                <div className="p-2 rounded bg-red-950/40 border border-red-800 text-red-300 text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Channel</label>
                  <select
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>{c.channel_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Outcome</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Interested">Interested</option>
                    <option value="Partially Interested">Partially Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Not Relevant">Not Relevant</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Mandatory Reason</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inquired about bulk discount for 50 USB tokens"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="Sent commercial proposal PDF"
                    value={conversationNotes}
                    onChange={(e) => setConversationNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Next Follow-Up Date</label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                >
                  {actionLoading ? 'Logging...' : 'Save Interaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

