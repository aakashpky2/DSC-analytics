'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface AccessDeniedCardProps {
  title?: string
  message?: string
  backHref?: string
  backLabel?: string
  onRetry?: () => void
}

export function AccessDeniedCard({
  title = 'Access Restricted',
  message = 'Access denied. You do not have permission to view this resource.',
  backHref = '/',
  backLabel = 'Return to Home Dashboard',
  onRetry,
}: AccessDeniedCardProps) {
  return (
    <div className="mx-auto max-w-2xl p-8 my-8 animate-in fade-in duration-200">
      <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-8 text-center text-red-300 shadow-xl backdrop-blur-sm">
        <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-red-300/90 leading-relaxed max-w-md mx-auto">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-500 transition cursor-pointer"
            >
              Retry Request
            </button>
          )}
          <Link
            href={backHref}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 shadow transition"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

