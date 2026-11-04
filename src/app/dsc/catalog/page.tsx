// DSC Products & Pricing (/dsc/catalog)
'use client'

import React, { useState, useEffect } from 'react'
import { FileCheck2, Tag, Plus, Edit2, CheckCircle2, X } from 'lucide-react'

export default function DscCatalogPage() {
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [formData, setFormData] = useState({
    class_type: 'class_3_individual',
    certificate_type: 'combo_signing_encryption',
    validity_years: '2_years',
    vendor_base_price: '',
    partner_price: '',
    mrp: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadCatalog = () => {
    setLoading(true)
    fetch('/api/dsc/catalog')
      .then((r) => r.json())
      .then((d) => setCatalog(d.catalog || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    setFormData({
      class_type: 'class_3_individual',
      certificate_type: 'combo_signing_encryption',
      validity_years: '2_years',
      vendor_base_price: '800',
      partner_price: '1200',
      mrp: '2000',
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: any) => {
    setEditingItem(item)
    setFormData({
      class_type: item.class_type,
      certificate_type: item.certificate_type,
      validity_years: item.validity_years,
      vendor_base_price: String(item.vendor_base_price),
      partner_price: String(item.partner_price),
      mrp: String(item.mrp),
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingItem) {
        // Update price slabs
        const res = await fetch(`/api/dsc/catalog/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor_base_price: parseFloat(formData.vendor_base_price),
            partner_price: parseFloat(formData.partner_price),
            mrp: parseFloat(formData.mrp),
          }),
        })
        if (res.ok) {
          setIsModalOpen(false)
          loadCatalog()
        }
      } else {
        // Create new DSC product
        const res = await fetch('/api/dsc/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.ok) {
          setIsModalOpen(false)
          loadCatalog()
        }
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
          <h1 className="text-xl font-bold text-white">DSC Products & Pricing</h1>
          <p className="text-xs text-slate-400 mt-1">
            Price list for Class 3, DGFT, and Foreign National certificates (1, 2, and 3 Years).
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Certificate Product
        </button>
      </div>

      {/* Catalog Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Active Product Prices ({catalog.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Class Type</th>
                <th className="p-3">Certificate Type</th>
                <th className="p-3">Validity</th>
                <th className="p-3 text-right">Base Cost</th>
                <th className="p-3 text-right">Partner Price</th>
                <th className="p-3 text-right">Retail MRP</th>
                <th className="p-3 text-right">Profit / Unit</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Loading pricing catalog...
                  </td>
                </tr>
              ) : catalog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    No products found in catalog.
                  </td>
                </tr>
              ) : (
                catalog.map((c: any) => {
                  const margin = c.partner_price - c.vendor_base_price
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white capitalize">
                        {c.class_type.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3 text-slate-300 capitalize">
                        {c.certificate_type.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">
                          {c.validity_years.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400">₹{c.vendor_base_price?.toFixed(2)}</td>
                      <td className="p-3 text-right text-indigo-400 font-semibold">₹{c.partner_price?.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-200">₹{c.mrp?.toFixed(2)}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">
                        +₹{margin.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Edit Price
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">
                {editingItem ? 'Edit Product Pricing Slab' : 'Add DSC Certificate Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {!editingItem && (
                <>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Class Type</label>
                    <select
                      value={formData.class_type}
                      onChange={(e) => setFormData({ ...formData, class_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="class_3_individual">Class 3 Individual</option>
                      <option value="class_3_organization">Class 3 Organization</option>
                      <option value="dgft">DGFT Certificate</option>
                      <option value="foreign_national">Foreign National</option>
                      <option value="document_signer">Document Signer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Certificate Type</label>
                    <select
                      value={formData.certificate_type}
                      onChange={(e) => setFormData({ ...formData, certificate_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="signing_only">Signing Only</option>
                      <option value="combo_signing_encryption">Combo (Signing + Encryption)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Validity</label>
                    <select
                      value={formData.validity_years}
                      onChange={(e) => setFormData({ ...formData, validity_years: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                    >
                      <option value="1_year">1 Year</option>
                      <option value="2_years">2 Years</option>
                      <option value="3_years">3 Years</option>
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Base Cost (₹)</label>
                  <input
                    required
                    type="number"
                    value={formData.vendor_base_price}
                    onChange={(e) => setFormData({ ...formData, vendor_base_price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Partner Price (₹)</label>
                  <input
                    required
                    type="number"
                    value={formData.partner_price}
                    onChange={(e) => setFormData({ ...formData, partner_price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-semibold text-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Retail MRP (₹)</label>
                  <input
                    required
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
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
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
