'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ShieldAlert, LogIn, X } from 'lucide-react'

export interface ToastNotification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  status?: number
  title: string
  message: string
}

interface ToastContextType {
  toasts: ToastNotification[]
  showToast: (toast: Omit<ToastNotification, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(({ type, status, title, message }: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    setToasts((prev) => {
      // Deduplicate identical active toasts
      if (prev.some((t) => t.title === title && t.message === message)) {
        return prev
      }
      return [...prev, { id, type, status, title, message }]
    })

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      removeToast(id)
    }, 6000)
  }, [removeToast])

  // Central event listener for window dispatch
  useEffect(() => {
    const handleAuthError = (event: CustomEvent<{ status: number; message?: string }>) => {
      const { status, message } = event.detail
      if (status === 401) {
        showToast({
          type: 'warning',
          status: 401,
          title: 'Authentication Required',
          message: message || 'Your session has expired. Please sign in again to continue.'
        })
      } else if (status === 403) {
        showToast({
          type: 'error',
          status: 403,
          title: 'Access Restricted (403)',
          message: message || 'You do not have permission to view or perform this action within your current role or category scope.'
        })
      }
    }

    window.addEventListener('signsync:auth-error' as any, handleAuthError as any)
    return () => {
      window.removeEventListener('signsync:auth-error' as any, handleAuthError as any)
    }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Central Fixed Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
              toast.status === 403
                ? 'bg-rose-950/90 border-rose-600/60 text-rose-100 shadow-rose-950/50'
                : toast.status === 401
                ? 'bg-amber-950/90 border-amber-600/60 text-amber-100 shadow-amber-950/50'
                : 'bg-slate-900/90 border-slate-700/60 text-slate-100 shadow-slate-950/50'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.status === 403 ? (
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              ) : toast.status === 401 ? (
                <LogIn className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider">
                  {toast.title}
                </h4>
                {toast.status && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      toast.status === 403
                        ? 'bg-rose-500/30 text-rose-300'
                        : 'bg-amber-500/30 text-amber-300'
                    }`}
                  >
                    HTTP {toast.status}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90 line-clamp-3">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

