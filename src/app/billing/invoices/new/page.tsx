// Module 07: Invoice Builder (/billing/invoices/new)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from 'lucide-react'

export default function NewInvoicePage() {
  const [partners, setPartners] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [partnerId, setPartnerId] = useState('')
  const [seriesId, setSeriesId] = useState('')
  const [dueDays, setDueDays] = useState(30)
  const [items, setItems] = useState([
    { item: 'Class 3 Combo DSC 2-Yr', qty: 5, rate: 1450 },
    { item: 'ePass2003 Auto Token', qty: 5, rate: 500 },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((d) => {
        if (d.partners?.length) {
          setPartners(d.partners)
          setPartnerId(d.partners[0].id)
        }
      })
    fetch('/api/billing/series')
      .then((r) => r.json())
      .then((d) => {
        if (d.series?.length) {
          setSeries(d.series)
          setSeriesId(d.series[0].id)
        }
      })
  }, [])

  const subtotal = items.reduce((acc, curr) => acc + curr.qty * curr.rate, 0)
  const selectedPartner = partners.find((p) => p.id === partnerId)
  const isInterstate = selectedPartner && selectedPartner.state_code !== '27'
  const cgst = isInterstate ? 0 : Number(((subtotal * 0.18) / 2).toFixed(2))
  const sgst = isInterstate ? 0 : Number(((subtotal * 0.18) / 2).toFixed(2))
  const igst = isInterstate ? Number((subtotal * 0.18).toFixed(2)) : 0
  const total = subtotal + cgst + sgst + igst

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          series_id: seriesId,
          partner_id: partnerId,
          due_days: dueDays,
          line_items: items,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(`Invoice ${data.invoice_number} created successfully! Total: ₹${data.total}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/billing/invoices" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Invoices
        </Link>
        <span>/</span>
        <span className="text-white">New Multi-Account Invoice</span>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Generate Multi-Account Invoice</h1>
          <p className="text-xs text-slate-400 mt-1">
            Date-based sequence counter with automatic GST (CGST/SGST/IGST) calculations & ledger debit posting.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Select Partner</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name} ({p.partner_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Invoice Series</label>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              >
                {series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.series_name} ({s.prefix})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Credit Terms (Days)</label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Invoice Line Items</span>
              <button
                type="button"
                onClick={() => setItems([...items, { item: 'New Item', qty: 1, rate: 500 }])}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={it.item}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[idx].item = e.target.value
                      setItems(newItems)
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={it.qty}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[idx].qty = Number(e.target.value)
                      setItems(newItems)
                    }}
                    className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white text-right"
                  />
                  <input
                    type="number"
                    value={it.rate}
                    onChange={(e) => {
                      const newItems = [...items]
                      newItems[idx].rate = Number(e.target.value)
                      setItems(newItems)
                    }}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="p-2 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tax & Total Calculation */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-white">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {isInterstate ? (
              <div className="flex justify-between text-slate-400">
                <span>IGST (18% Interstate):</span>
                <span className="text-white">₹{igst.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-slate-400">
                  <span>CGST (9%):</span>
                  <span className="text-white">₹{cgst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SGST (9%):</span>
                  <span className="text-white">₹{sgst.toLocaleString('en-IN')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold text-white">
              <span>Grand Total:</span>
              <span className="text-emerald-400">₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Issue Invoice & Post to Ledger'}
          </button>
        </form>
      </div>
    </div>
  )
}

