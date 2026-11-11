'use client'

import React, { useState, useEffect } from 'react'
import {
  Percent,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Plus,
  RefreshCw,
  Award,
  DollarSign,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function DscCommissionsPage() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'configs' | 'payouts' | 'incentives' | 'reports'>('calculator')
  
  // Data states
  const [partners, setPartners] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [configs, setConfigs] = useState<any[]>([])
  const [payouts, setPayouts] = useState<any[]>([])
  const [qIncentives, setQIncentives] = useState<any[]>([])
  const [tIncentives, setTIncentives] = useState<any[]>([])
  const [reportSummary, setReportSummary] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Simulation / Resolution State
  const [simPartnerId, setSimPartnerId] = useState('')
  const [simCompanyId, setSimCompanyId] = useState('')
  const [simProductId, setSimProductId] = useState('')
  const [simSellingRate, setSimSellingRate] = useState('1500')
  const [simSupportFee, setSimSupportFee] = useState('0')
  const [simQty, setSimQty] = useState('1')
  const [simResult, setSimResult] = useState<any>(null)
  const [simError, setSimError] = useState('')
  const [simSuccess, setSimSuccess] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    loadBaseMasters()
  }, [])

  const loadBaseMasters = async () => {
    setLoading(true)
    try {
      const [partRes, mastRes, confRes, payRes, qRes, tRes, repRes] = await Promise.all([
        fetch('/api/partners?mask=true').then((r) => r.json()),
        fetch('/api/dsc/masters/all').then((r) => r.json()),
        fetch('/api/dsc/commission-configs').then((r) => r.json()),
        fetch('/api/dsc/provider-payouts').then((r) => r.json()),
        fetch('/api/dsc/incentives/quantity').then((r) => r.json()),
        fetch('/api/dsc/incentives/turnover').then((r) => r.json()),
        fetch('/api/dsc/reports/commissions').then((r) => r.json()),
      ])

      const pList = partRes.partners || []
      setPartners(pList)
      if (pList.length > 0 && !simPartnerId) setSimPartnerId(pList[0].id)

      const cList = mastRes.dscCompanies || []
      setCompanies(cList)
      if (cList.length > 0 && !simCompanyId) setSimCompanyId(cList[0].id)

      const prodList = mastRes.dscProducts || []
      setProducts(prodList)
      if (prodList.length > 0 && !simProductId) setSimProductId(prodList[0].id)

      setConfigs(confRes.configs || [])
      setPayouts(payRes.payouts || [])
      setQIncentives(qRes.incentives || [])
      setTIncentives(tRes.incentives || [])
      if (repRes.summary) {
        setReportSummary(repRes.summary)
        setTransactions(repRes.transactions || [])
      }
    } catch (err) {
      console.error('Failed to load masters:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSimulate = async () => {
    setSimError('')
    setSimSuccess('')
    setSimResult(null)

    if (!simPartnerId || !simCompanyId || !simProductId) {
      setSimError('Please select a partner, provider CA, and DSC product.')
      return
    }

    try {
      const res = await fetch('/api/dsc/commission/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: simPartnerId,
          company_id: simCompanyId,
          product_id: simProductId,
          selling_base_rate: Number(simSellingRate),
          support_fee_base_amount: Number(simSupportFee),
          quantity: Number(simQty),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSimError(data.error || 'Failed to resolve commission')
      } else {
        setSimResult(data.resolution)
      }
    } catch (err: any) {
      setSimError(err.message)
    }
  }

  const handleCreateTransaction = async (override = false) => {
    if (!simResult) return
    setSimError('')
    setSimSuccess('')

    try {
      const res = await fetch('/api/dsc/commission/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: simPartnerId,
          company_id: simCompanyId,
          product_id: simProductId,
          selling_base_rate: Number(simSellingRate),
          support_fee_base_amount: Number(simSupportFee),
          quantity: Number(simQty),
          override_warning: override,
          override_reason: override ? overrideReason : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSimError(data.error || 'Failed to record transaction')
      } else {
        setSimSuccess(`Commission transaction ${data.transaction.transaction_number} recorded successfully!`)
        loadBaseMasters()
      }
    } catch (err: any) {
      setSimError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">DSC Partner Commission Engine</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Module 15
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time margin calculation, provider payout margins, multi-tier partner commissions, and turnover incentives.
          </p>
        </div>

        <button
          onClick={loadBaseMasters}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Engine
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total DSC Volume</span>
            <Award className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2">
            {reportSummary?.total_certificates || 0}
          </div>
          <span className="text-[10px] text-slate-500">Issued Certificates</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">CA Incoming Payouts</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-2">
            ₹{Number(reportSummary?.total_provider_payout || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">Gross Received from CAs</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Partner Commissions</span>
            <Percent className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-400 mt-2">
            ₹{Number(reportSummary?.total_partner_commission || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">Disbursed to DSC Partners</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Net Retained Margin</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-400 mt-2">
            ₹{Number(reportSummary?.total_net_margin || 0).toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500">Our Retained Spread</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`pb-3 flex items-center gap-2 ${
            activeTab === 'calculator'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Commission Simulator & Execution
        </button>
        <button
          onClick={() => setActiveTab('configs')}
          className={`pb-3 flex items-center gap-2 ${
            activeTab === 'configs'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          Partner Rates ({configs.length})
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 flex items-center gap-2 ${
            activeTab === 'payouts'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          CA Provider Payouts ({payouts.length})
        </button>
        <button
          onClick={() => setActiveTab('incentives')}
          className={`pb-3 flex items-center gap-2 ${
            activeTab === 'incentives'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          Slab & Turnover Incentives ({qIncentives.length + tIncentives.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Transaction Audit & Exceptions
        </button>
      </div>

      {/* TAB 1: CALCULATOR & RESOLUTION */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Commission Resolution Simulator
            </h3>

            {simError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                {simError}
              </div>
            )}
            {simSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {simSuccess}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Select DSC Partner *</label>
                <select
                  value={simPartnerId}
                  onChange={(e) => setSimPartnerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name} ({p.partner_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Certifying Authority (Provider) *</label>
                  <select
                    value={simCompanyId}
                    onChange={(e) => setSimCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">DSC Product *</label>
                  <select
                    value={simProductId}
                    onChange={(e) => setSimProductId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Selling Base Rate (₹)</label>
                  <input
                    type="number"
                    value={simSellingRate}
                    onChange={(e) => setSimSellingRate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Support Fee (₹)</label>
                  <input
                    type="number"
                    value={simSupportFee}
                    onChange={(e) => setSimSupportFee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleSimulate}
                className="w-full mt-2 py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
              >
                Resolve Rate & Margin
              </button>
            </div>
          </div>

          {/* Results Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Live Resolution Breakdown</h3>
              {!simResult ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
                  <span>Click "Resolve Rate & Margin" to inspect resolution mechanics.</span>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {simResult.marginWarning && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300">
                      <div className="font-semibold flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        MARGIN DEFICIT WARNING
                      </div>
                      <p>{simResult.marginWarningMessage}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-400">Applied Rule:</span>
                      <p className="font-semibold text-white mt-0.5">
                        {simResult.commissionHierarchyLevel} (
                        {simResult.commissionType === 'PERCENTAGE'
                          ? `${simResult.commissionValue}%`
                          : `₹${simResult.commissionValue}`}
                        )
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Calculation Basis:</span>
                      <p className="font-semibold text-white mt-0.5">
                        {simResult.calculationBasis}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Incoming CA Payout:</span>
                      <p className="font-semibold text-emerald-400 mt-0.5">
                        ₹{simResult.providerPayoutAmount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Partner Outgoing Commission:</span>
                      <p className="font-semibold text-indigo-400 mt-0.5">
                        ₹{simResult.totalPartnerPayout.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300 font-medium">Net Retained Margin:</span>
                    <span
                      className={`text-base font-bold ${
                        simResult.netRetainedMargin >= 0 ? 'text-cyan-400' : 'text-red-400'
                      }`}
                    >
                      ₹{simResult.netRetainedMargin.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded border border-slate-850">
                    {simResult.explanation}
                  </p>
                </div>
              )}
            </div>

            {simResult && (
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                {simResult.marginWarning ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Mandatory Administrator Override Reason *"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={() => handleCreateTransaction(true)}
                      className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition"
                    >
                      Acknowledge Warning & Execute Transaction
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleCreateTransaction(false)}
                    className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
                  >
                    Execute Commission Transaction
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PARTNER COMMISSION CONFIGS */}
      {activeTab === 'configs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Partner Commission Rules</h3>
            <span className="text-xs text-slate-400">{configs.length} Active Configurations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Partner</th>
                  <th className="py-2.5 px-4">Fee Type</th>
                  <th className="py-2.5 px-4">CA Provider</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Commission</th>
                  <th className="py-2.5 px-4">Basis</th>
                  <th className="py-2.5 px-4">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {configs.map((c) => {
                  const pName = partners.find((p) => p.id === c.partner_id)?.company_name || 'All Partners (Default)'
                  const cName = companies.find((co) => co.id === c.company_id)?.company_name || c.company_id
                  const prodName = products.find((pr) => pr.id === c.product_id)?.product_name || 'All Products'
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-white">{pName}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400">
                          {c.fee_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">{cName}</td>
                      <td className="py-2.5 px-4">{prodName}</td>
                      <td className="py-2.5 px-4 font-mono">
                        {c.commission_type === 'PERCENTAGE' ? `${c.commission_value}%` : `₹${c.commission_value}`}
                      </td>
                      <td className="py-2.5 px-4">{c.calculation_basis}</td>
                      <td className="py-2.5 px-4 text-slate-400">{c.effective_from}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CA PROVIDER PAYOUTS */}
      {activeTab === 'payouts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Incoming CA Provider Payouts</h3>
            <span className="text-xs text-slate-400">{payouts.length} Active Payout Rates</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Certifying Authority</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Incoming CA Payout (₹)</th>
                  <th className="py-2.5 px-4">Basis</th>
                  <th className="py-2.5 px-4">Effective From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {payouts.map((p) => {
                  const cName = companies.find((co) => co.id === p.company_id)?.company_name || p.company_id
                  const prodName = products.find((pr) => pr.id === p.product_id)?.product_name || p.product_id
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-white">{cName}</td>
                      <td className="py-2.5 px-4">{prodName}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400 font-semibold">
                        ₹{Number(p.payout_amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">{p.calculation_basis}</td>
                      <td className="py-2.5 px-4 text-slate-400">{p.effective_from}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INCENTIVES */}
      {activeTab === 'incentives' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Quantity Slab Incentives</h3>
            </div>
            <div className="p-4 space-y-2 text-xs">
              {qIncentives.length === 0 ? (
                <p className="text-slate-500">No volume slab rules defined.</p>
              ) : (
                qIncentives.map((q) => (
                  <div key={q.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-white">
                        {q.min_quantity} to {q.max_quantity || '∞'} Certificates
                      </p>
                      <span className="text-[10px] text-slate-400">{q.period_type} aggregation</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 font-mono font-bold">
                      ₹{q.incentive_amount} {q.incentive_type === 'PER_UNIT' ? '/ unit' : 'flat'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Turnover / Value Slabs</h3>
            </div>
            <div className="p-4 space-y-2 text-xs">
              {tIncentives.length === 0 ? (
                <p className="text-slate-500">No turnover rules defined.</p>
              ) : (
                tIncentives.map((t) => (
                  <div key={t.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-white">
                        ₹{Number(t.min_turnover).toLocaleString()} to {t.max_turnover ? `₹${Number(t.max_turnover).toLocaleString()}` : '∞'}
                      </p>
                      <span className="text-[10px] text-slate-400">{t.period_type} on {t.calculation_basis}</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 font-mono font-bold">
                      {t.incentive_type === 'PERCENTAGE' ? `${t.incentive_value}%` : `₹${t.incentive_value}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TRANSACTION AUDIT & EXCEPTIONS */}
      {activeTab === 'reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Commission Execution Ledger</h3>
            <span className="text-xs text-slate-400">{transactions.length} Recorded Transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Txn #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Partner</th>
                  <th className="py-2.5 px-4">CA Payout (₹)</th>
                  <th className="py-2.5 px-4">Partner Payout (₹)</th>
                  <th className="py-2.5 px-4">Net Margin (₹)</th>
                  <th className="py-2.5 px-4">Warning / Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {transactions.map((t) => {
                  const pName = partners.find((p) => p.id === t.partner_id)?.company_name || t.partner_id
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-medium text-cyan-400">
                        {t.transaction_number}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{t.transaction_date}</td>
                      <td className="py-2.5 px-4">{pName}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">
                        ₹{Number(t.provider_payout_amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-indigo-400">
                        ₹{Number(t.total_partner_payout).toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-mono font-semibold ${
                          Number(t.net_retained_margin) >= 0 ? 'text-cyan-400' : 'text-red-400'
                        }`}
                      >
                        ₹{Number(t.net_retained_margin).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
                        {t.margin_warning ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Override: {t.override_user_name || 'Admin'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

