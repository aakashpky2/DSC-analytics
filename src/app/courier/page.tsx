// Courier Dispatches & Shipments (/courier) - Master-Driven & Logistics Lifecycle
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Truck,
  Plus,
  X,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ShieldCheck,
  FileText,
  RotateCcw,
  Package,
  Layers,
  FileCheck2,
} from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function CourierPage() {
  const [dispatches, setDispatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Masters from Central Database
  const [courierPartners, setCourierPartners] = useState<any[]>([])
  const [shipmentStatuses, setShipmentStatuses] = useState<any[]>([])
  const [rtoReasons, setRtoReasons] = useState<any[]>([])
  const [dispatchMethods, setDispatchMethods] = useState<any[]>([])
  const [packagingTypes, setPackagingTypes] = useState<any[]>([])

  // Modals
  const [isShipModalOpen, setIsShipModalOpen] = useState(false)
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false)
  const [isRtoModalOpen, setIsRtoModalOpen] = useState(false)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null)
  const [trackingMilestones, setTrackingMilestones] = useState<any[]>([])

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Shipment Form
  const [shipForm, setShipForm] = useState({
    courier_id: '',
    awb_number: '',
    dispatch_method_code: '',
    packaging_type_code: '',
    serial_number: '',
    recipient_name: '',
    recipient_phone: '',
    shipping_address: '',
    district: '',
    state: '',
    pin_code: '',
    notes: '',
  })
  const [submittingShip, setSubmittingShip] = useState(false)
  const [shipError, setShipError] = useState('')

  // Manifest Form
  const [manifestCourierId, setManifestCourierId] = useState('')
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([])
  const [submittingManifest, setSubmittingManifest] = useState(false)
  const [manifestResult, setManifestResult] = useState<any | null>(null)

  // RTO Form
  const [rtoShipmentId, setRtoShipmentId] = useState('')
  const [rtoReasonCode, setRtoReasonCode] = useState('')
  const [rtoRemarks, setRtoRemarks] = useState('')
  const [submittingRto, setSubmittingRto] = useState(false)

  // 1. Fetch Masters from Database
  useEffect(() => {
    fetch('/api/courier/masters/all')
      .then((r) => r.json())
      .then((d) => {
        const couriers = (d.couriers || []).filter((c: any) => c.is_active !== 0)
        const statuses = d.statuses || []
        const reasons = (d.rtoReasons || []).filter((r: any) => r.is_active !== 0)
        const methods = (d.dispatchMethods || []).filter((m: any) => m.is_active !== 0)
        const pkgs = (d.packagingTypes || []).filter((p: any) => p.is_active !== 0)

        setCourierPartners(couriers)
        setShipmentStatuses(statuses)
        setRtoReasons(reasons)
        setDispatchMethods(methods)
        setPackagingTypes(pkgs)

        setShipForm((prev) => ({
          ...prev,
          courier_id: prev.courier_id || couriers[0]?.id || '',
          dispatch_method_code: prev.dispatch_method_code || methods[0]?.method_code || '',
          packaging_type_code: prev.packaging_type_code || pkgs[0]?.package_code || '',
        }))
        if (couriers.length > 0 && !manifestCourierId) {
          setManifestCourierId(couriers[0].id)
        }
        if (reasons.length > 0 && !rtoReasonCode) {
          setRtoReasonCode(reasons[0].reason_code)
        }
      })
      .catch((err) => console.error(err))
  }, [manifestCourierId, rtoReasonCode])

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

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingShip(true)
    setShipError('')

    try {
      const res = await fetch('/api/courier/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setShipError(data.error || 'Failed to create shipment.')
        return
      }

      setIsShipModalOpen(false)
      setShipForm({
        courier_id: courierPartners[0]?.id || '',
        awb_number: '',
        dispatch_method_code: dispatchMethods[0]?.method_code || '',
        packaging_type_code: packagingTypes[0]?.package_code || '',
        serial_number: '',
        recipient_name: '',
        recipient_phone: '',
        shipping_address: '',
        district: '',
        state: '',
        pin_code: '',
        notes: '',
      })
      loadDispatches()
    } catch (err: any) {
      setShipError(err.message || 'Error communicating with server')
    } finally {
      setSubmittingShip(false)
    }
  }

  const handleOpenTracking = async (shipment: any) => {
    setSelectedShipment(shipment)
    setIsTrackingModalOpen(true)
    try {
      const res = await fetch(`/api/courier/shipments/${shipment.id}`)
      const data = await res.json()
      setTrackingMilestones(data.milestones || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenRtoModal = (shipment: any) => {
    setRtoShipmentId(shipment.id)
    setIsRtoModalOpen(true)
  }

  const handleExecuteRto = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingRto(true)
    try {
      const res = await fetch('/api/courier/rto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: rtoShipmentId,
          rto_reason_code: rtoReasonCode,
          remarks: rtoRemarks,
        }),
      })
      if (res.ok) {
        setIsRtoModalOpen(false)
        loadDispatches()
      }
    } finally {
      setSubmittingRto(false)
    }
  }

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedShipmentIds.length === 0) return

    setSubmittingManifest(true)
    try {
      const res = await fetch('/api/courier/manifests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courier_id: manifestCourierId,
          shipment_ids: selectedShipmentIds,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setManifestResult(data.manifest)
        setSelectedShipmentIds([])
        loadDispatches()
      }
    } finally {
      setSubmittingManifest(false)
    }
  }

  const getDynamicTrackingUrl = (carrierName: string, awb: string) => {
    const courier = courierPartners.find((c) => c.company_name?.toLowerCase() === carrierName?.toLowerCase())
    const tpl = courier?.tracking_url_template || 'https://www.google.com/search?q={TRACKING_NO}'
    return tpl.replace(/{TRACKING_NO}/gi, awb).replace(/{awb}/gi, awb)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Courier Dispatches & Logistics</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              Database Masters
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic carrier integration, verified token packaging, daily manifests, and live tracking milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsManifestModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-xs flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Layers className="w-4 h-4" /> Daily Manifest
          </button>

          <button
            onClick={() => setIsShipModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition"
          >
            <Plus className="w-4 h-4" /> Create Shipment
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by AWB, recipient, or carrier..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500"
          />
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold">Consignment Ref</th>
                <th className="p-3 font-semibold">Courier Partner</th>
                <th className="p-3 font-semibold">Tracking AWB</th>
                <th className="p-3 font-semibold">Recipient & Address</th>
                <th className="p-3 font-semibold">Package Contents</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Dispatched</th>
                <th className="p-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                    Loading courier dispatches...
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                    No shipments found.
                  </td>
                </tr>
              ) : (
                dispatches.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3 font-bold text-cyan-400">{s.dispatch_number}</td>
                    <td className="p-3 font-sans text-white font-medium flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      {s.carrier_name}
                    </td>
                    <td className="p-3">
                      <a
                        href={getDynamicTrackingUrl(s.carrier_name, s.awb_number)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-mono"
                      >
                        {s.awb_number} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>
                    <td className="p-3 font-sans">
                      <div className="text-white font-medium">{s.recipient_name}</div>
                      <div className="text-[10px] text-slate-400 max-w-xs truncate">{s.shipping_address}</div>
                    </td>
                    <td className="p-3 text-slate-300">{s.package_contents}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 font-mono text-cyan-300">
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {new Date(s.dispatched_at || s.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenTracking(s)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                        >
                          Milestones
                        </button>
                        {s.status !== 'DELIVERED' && s.status !== 'RETURNED_TO_OFFICE' && (
                          <button
                            onClick={() => handleOpenRtoModal(s)}
                            className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] transition"
                          >
                            Mark RTO
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          isLoading={loading}
        />
      </div>

      {/* Create Shipment Modal */}
      {isShipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Create Courier Shipment</h3>
              <button onClick={() => setIsShipModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {shipError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {shipError}
              </div>
            )}

            <form onSubmit={handleCreateShipment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Courier Partner (Database Master) *</label>
                  <select
                    required
                    value={shipForm.courier_id}
                    onChange={(e) => setShipForm({ ...shipForm, courier_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {courierPartners.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tracking Number / AWB *</label>
                  <input
                    required
                    placeholder="e.g. BLU-8822001"
                    value={shipForm.awb_number}
                    onChange={(e) => setShipForm({ ...shipForm, awb_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Dispatch Method</label>
                  <select
                    value={shipForm.dispatch_method_code}
                    onChange={(e) => setShipForm({ ...shipForm, dispatch_method_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {dispatchMethods.map((m) => (
                      <option key={m.id || m.method_code} value={m.method_code}>
                        {m.method_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Security Packaging Type</label>
                  <select
                    value={shipForm.packaging_type_code}
                    onChange={(e) => setShipForm({ ...shipForm, packaging_type_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {packagingTypes.map((p) => (
                      <option key={p.id || p.package_code} value={p.package_code}>
                        {p.package_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Token Serial Number to Dispatch</label>
                <input
                  placeholder="e.g. FT-2026-0004"
                  value={shipForm.serial_number}
                  onChange={(e) => setShipForm({ ...shipForm, serial_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Recipient Full Name *</label>
                  <input
                    required
                    placeholder="e.g. Anita Sharma"
                    value={shipForm.recipient_name}
                    onChange={(e) => setShipForm({ ...shipForm, recipient_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Recipient Phone *</label>
                  <input
                    required
                    placeholder="+91 9820123456"
                    value={shipForm.recipient_phone}
                    onChange={(e) => setShipForm({ ...shipForm, recipient_phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Shipping Address *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street, Building, Flat No, Landmark..."
                  value={shipForm.shipping_address}
                  onChange={(e) => setShipForm({ ...shipForm, shipping_address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">District / City</label>
                  <input
                    placeholder="Mumbai"
                    value={shipForm.district}
                    onChange={(e) => setShipForm({ ...shipForm, district: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">State</label>
                  <input
                    placeholder="Maharashtra"
                    value={shipForm.state}
                    onChange={(e) => setShipForm({ ...shipForm, state: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">PIN Code</label>
                  <input
                    placeholder="400053"
                    value={shipForm.pin_code}
                    onChange={(e) => setShipForm({ ...shipForm, pin_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsShipModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingShip}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {submittingShip ? 'Creating...' : 'Create Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Milestones Modal */}
      {isTrackingModalOpen && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Tracking Milestone History</h3>
                <p className="text-[11px] text-slate-400">
                  {selectedShipment.carrier_name} — AWB: {selectedShipment.awb_number}
                </p>
              </div>
              <button
                onClick={() => setIsTrackingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar py-2">
              {trackingMilestones.length === 0 ? (
                <div className="text-center text-slate-500 italic p-4">No milestone events logged yet.</div>
              ) : (
                trackingMilestones.map((m, idx) => (
                  <div key={m.id || idx} className="flex items-start gap-3 text-slate-300 border-l border-cyan-500/40 pl-3 ml-2">
                    <div>
                      <div className="font-bold text-white text-xs">{m.status}</div>
                      <div className="text-[11px] text-cyan-300">{m.location}</div>
                      <div className="text-[10px] text-slate-400">{m.remarks}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        {new Date(m.timestamp).toLocaleString()} • {m.recorded_by}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTrackingModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RTO Modal */}
      {isRtoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">Initiate Delivery RTO</h3>
              </div>
              <button onClick={() => setIsRtoModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRto} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">RTO Reason (Database Master) *</label>
                <select
                  required
                  value={rtoReasonCode}
                  onChange={(e) => setRtoReasonCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {rtoReasons.map((r) => (
                    <option key={r.id || r.reason_code} value={r.reason_code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Remediation Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Details regarding failure to deliver..."
                  value={rtoRemarks}
                  onChange={(e) => setRtoRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRtoModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRto}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-md transition"
                >
                  {submittingRto ? 'Initiating...' : 'Confirm RTO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
