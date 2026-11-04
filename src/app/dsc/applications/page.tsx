// DSC Application Progress (/dsc/applications)
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Plus, X, ChevronRight, FileCheck, LayoutGrid, List } from 'lucide-react'
import { Pagination } from '@/components/Pagination'

const STAGES = [
  { key: 'intake', label: 'Application Received', color: 'border-blue-500/40 text-blue-400' },
  { key: 'document_verification', label: 'Document Review', color: 'border-amber-500/40 text-amber-400' },
  { key: 'video_recording', label: 'Video Verification', color: 'border-purple-500/40 text-purple-400' },
  { key: 'ca_portal_approval', label: 'Approval in Progress', color: 'border-cyan-500/40 text-cyan-400' },
  { key: 'issued_dispatched', label: 'Issued & Dispatched', color: 'border-emerald-500/40 text-emerald-400' },
]

export default function DscApplicationsPage() {
  const [apps, setApps] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stageFilter, setStageFilter] = useState('')

  // Column pagination offsets for board view
  const [columnPages, setColumnPages] = useState<{ [key: string]: number }>({
    intake: 1,
    document_verification: 1,
    video_recording: 1,
    ca_portal_approval: 1,
    issued_dispatched: 1,
  })
  const COLUMN_PAGE_SIZE = 5

  const [formData, setFormData] = useState({
    partner_id: '',
    catalog_id: '',
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    applicant_pan: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      mask: 'true',
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (stageFilter) params.append('stage', stageFilter)

    Promise.all([
      fetch(`/api/dsc/applications?${params.toString()}`).then((r) => r.json()),
      fetch('/api/partners').then((r) => r.json()),
      fetch('/api/dsc/catalog').then((r) => r.json()),
    ])
      .then(([aData, pData, cData]) => {
        setApps(aData.applications || [])
        setTotalCount(aData.totalCount || 0)
        setTotalPages(aData.totalPages || 1)

        const pList = pData.partners || []
        const cList = cData.catalog || []
        setPartners(pList)
        setCatalog(cList)
        if (pList.length > 0 && !formData.partner_id) {
          setFormData((prev) => ({ ...prev, partner_id: pList[0].id }))
        }
        if (cList.length > 0 && !formData.catalog_id) {
          setFormData((prev) => ({ ...prev, catalog_id: cList[0].id }))
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, stageFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleStageFilterChange = (st: string) => {
    setStageFilter(st)
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/dsc/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setIsModalOpen(false)
        setFormData((prev) => ({
          ...prev,
          applicant_name: '',
          applicant_email: '',
          applicant_phone: '',
          applicant_pan: '',
        }))
        loadData()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleAdvanceStage = async (id: string, currentStage: string) => {
    const stageKeys = STAGES.map((s) => s.key)
    const nextIndex = stageKeys.indexOf(currentStage) + 1
    if (nextIndex < stageKeys.length) {
      const nextStage = stageKeys[nextIndex]
      await fetch(`/api/dsc/applications/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: nextStage,
          ca_reference_no: nextStage === 'ca_portal_approval' ? `CA-REF-${Date.now().toString().slice(-4)}` : undefined,
          notes: `Progressed to ${nextStage.replace('_', ' ')} by operations staff`,
        }),
      })
      loadData()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/dsc/catalog" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Products & Prices
            </Link>
            <span>/</span>
            <span className="text-white">Application Progress</span>
          </div>
          <h1 className="text-xl font-bold text-white">DSC Application Progress</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track certificate processing from intake to document checks, video verification, and dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'board'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New DSC Application
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* Paginated Table View */
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white">All Applications ({totalCount})</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => handleStageFilterChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-md px-2.5 py-1 text-xs"
              >
                <option value="">All Stages</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <th className="p-3">Application #</th>
                  <th className="p-3">Applicant Name</th>
                  <th className="p-3">Partner</th>
                  <th className="p-3">Certificate Type</th>
                  <th className="p-3">Current Stage</th>
                  <th className="p-3">CA Reference</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading && apps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      Loading applications...
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  apps.map((a: any) => {
                    const st = STAGES.find((s) => s.key === a.stage)
                    return (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-cyan-400 font-semibold">{a.application_number}</td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{a.applicant_name}</div>
                          <div className="text-[11px] text-slate-400">{a.applicant_email} &bull; {a.applicant_phone}</div>
                        </td>
                        <td className="p-3 text-slate-300">{a.partner_company || 'Direct'}</td>
                        <td className="p-3">
                          <span className="capitalize text-slate-200">
                            {a.class_type?.replace(/_/g, ' ') || 'Class 3'} &bull; {a.certificate_type?.replace(/_/g, ' ') || 'Combo'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-950 ${st?.color || 'text-slate-400'}`}>
                            {st?.label || a.stage}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{a.ca_reference_no || '—'}</td>
                        <td className="p-3 text-right">
                          {a.stage !== 'issued_dispatched' ? (
                            <button
                              onClick={() => handleAdvanceStage(a.id, a.stage)}
                              className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[10px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              Advance <ChevronRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-emerald-400 text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Dispatched
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
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
            onPageSizeChange={handlePageSizeChange}
            isLoading={loading}
          />
        </div>
      ) : (
        /* Kanban Pipeline Columns */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {STAGES.map((st) => {
              const stageApps = apps.filter((a: any) => a.stage === st.key)
              const page = columnPages[st.key] || 1
              const totalColPages = Math.max(1, Math.ceil(stageApps.length / COLUMN_PAGE_SIZE))
              const paginatedStageApps = stageApps.slice((page - 1) * COLUMN_PAGE_SIZE, page * COLUMN_PAGE_SIZE)

              return (
                <div key={st.key} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {stageApps.length}
                      </span>
                    </div>

                    <div className="space-y-2 min-h-[320px]">
                      {loading && apps.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-600">Loading...</div>
                      ) : stageApps.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-slate-600 italic">No applications</div>
                      ) : (
                        paginatedStageApps.map((a: any) => (
                          <div key={a.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5 shadow-sm group">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-cyan-400 font-semibold">{a.application_number}</span>
                              <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-400">Class 3</span>
                            </div>
                            <div className="text-xs font-semibold text-white truncate">{a.applicant_name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{a.applicant_email}</div>
                            <div className="text-[10px] text-slate-400 truncate">{a.applicant_phone}</div>
                            {a.ca_reference_no && (
                              <div className="text-[9px] text-cyan-300 font-mono">Ref: {a.ca_reference_no}</div>
                            )}

                            {st.key !== 'issued_dispatched' && (
                              <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                                <button
                                  onClick={() => handleAdvanceStage(a.id, a.stage)}
                                  className="px-2 py-0.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-[10px] font-medium flex items-center gap-1 transition cursor-pointer"
                                >
                                  Advance <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Per-column compact pagination if records exceed column page size */}
                  {totalColPages > 1 && (
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Pg {page}/{totalColPages}</span>
                      <div className="flex gap-1">
                        <button
                          disabled={page <= 1}
                          onClick={() => setColumnPages({ ...columnPages, [st.key]: page - 1 })}
                          className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={page >= totalColPages}
                          onClick={() => setColumnPages({ ...columnPages, [st.key]: page + 1 })}
                          className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Database Pagination for current fetch */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
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
        </div>
      )}

      {/* New Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Create DSC Application</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Partner *</label>
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
                <label className="block text-slate-300 font-medium mb-1">DSC Product *</label>
                <select
                  required
                  value={formData.catalog_id}
                  onChange={(e) => setFormData({ ...formData, catalog_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_type.replace(/_/g, ' ')} - {c.certificate_type.replace(/_/g, ' ')} ({c.validity_years})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Applicant Full Name *</label>
                <input
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.applicant_name}
                  onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    placeholder="name@email.com"
                    value={formData.applicant_email}
                    onChange={(e) => setFormData({ ...formData, applicant_email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
                  <input
                    required
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.applicant_phone}
                    onChange={(e) => setFormData({ ...formData, applicant_phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Applicant PAN Card</label>
                <input
                  placeholder="e.g. ABCDE1234F"
                  value={formData.applicant_pan}
                  onChange={(e) => setFormData({ ...formData, applicant_pan: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white uppercase font-mono"
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
                  {submitting ? 'Creating...' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
