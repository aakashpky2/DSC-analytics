'use client'

import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddLeadModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState({
    company_name: '',
    alternate_name: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    district: '',
    address: '',
    pin_code: '',
    source_id: '',
    category_id: '',
    service_intent: 'Undecided',
    pan: '',
    requirement_summary: '',
  })

  const [sources, setSources] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [partnerMatchWarning, setPartnerMatchWarning] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Fetch dynamic active sources & categories
      fetch('/api/crm/lead-sources')
        .then(res => res.json())
        .then(d => setSources(d.sources || []))
        .catch(() => {})

      fetch('/api/crm/lead-categories')
        .then(res => res.json())
        .then(d => setCategories(d.categories || []))
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  // Real-time partner matching & duplicate check
  const checkMatches = async () => {
    if (!formData.phone && !formData.email && !formData.company_name) return

    try {
      // 1. Check partner matching (LM-08 to LM-11)
      const pRes = await fetch('/api/crm/leads/check-partner-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: formData.company_name,
          alternate_name: formData.alternate_name,
          email: formData.email,
          phone: formData.phone
        })
      })
      const pData = await pRes.json()
      if (pData.hasMatch) {
        setPartnerMatchWarning(pData)
      } else {
        setPartnerMatchWarning(null)
      }

      // 2. Check lead-to-lead duplicate scoring
      const dRes = await fetch('/api/crm/leads/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const dData = await dRes.json()
      if (dData.hasAlert) {
        setDuplicateWarning('Notice: Potential duplicate lead already exists in intake records.')
      } else {
        setDuplicateWarning(null)
      }
    } catch {
      // non-blocking
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Unable to save lead')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Please check your inputs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Add Customer / Partner Lead</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">All contact and organization fields are optional (LM-06)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LM-08 to LM-11: Partner Match Warning Banner */}
        {partnerMatchWarning && (
          <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
            partnerMatchWarning.callBlocked
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <div className="font-semibold">
                {partnerMatchWarning.callBlocked
                  ? 'Existing Partner Detected — Calling Action Will Be Blocked'
                  : 'Possible Partner Name Match (Informational Alert)'}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                Matched Partner: <span className="font-medium">{partnerMatchWarning.matchedPartner?.company_name}</span> ({partnerMatchWarning.matchedPartner?.partner_code})
              </div>
              <ul className="list-disc list-inside text-[10px] opacity-80 mt-1">
                {partnerMatchWarning.matchFactors?.map((f: string, idx: number) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {duplicateWarning && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Company / Individual Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company / Organization Name</label>
              <input
                type="text"
                placeholder="e.g. Vikas Logistics Pvt Ltd"
                value={formData.company_name}
                onBlur={checkMatches}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Alternative Name / Trade Name</label>
              <input
                type="text"
                placeholder="e.g. Vikas Express Cargo"
                value={formData.alternate_name}
                onBlur={checkMatches}
                onChange={(e) => setFormData({ ...formData, alternate_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Phone / Landline / Mobile</label>
              <input
                type="tel"
                placeholder="e.g. 9820012345 or 022-26540000"
                value={formData.phone}
                onBlur={checkMatches}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Email & Service Intent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email ID</label>
              <input
                type="email"
                placeholder="contact@company.com"
                value={formData.email}
                onBlur={checkMatches}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Service Intent</label>
              <select
                value={formData.service_intent}
                onChange={(e) => setFormData({ ...formData, service_intent: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Undecided">Undecided / Open</option>
                <option value="Token">Hardware Tokens Only</option>
                <option value="DSC">Digital Signature Certificates (DSC) Only</option>
                <option value="Both">Both (Token + DSC)</option>
              </select>
            </div>
          </div>

          {/* Lead Source & Lead Category (Dynamic Masters LM-01 & LM-02) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Lead Source (LM-01)</label>
              <select
                value={formData.source_id}
                onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Lead Source (Optional)</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.source_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Lead Category (LM-02)</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Category (Supervisory Intake if Unassigned)</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Geography: City/Town, State, District, Postal Code */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">City / Town</label>
              <input
                type="text"
                placeholder="e.g. Mumbai"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">District</label>
              <input
                type="text"
                placeholder="e.g. Mumbai Suburban"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">State</label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">PIN / Postal Code</label>
              <input
                type="text"
                placeholder="400051"
                value={formData.pin_code}
                onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Office / Delivery Address</label>
            <input
              type="text"
              placeholder="e.g. 402 Trade Centre, BKC, Bandra East"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Optional PAN Identifier */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">PAN (Optional)</label>
            <input
              type="text"
              placeholder="AAACA1234A"
              value={formData.pan}
              onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Requirement Summary */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Requirement / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Inquired about 50 Class 3 DSCs and token hardware for annual audit filing"
              value={formData.requirement_summary}
              onChange={(e) => setFormData({ ...formData, requirement_summary: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
            >
              {loading ? 'Saving...' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
