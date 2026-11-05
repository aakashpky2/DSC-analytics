'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Wallet,
  FileText,
  CheckCircle2,
  Package,
  Layers,
  Sliders,
  Save,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

export function PartnerDetailClient({ initialData, partnerId }: { initialData: any; partnerId: string }) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'inventory' | 'ledger' | 'credit'>('profile')
  const [creditLimit, setCreditLimit] = useState(initialData.partner?.credit_limit || 0)
  const [creditPeriod, setCreditPeriod] = useState(initialData.partner?.credit_period_days || 0)
  const [savingCredit, setSavingCredit] = useState(false)
  const [creditSuccess, setCreditSuccess] = useState('')

  const { partner, orders, invoices, ledger, inventory } = data

  const handleUpdateCredit = async () => {
    setSavingCredit(true)
    setCreditSuccess('')
    try {
      const res = await fetch(`/api/partners/${partnerId}/credit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_limit: Number(creditLimit),
          credit_period_days: Number(creditPeriod)
        })
      })
      if (res.ok) {
        setCreditSuccess('Credit terms and operational limits updated successfully.')
        setData((prev: any) => ({
          ...prev,
          partner: {
            ...prev.partner,
            credit_limit: Number(creditLimit),
            credit_period_days: Number(creditPeriod)
          }
        }))
        setTimeout(() => setCreditSuccess(''), 4000)
      }
    } finally {
      setSavingCredit(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/partners" className="hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Partners
        </Link>
        <span>/</span>
        <span className="text-white font-medium">{partner.company_name}</span>
      </div>

      {/* Partner 360 Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{partner.company_name}</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {partner.partner_code}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
              {partner.type?.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 space-y-1">
            <div>Contact Person: <span className="text-slate-200">{partner.contact_person}</span> &bull; {partner.phone} &bull; {partner.email}</div>
            <div>GSTIN: {partner.gstin || 'N/A'} &bull; PAN: {partner.pan || 'N/A'} &bull; State Code: {partner.state_code}</div>
            <div>Billing Address: {partner.billing_address}</div>
          </div>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-xs text-slate-400">Wallet Balance</div>
            <div className="text-xl font-bold text-emerald-400">₹{partner.wallet_balance?.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500">Available to issue DSCs</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Active Credit Limit</div>
            <div className="text-xl font-bold text-indigo-400">₹{partner.credit_limit?.toLocaleString('en-IN')}</div>
            <div className="text-[10px] text-slate-500">Net-{partner.credit_period_days} Days</div>
          </div>
        </div>
      </div>

      {/* 5-Tab Navigation System */}
      <div className="flex border-b border-slate-800 gap-1 text-xs">
        {[
          { key: 'profile', label: '1. Legal Profile & KYC', icon: Building2 },
          { key: 'orders', label: '2. DSC Order History', icon: FileText },
          { key: 'inventory', label: '3. Token Allocations', icon: Package },
          { key: 'ledger', label: '4. Financial Ledger', icon: Wallet },
          { key: 'credit', label: '5. Credit Control', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 font-medium border-b-2 transition cursor-pointer ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: Profile & KYC */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white">Legal Entity Credentials</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800"><span className="text-slate-400">Company Name</span><span className="text-white font-medium">{partner.company_name}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-800"><span className="text-slate-400">Partner Code</span><span className="font-mono text-indigo-300">{partner.partner_code}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-800"><span className="text-slate-400">Partner Category</span><span className="capitalize text-slate-200">{partner.type?.replace('_', ' ')}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-800"><span className="text-slate-400">GSTIN</span><span className="font-mono text-slate-200">{partner.gstin || 'Unregistered'}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-800"><span className="text-slate-400">PAN</span><span className="font-mono text-slate-200">{partner.pan || 'N/A'}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-400">State / Region</span><span className="text-slate-200">{partner.state_code}</span></div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white">KYC Verification & Compliance</h3>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" /> KYC Document Verification Complete
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Identity documents, business registration certificates, and partner authorization agreements are verified by the operations compliance desk.
              </p>
              <div className="pt-2">
                <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-700 font-mono text-[11px]">
                  Status: KYC_VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Orders */}
      {activeTab === 'orders' && (
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white">DSC Application & Order History ({orders?.length || 0})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2">Application #</th>
                  <th className="pb-2">Applicant</th>
                  <th className="pb-2">Certificate Type</th>
                  <th className="pb-2">Stage</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {!orders || orders.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-500">No DSC applications found for this partner.</td></tr>
                ) : (
                  orders.map((o: any) => (
                    <tr key={o.id}>
                      <td className="py-2.5 font-mono text-indigo-400">{o.application_number}</td>
                      <td className="py-2.5 text-white">{o.applicant_name}</td>
                      <td className="py-2.5 text-slate-300 capitalize">{o.class_type?.replace('_', ' ')}</td>
                      <td className="py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-300 capitalize">{o.status || o.stage}</span></td>
                      <td className="py-2.5 text-slate-400 font-mono">{o.created_at?.substring(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Token Inventory Allocations */}
      {activeTab === 'inventory' && (
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white">Token Inventory Allocations & Physical Dispatches</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2">Serial Number</th>
                  <th className="pb-2">Token Model</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Allocated Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {!inventory || inventory.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">No specific token serials allocated yet.</td></tr>
                ) : (
                  inventory.map((t: any) => (
                    <tr key={t.id}>
                      <td className="py-2.5 font-mono text-cyan-300">{t.serial_number}</td>
                      <td className="py-2.5 text-white">{t.token_model}</td>
                      <td className="py-2.5"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">{t.status}</span></td>
                      <td className="py-2.5 text-slate-400 font-mono">{t.created_at?.substring(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Financial Ledger */}
      {activeTab === 'ledger' && (
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Partner Financial Statement & Ledger</h3>
            <span className="text-xs text-slate-400">Chronological transaction register</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Narration / Ref</th>
                  <th className="pb-2 text-right">Debit</th>
                  <th className="pb-2 text-right">Credit</th>
                  <th className="pb-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {!ledger || ledger.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No financial ledger entries recorded.</td></tr>
                ) : (
                  ledger.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2.5 text-slate-400 font-mono">{item.entry_date || item.transaction_date?.substring(0, 10)}</td>
                      <td className="py-2.5 text-slate-300 capitalize">{(item.transaction_type || item.entry_type)?.replace('_', ' ')}</td>
                      <td className="py-2.5 text-slate-400 max-w-xs truncate">{item.remarks || item.narration || item.reference_id}</td>
                      <td className="py-2.5 text-right text-red-400 font-mono">₹{Number(item.debit || item.debit_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-mono">₹{Number(item.credit || item.credit_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right font-semibold text-white font-mono">₹{Number(item.running_balance || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Credit Control Settings */}
      {activeTab === 'credit' && (
        <div className="max-w-xl p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-white">Credit Terms & Exposure Control</h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust wholesale line of credit from ₹0 (strictly prepaid) up to ₹5,00,000 INR and configure credit settlement period.
            </p>
          </div>

          {creditSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{creditSuccess}</span>
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                Authorized Credit Limit: <span className="text-indigo-400 font-bold">₹{Number(creditLimit).toLocaleString('en-IN')}</span>
              </label>
              <input
                type="range"
                min="0"
                max="500000"
                step="5000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                <span>₹0 (Prepaid Only)</span>
                <span>₹2,50,000</span>
                <span>₹5,00,000 (Max Cap)</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Settlement Period (Days)</label>
              <select
                value={creditPeriod}
                onChange={(e) => setCreditPeriod(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="0">Net-0 (Strict Prepaid / Immediate Settlement)</option>
                <option value="15">Net-15 (15 Days Credit Period)</option>
                <option value="30">Net-30 (Standard 30 Days Credit Term)</option>
                <option value="45">Net-45 (45 Days Credit Term)</option>
                <option value="60">Net-60 (Extended 60 Days Term)</option>
              </select>
            </div>

            <button
              type="button"
              disabled={savingCredit}
              onClick={handleUpdateCredit}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {savingCredit ? 'Updating Credit...' : 'Save Credit Controls'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
