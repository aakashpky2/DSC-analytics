'use client'

import React, { useState, useEffect } from 'react'
import { Plus, X, CheckCircle2, Upload, FileText, Check } from 'lucide-react'
import { UI_TERMS } from '@/lib/terms'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddPartnerModal({ isOpen, onClose, onSuccess }: ModalProps) {
  const [partnerTypes, setPartnerTypes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    gstin: '',
    pan: '',
    billing_address: '',
    state_code: '27',
    type: 'dsc_partner',
    credit_limit: 100000,
    credit_period_days: 30,
    kyc_document_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/masters/partner-types')
        .then((r) => r.json())
        .then((d) => {
          const list = (d.partner_types || []).filter((t: any) => t.is_active === 1 || t.is_active === true)
          setPartnerTypes(list)
          if (list.length > 0 && !list.some((t: any) => t.type_key === formData.type)) {
            setFormData((prev) => ({ ...prev, type: list[0].type_key }))
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1]
        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'kyc',
            fileName: file.name,
            fileBase64: base64Data,
            contentType: file.type || 'application/pdf',
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload document')
        }

        setFormData((prev) => ({ ...prev, kyc_document_url: data.fullUrl || data.signedUrl }))
        setUploadSuccess(true)
      }
      reader.readAsDataURL(file)
    } catch (err: any) {
      setError(err.message || 'File upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Unable to save partner')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">Add New Partner</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Acme Certifications Ltd"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Contact Person *</label>
              <input
                required
                type="text"
                placeholder="Full Name"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Mobile Number (10 digits) *</label>
              <input
                required
                type="tel"
                placeholder="98XXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email Address *</label>
              <input
                required
                type="email"
                placeholder="contact@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">GSTIN (Optional)</label>
              <input
                type="text"
                placeholder="27AAACA1234A1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Partner Category *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              >
                {partnerTypes.length > 0 ? (
                  partnerTypes.map((pt) => (
                    <option key={pt.id || pt.type_key} value={pt.type_key}>
                      {pt.type_name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="dsc_partner">DSC Retail Partner</option>
                    <option value="token_partner">Hardware Token Stockist</option>
                    <option value="associate_partner">Associate Business Partner</option>
                    <option value="master_distributor">Master Regional Distributor</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">KYC Supporting Document (PDF / Image)</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                {uploading ? 'Uploading...' : uploadSuccess ? 'Replace KYC File' : 'Upload'}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {uploadSuccess && (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> File securely stored in bucket
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Billing Office Address *</label>
            <input
              required
              type="text"
              placeholder="Full physical address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Credit Limit (₹)</label>
              <input
                type="number"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Payment Days (e.g. 30)</label>
              <input
                type="number"
                value={formData.credit_period_days}
                onChange={(e) => setFormData({ ...formData, credit_period_days: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

