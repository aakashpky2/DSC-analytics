// Module 03: DSC Application Lifecycle Kanban Pipeline (/dsc/applications)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, FileCheck2, Clock, CheckCircle2, AlertCircle, Video, ShieldCheck } from 'lucide-react'

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
  { key: 'intake', label: 'Intake Form', color: 'border-blue-500/40 text-blue-400' },
  { key: 'document_verification', label: 'Document Review', color: 'border-amber-500/40 text-amber-400' },
  { key: 'video_recording', label: 'Video Verification', color: 'border-purple-500/40 text-purple-400' },
  { key: 'ca_portal_approval', label: 'CA Approval', color: 'border-cyan-500/40 text-cyan-400' },
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
              <ArrowLeft className="w-3.5 h-3.5" /> DSC Catalog
            </Link>
            <span>/</span>
            <span className="text-white">Issuance Pipeline</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">DSC Application Lifecycle Kanban Pipeline</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Module 03 Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end lifecycle: Intake Form &rarr; Document Verification &rarr; Video Recording &rarr; CA Approval &rarr; Issuance & Dispatch.
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
                  <div className="p-4 text-center text-[11px] text-slate-600 italic">No apps</div>
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

