'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react'
import {
  validateLeadPhone,
  validateLeadEmail,
  validateLeadContactPerson,
  validateLeadCompanyName,
  validateLeadPinCode,
  validateLeadPan,
  validateLeadPayload,
} from '@/lib/leadValidation'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const INITIAL_LEAD_FORM = {
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
}

export function AddLeadModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState(INITIAL_LEAD_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [sources, setSources] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [partnerMatchWarning, setPartnerMatchWarning] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Refs for focusing first invalid field on submission
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const contactPersonRef = useRef<HTMLInputElement>(null)
  const companyNameRef = useRef<HTMLInputElement>(null)
  const pinCodeRef = useRef<HTMLInputElement>(null)
  const panRef = useRef<HTMLInputElement>(null)

  // AbortController ref to cancel previous pending requests and avoid simultaneous network hammering
  const matchAbortControllerRef = useRef<AbortController | null>(null)

  const resetForm = useCallback(() => {
    setFormData(INITIAL_LEAD_FORM)
    setFieldErrors({})
    setDuplicateWarning(null)
    setPartnerMatchWarning(null)
    setError('')
    setSuccessMsg('')
    setLoading(false)
  }, [])

  // Complete clean form reset on modal open and close
  useEffect(() => {
    if (isOpen) {
      resetForm()
      // Fetch dynamic active sources & categories
      fetch('/api/crm/lead-sources')
        .then((res) => res.json())
        .then((d) => setSources(d.sources || []))
        .catch(() => {})

      fetch('/api/crm/lead-categories')
        .then((res) => res.json())
        .then((d) => setCategories(d.categories || []))
        .catch(() => {})
    } else {
      resetForm()
    }
  }, [isOpen, resetForm])

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Real-time partner matching & duplicate check with request cancellation & debounce
  const checkMatches = async () => {
    if (!formData.phone && !formData.email && !formData.company_name) return

    // Cancel any previous in-flight match requests
    if (matchAbortControllerRef.current) {
      matchAbortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    matchAbortControllerRef.current = abortController

    try {
      console.log('[AddLeadModal] checkMatches initiating with:', {
        company: formData.company_name,
        email: formData.email,
        phone: formData.phone
      })
      // 1. Check partner matching (LM-08 to LM-11)
      const pRes = await fetch('/api/crm/leads/check-partner-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          company_name: formData.company_name,
          alternate_name: formData.alternate_name,
          email: formData.email,
          phone: formData.phone,
        }),
      })
      console.log('[AddLeadModal] check-partner-match HTTP status:', pRes.status)
      if (!pRes.ok) {
        console.warn('[AddLeadModal] check-partner-match returned non-OK status:', pRes.status)
        return
      }
      const pData = await pRes.json()
      console.log('[AddLeadModal] check-partner-match response payload:', pData)
      if (pData.hasMatch) {
        setPartnerMatchWarning(pData)
      } else {
        setPartnerMatchWarning(null)
      }

      // 2. Check lead-to-lead duplicate scoring
      const dRes = await fetch('/api/crm/leads/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify(formData),
      })
      console.log('[AddLeadModal] check-duplicate HTTP status:', dRes.status)
      if (!dRes.ok) {
        console.warn('[AddLeadModal] check-duplicate returned non-OK status:', dRes.status)
        return
      }
      const dData = await dRes.json()
      console.log('[AddLeadModal] check-duplicate response payload:', dData)
      if (dData.hasAlert) {
        setDuplicateWarning('Notice: Potential duplicate lead already exists in intake records.')
      } else {
        setDuplicateWarning(null)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[AddLeadModal] Previous match check request aborted.')
        return
      }
      console.error('[AddLeadModal] checkMatches error:', err)
      // non-blocking
    }
  }

  // Field-level blur validators
  const handleBlurPhone = () => {
    checkMatches()
    const res = validateLeadPhone(formData.phone)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, phone: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.phone
        return copy
      })
    }
  }

  const handleBlurEmail = () => {
    checkMatches()
    const res = validateLeadEmail(formData.email)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, email: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.email
        return copy
      })
    }
  }

  const handleBlurContact = () => {
    const res = validateLeadContactPerson(formData.contact_person)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, contact_person: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.contact_person
        return copy
      })
    }
  }

  const handleBlurCompany = () => {
    checkMatches()
    const res = validateLeadCompanyName(formData.company_name)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, company_name: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.company_name
        return copy
      })
    }
  }

  const handleBlurPin = () => {
    const res = validateLeadPinCode(formData.pin_code)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, pin_code: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.pin_code
        return copy
      })
    }
  }

  const handleBlurPan = () => {
    const res = validateLeadPan(formData.pan)
    if (!res.valid && res.error) {
      setFieldErrors((prev) => ({ ...prev, pan: res.error! }))
    } else {
      setFieldErrors((prev) => {
        const copy = { ...prev }
        delete copy.pan
        return copy
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    // LM-06 & LM-32: Validate complete intake payload (optional fields allowed; supplied invalid fields rejected)
    console.log('[AddLeadModal] Submitting lead formData:', formData)
    const validation = validateLeadPayload(formData)
    if (!validation.valid) {
      console.warn('[AddLeadModal] Frontend validation failed:', validation.errors)
      setFieldErrors(validation.errors)

      // Focus first invalid field
      if (validation.errors.phone && phoneRef.current) phoneRef.current.focus()
      else if (validation.errors.email && emailRef.current) emailRef.current.focus()
      else if (validation.errors.contact_person && contactPersonRef.current) contactPersonRef.current.focus()
      else if (validation.errors.company_name && companyNameRef.current) companyNameRef.current.focus()
      else if (validation.errors.pin_code && pinCodeRef.current) pinCodeRef.current.focus()
      else if (validation.errors.pan && panRef.current) panRef.current.focus()

      return
    }

    setFieldErrors({})
    setLoading(true)

    try {
      console.log('[AddLeadModal] Sending POST /api/crm/leads with sanitized payload:', validation.sanitized)
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.sanitized),
      })
      console.log('[AddLeadModal] POST /api/crm/leads response status:', res.status)

      const data = await res.json().catch(() => ({}))
      console.log('[AddLeadModal] POST /api/crm/leads response data:', data)

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          setFieldErrors(data.errors)
        }
        throw new Error(data.error || 'Unable to save lead. Please check your inputs.')
      }

      console.log('[AddLeadModal] Lead created successfully!')
      setSuccessMsg('Customer lead created successfully!')
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 700)
    } catch (err: any) {
      console.error('[AddLeadModal] Lead save error:', err)
      setError(err.message || 'Please check your inputs')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Add Customer / Partner Lead</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">All contact and organization fields are optional (LM-06)</p>
          </div>
          <button onClick={handleClose} disabled={loading} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LM-08 to LM-11: Partner Match Warning Banner */}
        {partnerMatchWarning && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              partnerMatchWarning.callBlocked
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <div className="font-semibold">
                {partnerMatchWarning.callBlocked
                  ? 'Existing Partner Detected — Calling Action Will Be Blocked (LM-08/LM-14)'
                  : 'Possible Partner Name Match (Informational Alert — LM-11)'}
              </div>
              <div className="text-[11px] opacity-90 mt-0.5">
                Matched Partner: <span className="font-medium">{partnerMatchWarning.matchedPartner?.company_name}</span>{' '}
                ({partnerMatchWarning.matchedPartner?.partner_code})
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
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs" noValidate autoComplete="off">
          {/* Company Name & Trade Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company / Organization Name</label>
              <input
                ref={companyNameRef}
                type="text"
                autoComplete="off"
                placeholder="e.g. Apex Digital Solutions"
                value={formData.company_name}
                onBlur={handleBlurCompany}
                onChange={(e) => {
                  setFormData({ ...formData, company_name: e.target.value })
                  if (fieldErrors.company_name) setFieldErrors((prev) => ({ ...prev, company_name: undefined as any }))
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none transition ${
                  fieldErrors.company_name ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.company_name && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.company_name}</p>
              )}
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Trade Name / Alternative Name</label>
              <input
                type="text"
                autoComplete="off"
                placeholder="e.g. Apex DSC Hub"
                value={formData.alternate_name}
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
                ref={contactPersonRef}
                type="text"
                autoComplete="off"
                placeholder="Full Name (e.g. Arjun Nair)"
                value={formData.contact_person}
                onBlur={handleBlurContact}
                onChange={(e) => {
                  setFormData({ ...formData, contact_person: e.target.value })
                  if (fieldErrors.contact_person) setFieldErrors((prev) => ({ ...prev, contact_person: undefined as any }))
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none transition ${
                  fieldErrors.contact_person ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.contact_person && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.contact_person}</p>
              )}
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Phone / Landline / Mobile</label>
              <input
                ref={phoneRef}
                type="tel"
                autoComplete="off"
                placeholder="10-digit number (e.g. 9876543210)"
                maxLength={10}
                value={formData.phone}
                onBlur={handleBlurPhone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setFormData({ ...formData, phone: val })
                  if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined as any }))
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white font-mono focus:outline-none transition ${
                  fieldErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.phone && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          {/* Email & Service Intent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email ID</label>
              <input
                ref={emailRef}
                type="email"
                autoComplete="off"
                placeholder="contact@company.com"
                value={formData.email}
                onBlur={handleBlurEmail}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined as any }))
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white focus:outline-none transition ${
                  fieldErrors.email ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.email}</p>
              )}
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
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name}
                  </option>
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">PIN / Postal Code</label>
              <input
                ref={pinCodeRef}
                type="text"
                autoComplete="off"
                placeholder="6 digits (e.g. 400051)"
                maxLength={6}
                value={formData.pin_code}
                onBlur={handleBlurPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setFormData({ ...formData, pin_code: val })
                  if (fieldErrors.pin_code) setFieldErrors((prev) => ({ ...prev, pin_code: undefined as any }))
                }}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white font-mono focus:outline-none transition ${
                  fieldErrors.pin_code ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {fieldErrors.pin_code && (
                <p className="text-[11px] text-red-400 mt-1">{fieldErrors.pin_code}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Office / Delivery Address</label>
            <input
              type="text"
              autoComplete="off"
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
              ref={panRef}
              type="text"
              autoComplete="off"
              placeholder="AAAAA9999A"
              maxLength={10}
              value={formData.pan}
              onBlur={handleBlurPan}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().slice(0, 10)
                setFormData({ ...formData, pan: val })
                if (fieldErrors.pan) setFieldErrors((prev) => ({ ...prev, pan: undefined as any }))
              }}
              className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-white uppercase font-mono focus:outline-none transition ${
                fieldErrors.pan ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {fieldErrors.pan && (
              <p className="text-[11px] text-red-400 mt-1">{fieldErrors.pan}</p>
            )}
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
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
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
