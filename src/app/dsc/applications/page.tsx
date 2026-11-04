// DSC Application Progress (/dsc/applications)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

async function getApplications() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/dsc/applications?mask=true`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.applications || []
  } catch {
    return []
  }
}

const STAGES = [
  { key: 'intake', label: 'Application Received', color: 'border-blue-500/40 text-blue-400' },
  { key: 'document_verification', label: 'Document Review', color: 'border-amber-500/40 text-amber-400' },
  { key: 'video_recording', label: 'Video Verification', color: 'border-purple-500/40 text-purple-400' },
  { key: 'ca_portal_approval', label: 'Approval in Progress', color: 'border-cyan-500/40 text-cyan-400' },
  { key: 'issued_dispatched', label: 'Issued & Dispatched', color: 'border-emerald-500/40 text-emerald-400' },
]

export default async function DscApplicationsPage() {
  const apps = await getApplications()

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
      </div>

      {/* Kanban Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STAGES.map((st) => {
          const stageApps = apps.filter((a: any) => a.stage === st.key)
          return (
            <div key={st.key} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className={`text-xs font-semibold ${st.color}`}>{st.label}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {stageApps.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[300px]">
                {stageApps.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-600 italic">No applications</div>
                ) : (
                  stageApps.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-400 font-semibold">{a.application_number}</span>
                        <span className="text-[9px] uppercase px-1 rounded bg-slate-800 text-slate-400">2-Yr</span>
                      </div>
                      <div className="text-xs font-medium text-white truncate">{a.applicant_name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{a.applicant_email}</div>
                      <div className="text-[10px] text-slate-400 truncate">{a.applicant_phone}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
