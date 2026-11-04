// Module 02: Partner Network Management (/partners)
import React from 'react'
import Link from 'next/link'
import { Users2, Wallet, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react'

async function getPartners() {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/partners?mask=true`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return data.partners || []
  } catch {
    return []
  }
}

export default async function PartnersPage() {
  const partners = await getPartners()

  const totalWallet = partners.reduce((sum: number, p: any) => sum + (p.wallet_balance || 0), 0)
  const totalCreditLimit = partners.reduce((sum: number, p: any) => sum + (p.credit_limit || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Partner Network Directory</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Module 02
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            DSC Direct Partners, Token Stockists & Associate Referral Networks with Credit Control and KYC.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Total Active Partners</div>
          <div className="text-2xl font-bold text-white mt-1">{partners.length}</div>
          <div className="text-[11px] text-emerald-400 mt-1">100% KYC Approved</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Combined Wallet Balances</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            ₹{totalWallet.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Available for DSC issuance</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Total Authorized Credit Lines</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            ₹{totalCreditLimit.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Net-30 / Net-45 credit terms</div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">Registered Partner Accounts</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Partner Code</th>
                <th className="p-3">Company & Contact</th>
                <th className="p-3">Category</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3">Credit Period</th>
                <th className="p-3">Wallet</th>
                <th className="p-3">KYC</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {partners.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono text-indigo-400 font-semibold">{p.partner_code}</td>
                  <td className="p-3">
                    <div className="font-semibold text-white">{p.company_name}</div>
                    <div className="text-[11px] text-slate-400">{p.contact_person} &bull; {p.phone}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                      {p.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-slate-200 font-medium">₹{p.credit_limit?.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-slate-400">Net-{p.credit_period_days} Days</td>
                  <td className="p-3 text-emerald-400 font-semibold">₹{p.wallet_balance?.toLocaleString('en-IN')}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/partners/${p.id}`}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      360 View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

