// Payment Reminder Modal & Preview Component
'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  MessageSquare,
  Mail,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Clock,
  Building,
  User,
  Phone,
  Calendar,
  FileText,
  History,
  Copy,
  Check,
  Send
} from 'lucide-react'

interface ReminderModalProps {
  partnerId: string
  partnerName: string
  onClose: () => void
  onReminderLogged?: () => void
}

export function PaymentReminderModal({
  partnerId,
  partnerName,
  onClose,
  onReminderLogged
}: ReminderModalProps) {
  const [loading, setLoading] = useState(true)
  const [previewData, setPreviewData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview')
  
  // Editable message content
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  
  // History tab
  const [historyList, setHistoryList] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Action states
  const [actionLoading, setActionLoading] = useState(false)
  const [lastActionSuccess, setLastActionSuccess] = useState<string | null>(null)
  const [pendingConfirmSent, setPendingConfirmSent] = useState<string | null>(null) // reminder_id or channel
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load Preview
  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/billing/reminders/preview?partner_id=${encodeURIComponent(partnerId)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load reminder details')
        }
        if (isMounted) {
          setPreviewData(data)
          setMessage(data.default_message || '')
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [partnerId])

  // Load History
  const loadHistory = () => {
    setLoadingHistory(true)
    fetch(`/api/billing/reminders/history?partner_id=${encodeURIComponent(partnerId)}`)
      .then((res) => res.json())
      .then((data) => {
        setHistoryList(data.history || [])
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingHistory(false))
  }

  const handleTabChange = (tab: 'preview' | 'history') => {
    setActiveTab(tab)
    if (tab === 'history') {
      loadHistory()
    }
  }

  // Double-click safe logger
  const logReminderAction = async (channel: 'whatsapp' | 'email', status: 'opened' | 'staff_confirmed_sent' | 'drafted') => {
    if (isSubmitting) return null
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/billing/reminders/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          channel,
          status,
          outstanding_amount: previewData?.total_outstanding || 0,
          invoices: previewData?.invoices?.map((i: any) => i.invoice_number) || [],
          recipient_phone: previewData?.raw_phone || previewData?.partner?.phone,
          recipient_email: previewData?.raw_email || previewData?.partner?.email,
          message_content: message,
          client_timestamp: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to log reminder')
      }
      onReminderLogged?.()
      return data
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  // 1. Send via WhatsApp
  const handleOpenWhatsApp = async () => {
    const rawPhone = previewData?.raw_phone || previewData?.partner?.phone
    if (!rawPhone) {
      setError('Partner does not have a registered phone or WhatsApp number.')
      return
    }

    // Clean phone number: remove non-digits
    let cleanDigits = rawPhone.replace(/\D/g, '')
    if (cleanDigits.length === 10) {
      cleanDigits = '91' + cleanDigits // Default India code if 10 digits
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
      cleanDigits = '91' + cleanDigits.slice(1)
    } else if (cleanDigits.length < 10) {
      setError(`Invalid phone number (${rawPhone}). Please update partner profile with a valid 10-digit number.`)
      return
    }

    setActionLoading(true)
    setError(null)
    setLastActionSuccess(null)

    // Log status as 'opened'
    await logReminderAction('whatsapp', 'opened')

    // Open WhatsApp Web or Desktop application
    const encodedText = encodeURIComponent(message)
    const waUrl = `https://wa.me/${cleanDigits}?text=${encodedText}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')

    setActionLoading(false)
    setPendingConfirmSent('whatsapp')
    setLastActionSuccess('WhatsApp Web opened with draft message. Once sent, click "Mark as Sent" below to confirm.')
  }

  // 2. Send via Email (mailto draft)
  const handleOpenEmail = async () => {
    const rawEmail = previewData?.raw_email || previewData?.partner?.email
    if (!rawEmail || !rawEmail.includes('@')) {
      setError('Partner does not have a valid email address configured.')
      return
    }

    setActionLoading(true)
    setError(null)
    setLastActionSuccess(null)

    // Log status as 'opened'
    await logReminderAction('email', 'opened')

    const subject = encodeURIComponent(`Payment Reminder: Outstanding Balance for ${previewData?.partner?.company_name || partnerName}`)
    const body = encodeURIComponent(message)
    const mailtoUrl = `mailto:${rawEmail}?subject=${subject}&body=${body}`

    window.open(mailtoUrl, '_blank')

    setActionLoading(false)
    setPendingConfirmSent('email')
    setLastActionSuccess('Email client opened with prefilled draft. After sending, click "Mark as Sent" to record confirmation.')
  }

  // 3. Manual Staff Confirmation: Mark as Sent
  const handleConfirmSent = async (channel: 'whatsapp' | 'email') => {
    setActionLoading(true)
    const result = await logReminderAction(channel, 'staff_confirmed_sent')
    setActionLoading(false)
    if (result) {
      setPendingConfirmSent(null)
      setLastActionSuccess(`Staff confirmed: Reminder recorded as Sent via ${channel.toUpperCase()}!`)
      if (activeTab === 'history') {
        loadHistory()
      }
    }
  }

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Payment Follow-Up & Reminder
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700 font-mono">
                  {partnerName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Review outstanding invoice details and dispatch notification via WhatsApp or Email.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-800 px-5 pt-2 bg-slate-950/40 text-xs gap-4">
          <button
            onClick={() => handleTabChange('preview')}
            className={`pb-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Reminder Preview & Dispatch
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`pb-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Reminder History
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {lastActionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{lastActionSuccess}</span>
              </div>
              {pendingConfirmSent && (
                <button
                  type="button"
                  onClick={() => handleConfirmSent(pendingConfirmSent as any)}
                  disabled={actionLoading}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shrink-0 transition-colors cursor-pointer"
                >
                  ✓ Mark as Sent
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
              Loading partner statement & invoices...
            </div>
          ) : activeTab === 'history' ? (
            /* Reminder History Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Past reminders logged for this partner</span>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="text-indigo-400 hover:underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-slate-500">Loading history...</div>
              ) : historyList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500">
                  No payment reminders have been sent to this partner yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {historyList.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              item.channel === 'whatsapp'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {item.channel}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              item.status === 'staff_confirmed_sent'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : item.status === 'opened'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {item.status === 'staff_confirmed_sent'
                              ? 'Staff-Confirmed Sent'
                              : item.status === 'opened'
                              ? 'Opened / Drafted'
                              : item.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 flex items-center justify-between">
                        <span>
                          Pending: <strong className="text-amber-400">₹{item.outstanding_amount?.toLocaleString('en-IN')}</strong>
                          {item.invoices && item.invoices.length > 0 && ` (${item.invoices.join(', ')})`}
                        </span>
                        <span className="text-slate-400 text-[10px]">By: {item.staff_name}</span>
                      </div>
                      {item.message_snapshot && (
                        <p className="mt-1 text-[10px] text-slate-400 line-clamp-2 bg-slate-900/60 p-1.5 rounded font-mono">
                          {item.message_snapshot}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Preview & Dispatch Tab */
            <>
              {/* Partner Summary Card */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-white">{previewData?.partner?.company_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Contact: {previewData?.partner?.contact_person || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>WhatsApp / Phone: {previewData?.partner?.phone || <span className="text-rose-400 font-semibold">Not Configured</span>}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Email: {previewData?.partner?.email || <span className="text-rose-400 font-semibold">Not Configured</span>}</span>
                  </div>
                </div>

                <div className="space-y-1.5 sm:border-l sm:border-slate-800 sm:pl-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Total Pending:</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      ₹{previewData?.total_outstanding?.toLocaleString('en-IN') || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Earliest Due:</span>
                    <span className="text-slate-200 font-medium">
                      {previewData?.earliest_due_date ? new Date(previewData.earliest_due_date).toLocaleDateString('en-IN') : 'None'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Status:</span>
                    {previewData?.is_overdue ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold text-[10px] border border-rose-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Overdue ({previewData.overdue_days} days)
                      </span>
                    ) : previewData?.total_outstanding > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px] border border-amber-500/30">
                        Upcoming Due
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                        No Dues
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Invoices Pending:</span>
                    <span className="text-slate-200 font-medium font-mono">
                      {previewData?.invoices?.length || 0} invoice(s)
                    </span>
                  </div>
                </div>
              </div>

              {/* Outstanding Invoices List */}
              {previewData?.invoices && previewData.invoices.length > 0 && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5 text-[11px]">
                    Pending Invoices Included in Reminder ({previewData.invoices.length})
                  </label>
                  <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-950/40">
                    {previewData.invoices.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-[11px] py-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-400 font-semibold">{inv.invoice_number}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">
                            Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : 'N/A'}
                          </span>
                        </div>
                        <span className="font-semibold text-amber-400">
                          ₹{Number(inv.outstanding_balance).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Message Preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-medium text-[11px]">
                    Message Draft (Staff Editable)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                  placeholder="Payment reminder message..."
                />
              </div>

              {/* Bank Account Info Notice */}
              {previewData?.bank_account && (
                <div className="text-[10px] text-slate-400 bg-slate-950/30 p-2 rounded border border-slate-800/80">
                  <span className="text-indigo-400 font-semibold">SignSync Bank Details:</span> {previewData.bank_account.bank_name} • A/C: {previewData.bank_account.account_number} • IFSC: {previewData.bank_account.ifsc_code} {previewData.bank_account.upi_id && `• UPI: ${previewData.bank_account.upi_id}`}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {activeTab === 'preview' && (
              <span>Actions will open draft in client and record an audit log in Supabase.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            >
              Close
            </button>

            {activeTab === 'preview' && (
              <>
                {/* Send via Email button */}
                <button
                  type="button"
                  onClick={handleOpenEmail}
                  disabled={loading || actionLoading || !previewData || previewData.total_outstanding <= 0}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Open Email Draft
                </button>

                {/* Send via WhatsApp button */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  disabled={loading || actionLoading || !previewData || previewData.total_outstanding <= 0}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Send via WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
