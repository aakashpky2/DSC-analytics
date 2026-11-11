'use client'

import React, { useState, useEffect } from 'react'
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
  Clock,
  Upload,
  ArrowRight,
  Cpu,
  Send,
  Check,
} from 'lucide-react'

export default function DscDirectIssuancePage() {
  const [activeTab, setActiveTab] = useState<'applications' | 'create_direct' | 'estimates' | 'rate_cards' | 'associate_partners' | 'stages' | 'reports'>('applications')

  // Init lookups
  const [profiles, setProfiles] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [associatePartners, setAssociatePartners] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [validities, setValidities] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [documentRequirements, setDocumentRequirements] = useState<any[]>([])
  const [tokenModels, setTokenModels] = useState<any[]>([])
  const [loadingInit, setLoadingInit] = useState(false)

  // Applications list
  const [applications, setApplications] = useState<any[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [filterProfile, setFilterProfile] = useState('')
  const [filterChannel, setFilterChannel] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Selected Application for Detail & Progress Modal
  const [selectedApp, setSelectedApp] = useState<any | null>(null)
  const [appHistory, setAppHistory] = useState<any[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Direct Application / Estimate Form State
  const [formType, setFormType] = useState<'DIRECT' | 'ESTIMATE'>('DIRECT')
  const [formData, setFormData] = useState({
    company_profile_id: '',
    client_id: '',
    fulfillment_channel: 'DIRECT_SALE' as 'DIRECT_SALE' | 'ASSOCIATE_PARTNER',
    associate_partner_id: '',
    fulfillment_model: 'COMMISSION' as 'COMMISSION' | 'RESELLING_B2B',
    company_id: '',
    product_id: '',
    class_id: '',
    validity_id: '',
    quantity: 1,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  // Pricing preview
  const [pricingPreview, setPricingPreview] = useState<any | null>(null)
  const [resolvingPricing, setResolvingPricing] = useState(false)
  const [pricingError, setPricingError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')
  const [formError, setFormError] = useState('')

  // Transition stage modal
  const [showTransitionModal, setShowTransitionModal] = useState(false)
  const [targetStageId, setTargetStageId] = useState('')
  const [submittedDocs, setSubmittedDocs] = useState<{ [reqId: string]: string }>({})
  const [transitionNotes, setTransitionNotes] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState('')

  // Token allocation modal
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [selectedTokenModelId, setSelectedTokenModelId] = useState('')
  const [tokenSerials, setTokenSerials] = useState('')
  const [allocatingToken, setAllocatingToken] = useState(false)
  const [tokenError, setTokenError] = useState('')

  // Rate Cards state
  const [rateCards, setRateCards] = useState<any[]>([])
  const [rateCardsLoading, setRateCardsLoading] = useState(false)
  const [newCard, setNewCard] = useState({
    rate_card_type: 'GENERAL',
    company_profile_id: '',
    company_id: '',
    product_id: '',
    class_id: '',
    validity_id: '',
    rate: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
  })
  const [savingCard, setSavingCard] = useState(false)

  // Associate Partners Config list
  const [assocList, setAssocList] = useState<any[]>([])
  const [newAssocPartnerId, setNewAssocPartnerId] = useState('')
  const [newAssocComm, setNewAssocComm] = useState('10')
  const [newAssocModel, setNewAssocModel] = useState<'COMMISSION' | 'RESELLING_B2B'>('COMMISSION')
  const [savingAssoc, setSavingAssoc] = useState(false)

  // Estimates list
  const [estimates, setEstimates] = useState<any[]>([])
  const [estimatesLoading, setEstimatesLoading] = useState(false)

  // Reports state
  const [reportsData, setReportsData] = useState<any | null>(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportProfile, setReportProfile] = useState('ALL')
  const [reportPeriod, setReportPeriod] = useState('current_month')

  useEffect(() => {
    loadInitData()
  }, [])

  const loadInitData = async () => {
    setLoadingInit(true)
    try {
      const res = await fetch('/api/dsc/direct/init-data')
      const data = await res.json()
      setProfiles(data.profiles || [])
      setCustomers(data.customers || [])
      setAssociatePartners(data.associatePartners || [])
      setCompanies(data.companies || [])
      setProducts(data.products || [])
      setClasses(data.classes || [])
      setValidities(data.validities || [])
      setStages(data.stages || [])
      setDocumentRequirements(data.documentRequirements || [])
      setTokenModels(data.tokenModels || [])

      // Defaults
      if (data.profiles?.length > 0) {
        const defP = data.profiles.find((p: any) => p.is_default) || data.profiles[0]
        setFormData((prev) => ({ ...prev, company_profile_id: defP.id }))
      }
      if (data.customers?.length > 0) {
        setFormData((prev) => ({ ...prev, client_id: data.customers[0].id }))
      }
      if (data.associatePartners?.length > 0) {
        setFormData((prev) => ({ ...prev, associate_partner_id: data.associatePartners[0].id }))
      }
      if (data.companies?.length > 0) {
        setFormData((prev) => ({ ...prev, company_id: data.companies[0].id }))
        setNewCard((prev) => ({ ...prev, company_id: data.companies[0].id }))
      }
      if (data.products?.length > 0) {
        setFormData((prev) => ({ ...prev, product_id: data.products[0].id }))
        setNewCard((prev) => ({ ...prev, product_id: data.products[0].id }))
      }
      if (data.tokenModels?.length > 0) {
        setSelectedTokenModelId(data.tokenModels[0].id)
      }
    } catch (err) {
      console.error('Failed to load direct issuance init data:', err)
    } finally {
      setLoadingInit(false)
    }
  }

  // Load applications
  const loadApplications = async () => {
    setAppsLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterProfile && filterProfile !== 'ALL') q.append('company_profile_id', filterProfile)
      if (filterStatus && filterStatus !== 'ALL') q.append('status', filterStatus)
      const res = await fetch(`/api/dsc/direct/applications?${q.toString()}`)
      const data = await res.json()
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setAppsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'applications') loadApplications()
  }, [activeTab, filterProfile, filterStatus])

  // Auto-resolve pricing on form changes
  useEffect(() => {
    if (formData.company_id && formData.product_id && formData.quantity > 0) {
      resolvePricing()
    }
  }, [
    formData.company_profile_id,
    formData.client_id,
    formData.fulfillment_channel,
    formData.associate_partner_id,
    formData.fulfillment_model,
    formData.company_id,
    formData.product_id,
    formData.class_id,
    formData.validity_id,
    formData.quantity,
    formData.date,
  ])

  const resolvePricing = async () => {
    setResolvingPricing(true)
    setPricingError('')
    try {
      const res = await fetch('/api/dsc/direct/resolve-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        setPricingError(data.error || 'Failed to resolve pricing')
        setPricingPreview(null)
      } else {
        setPricingPreview(data)
      }
    } catch (err: any) {
      setPricingError(err.message || 'Pricing resolution error')
      setPricingPreview(null)
    } finally {
      setResolvingPricing(false)
    }
  }

  // Submit Application or Estimate
  const handleSubmitForm = async () => {
    setFormSubmitting(true)
    setFormError('')
    setFormSuccess('')

    try {
      const url =
        formType === 'DIRECT'
          ? '/api/dsc/direct/applications'
          : '/api/dsc/direct/estimates'

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          application_date: formData.date,
          estimate_date: formData.date,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Failed to submit transaction')
      } else {
        setFormSuccess(
          formType === 'DIRECT'
            ? `Success! Created DSC Application #${data.application?.application_number}`
            : `Success! Created DSC Estimate #${data.estimate?.estimate_number}`
        )
        loadApplications()
      }
    } catch (err: any) {
      setFormError(err.message || 'Network submission error')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Load Single Application Detail & Stage History
  const openAppDetail = async (appId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/dsc/direct/applications/${appId}`)
      const data = await res.json()
      setSelectedApp(data.application)
      setAppHistory(data.stageHistory || [])
      // set default next stage if available
      const currentIdx = stages.findIndex((s) => s.id === data.application?.current_stage_id)
      if (currentIdx >= 0 && currentIdx < stages.length - 1) {
        setTargetStageId(stages[currentIdx + 1].id)
      }
    } catch (err) {
      console.error('Failed to load application detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Execute Stage Transition
  const handleTransitionStage = async () => {
    if (!selectedApp || !targetStageId) return
    setTransitioning(true)
    setTransitionError('')

    try {
      const docsPayload = Object.entries(submittedDocs).map(([reqId, val]) => ({
        requirement_id: reqId,
        text_value: val,
        file_url: val,
      }))

      const res = await fetch(`/api/dsc/direct/applications/${selectedApp.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_stage_id: targetStageId,
          documents_submitted: docsPayload,
          notes: transitionNotes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setTransitionError(data.error || 'Stage transition failed')
      } else {
        setShowTransitionModal(false)
        openAppDetail(selectedApp.id)
        loadApplications()
      }
    } catch (err: any) {
      setTransitionError(err.message || 'Transition network error')
    } finally {
      setTransitioning(false)
    }
  }

  // Allocate Physical Token
  const handleAllocateToken = async () => {
    if (!selectedApp || !selectedTokenModelId) return
    setAllocatingToken(true)
    setTokenError('')

    try {
      const serials = tokenSerials
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch(`/api/dsc/direct/applications/${selectedApp.id}/allocate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_model_id: selectedTokenModelId,
          serial_numbers: serials,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setTokenError(data.error || 'Token allocation failed')
      } else {
        setShowTokenModal(false)
        openAppDetail(selectedApp.id)
        loadApplications()
      }
    } catch (err: any) {
      setTokenError(err.message || 'Token allocation network error')
    } finally {
      setAllocatingToken(false)
    }
  }

  // Issue Certificate Final
  const handleFinalIssue = async () => {
    if (!selectedApp) return
    if (!confirm('Are you sure you want to finalize and issue this DSC Certificate? This will permanently freeze all commercial and technical snapshots.')) {
      return
    }

    try {
      const res = await fetch(`/api/dsc/direct/applications/${selectedApp.id}/issue`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to issue certificate')
      } else {
        alert(data.message || 'Certificate successfully issued!')
        openAppDetail(selectedApp.id)
        loadApplications()
      }
    } catch (err: any) {
      alert(err.message || 'Network error')
    }
  }

  // Load Rate Cards
  const loadRateCards = async () => {
    setRateCardsLoading(true)
    try {
      const res = await fetch('/api/dsc/direct/rate-cards')
      const data = await res.json()
      setRateCards(data.rateCards || [])
    } catch (err) {
      console.error('Failed to load rate cards:', err)
    } finally {
      setRateCardsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'rate_cards') loadRateCards()
  }, [activeTab])

  // Save new rate card
  const handleSaveRateCard = async () => {
    setSavingCard(true)
    try {
      const res = await fetch('/api/dsc/direct/rate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to save rate card')
      } else {
        alert('Rate card saved successfully!')
        loadRateCards()
      }
    } catch (err: any) {
      alert(err.message || 'Network error')
    } finally {
      setSavingCard(false)
    }
  }

  // Load Associate Partners list
  const loadAssociatePartners = async () => {
    try {
      const res = await fetch('/api/dsc/direct/associate-partners')
      const data = await res.json()
      setAssocList(data.associatePartners || [])
    } catch (err) {
      console.error('Failed to load associate partners:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'associate_partners') loadAssociatePartners()
  }, [activeTab])

  const handleSaveAssociate = async () => {
    setSavingAssoc(true)
    try {
      const res = await fetch('/api/dsc/direct/associate-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partner_id: newAssocPartnerId,
          commission_percentage: Number(newAssocComm),
          default_fulfillment_model: newAssocModel,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to register associate partner')
      } else {
        alert('Associate Partner registered successfully!')
        loadAssociatePartners()
        loadInitData()
      }
    } catch (err: any) {
      alert(err.message || 'Network error')
    } finally {
      setSavingAssoc(false)
    }
  }

  // Load Reports
  const loadReports = async () => {
    setReportsLoading(true)
    try {
      const q = new URLSearchParams()
      if (reportProfile && reportProfile !== 'ALL') q.append('company_profile_id', reportProfile)
      q.append('period', reportPeriod)
      const res = await fetch(`/api/dsc/direct/reports?${q.toString()}`)
      const data = await res.json()
      setReportsData(data)
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setReportsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'reports') loadReports()
  }, [activeTab, reportProfile, reportPeriod])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">DSC Client Issuance & Associate Partner Hub</h1>
              <p className="text-sm text-slate-400">
                Manage client DSC applications, associate partner fulfillment channels, rate cards & physical token allocations
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'applications' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Applications Register
          </button>
          <button
            onClick={() => setActiveTab('create_direct')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'create_direct' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            New DSC Transaction
          </button>
          <button
            onClick={() => setActiveTab('rate_cards')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'rate_cards' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            DSC Rate Cards
          </button>
          <button
            onClick={() => setActiveTab('associate_partners')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'associate_partners' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Associate Partners
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            Operational Reports
          </button>
        </div>
      </div>

      {/* TAB 1: APPLICATIONS REGISTER */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Client, Number, CA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-800 rounded-lg text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500 w-60"
                />
              </div>

              {/* Profile Filter */}
              <select
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-1.5 text-white bg-slate-950"
              >
                <option className="bg-slate-950 text-white" value="ALL">All Company Profiles</option>
                {profiles.map((p) => (
                  <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                    {p.legal_name}
                  </option>
                ))}
              </select>

              {/* Channel Filter */}
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-1.5 text-white bg-slate-950"
              >
                <option className="bg-slate-950 text-white" value="ALL">All Channels</option>
                <option className="bg-slate-950 text-white" value="DIRECT_SALE">Direct Sale</option>
                <option className="bg-slate-950 text-white" value="ASSOCIATE_PARTNER">Via Associate Partner</option>
              </select>
            </div>

            <button
              onClick={loadApplications}
              disabled={appsLoading}
              className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900/60 border border-slate-800 rounded-lg hover:bg-slate-800/60 flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${appsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Applications Table */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-800/60 text-slate-300 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">App #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Channel / Associate</th>
                    <th className="p-3">Provider & Product</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Stage</th>
                    <th className="p-3 text-center">Token</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {appsLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                        Loading DSC applications...
                      </td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-500">
                        No DSC applications found matching filters.
                      </td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="p-3 font-mono font-medium text-indigo-400">{app.application_number}</td>
                        <td className="p-3 whitespace-nowrap">{app.application_date}</td>
                        <td className="p-3 font-semibold text-white">
                          {app.client?.company_name || app.client_id}
                        </td>
                        <td className="p-3">
                          {app.fulfillment_channel === 'ASSOCIATE_PARTNER' ? (
                            <span className="inline-flex items-center gap-1 text-purple-400 font-medium">
                              <Award className="h-3 w-3" />
                              {app.associate_partner?.company_name || 'Associate'}
                              <span className="text-[10px] text-slate-500">({app.fulfillment_model})</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-medium">Direct Retail</span>
                          )}
                        </td>
                        <td className="p-3">
                          {app.company_id} — {app.product_id}
                        </td>
                        <td className="p-3 text-right font-bold">{app.quantity}</td>
                        <td className="p-3 text-right font-bold text-white">
                          ₹{Number(app.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            {app.current_stage?.stage_name || app.current_stage_id}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {app.is_token_allocated ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/40 border border-emerald-800/400/20 text-emerald-400 border border-emerald-500/30">
                              Allocated
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openAppDetail(app.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50 rounded-md transition-all flex items-center gap-1 mx-auto"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE DIRECT TRANSACTION OR ESTIMATE */}
      {activeTab === 'create_direct' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form */}
          <div className="lg:col-span-7 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Initiate DSC Transaction</h2>
                <p className="text-xs text-slate-400">Record a Direct DSC Application or issue a preliminary Client Estimate</p>
              </div>
              <div className="flex bg-slate-800/60 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFormType('DIRECT')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    formType === 'DIRECT' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                  }`}
                >
                  Direct Application
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('ESTIMATE')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    formType === 'ESTIMATE' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-300'
                  }`}
                >
                  Create Estimate
                </button>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-800/40 border border-red-200 text-red-400 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 border border-emerald-200 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Company Profile */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Company Profile <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.company_profile_id}
                  onChange={(e) => setFormData({ ...formData, company_profile_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                >
                  {profiles.map((p) => (
                    <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                      {p.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fulfillment Channel */}
              <div className="sm:col-span-2 p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/40">
                <label className="block text-xs font-bold text-indigo-300 mb-2">
                  Fulfillment Channel <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="channel"
                      checked={formData.fulfillment_channel === 'DIRECT_SALE'}
                      onChange={() => setFormData({ ...formData, fulfillment_channel: 'DIRECT_SALE' })}
                      className="text-indigo-400 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-white">Direct Retail Sale</div>
                      <div className="text-[11px] text-slate-400">Bill direct customer at Retail / General rate</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="channel"
                      checked={formData.fulfillment_channel === 'ASSOCIATE_PARTNER'}
                      onChange={() => setFormData({ ...formData, fulfillment_channel: 'ASSOCIATE_PARTNER' })}
                      className="text-indigo-400 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-white">Via Associate Partner</div>
                      <div className="text-[11px] text-slate-400">Commission or Reselling/B2B fulfillment</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Associate Partner Selection & Model if applicable */}
              {formData.fulfillment_channel === 'ASSOCIATE_PARTNER' && (
                <div className="sm:col-span-2 p-3.5 bg-purple-950/30 border border-purple-800/40 rounded-xl border border-purple-800/50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-purple-300 mb-1">
                        Select Associate Partner <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.associate_partner_id}
                        onChange={(e) => setFormData({ ...formData, associate_partner_id: e.target.value })}
                        className="w-full text-xs border border-slate-800 bg-slate-950 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500"
                      >
                        {associatePartners.map((ap) => (
                          <option className="bg-slate-950 text-white" key={ap.id} value={ap.id}>
                            {ap.company_name} [{ap.partner_code || 'AP'}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-purple-300 mb-1">
                        Fulfillment Model <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.fulfillment_model}
                        onChange={(e) => setFormData({ ...formData, fulfillment_model: e.target.value as any })}
                        className="w-full text-xs border border-slate-800 bg-slate-950 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 font-semibold"
                      >
                        <option className="bg-slate-950 text-white" value="COMMISSION">Commission-Based (Bill Customer, Pay Commission)</option>
                        <option className="bg-slate-950 text-white" value="RESELLING_B2B">Reselling / B2B (Bill Associate Partner Directly)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* End Client / Customer */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  End Client / Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                >
                  {customers.map((c) => (
                    <option className="bg-slate-950 text-white" key={c.id} value={c.id}>
                      {c.company_name} {c.contact_person ? `(${c.contact_person})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider CA */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  DSC Provider (CA) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
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
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
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
                <label className="block text-xs font-semibold text-slate-200 mb-1">Certificate Class</label>
                <select
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                >
                  <option className="bg-slate-950 text-white" value="">-- Standard Class 3 --</option>
                  {classes.map((cls) => (
                    <option className="bg-slate-950 text-white" key={cls.id} value={cls.id}>
                      {cls.class_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Validity */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Validity</label>
                <select
                  value={formData.validity_id}
                  onChange={(e) => setFormData({ ...formData, validity_id: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                >
                  <option className="bg-slate-950 text-white" value="">-- Standard 2 Years --</option>
                  {validities.map((v) => (
                    <option className="bg-slate-950 text-white" key={v.id} value={v.id}>
                      {v.display_name}
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
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">Internal Reference Notes</label>
                <input
                  type="text"
                  placeholder="e.g. MCA Annual Filing batch..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs border border-slate-800 rounded-lg px-3 py-2 text-white bg-slate-950 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Action */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {formType === 'DIRECT'
                  ? 'Creates an active DSC application for stage processing.'
                  : 'Generates a customer estimate ready to send for approval.'}
              </span>
              <button
                type="button"
                onClick={handleSubmitForm}
                disabled={formSubmitting || !!pricingError || !pricingPreview}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                {formSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {formType === 'DIRECT' ? 'Confirm Direct Application' : 'Create Customer Estimate'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Pricing Breakdown */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-indigo-400" />
                  Commercial Rate Card Resolution
                </h3>
                {resolvingPricing && (
                  <span className="text-xs text-indigo-400 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Resolving...
                  </span>
                )}
              </div>

              {pricingError ? (
                <div className="p-3 bg-red-950/40 border border-red-800/40 border border-red-200 rounded-lg text-red-400 text-xs">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Rate Resolution Notice
                  </div>
                  <p className="mt-1">{pricingError}</p>
                </div>
              ) : pricingPreview ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-indigo-200">
                    <div className="font-bold flex items-center justify-between">
                      <span>Rate Card: {pricingPreview.rateCardType}</span>
                      <span className="font-mono text-xs">₹{pricingPreview.baseUnitRate} / unit</span>
                    </div>
                    <div className="text-[11px] text-indigo-400 mt-1">
                      Billing Party: <span className="font-bold">{pricingPreview.billingPartyRole}</span>
                    </div>
                  </div>

                  <div className="space-y-2 border border-slate-800 rounded-lg p-3">
                    <div className="flex justify-between text-slate-300">
                      <span>Base Selling Price ({pricingPreview.quantity} unit):</span>
                      <span className="font-semibold text-white">₹{pricingPreview.baseTotalAmount}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Statutory GST ({pricingPreview.gstRate}%):</span>
                      <span className="font-semibold text-white">₹{pricingPreview.gstAmount}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-indigo-200">
                      <span>Total Invoice Amount:</span>
                      <span>₹{pricingPreview.totalAmount}</span>
                    </div>
                  </div>

                  {pricingPreview.associateCommissionAmount > 0 && (
                    <div className="p-3 bg-purple-950/30 border border-purple-800/40 border border-purple-800/50 rounded-lg text-purple-300 text-xs">
                      <div className="font-bold flex items-center justify-between">
                        <span>Associate Partner Commission:</span>
                        <span>₹{pricingPreview.associateCommissionAmount}</span>
                      </div>
                      <p className="text-[11px] text-purple-400 mt-1">
                        Calculated at {pricingPreview.associateCommissionPercentage}% commission model.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Fill in transaction details to auto-resolve rate cards
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RATE CARDS MASTER (Admin Only) */}
      {activeTab === 'rate_cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-indigo-400" />
              Configure DSC Rate Card
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Rate Card Type</label>
                <select
                  value={newCard.rate_card_type}
                  onChange={(e) => setNewCard({ ...newCard, rate_card_type: e.target.value })}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  <option className="bg-slate-950 text-white" value="GENERAL">GENERAL / STANDARD</option>
                  <option className="bg-slate-950 text-white" value="DIRECT_RETAIL">DIRECT RETAIL</option>
                  <option className="bg-slate-950 text-white" value="ASSOCIATE_PARTNER">ASSOCIATE PARTNER (Reselling/B2B)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Provider (CA)</label>
                <select
                  value={newCard.company_id}
                  onChange={(e) => setNewCard({ ...newCard, company_id: e.target.value })}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  {companies.map((c) => (
                    <option className="bg-slate-950 text-white" key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">DSC Product</label>
                <select
                  value={newCard.product_id}
                  onChange={(e) => setNewCard({ ...newCard, product_id: e.target.value })}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  {products.map((p) => (
                    <option className="bg-slate-950 text-white" key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Base Selling Rate (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={newCard.rate}
                  onChange={(e) => setNewCard({ ...newCard, rate: e.target.value })}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={newCard.effective_from}
                    onChange={(e) => setNewCard({ ...newCard, effective_from: e.target.value })}
                    className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-200 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={newCard.effective_to}
                    onChange={(e) => setNewCard({ ...newCard, effective_to: e.target.value })}
                    className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveRateCard}
                disabled={savingCard || !newCard.rate}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs"
              >
                {savingCard ? 'Saving...' : 'Add Rate Card'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 font-bold text-xs text-slate-200">
              Active Rate Cards
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Provider</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-right">Base Rate</th>
                    <th className="p-2.5">Validity Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rateCards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        No custom rate cards defined. Using CA Master rates.
                      </td>
                    </tr>
                  ) : (
                    rateCards.map((rc) => (
                      <tr key={rc.id}>
                        <td className="p-2.5 font-semibold text-indigo-400">{rc.rate_card_type}</td>
                        <td className="p-2.5">{rc.company_id}</td>
                        <td className="p-2.5">{rc.product_id}</td>
                        <td className="p-2.5 text-right font-bold">₹{rc.rate}</td>
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">
                          {rc.effective_from} → {rc.effective_to || 'Ongoing'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ASSOCIATE PARTNERS MASTER */}
      {activeTab === 'associate_partners' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600" />
              Tag Party as Associate Partner
            </h3>
            <p className="text-xs text-slate-400">
              Designate existing parties as Associate Partners with independent fulfillment and rate configuration.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Select Party</label>
                <select
                  value={newAssocPartnerId}
                  onChange={(e) => setNewAssocPartnerId(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  <option className="bg-slate-950 text-white" value="">-- Choose Party --</option>
                  {customers.map((c) => (
                    <option className="bg-slate-950 text-white" key={c.id} value={c.id}>
                      {c.company_name} ({c.contact_person || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Default Commission (%)</label>
                <input
                  type="number"
                  value={newAssocComm}
                  onChange={(e) => setNewAssocComm(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Default Fulfillment Model</label>
                <select
                  value={newAssocModel}
                  onChange={(e) => setNewAssocModel(e.target.value as any)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  <option className="bg-slate-950 text-white" value="COMMISSION">Commission-Based</option>
                  <option className="bg-slate-950 text-white" value="RESELLING_B2B">Reselling / B2B</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSaveAssociate}
                disabled={savingAssoc || !newAssocPartnerId}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-xs"
              >
                {savingAssoc ? 'Registering...' : 'Register Associate Partner'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 font-bold text-xs text-slate-200">
              Registered Associate Partners
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Partner Name</th>
                    <th className="p-2.5">Contact</th>
                    <th className="p-2.5 text-right">Commission</th>
                    <th className="p-2.5">Model</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {assocList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        No Associate Partners tagged yet.
                      </td>
                    </tr>
                  ) : (
                    assocList.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2.5 font-bold text-purple-300">{a.partner?.company_name || a.partner_id}</td>
                        <td className="p-2.5 text-slate-300">{a.partner?.email || 'N/A'}</td>
                        <td className="p-2.5 text-right font-semibold">{a.commission_percentage}%</td>
                        <td className="p-2.5">{a.default_fulfillment_model}</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              a.is_active ? 'bg-emerald-950/40 border border-emerald-800/400/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/60 text-slate-300'
                            }`}
                          >
                            {a.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: OPERATIONAL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-1.5 text-white bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="current_month" className="bg-slate-950 text-white">Current Month</option>
                <option value="fy" className="bg-slate-950 text-white">Financial Year (01-Apr to 31-Mar)</option>
              </select>

              <select
                value={reportProfile}
                onChange={(e) => setReportProfile(e.target.value)}
                className="text-xs border border-slate-800 rounded-lg px-3 py-1.5 text-white bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL" className="bg-slate-950 text-white">All Company Profiles (Consolidated)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                    {p.legal_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadReports}
              disabled={reportsLoading}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
          </div>

          {reportsData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-sm">
                <div className="text-xs text-slate-400 uppercase font-semibold">Total Certificates</div>
                <div className="text-2xl font-black text-white mt-1">
                  {reportsData.summary.total_certificates}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{reportsData.summary.total_applications} applications</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-sm">
                <div className="text-xs text-slate-400 uppercase font-semibold">Gross Revenue</div>
                <div className="text-2xl font-black text-indigo-400 mt-1">
                  ₹{Number(reportsData.summary.total_gross_sales || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Base: ₹{reportsData.summary.total_base_sales}</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-sm">
                <div className="text-xs text-slate-400 uppercase font-semibold">Associate Commissions</div>
                <div className="text-2xl font-black text-purple-400 mt-1">
                  ₹{Number(reportsData.summary.total_associate_commissions || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Paid under commission model</div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-sm">
                <div className="text-xs text-slate-400 uppercase font-semibold">Reselling B2B Value</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  ₹{Number(reportsData.summary.total_reselling_sales || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Billed to associate partners</div>
              </div>
            </div>
          )}

          {/* Pipeline Grouping */}
          {reportsData?.pipeline && (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 shadow-sm p-4">
              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3">Application Pipeline</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {reportsData.pipeline.map((p: any) => (
                  <div key={p.stage_id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-center">
                    <div className="text-xs font-semibold text-slate-200 truncate">{p.stage_name}</div>
                    <div className="text-xl font-bold text-indigo-400 mt-1">{p.count}</div>
                    <div className="text-[10px] text-slate-500">{p.certificates} certs</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPLICATION DETAIL / MANAGEMENT MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" />
                  DSC Application #{selectedApp.application_number}
                </h3>
                <p className="text-xs text-slate-400">
                  Client: {selectedApp.client_id} | Channel: {selectedApp.fulfillment_channel}
                </p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-indigo-950/40 rounded-lg border border-slate-800">
                <span className="text-slate-400 uppercase text-[10px] font-semibold">Current Stage</span>
                <div className="font-bold text-indigo-200 mt-0.5">
                  {stages.find((s) => s.id === selectedApp.current_stage_id)?.stage_name || selectedApp.current_stage_id}
                </div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 uppercase text-[10px] font-semibold">Token Allocation</span>
                <div className="font-bold text-white mt-0.5">
                  {selectedApp.is_token_allocated ? 'Allocated' : 'Pending Allocation'}
                </div>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                <span className="text-slate-400 uppercase text-[10px] font-semibold">Issuance Status</span>
                <div className="font-bold text-white mt-0.5">{selectedApp.status}</div>
              </div>
            </div>

            {/* Stage Progression Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-100 mb-2 uppercase">Lifecycle Progression History</h4>
              <div className="space-y-2 border border-slate-800 rounded-lg p-3 bg-slate-900/60 text-xs">
                {appHistory.map((h, idx) => (
                  <div key={h.id} className="flex items-center justify-between pb-2 border-b border-slate-800 last:border-0 last:pb-0">
                    <div>
                      <span className="font-bold text-white">{h.stage_name}</span>
                      <span className="text-[11px] text-slate-400 ml-2">by {h.completed_by_user_name}</span>
                      {h.notes && <div className="text-[11px] text-slate-300 mt-0.5">{h.notes}</div>}
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(h.completed_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800">
              {!selectedApp.is_token_allocated && (
                <button
                  type="button"
                  onClick={() => setShowTokenModal(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Cpu className="h-4 w-4" />
                  Allocate Hardware Token
                </button>
              )}

              {selectedApp.status !== 'ISSUED' && selectedApp.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => setShowTransitionModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <ArrowRight className="h-4 w-4" />
                  Progress Stage
                </button>
              )}

              {selectedApp.status !== 'ISSUED' && selectedApp.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={handleFinalIssue}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  Finalize & Issue DSC
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STAGE TRANSITION MODAL */}
      {showTransitionModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg border border-slate-800 w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white">Progress DSC Application Stage</h3>

            {transitionError && (
              <div className="p-3 bg-red-950/40 border border-red-800/40 border border-red-200 text-red-400 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{transitionError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Target Stage</label>
                <select
                  value={targetStageId}
                  onChange={(e) => setTargetStageId(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  {stages.map((s) => (
                    <option className="bg-slate-950 text-white" key={s.id} value={s.id}>
                      {s.stage_order}. {s.stage_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Requirements for target stage */}
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Document Verification / Verification Details</label>
                <div className="space-y-2 border border-slate-800 rounded-lg p-2.5 bg-slate-900/60">
                  {documentRequirements
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <div key={r.id} className="space-y-1">
                        <span className="font-semibold text-slate-100">
                          {r.name} {r.is_mandatory && <span className="text-red-500">*</span>}
                        </span>
                        <input
                          type="text"
                          placeholder="Verification document reference / file URL..."
                          value={submittedDocs[r.id] || ''}
                          onChange={(e) => setSubmittedDocs({ ...submittedDocs, [r.id]: e.target.value })}
                          className="w-full border border-slate-800 rounded px-2 py-1 text-white bg-slate-950"
                        />
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Notes / Verification Remarks</label>
                <textarea
                  rows={2}
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg p-2 text-white bg-slate-950"
                  placeholder="e.g. Identity verified on MCA portal..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransitionModal(false)}
                  className="px-3 py-1.5 bg-slate-800/60 text-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransitionStage}
                  disabled={transitioning}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg"
                >
                  {transitioning ? 'Verifying...' : 'Confirm Stage Progress'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOKEN ALLOCATION MODAL */}
      {showTokenModal && selectedApp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-md border border-slate-800 w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-cyan-600" />
              Allocate Physical USB Hardware Token
            </h3>

            {tokenError && (
              <div className="p-3 bg-red-950/40 border border-red-800/40 border border-red-200 text-red-400 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{tokenError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">Select Token Model from Stock</label>
                <select
                  value={selectedTokenModelId}
                  onChange={(e) => setSelectedTokenModelId(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                >
                  {tokenModels.map((tm) => (
                    <option className="bg-slate-950 text-white" key={tm.id} value={tm.id}>
                      {tm.model_name} ({tm.manufacturer || 'Auto'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">Serial Numbers (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. SN-998811, SN-998812"
                  value={tokenSerials}
                  onChange={(e) => setTokenSerials(e.target.value)}
                  className="w-full border border-slate-800 rounded-lg px-2.5 py-1.5 text-white bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-3 py-1.5 bg-slate-800/60 text-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAllocateToken}
                  disabled={allocatingToken}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg"
                >
                  {allocatingToken ? 'Deducting Stock...' : 'Confirm Allocation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

