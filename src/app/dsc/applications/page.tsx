// DSC Application Progress (/dsc/applications) - Dynamic Workflow & Token Allocation
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  ChevronRight,
  FileCheck,
  LayoutGrid,
  List,
  Upload,
  Check,
  Cpu,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { Pagination } from '@/components/Pagination'

export default function DscApplicationsPage() {
  const [apps, setApps] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [workflowStages, setWorkflowStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  // Token assignment modal
  const [assigningApp, setAssigningApp] = useState<any | null>(null)
  const [availableTokens, setAvailableTokens] = useState<any[]>([])
  const [selectedTokenSerial, setSelectedTokenSerial] = useState('')
  const [assigningLoading, setAssigningLoading] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Stage transition modal
  const [transitioningApp, setTransitioningApp] = useState<any | null>(null)
  const [targetStage, setTargetStage] = useState('')
  const [transitionNotes, setTransitionNotes] = useState('')
  const [caRefNo, setCaRefNo] = useState('')
  const [transitionError, setTransitionError] = useState('')
  const [transitionLoading, setTransitionLoading] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stageFilter, setStageFilter] = useState('')

  const [columnPages, setColumnPages] = useState<{ [key: string]: number }>({})
  const COLUMN_PAGE_SIZE = 5

  const [formData, setFormData] = useState({
    partner_id: '',
    catalog_id: '',
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    applicant_pan: '',
    documents_submitted: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // 1. Load Dynamic Workflow Stages from Central Database
  useEffect(() => {
    fetch('/api/dsc/masters/all')
      .then((r) => r.json())
      .then((d) => {
        const stages = (d.workflowStages || []).filter((s: any) => s.is_active !== 0)
        setWorkflowStages(stages)
        const initialColPages: { [key: string]: number } = {}
        stages.forEach((s: any) => {
          initialColPages[s.stage_key] = 1
        })
        setColumnPages(initialColPages)
      })
      .catch((err) => console.error('Failed to load workflow stages:', err))
  }, [])

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
            category: 'dsc',
            fileName: file.name,
            fileBase64: base64Data,
            contentType: file.type || 'application/pdf',
          }),
        })

        const data = await res.json()
        if (res.ok) {
          setFormData((prev) => ({ ...prev, documents_submitted: data.fullUrl || data.signedUrl }))
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

  // Open Transition Modal
  const handleOpenTransition = (app: any) => {
    setTransitioningApp(app)
    setCaRefNo(app.ca_reference_no || '')
    setTransitionNotes('')
    setTransitionError('')

    const currentStage = workflowStages.find((s) => s.stage_key === (app.stage || 'intake'))
    const allowed = currentStage?.allowed_transitions || []
    setTargetStage(allowed.length > 0 ? allowed[0] : '')
  }

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transitioningApp || !targetStage) return

    setTransitionLoading(true)
    setTransitionError('')

    try {
      const res = await fetch(`/api/dsc/applications/${transitioningApp.id}/transition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_stage: targetStage,
          ca_reference_no: caRefNo || undefined,
          notes: transitionNotes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setTransitionError(data.error || 'Workflow transition failed.')
        return
      }

      setTransitioningApp(null)
      loadData()
    } catch (err: any) {
      setTransitionError(err.message || 'Workflow transition error')
    } finally {
      setTransitionLoading(false)
    }
  }

  // Open Token Assignment Modal
  const handleOpenAssignToken = async (app: any) => {
    setAssigningApp(app)
    setAssignError('')
    setAssigningLoading(true)

    try {
      const res = await fetch('/api/inventory/tokens/available')
      const data = await res.json()
      const tokens = data.tokens || []
      setAvailableTokens(tokens)
      setSelectedTokenSerial(tokens[0]?.serial_number || '')
    } catch (err) {
      console.error(err)
    } finally {
      setAssigningLoading(false)
    }
  }

  const handleExecuteTokenReservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningApp || !selectedTokenSerial) return

    setAssigningLoading(true)
    setAssignError('')

    try {
      const res = await fetch('/api/inventory/tokens/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serial_number: selectedTokenSerial,
          partner_id: assigningApp.partner_id,
          application_id: assigningApp.id,
          notes: `Token allocated to applicant ${assigningApp.applicant_name} (${assigningApp.application_number})`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setAssignError(data.error || 'Token reservation conflict.')
        return
      }

      setAssigningApp(null)
      loadData()
    } catch (err: any) {
      setAssignError(err.message || 'Failed to allocate token')
    } finally {
      setAssigningLoading(false)
    }
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
        setFormData({
          partner_id: partners[0]?.id || '',
          catalog_id: catalog[0]?.id || '',
          applicant_name: '',
          applicant_email: '',
          applicant_phone: '',
          applicant_pan: '',
          documents_submitted: '',
        })
        setUploadSuccess(false)
        loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">DSC Application Pipeline</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Master Workflow Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic pipeline stages, transition verification, and cryptographic token allocation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                viewMode === 'board' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> New Application
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="">All Pipeline Stages</option>
          {workflowStages.map((st) => (
            <option key={st.stage_key} value={st.stage_key}>
              {st.stage_label}
            </option>
          ))}
        </select>
      </div>

      {/* Board View (Dynamic Columns based on PostgreSQL Workflow Stages) */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {workflowStages.map((stage) => {
            const stageApps = apps.filter((a) => (a.stage || 'intake') === stage.stage_key)
            const page = columnPages[stage.stage_key] || 1
            const totalColPages = Math.max(1, Math.ceil(stageApps.length / COLUMN_PAGE_SIZE))
            const paginatedColApps = stageApps.slice((page - 1) * COLUMN_PAGE_SIZE, page * COLUMN_PAGE_SIZE)

            return (
              <div
                key={stage.stage_key}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-3 min-h-[450px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-semibold text-white text-xs">{stage.stage_label}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                    {stageApps.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar max-h-[600px]">
                  {paginatedColApps.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-[11px] italic">No applications</div>
                  ) : (
                    paginatedColApps.map((app) => (
                      <div
                        key={app.id}
                        className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 space-y-2 hover:border-slate-700 transition shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] font-mono font-bold text-indigo-400">
                            {app.application_number}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-medium text-white text-xs">{app.applicant_name}</h4>
                          <p className="text-[10px] text-slate-400">{app.partner_company || 'Direct Partner'}</p>
                        </div>

                        <div className="text-[10px] text-slate-300 space-y-0.5">
                          <div>
                            <span className="text-slate-400">Class: </span>
                            {app.class_type?.replace(/_/g, ' ') || 'Class 3'}
                          </div>
                          <div>
                            <span className="text-slate-400">Validity: </span>
                            {app.validity_years?.replace(/_/g, ' ') || '2 Years'}
                          </div>
                          {app.ca_reference_no && (
                            <div>
                              <span className="text-slate-400">CA Ref: </span>
                              <span className="font-mono text-cyan-300">{app.ca_reference_no}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1">
                          <button
                            onClick={() => handleOpenAssignToken(app)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] flex items-center gap-1 transition"
                            title="Assign Physical USB Token"
                          >
                            <Cpu className="w-3 h-3" /> Token
                          </button>

                          <button
                            onClick={() => handleOpenTransition(app)}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] flex items-center gap-1 transition"
                          >
                            Transition <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Column Pagination */}
                {totalColPages > 1 && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {page}/{totalColPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={page <= 1}
                        onClick={() => setColumnPages({ ...columnPages, [stage.stage_key]: page - 1 })}
                        className="px-1.5 py-0.5 rounded bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white"
                      >
                        Prev
                      </button>
                      <button
                        disabled={page >= totalColPages}
                        onClick={() => setColumnPages({ ...columnPages, [stage.stage_key]: page + 1 })}
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
      ) : (
        /* List View */
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <th className="p-3 font-semibold">App Number</th>
                  <th className="p-3 font-semibold">Applicant Name</th>
                  <th className="p-3 font-semibold">Partner</th>
                  <th className="p-3 font-semibold">Certificate</th>
                  <th className="p-3 font-semibold">Current Stage</th>
                  <th className="p-3 font-semibold">CA Ref No</th>
                  <th className="p-3 font-semibold">Created</th>
                  <th className="p-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-sans">
                      Loading DSC applications...
                    </td>
                  </tr>
                ) : apps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                      No applications found.
                    </td>
                  </tr>
                ) : (
                  apps.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-bold text-indigo-400">{app.application_number}</td>
                      <td className="p-3 font-sans font-medium text-white">{app.applicant_name}</td>
                      <td className="p-3 font-sans text-slate-300">{app.partner_company || 'Direct'}</td>
                      <td className="p-3 font-sans text-slate-300">
                        {app.class_type?.replace(/_/g, ' ')} - {app.validity_years?.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[10px] border border-slate-700">
                          {workflowStages.find((s) => s.stage_key === app.stage)?.stage_label || app.stage}
                        </span>
                      </td>
                      <td className="p-3 text-cyan-300">{app.ca_reference_no || '-'}</td>
                      <td className="p-3 text-slate-400">{new Date(app.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenAssignToken(app)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] inline-flex items-center gap-1"
                          >
                            <Cpu className="w-3 h-3" /> Token
                          </button>
                          <button
                            onClick={() => handleOpenTransition(app)}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] inline-flex items-center gap-1"
                          >
                            Transition <ChevronRight className="w-3 h-3" />
                          </button>
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
            onPageSizeChange={handlePageSizeChange}
            isLoading={loading}
          />
        </div>
      )}

      {/* Dynamic Workflow Transition Modal */}
      {transitioningApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Advance Workflow Stage</h3>
                <p className="text-[11px] text-slate-400">
                  {transitioningApp.applicant_name} ({transitioningApp.application_number})
                </p>
              </div>
              <button
                onClick={() => setTransitioningApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transitionError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {transitionError}
              </div>
            )}

            <form onSubmit={handleExecuteTransition} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Current Stage</label>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                  {workflowStages.find((s) => s.stage_key === (transitioningApp.stage || 'intake'))?.stage_label ||
                    transitioningApp.stage}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Allowed Target Stage *</label>
                <select
                  required
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {(() => {
                    const cur = workflowStages.find((s) => s.stage_key === (transitioningApp.stage || 'intake'))
                    const allowedKeys = cur?.allowed_transitions || []
                    const allowedConfigs = workflowStages.filter((s) => allowedKeys.includes(s.stage_key))

                    if (allowedConfigs.length === 0) {
                      return <option value="">No transitions configured (Terminal stage)</option>
                    }
                    return allowedConfigs.map((s) => (
                      <option key={s.stage_key} value={s.stage_key}>
                        {s.stage_label} ({s.role_responsible || 'Staff'})
                      </option>
                    ))
                  })()}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Certifying Authority Reference No</label>
                <input
                  type="text"
                  placeholder="e.g. CA-2026-998811"
                  value={caRefNo}
                  onChange={(e) => setCaRefNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Audit Notes / Decision Rationale</label>
                <textarea
                  rows={2}
                  placeholder="Enter audit remarks for this workflow stage transition..."
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setTransitioningApp(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitionLoading || !targetStage}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {transitionLoading ? 'Advancing...' : 'Advance Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Token Reservation / Allocation Modal */}
      {assigningApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">Assign USB Cryptotoken</h3>
              </div>
              <button
                onClick={() => setAssigningApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {assignError}
              </div>
            )}

            <form onSubmit={handleExecuteTokenReservation} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Applicant</label>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-medium">
                  {assigningApp.applicant_name} ({assigningApp.application_number})
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Available Token Serial *</label>
                {availableTokens.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    No AVAILABLE tokens in stock. Please record inward token serials in Token Inventory first.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedTokenSerial}
                    onChange={(e) => setSelectedTokenSerial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  >
                    {availableTokens.map((t) => (
                      <option key={t.id || t.serial_number} value={t.serial_number}>
                        {t.serial_number} ({t.token_model})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssigningApp(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningLoading || availableTokens.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-md transition disabled:opacity-50"
                >
                  {assigningLoading ? 'Allocating...' : 'Reserve Token'}
                </button>
              </div>
            </form>
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

              <div>
                <label className="block text-slate-300 font-medium mb-1">Applicant e-KYC Proof Document</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 border border-slate-700 transition">
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    {uploading ? 'Uploading...' : uploadSuccess ? 'Replace Document' : 'Upload'}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {uploadSuccess && (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <Check className="w-3.5 h-3.5" /> File securely uploaded
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
