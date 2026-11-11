'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Calendar,
  Building,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Layers,
  ChevronRight,
  BarChart3,
  Award,
  PlusCircle,
  Eye,
  Info,
} from 'lucide-react'

export default function DscIssuancePage() {
  const [activeTab, setActiveTab] = useState<'entry' | 'list' | 'reports'>('entry')

  // Init data
  const [profiles, setProfiles] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [validities, setValidities] = useState<any[]>([])
  const [supportFeeCharges, setSupportFeeCharges] = useState<any[]>([])
  const [loadingInit, setLoadingInit] = useState(false)

  // Entry Form State
  const [issuanceDate, setIssuanceDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [companyProfileId, setCompanyProfileId] = useState<string>('')
  const [partnerId, setPartnerId] = useState<string>('')
  const [companyId, setCompanyId] = useState<string>('')
  const [productId, setProductId] = useState<string>('')
  const [classId, setClassId] = useState<string>('')
  const [validityId, setValidityId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [applySupportFee, setApplySupportFee] = useState<boolean>(false)
  const [selectedChargeId, setSelectedChargeId] = useState<string>('')

  // Pricing / Margin State
  const [resolvingPricing, setResolvingPricing] = useState<boolean>(false)
  const [pricingResolution, setPricingResolution] = useState<any>(null)
  const [pricingError, setPricingError] = useState<string>('')

  // Entry Submission State
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [submitSuccess, setSubmitSuccess] = useState<string>('')

  // Admin Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false)
  const [overrideReason, setOverrideReason] = useState<string>('')

  // Entries List State
  const [entries, setEntries] = useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = useState<boolean>(false)
  const [entriesProfileFilter, setEntriesProfileFilter] = useState<string>('')
  const [entriesSearch, setEntriesSearch] = useState<string>('')
  const [entriesStatusFilter, setEntriesStatusFilter] = useState<string>('all')

  // Reports State
  const [reportPeriod, setReportPeriod] = useState<'current_month' | 'last_month' | 'fy' | 'custom'>('current_month')
  const [reportProfileFilter, setReportProfileFilter] = useState<string>('ALL')
  const [reportStartDate, setReportStartDate] = useState<string>('')
  const [reportEndDate, setReportEndDate] = useState<string>('')
  const [reportsData, setReportsData] = useState<any>(null)
  const [reportsLoading, setReportsLoading] = useState<boolean>(false)
  const [reportTab, setReportTab] = useState<'summary' | 'partner' | 'provider' | 'product' | 'profile'>('summary')

  // Load Initial Master Data
  useEffect(() => {
    loadInitData()
  }, [])

  const loadInitData = async () => {
    setLoadingInit(true)
    try {
      const [initRes, mastersRes] = await Promise.all([
        fetch('/api/dsc/issuance/init-data').then((r) => r.json()),
        fetch('/api/dsc/masters/all').then((r) => r.json()),
      ])

      const pList = initRes.profiles || []
      setProfiles(pList)
      const defProf = pList.find((p: any) => p.is_default) || pList[0]
      if (defProf) setCompanyProfileId(defProf.id)

      const partList = initRes.partners || []
      setPartners(partList)
      if (partList.length > 0) setPartnerId(partList[0].id)

      const chgs = initRes.supportFeeCharges || []
      setSupportFeeCharges(chgs)
      if (chgs.length > 0) setSelectedChargeId(chgs[0].id)

      setCompanies(mastersRes.dscCompanies || [])
      if (mastersRes.dscCompanies?.length > 0) setCompanyId(mastersRes.dscCompanies[0].id)

      setProducts(mastersRes.dscProducts || [])
      if (mastersRes.dscProducts?.length > 0) setProductId(mastersRes.dscProducts[0].id)

      setClasses(mastersRes.dscClasses || [])
      if (mastersRes.dscClasses?.length > 0) setClassId(mastersRes.dscClasses[0].id)

      setValidities(mastersRes.dscValidities || [])
      if (mastersRes.dscValidities?.length > 0) setValidityId(mastersRes.dscValidities[0].id)
    } catch (err) {
      console.error('Failed to load issuance initialization data:', err)
    } finally {
      setLoadingInit(false)
    }
  }

  // Auto-resolve pricing whenever dependencies change
  useEffect(() => {
    if (companyId && productId && partnerId && quantity > 0) {
      resolvePricing()
    }
  }, [
    companyProfileId,
    partnerId,
    companyId,
    productId,
    classId,
    validityId,
    quantity,
    applySupportFee,
    selectedChargeId,
    issuanceDate,
  ])

  const resolvePricing = async () => {
    setResolvingPricing(true)
    setPricingError('')
    try {
      const res = await fetch('/api/dsc/issuance/resolve-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_profile_id: companyProfileId,
          partner_id: partnerId,
          company_id: companyId,
          product_id: productId,
          class_id: classId,
          validity_id: validityId,
          quantity: Number(quantity) || 1,
          apply_support_fee: applySupportFee,
          charge_id: applySupportFee ? selectedChargeId : undefined,
          date: issuanceDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setPricingError(data.error || 'Failed to auto-resolve pricing')
        setPricingResolution(null)
      } else {
        setPricingResolution(data)
      }
    } catch (err: any) {
      setPricingError(err.message || 'Network error while resolving pricing')
      setPricingResolution(null)
    } finally {
      setResolvingPricing(false)
    }
  }

  // Submit Issuance Entry
  const handleRecordIssuance = async (isOverride: boolean = false) => {
    setSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      const payload: any = {
        issuance_date: issuanceDate,
        company_profile_id: companyProfileId,
        partner_id: partnerId,
        company_id: companyId,
        product_id: productId,
        class_id: classId,
        validity_id: validityId,
        quantity: Number(quantity) || 1,
        apply_support_fee: applySupportFee,
        charge_id: applySupportFee ? selectedChargeId : undefined,
      }

      if (isOverride) {
        payload.override_warning = true
        payload.override_reason = overrideReason
      }

      const res = await fetch('/api/dsc/issuance/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.margin_warning && !isOverride) {
          // Trigger override dialog
          setShowOverrideModal(true)
          setSubmitError(data.error || 'Margin deficit detected.')
        } else {
          setSubmitError(data.error || 'Failed to record issuance transaction')
        }
      } else {
        setSubmitSuccess(`Success! Recorded DSC Issuance #${data.transaction?.transaction_number || data.transaction?.id}`)
        setShowOverrideModal(false)
        setOverrideReason('')
        // Refresh pricing & recent list
        resolvePricing()
        loadEntries()
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  // Load Entries List
  const loadEntries = async () => {
    setEntriesLoading(true)
    try {
      const q = new URLSearchParams()
      if (entriesProfileFilter) q.append('company_profile_id', entriesProfileFilter)
      if (entriesSearch) q.append('search', entriesSearch)
      if (entriesStatusFilter !== 'all') q.append('status', entriesStatusFilter)

      const res = await fetch(`/api/dsc/issuance/entries?${q.toString()}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (err) {
      console.error('Failed to load entries:', err)
    } finally {
      setEntriesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'list') {
      loadEntries()
    }
  }, [activeTab, entriesProfileFilter, entriesStatusFilter])

  // Load Reports
  const loadReports = async () => {
    setReportsLoading(true)
    try {
      const q = new URLSearchParams()
      q.append('period', reportPeriod)
      if (reportProfileFilter && reportProfileFilter !== 'ALL') {
        q.append('company_profile_id', reportProfileFilter)
      }
      if (reportPeriod === 'custom') {
        if (reportStartDate) q.append('start_date', reportStartDate)
        if (reportEndDate) q.append('end_date', reportEndDate)
      }

      const res = await fetch(`/api/dsc/issuance/reports?${q.toString()}`)
      const data = await res.json()
      setReportsData(data)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setReportsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports()
    }
  }, [activeTab, reportPeriod, reportProfileFilter, reportStartDate, reportEndDate])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">DSC Daily Issuance & Partner Performance</h1>
              <p className="text-sm text-slate-400">
                Record day-to-day DSC certificate issuances, auto-resolve commissions & inspect five-dimension analytics
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('entry')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'entry' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Daily Issuance Entry
            </div>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'list' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Issuance Register
            </div>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Performance Reports
            </div>
          </button>
        </div>
      </div>

      {/* TAB 1: DAILY ISSUANCE ENTRY */}
      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-6 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                Certificate Issuance Details
              </h2>
              <p className="text-xs text-slate-400">Record issued digital signatures under authorized company profile</p>
            </div>

            {/* Error & Success Messages */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
            {submitSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-400 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Issuance Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Issuance Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={issuanceDate}
                    onChange={(e) => setIssuanceDate(e.target.value)}
                    className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Company Internal Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Company Profile <span className="text-red-500">*</span>
                </label>
                <select
                  value={companyProfileId}
                  onChange={(e) => setCompanyProfileId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {profiles.map((p) => (
                    <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                      {p.legal_name} {p.trade_name ? `(${p.trade_name})` : ''} {p.is_default ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Partner Dropdown (Filtered to DSC Partners) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Partner / Associate (DSC Partner) <span className="text-red-500">*</span>
                </label>
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {partners.map((pt) => (
                    <option className="bg-slate-950 text-white" key={pt.id} value={pt.id}>
                      {pt.company_name} {pt.partner_code ? `[${pt.partner_code}]` : ''} {pt.type ? `(${pt.type})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Showing only active registered DSC Partners</p>
              </div>

              {/* Provider / Certifying Authority */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  DSC Provider (CA) <span className="text-red-500">*</span>
                </label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {companies.map((c) => (
                    <option className="bg-slate-950 text-white" key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  DSC Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {products.map((prod) => (
                    <option className="bg-slate-950 text-white" key={prod.id} value={prod.id}>
                      {prod.product_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">DSC Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option className="bg-slate-950 text-white" value="">-- Default / All --</option>
                  {classes.map((cls) => (
                    <option className="bg-slate-950 text-white" key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validity */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Validity Period</label>
                <select
                  value={validityId}
                  onChange={(e) => setValidityId(e.target.value)}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option className="bg-slate-950 text-white" value="">-- Default / All --</option>
                  {validities.map((v) => (
                    <option className="bg-slate-950 text-white" key={v.id} value={v.id}>
                      {v.validity_years} Year{v.validity_years > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-sm border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Optional Support Fee Toggle */}
              <div className="flex flex-col justify-center">
                <label className="block text-xs font-semibold text-slate-200 mb-1">Support Fee Service</label>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={applySupportFee}
                    onChange={(e) => setApplySupportFee(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-800 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-100">Add Premium Partner Support Fee</span>
                </label>
              </div>

              {/* Charge Selector if Support Fee checked */}
              {applySupportFee && (
                <div className="sm:col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Select Support Fee Master Category
                  </label>
                  <select
                    value={selectedChargeId}
                    onChange={(e) => setSelectedChargeId(e.target.value)}
                    className="w-full text-sm border border-slate-800 bg-slate-950 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    {supportFeeCharges.map((chg) => (
                      <option className="bg-slate-950 text-white" key={chg.id} value={chg.id}>
                        {chg.charge_name} — Base: ₹{chg.base_rate} ({chg.calculation_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Record Issuance Button */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                All calculations are automatically verified against Master Data and Commission Rules.
              </span>
              <button
                type="button"
                onClick={() => handleRecordIssuance(false)}
                disabled={submitting || resolvingPricing || !!pricingError}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Record Issuance
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Auto-Resolved Commercial Breakdown & Margin Card (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-indigo-600" />
                  Commercial & Margin Summary
                </h3>
                {resolvingPricing && (
                  <span className="flex items-center gap-1 text-xs text-indigo-600">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Resolving...
                  </span>
                )}
              </div>

              {pricingError ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Pricing Master Notice
                  </div>
                  <p className="mt-1 text-xs">{pricingError}</p>
                </div>
              ) : pricingResolution ? (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-medium text-slate-400 uppercase">Base Selling Rate</div>
                      <div className="text-lg font-bold text-white">
                        ₹{Number(pricingResolution.selling_base_rate || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Total Base: ₹{Number(pricingResolution.base_amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-medium text-slate-400 uppercase">GST Amount ({pricingResolution.gst_rate || 18}%)</div>
                      <div className="text-lg font-bold text-white">
                        ₹{Number(pricingResolution.gst_amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Gross: ₹{Number(pricingResolution.gross_amount || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="border border-slate-800 rounded-lg overflow-hidden text-xs">
                    <div className="p-2.5 bg-slate-900/60 font-semibold text-slate-200 border-b border-slate-800">
                      Cost & Commission Mechanics
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="flex justify-between text-slate-300">
                        <span>Provider Incoming Payout:</span>
                        <span className="font-semibold text-white">
                          ₹{Number(pricingResolution.provider_payout_amount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Standard Partner Commission:</span>
                        <span className="font-semibold text-indigo-400">
                          ₹{Number(pricingResolution.calculated_commission || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {applySupportFee && (
                        <div className="flex justify-between text-amber-700">
                          <span>Support Fee Commission:</span>
                          <span className="font-semibold">
                            ₹{Number(pricingResolution.support_fee_commission || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white">
                        <span>Total Partner Payout:</span>
                        <span className="text-indigo-600">
                          ₹{Number(pricingResolution.total_partner_payout || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Retained Margin Alert / Pill */}
                  <div
                    className={`p-4 rounded-xl border ${
                      pricingResolution.margin_warning
                        ? 'bg-red-50 border-red-300 text-red-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {pricingResolution.margin_warning ? 'Margin Deficit Warning' : 'Net Retained Margin'}
                      </span>
                      {pricingResolution.margin_warning ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">
                      ₹{Number(pricingResolution.net_retained_margin || 0).toLocaleString('en-IN')}
                    </div>
                    {pricingResolution.margin_warning && (
                      <p className="mt-2 text-xs text-red-700 leading-relaxed">
                        ⚠️ Partner payout exceeds incoming provider payout by ₹
                        {Number(pricingResolution.margin_warning_amount || 0).toLocaleString('en-IN')}. Requires Administrator
                        override authorization with mandatory business justification.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Fill in issuance details to auto-resolve pricing and commission
                </div>
              )}
            </div>

            {/* Quick Helper / Info Card */}
            <div className="bg-indigo-950/40 border border-indigo-900/40 rounded-xl p-4 text-xs text-indigo-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-indigo-300">
                <Info className="h-4 w-4" />
                Snapshot Security Guarantee
              </div>
              <p className="text-indigo-300 leading-relaxed">
                All prices, GST rates, provider payouts, and partner commissions are snapshotted permanently at issuance time. Future
                Master Data rate updates will not mutate historical transactions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ISSUANCE REGISTER / TABLE */}
      {activeTab === 'list' && (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Partner / Provider / Product..."
                  value={entriesSearch}
                  onChange={(e) => setEntriesSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadEntries()}
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-800 rounded-lg text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 w-64"
                />
              </div>

              {/* Profile Filter */}
              <select
                value={entriesProfileFilter}
                onChange={(e) => setEntriesProfileFilter(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
              >
                <option className="bg-slate-950 text-white" value="">All Company Profiles</option>
                {profiles.map((p) => (
                  <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                    {p.legal_name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={entriesStatusFilter}
                onChange={(e) => setEntriesStatusFilter(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
              >
                <option className="bg-slate-950 text-white" value="all">All Statuses</option>
                <option className="bg-slate-950 text-white" value="active">Active Only</option>
                <option className="bg-slate-950 text-white" value="cancelled">Void / Cancelled</option>
              </select>
            </div>

            <button
              onClick={loadEntries}
              disabled={entriesLoading}
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800/60 flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${entriesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-slate-800/60 text-slate-300 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Ref #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Profile</th>
                  <th className="p-3">Partner</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Selling Rate</th>
                  <th className="p-3 text-right">Provider Payout</th>
                  <th className="p-3 text-right">Partner Commission</th>
                  <th className="p-3 text-right">Net Margin</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {entriesLoading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-500">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading issuance register...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-500">
                      No DSC issuance records found matching filters.
                    </td>
                  </tr>
                ) : (
                  entries.map((ent) => (
                    <tr key={ent.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-3 font-mono font-medium text-indigo-400">{ent.transaction_number || ent.id}</td>
                      <td className="p-3 whitespace-nowrap">{ent.transaction_date}</td>
                      <td className="p-3 max-w-[140px] truncate" title={ent.profile_legal_name}>
                        {ent.profile_legal_name || ent.company_profile_id || '—'}
                      </td>
                      <td className="p-3 max-w-[140px] truncate font-medium text-white" title={ent.partner_name}>
                        {ent.partner_name || ent.partner_id}
                      </td>
                      <td className="p-3">{ent.company_id}</td>
                      <td className="p-3">{ent.product_id}</td>
                      <td className="p-3 text-right font-semibold">{ent.quantity || 1}</td>
                      <td className="p-3 text-right font-medium">₹{Number(ent.selling_base_rate || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-medium text-white">
                        ₹{Number(ent.provider_payout_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-600">
                        ₹{Number(ent.total_partner_payout || 0).toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`p-3 text-right font-bold ${
                          Number(ent.net_retained_margin || 0) < 0 ? 'text-red-600' : 'text-emerald-400'
                        }`}
                      >
                        ₹{Number(ent.net_retained_margin || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ent.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-300 line-through'
                              : ent.margin_warning
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {ent.status === 'cancelled' ? 'VOID' : ent.margin_warning ? 'OVERRIDDEN' : 'CONFIRMED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Filter Card */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Period Selector */}
                <div className="flex bg-slate-800/60 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
                  <button
                    onClick={() => setReportPeriod('current_month')}
                    className={`px-3 py-1.5 rounded-md ${
                      reportPeriod === 'current_month' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                    }`}
                  >
                    Current Month
                  </button>
                  <button
                    onClick={() => setReportPeriod('last_month')}
                    className={`px-3 py-1.5 rounded-md ${
                      reportPeriod === 'last_month' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                    }`}
                  >
                    Last Month
                  </button>
                  <button
                    onClick={() => setReportPeriod('fy')}
                    className={`px-3 py-1.5 rounded-md ${
                      reportPeriod === 'fy' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                    }`}
                  >
                    Current FY
                  </button>
                  <button
                    onClick={() => setReportPeriod('custom')}
                    className={`px-3 py-1.5 rounded-md ${
                      reportPeriod === 'custom' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {/* Profile Filter */}
                <select
                  value={reportProfileFilter}
                  onChange={(e) => setReportProfileFilter(e.target.value)}
                  className="text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option className="bg-slate-950 text-white" value="ALL">All Company Profiles (Consolidated)</option>
                  {profiles.map((p) => (
                    <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                      {p.legal_name}
                    </option>
                  ))}
                </select>

                {/* Date Inputs if Custom */}
                {reportPeriod === 'custom' && (
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={loadReports}
                disabled={reportsLoading}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
            </div>
          </div>

          {/* Overall Summary KPI Cards */}
          {reportsData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                  <span>Total Certificates</span>
                  <FileText className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {Number(reportsData.summary.total_certificates || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Across {reportsData.summary.total_transactions} orders</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                  <span>Gross Value</span>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  ₹{Number(reportsData.summary.total_gross_amount || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Base: ₹{Number(reportsData.summary.total_base_amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                  <span>Partner Payouts</span>
                  <Award className="h-4 w-4 text-purple-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-purple-400">
                  ₹{Number(reportsData.summary.total_partner_payout || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Standard: ₹{Number(reportsData.summary.total_calculated_commission || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                  <span>Net Retained Margin</span>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div
                  className={`mt-2 text-2xl font-black ${
                    Number(reportsData.summary.net_retained_margin || 0) < 0 ? 'text-red-600' : 'text-emerald-400'
                  }`}
                >
                  ₹{Number(reportsData.summary.net_retained_margin || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Provider Payout: ₹{Number(reportsData.summary.total_provider_payout || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {/* Breakdown Tabs */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="border-b border-slate-800 bg-slate-900/60 px-4 pt-3 flex gap-2">
              <button
                onClick={() => setReportTab('partner')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  reportTab === 'partner'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                Partner Performance
              </button>
              <button
                onClick={() => setReportTab('provider')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  reportTab === 'provider'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                Provider / CA Breakdown
              </button>
              <button
                onClick={() => setReportTab('product')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  reportTab === 'product'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                Product Breakdown
              </button>
              <button
                onClick={() => setReportTab('profile')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  reportTab === 'profile'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                Company Profile Breakdown
              </button>
            </div>

            {/* Breakdown Content */}
            <div className="p-4">
              {reportsLoading ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Aggregating dimension analytics...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-800/60 text-slate-300 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Dimension Name</th>
                        <th className="p-3 text-right">Certificates</th>
                        <th className="p-3 text-right">Base Amount</th>
                        <th className="p-3 text-right">Gross Amount</th>
                        <th className="p-3 text-right">Provider Payout</th>
                        <th className="p-3 text-right">Partner Commission</th>
                        <th className="p-3 text-right">Net Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reportTab === 'partner' &&
                        reportsData?.breakdowns?.by_partner?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/60">
                            <td className="p-3 font-semibold text-white">
                              {item.partner_name} {item.partner_code ? `[${item.partner_code}]` : ''}
                            </td>
                            <td className="p-3 text-right font-bold">{item.certificates}</td>
                            <td className="p-3 text-right">₹{Number(item.base_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.gross_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.provider_payout).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right font-semibold text-purple-400">
                              ₹{Number(item.partner_payout).toLocaleString('en-IN')}
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                item.net_margin < 0 ? 'text-red-600' : 'text-emerald-400'
                              }`}
                            >
                              ₹{Number(item.net_margin).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}

                      {reportTab === 'provider' &&
                        reportsData?.breakdowns?.by_provider?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/60">
                            <td className="p-3 font-semibold text-white">{item.company_id}</td>
                            <td className="p-3 text-right font-bold">{item.certificates}</td>
                            <td className="p-3 text-right">₹{Number(item.base_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.gross_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.provider_payout).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right font-semibold text-purple-400">
                              ₹{Number(item.partner_payout).toLocaleString('en-IN')}
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                item.net_margin < 0 ? 'text-red-600' : 'text-emerald-400'
                              }`}
                            >
                              ₹{Number(item.net_margin).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}

                      {reportTab === 'product' &&
                        reportsData?.breakdowns?.by_product?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/60">
                            <td className="p-3 font-semibold text-white">{item.product_id}</td>
                            <td className="p-3 text-right font-bold">{item.certificates}</td>
                            <td className="p-3 text-right">₹{Number(item.base_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.gross_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.provider_payout).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right font-semibold text-purple-400">
                              ₹{Number(item.partner_payout).toLocaleString('en-IN')}
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                item.net_margin < 0 ? 'text-red-600' : 'text-emerald-400'
                              }`}
                            >
                              ₹{Number(item.net_margin).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}

                      {reportTab === 'profile' &&
                        reportsData?.breakdowns?.by_profile?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/60">
                            <td className="p-3 font-semibold text-white">{item.legal_name || item.company_profile_id}</td>
                            <td className="p-3 text-right font-bold">{item.certificates}</td>
                            <td className="p-3 text-right">₹{Number(item.base_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.gross_amount).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right">₹{Number(item.provider_payout).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right font-semibold text-purple-400">
                              ₹{Number(item.partner_payout).toLocaleString('en-IN')}
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                item.net_margin < 0 ? 'text-red-600' : 'text-emerald-400'
                              }`}
                            >
                              ₹{Number(item.net_margin).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Override Warning Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg border border-slate-800 w-full p-6 shadow-2xl border border-red-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Admin Authorization Required</h3>
                <p className="text-xs text-red-600">Margin Deficit Detected on this Issuance</p>
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-800 space-y-1">
              <p className="font-semibold">Security & Commercial Warning:</p>
              <p>
                The total partner payout exceeds the Certifying Authority incoming payout. This will generate a net negative retained
                margin for the organization.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                Mandatory Override Justification / Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Strategic enterprise account growth promo approved by MD..."
                className="w-full text-xs border border-slate-800 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideModal(false)
                  setOverrideReason('')
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecordIssuance(true)}
                disabled={submitting || !overrideReason.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm"
              >
                Authorize & Record Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

