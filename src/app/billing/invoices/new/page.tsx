// Module 07: Dynamic Database-Driven Multi-Account Invoice Builder (/billing/invoices/new)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building2,
  Calculator,
  RotateCcw
} from 'lucide-react'

interface MasterState {
  states: any[]
  taxRates: any[]
  hsnSac: any[]
  invoiceTypes: any[]
  seriesConfigs: any[]
  companyProfile: any
}

interface ItemRow {
  item_type: 'GOODS' | 'SERVICE'
  description: string
  hsn_sac: string
  quantity: number
  unit_price: number
  discount_amount: number
  tax_rate_pct: number
}

export default function NewInvoicePage() {
  const [masters, setMasters] = useState<MasterState | null>(null)
  const [partners, setPartners] = useState<any[]>([])
  const [partnerId, setPartnerId] = useState('')
  const [seriesId, setSeriesId] = useState('')
  const [invoiceType, setInvoiceType] = useState('TAX_INVOICE')
  const [dueDays, setDueDays] = useState(30)
  const [isDraft, setIsDraft] = useState(false)
  const [loading, setLoading] = useState(true)

  // Dynamic Line Items
  const [items, setItems] = useState<ItemRow[]>([
    {
      item_type: 'SERVICE',
      description: 'Class 3 Signing & Encryption Combo 2-Yr Certificate',
      hsn_sac: '998313',
      quantity: 2,
      unit_price: 1500,
      discount_amount: 0,
      tax_rate_pct: 18,
    },
    {
      item_type: 'GOODS',
      description: 'ePass2003 Auto USB Hardware Crypto Token',
      hsn_sac: '8471',
      quantity: 2,
      unit_price: 500,
      discount_amount: 0,
      tax_rate_pct: 18,
    },
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Load all masters dynamically from backend API
  useEffect(() => {
    Promise.all([
      fetch('/api/billing/masters/all').then((r) => r.json()),
      fetch('/api/partners').then((r) => r.json()),
    ])
      .then(([m, p]) => {
        setMasters(m)
        if (m.seriesConfigs?.length) {
          setSeriesId(m.seriesConfigs[0].id)
        }
        if (p.partners?.length) {
          setPartners(p.partners)
          setPartnerId(p.partners[0].id)
        }
      })
      .catch((err) => setErrorMsg(`Failed to load system masters: ${err.message}`))
      .finally(() => setLoading(false))
  }, [])

  // Resolve customer and Place of Supply
  const selectedPartner = partners.find((p) => p.id === partnerId)
  const supplierStateCode = masters?.companyProfile?.state_code || '27'
  const customerStateCode = selectedPartner?.state_code || '27'
  const isInterState = String(customerStateCode).trim() !== String(supplierStateCode).trim()

  // Real-time dynamic financial calculation matching backend engine
  let subtotal = 0
  let totalDiscount = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0

  items.forEach((it) => {
    const gross = (Number(it.quantity) || 1) * (Number(it.unit_price) || 0)
    const disc = Math.min(gross, Number(it.discount_amount) || 0)
    const taxable = Math.max(0, gross - disc)
    const rate = Number(it.tax_rate_pct) || 0

    subtotal += taxable
    totalDiscount += disc

    if (isInterState) {
      totalIgst += (taxable * rate) / 100
    } else {
      totalCgst += (taxable * (rate / 2)) / 100
      totalSgst += (taxable * (rate / 2)) / 100
    }
  })

  const totalTax = totalCgst + totalSgst + totalIgst
  const grandTotal = subtotal + totalTax

  const handleAddItem = () => {
    const defaultHsn = masters?.hsnSac?.[0]
    setItems((prev) => [
      ...prev,
      {
        item_type: (defaultHsn?.type as any) || 'SERVICE',
        description: defaultHsn?.description || 'Custom Service Item',
        hsn_sac: defaultHsn?.code || '998313',
        quantity: 1,
        unit_price: 1000,
        discount_amount: 0,
        tax_rate_pct: defaultHsn?.default_tax_rate || 18,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'hsn_sac') {
        const found = masters?.hsnSac?.find((h) => h.code === value)
        if (found) {
          copy[index].item_type = found.type
          copy[index].tax_rate_pct = found.default_tax_rate || 18
        }
      }
      return copy
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/billing/invoices/extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: partnerId,
          invoice_type: invoiceType,
          series_id: seriesId,
          due_days: dueDays,
          line_items: items,
          is_draft: isDraft,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMsg(
          `Invoice ${data.invoice_number} generated successfully! Status: ${data.status.toUpperCase()}, Total: ₹${data.total_amount?.toLocaleString('en-IN')}`
        )
      } else {
        setErrorMsg(data.error || 'Failed to generate invoice.')
      }
    } catch (err: any) {
      setErrorMsg(`Server connectivity error: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Loading authoritative Master Data and Partner Records...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/billing/invoices" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Invoices
        </Link>
        <span>/</span>
        <span className="text-white">Dynamic Multi-Account Invoice Builder</span>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Generate Database-Driven Tax Invoice
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic HSN/SAC codes, configurable GST slabs, supplier-to-POS state resolution, and atomic numbering counter.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
            {/* Customer / Partner */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Customer / Partner</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name} ({p.partner_code})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                GSTIN: {selectedPartner?.gstin || 'URP'} &bull; State: {customerStateCode}
              </span>
            </div>

            {/* Invoice Series */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Numbering Series</label>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                {masters?.seriesConfigs?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.series_name} ({s.prefix})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-emerald-400 mt-1 block">Atomic Counter Sequence</span>
            </div>

            {/* Invoice Type */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Invoice Document Type</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                {masters?.invoiceTypes?.map((t) => (
                  <option key={t.id} value={t.type_code}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-cyan-400 mt-1 block">
                {isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}
              </span>
            </div>

            {/* Credit Days */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Payment SLA (Due Days)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={dueDays}
                onChange={(e) => setDueDays(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Due: Net-{dueDays} Days</span>
            </div>
          </div>

          {/* Place of Supply Banner */}
          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-300">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>
                <strong>Supplier:</strong> {masters?.companyProfile?.legal_name} (State {supplierStateCode}) &rarr;{' '}
                <strong>Place of Supply:</strong> State {customerStateCode} ({selectedPartner?.company_name})
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {isInterState ? 'INTER-STATE SUPPLY (IGST)' : 'INTRA-STATE SUPPLY (CGST + SGST)'}
            </span>
          </div>

          {/* Dynamic Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Commercial Line Items</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium flex items-center gap-1 border border-indigo-500/30"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                    <th className="p-3">Type</th>
                    <th className="p-3">HSN / SAC</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Rate (₹)</th>
                    <th className="p-3 text-right">Discount (₹)</th>
                    <th className="p-3">GST Slab</th>
                    <th className="p-3 text-right">Taxable (₹)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((row, idx) => {
                    const gross = (Number(row.quantity) || 1) * (Number(row.unit_price) || 0)
                    const disc = Math.min(gross, Number(row.discount_amount) || 0)
                    const taxable = Math.max(0, gross - disc)

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        {/* Type */}
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.item_type === 'GOODS'
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {row.item_type}
                          </span>
                        </td>

                        {/* HSN/SAC Dropdown from DB Master */}
                        <td className="p-3">
                          <select
                            value={row.hsn_sac}
                            onChange={(e) => handleItemChange(idx, 'hsn_sac', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            {masters?.hsnSac?.map((h) => (
                              <option key={h.id} value={h.code}>
                                {h.code} ({h.type})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-64"
                          />
                        </td>

                        {/* Qty */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-16 text-right"
                          />
                        </td>

                        {/* Unit Rate */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-24 text-right"
                          />
                        </td>

                        {/* Discount Amount */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.discount_amount}
                            onChange={(e) =>
                              handleItemChange(idx, 'discount_amount', parseFloat(e.target.value) || 0)
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white w-20 text-right"
                          />
                        </td>

                        {/* GST Slab from DB Master */}
                        <td className="p-3">
                          <select
                            value={row.tax_rate_pct}
                            onChange={(e) =>
                              handleItemChange(idx, 'tax_rate_pct', parseFloat(e.target.value) || 0)
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            {masters?.taxRates?.map((t) => (
                              <option key={t.id} value={t.rate_pct}>
                                {t.rate_pct}% ({t.description.split('(')[0].trim()})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Taxable Value */}
                        <td className="p-3 text-right font-mono text-slate-200">
                          ₹{taxable.toFixed(2)}
                        </td>

                        {/* Action */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Calculation Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-1">
                <Calculator className="w-4 h-4 text-cyan-400" />
                <span>Statutory Tax & Place of Supply Breakdown</span>
              </div>
              <p>
                Calculations are authoritatively recomputed on the backend before insertion to preserve legal compliance.
              </p>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isDraft}
                    onChange={(e) => setIsDraft(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Save as Draft (Editable until formally issued)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Taxable Value:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Total Discount:</span>
                  <span>-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-cyan-400">
                  <span>Integrated GST (IGST):</span>
                  <span>₹{totalIgst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-cyan-400">
                    <span>Central GST (CGST):</span>
                    <span>₹{totalCgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-cyan-400">
                    <span>State GST (SGST):</span>
                    <span>₹{totalSgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white font-sans">
                <span>Invoice Total:</span>
                <span className="text-indigo-400 font-mono">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submission Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/billing/invoices"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'Generating Invoice...' : isDraft ? 'Save as Draft Invoice' : 'Issue Tax Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
