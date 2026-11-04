// Courier Dispatches (/courier)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Truck, Plus, X, Search, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function CourierPage() {
  const [dispatches, setDispatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [formData, setFormData] = useState({
    carrier_name: 'Blue Dart',
    awb_number: '',
    recipient_name: '',
    recipient_phone: '',
    shipping_address: '',
    package_contents: '10x ePass2003 Hardware Tokens',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadDispatches = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) params.append('search', search.trim())

    fetch(`/api/courier/dispatches?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setDispatches(d.dispatches || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, search])

  useEffect(() => {
    loadDispatches()
  }, [loadDispatches])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/courier/dispatches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsModalOpen(false)
        setFormData({
          carrier_name: 'Blue Dart',
          awb_number: '',
          recipient_name: '',
          recipient_phone: '',
          shipping_address: '',
          package_contents: '10x ePass2003 Hardware Tokens',
        })
        loadDispatches()
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
          <h1 className="text-xl font-bold text-white">Courier Dispatches & Waybills</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch records across Blue Dart, DTDC, Speed Post, and Delhivery with tracking numbers.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Book Courier Waybill
        </button>
      </div>

      {/* Dispatches Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">Shipment Records ({totalCount})</div>
          
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search dispatch #, carrier, AWB..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Dispatch #</th>
                <th className="p-3">Courier Partner</th>
                <th className="p-3">Tracking Number</th>
                <th className="p-3">Recipient & Phone</th>
                <th className="p-3">Package Contents</th>
                <th className="p-3">Dispatched Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading dispatches...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No active dispatches. Click Book Courier Waybill to record a shipment.
                  </td>
                </tr>
              ) : (
                dispatches.map((d: any) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300 font-semibold">{d.dispatch_number}</td>
                    <td className="p-3 font-semibold text-white">{d.carrier_name}</td>
                    <td className="p-3 font-mono text-indigo-300">{d.awb_number}</td>
                    <td className="p-3">
                      <div className="text-slate-200">{d.recipient_name}</div>
                      <div className="text-[11px] text-slate-400">{d.recipient_phone}</div>
                    </td>
                    <td className="p-3 text-slate-300">{d.package_contents}</td>
                    <td className="p-3 text-slate-400 font-mono">{d.dispatched_at?.split('T')[0] || d.dispatched_at}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                        {d.status === 'manifested' ? 'Booked & Manifested' : d.status}
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

      {/* Book Waybill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Book Courier Waybill</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Carrier Partner *</label>
                  <select
                    value={formData.carrier_name}
                    onChange={(e) => setFormData({ ...formData, carrier_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Blue Dart">Blue Dart</option>
                    <option value="DTDC">DTDC Courier</option>
                    <option value="Speed Post">India Post Speed Post</option>
                    <option value="Delhivery">Delhivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">AWB Tracking # *</label>
                  <input
                    required
                    placeholder="e.g. BLU-7389201"
                    value={formData.awb_number}
                    onChange={(e) => setFormData({ ...formData, awb_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Recipient Full Name *</label>
                <input
                  required
                  placeholder="e.g. Rahul Verma"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Recipient Phone *</label>
                <input
                  required
                  placeholder="+91 9820011223"
                  value={formData.recipient_phone}
                  onChange={(e) => setFormData({ ...formData, recipient_phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Delivery Address *</label>
                <input
                  required
                  placeholder="e.g. Suite 402, Trade Center, BKC, Mumbai 400051"
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Package Contents</label>
                <input
                  placeholder="e.g. 10x ePass2003 Hardware Tokens + Certificates"
                  value={formData.package_contents}
                  onChange={(e) => setFormData({ ...formData, package_contents: e.target.value })}
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
                  {submitting ? 'Booking...' : 'Book Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
