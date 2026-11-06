'use client'

import React, { useState } from 'react'
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Preview & Summary Data
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSource, setSelectedSource] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [importResult, setImportResult] = useState<any>(null)

  React.useEffect(() => {
    if (isOpen) {
      setStep('upload')
      setFile(null)
      setError('')
      setPreviewData(null)
      setImportResult(null)

      fetch('/api/crm/lead-categories')
        .then(r => r.json())
        .then(d => setCategories(d.categories || []))
        .catch(() => {})

      fetch('/api/crm/lead-sources')
        .then(r => r.json())
        .then(d => setSources(d.sources || []))
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    window.open(`/api/crm/leads/templates/${format}`, '_blank')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setFileName(uploadedFile.name)
    setLoading(true)
    setError('')

    try {
      const data = await uploadedFile.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        setError('Uploaded file contains no rows.')
        setLoading(false)
        return
      }

      // Send to server preview endpoint
      const res = await fetch('/api/crm/leads/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawData: jsonData,
          fileName: uploadedFile.name
        })
      })

      const previewRes = await res.json()
      if (!res.ok) {
        setError(previewRes.error || 'Failed to process spreadsheet.')
      } else {
        setPreviewData(previewRes)
        setStep('preview')
      }
    } catch (err: any) {
      setError(err.message || 'Error parsing spreadsheet.')
    } finally {
      setLoading(false)
    }
  }

  const handleCommitImport = async () => {
    if (!previewData || !previewData.previewRows) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/crm/leads/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: previewData.previewRows,
          category_id: selectedCategory || null,
          source_id: selectedSource || null
        })
      })

      const commitRes = await res.json()
      if (!res.ok) {
        setError(commitRes.error || 'Failed to commit import.')
      } else {
        setImportResult(commitRes)
        setStep('complete')
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Error committing import.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Bulk Lead Ingestion & Qualification</h2>
              <p className="text-xs text-slate-400">Excel / CSV intake with automated deduplication & partner cross-checking</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload & Templates */}
        {step === 'upload' && (
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Template Download Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white">Download Standard Import Templates</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Use approved column headers. All contact fields are optional. GSTIN is excluded.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> CSV Template
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition bg-slate-950/40">
              <input
                type="file"
                id="bulk-lead-file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={loading}
              />
              <label htmlFor="bulk-lead-file" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <div className="text-sm font-semibold text-white mb-1">
                  {loading ? 'Analyzing spreadsheet rows...' : 'Click to select Excel or CSV file'}
                </div>
                <div className="text-xs text-slate-500">Supports .xlsx, .xls and .csv (up to 500 rows per batch)</div>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Validation */}
        {step === 'preview' && previewData && (
          <div className="p-6 space-y-5">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Rows</div>
                <div className="text-lg font-bold text-white mt-0.5">{previewData.summary.totalRows}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold">Valid Approved</div>
                <div className="text-lg font-bold text-emerald-300 mt-0.5">{previewData.summary.validRows}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
                <div className="text-[10px] text-amber-400 uppercase font-semibold">Partner Matches</div>
                <div className="text-lg font-bold text-amber-300 mt-0.5">{previewData.summary.partnerConflictRows}</div>
              </div>
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-800/40">
                <div className="text-[10px] text-red-400 uppercase font-semibold">File Duplicates</div>
                <div className="text-lg font-bold text-red-300 mt-0.5">{previewData.summary.duplicateRows}</div>
              </div>
            </div>

            {/* Batch Level Defaults */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Category Assignment</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Apply file-defined or leave for triage --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.category_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lead Source Attribution</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Apply file-defined or default --</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.source_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="p-3 border-b border-slate-800 text-xs font-semibold text-slate-300">
                Data Preview (First 50 Validated Rows)
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Company / Name</th>
                      <th className="p-2.5">Contact</th>
                      <th className="p-2.5">City / State</th>
                      <th className="p-2.5">Service Intent</th>
                      <th className="p-2.5">Partner Match Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {previewData.previewRows.map((r: any) => (
                      <tr key={r.rowNum} className="hover:bg-slate-900/40">
                        <td className="p-2.5 text-slate-500 font-mono">#{r.rowNum}</td>
                        <td className="p-2.5 font-medium text-white">{r.companyName || '<No Name Provided>'}</td>
                        <td className="p-2.5 text-slate-300">
                          <div>{r.phone || '—'}</div>
                          <div className="text-[10px] text-slate-500">{r.email || '—'}</div>
                        </td>
                        <td className="p-2.5 text-slate-400">{r.city || r.district || '—'}, {r.state || '—'}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                            {r.serviceIntent || 'Undecided'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {r.partnerMatch.callBlocked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-400 border border-red-800/60 flex items-center gap-1 w-fit">
                              <ShieldAlert className="w-3 h-3" /> Partner Match (Call Blocked)
                            </span>
                          ) : r.partnerMatch.hasMatch ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/60 w-fit">
                              Review Alert
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">No Partner Conflict</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
              >
                Choose Different File
              </button>
              <button
                type="button"
                disabled={loading || previewData.summary.validRows === 0}
                onClick={handleCommitImport}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/20"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Confirm & Import {previewData.summary.validRows} Leads
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && importResult && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Import Successfully Committed!</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {importResult.message} Partner match warnings and call blocks have been automatically applied to the active queues.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
              >
                Return to Leads Pipeline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

