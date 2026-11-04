// Module 07: Bank Account Register & Dynamic QR Upload (/billing/accounts)
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Landmark, QrCode, Plus } from 'lucide-react'

async function getAccounts() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/billing/accounts`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.accounts || []
  } catch {
    return []
  }
}

export default async function BillingAccountsPage() {
  const accounts = await getAccounts()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/billing/invoices" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Billing Invoices
            </Link>
            <span>/</span>
            <span className="text-white">Bank Accounts Register</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Bank Account Configuration & Dynamic QR</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Module 07 Accounts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure bank credentials, UPI handles, IFSC & dynamic payment QR codes mapped to invoice series.
          </p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc: any) => (
          <div key={acc.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">{acc.account_nickname}</span>
              </div>
              <div className="text-xs text-slate-200">{acc.bank_name} &bull; A/C: {acc.account_number}</div>
              <div className="text-xs text-slate-400">Holder: {acc.account_holder_name}</div>
              <div className="text-[11px] text-slate-400">IFSC: {acc.ifsc_code} &bull; Branch: {acc.branch_name}</div>
              <div className="text-xs text-cyan-400 font-mono">UPI ID: {acc.upi_id}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <QrCode className="w-10 h-10 text-white mx-auto" />
              <span className="text-[9px] text-emerald-400 font-mono mt-1 block">Active UPI</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

