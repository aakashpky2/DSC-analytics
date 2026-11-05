// Other Business Services (/services)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, Plus, X, ChevronRight, FileCheck, Layers, Upload, Check } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function ServicesPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [servicesList, setServicesList] = useState<any[]>([])
  const [formData, setFormData] = useState({
    service_type: 'trademark',
    partner_id: '',
    client_name: '',
    client_contact: '',
    government_fees: '4500',
    professional_fees: '2500',
    uploaded_documents: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1]
        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'service',
            fileName: file.name,
            fileBase64: base64Data,
            contentType: file.type || 'application/pdf',
          }),
        })

        const data = await res.json()
        if (res.ok) {
          setFormData((prev) => ({ ...prev, uploaded_documents: data.fullUrl || data.signedUrl }))
          setUploadSuccess(true)
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })

    Promise.all([
      fetch(`/api/services/orders?${params.toString()}`).then((r) => r.json()),
      fetch('/api/partners').then((r) => r.json()),
    ])
      .then(([sData, pData]) => {
        setOrders(sData.orders || [])
        setTotalCount(sData.totalCount || 0)
        setTotalPages(sData.totalPages || 1)
        const pList = pData.partners || []
        setPartners(pList)
        if (pList.length > 0 && !formData.partner_id) {
          setFormData((prev) => ({ ...prev, partner_id: pList[0].id }))
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/services/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          government_fees: parseFloat(formData.government_fees) || 0,
          professional_fees: parseFloat(formData.professional_fees) || 0,
        }),
      })
      if (res.ok) {
        setIsModalOpen(false)
        setFormData((prev) => ({
          ...prev,
          client_name: '',
          client_contact: '',
          notes: '',
        }))
        loadData()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Other Business Services</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track filings for Trademarks, FSSAI Food Licenses, GST Registrations, and Company Incorporation.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs shadow-md shadow-pink-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Service Application
        </button>
      </div>

      {/* Services Portfolio Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { title: 'Trademark Filings', stage: 'Draft & Govt Search', color: 'border-pink-500/40 text-pink-400' },
          { title: 'FSSAI Licensing', stage: 'Basic / State / Central', color: 'border-amber-500/40 text-amber-400' },
          { title: 'GST Registration', stage: 'Application & Certificate', color: 'border-cyan-500/40 text-cyan-400' },
          { title: 'Company Incorporation', stage: 'SPICe+ MOA / AOA', color: 'border-indigo-500/40 text-indigo-400' },
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl bg-slate-900/60 border ${item.color} space-y-1`}>
            <div className="text-xs font-semibold text-white">{item.title}</div>
            <div className="text-[10px] text-slate-400">{item.stage}</div>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active Service Applications ({orders.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Order Number</th>
                <th className="p-3">Service Type</th>
                <th className="p-3">Client Name</th>
                <th className="p-3">Contact</th>
                <th className="p-3 text-right">Government Fee</th>
                <th className="p-3 text-right">Service Fee</th>
                <th className="p-3">Current Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading service orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active service orders in progress. Click New Service Application to start one.
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

        {/* Database Pagination */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>

      {/* New Service Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">New Legal & Business Service Order</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Service Type *</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  <option value="trademark">Trademark Filing</option>
                  <option value="fssai_basic">FSSAI Basic Food Registration</option>
                  <option value="fssai_state">FSSAI State License</option>
                  <option value="fssai_central">FSSAI Central License</option>
                  <option value="gst_registration">GST Registration</option>
                  <option value="company_incorporation">Private Limited Company Incorporation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Originating Partner *</label>
                <select
                  required
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name} ({p.partner_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Client Entity / Individual Name *</label>
                <input
                  required
                  placeholder="e.g. Apex Health Foods LLP"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Client Contact Number *</label>
                <input
                  required
                  placeholder="+91 9876543210"
                  value={formData.client_contact}
                  onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Government Fees (₹)</label>
                  <input
                    type="number"
                    value={formData.government_fees}
                    onChange={(e) => setFormData({ ...formData, government_fees: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Service Fee (₹)</label>
                  <input
                    type="number"
                    value={formData.professional_fees}
                    onChange={(e) => setFormData({ ...formData, professional_fees: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-semibold text-emerald-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Filing Notes / Reference</label>
                <input
                  placeholder="e.g. Logo mark search conducted, ready for portal intake"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Supporting Case Documents (ZIP, PDF, Image)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    {uploading ? 'Uploading...' : uploadSuccess ? 'Replace Uploaded File' : 'Upload'}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,application/zip"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {uploadSuccess && (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Documents securely stored
                    </span>
                  )}
                </div>
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
                  className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
