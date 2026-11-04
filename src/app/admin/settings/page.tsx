// Central Administrator Business Settings (/admin/settings)
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  Cpu,
  Truck,
  Sparkles,
  Save,
  CheckCircle2,
  Plus,
  ArrowLeft,
  Settings,
} from 'lucide-react'

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'tokens' | 'couriers' | 'services'>('company')

  // Company Profile State
  const [company, setCompany] = useState({
    legal_name: '',
    trade_name: '',
    gstin: '',
    pan: '',
    email: '',
    phone: '',
    registered_address: '',
    state_code: '27',
    state_name: 'Maharashtra',
  })
  const [companySaving, setCompanySaving] = useState(false)
  const [companySuccess, setCompanySuccess] = useState(false)

  // Token Models State
  const [tokens, setTokens] = useState<any[]>([])
  const [newToken, setNewToken] = useState({ model_name: '', manufacturer: '', min_threshold: '15' })
  const [tokenSaving, setTokenSaving] = useState(false)

  // Courier Companies State
  const [couriers, setCouriers] = useState<any[]>([])
  const [newCourier, setNewCourier] = useState({ company_name: '', tracking_url_template: '', support_phone: '' })
  const [courierSaving, setCourierSaving] = useState(false)

  // Services Catalog State
  const [services, setServices] = useState<any[]>([])
  const [newService, setNewService] = useState({ service_key: '', service_name: '', category: 'Corporate', government_fee: '0', professional_fee: '0' })
  const [serviceSaving, setServiceSaving] = useState(false)

  const loadAll = () => {
    fetch('/api/admin/settings/company')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) setCompany(d.profile)
      })

    fetch('/api/admin/settings/tokens')
      .then((r) => r.json())
      .then((d) => setTokens(d.models || []))

    fetch('/api/admin/settings/couriers')
      .then((r) => r.json())
      .then((d) => setCouriers(d.couriers || []))

    fetch('/api/admin/settings/services')
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setCompanySaving(true)
    setCompanySuccess(false)
    try {
      const res = await fetch('/api/admin/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      })
      if (res.ok) {
        setCompanySuccess(true)
        setTimeout(() => setCompanySuccess(false), 3000)
      }
    } finally {
      setCompanySaving(false)
    }
  }

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setTokenSaving(true)
    try {
      const res = await fetch('/api/admin/settings/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newToken),
      })
      if (res.ok) {
        setNewToken({ model_name: '', manufacturer: '', min_threshold: '15' })
        loadAll()
      }
    } finally {
      setTokenSaving(false)
    }
  }

  const handleAddCourier = async (e: React.FormEvent) => {
    e.preventDefault()
    setCourierSaving(true)
    try {
      const res = await fetch('/api/admin/settings/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCourier),
      })
      if (res.ok) {
        setNewCourier({ company_name: '', tracking_url_template: '', support_phone: '' })
        loadAll()
      }
    } finally {
      setCourierSaving(false)
    }
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    setServiceSaving(true)
    try {
      const res = await fetch('/api/admin/settings/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      })
      if (res.ok) {
        setNewService({ service_key: '', service_name: '', category: 'Corporate', government_fee: '0', professional_fee: '0' })
        loadAll()
      }
    } finally {
      setServiceSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span>/</span>
            <span className="text-white">Business Settings</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Central Administrator Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain company profile, hardware token inventory master, couriers, and business service categories.
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'company'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Company Profile & GST
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'tokens'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4" /> Hardware Token Models
        </button>

        <button
          onClick={() => setActiveTab('couriers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'couriers'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" /> Courier Partners
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === 'services'
              ? 'bg-pink-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Business Services Catalog
        </button>
      </div>

      {/* Tab 1: Company Profile */}
      {activeTab === 'company' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 max-w-3xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Business Entity Profile</h2>
              <p className="text-[11px] text-slate-400">
                Official entity credentials printed on Invoices, Delivery Challans, and Compliance PDFs.
              </p>
            </div>
            {companySuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Settings Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Legal Business Name *</label>
                <input
                  required
                  value={company.legal_name}
                  onChange={(e) => setCompany({ ...company, legal_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Trade / Brand Name</label>
                <input
                  value={company.trade_name}
                  onChange={(e) => setCompany({ ...company, trade_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">GSTIN *</label>
                <input
                  required
                  value={company.gstin}
                  onChange={(e) => setCompany({ ...company, gstin: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Company PAN *</label>
                <input
                  required
                  value={company.pan}
                  onChange={(e) => setCompany({ ...company, pan: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Billing Email</label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Registered Office Address</label>
              <textarea
                rows={2}
                value={company.registered_address}
                onChange={(e) => setCompany({ ...company, registered_address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Default State Code * (GST)</label>
                <input
                  required
                  value={company.state_code}
                  onChange={(e) => setCompany({ ...company, state_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  placeholder="e.g. 27"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">State Name</label>
                <input
                  value={company.state_name}
                  onChange={(e) => setCompany({ ...company, state_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g. Maharashtra"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={companySaving}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {companySaving ? 'Saving...' : 'Save Company Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Hardware Token Models */}
      {activeTab === 'tokens' && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Add New Hardware Token Model</h2>
            <form onSubmit={handleAddToken} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Model Name *</label>
                <input
                  required
                  placeholder="e.g. HYPERPKI HYP2003"
                  value={newToken.model_name}
                  onChange={(e) => setNewToken({ ...newToken, model_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Manufacturer *</label>
                <input
                  required
                  placeholder="e.g. Hypersecu Inc"
                  value={newToken.manufacturer}
                  onChange={(e) => setNewToken({ ...newToken, manufacturer: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-slate-300 font-medium mb-1">Min Threshold</label>
                  <input
                    type="number"
                    value={newToken.min_threshold}
                    onChange={(e) => setNewToken({ ...newToken, min_threshold: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={tokenSaving}
                  className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <th className="p-3">Model Name</th>
                  <th className="p-3">Manufacturer</th>
                  <th className="p-3 text-right">Min Threshold</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tokens.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-semibold text-cyan-300">{t.model_name}</td>
                    <td className="p-3 text-slate-200">{t.manufacturer}</td>
                    <td className="p-3 text-right font-medium text-white">{t.min_threshold} units</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Model
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Courier Companies */}
      {activeTab === 'couriers' && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Add Courier Partner</h2>
            <form onSubmit={handleAddCourier} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
                <input
                  required
                  placeholder="e.g. Trackon Couriers"
                  value={newCourier.company_name}
                  onChange={(e) => setNewCourier({ ...newCourier, company_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Support Phone</label>
                <input
                  placeholder="+91 1800 123 4567"
                  value={newCourier.support_phone}
                  onChange={(e) => setNewCourier({ ...newCourier, support_phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={courierSaving}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Courier
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <th className="p-3">Courier Company</th>
                  <th className="p-3">Support Helpline</th>
                  <th className="p-3">Tracking Supported</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {couriers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{c.company_name}</td>
                    <td className="p-3 text-slate-300">{c.support_phone || 'N/A'}</td>
                    <td className="p-3 text-cyan-400 font-mono text-[11px]">Dynamic AWB Resolution</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Carrier
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Services Catalog */}
      {activeTab === 'services' && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Add Business Service to Catalog</h2>
            <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Service Key *</label>
                <input
                  required
                  placeholder="e.g. import_export_code"
                  value={newService.service_key}
                  onChange={(e) => setNewService({ ...newService, service_key: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono lowercase"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Service Name *</label>
                <input
                  required
                  placeholder="e.g. IEC Code Registration"
                  value={newService.service_name}
                  onChange={(e) => setNewService({ ...newService, service_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="w-full py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Service
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <th className="p-3">Service Key</th>
                  <th className="p-3">Service Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Govt Fee</th>
                  <th className="p-3 text-right">Service Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-300">{s.service_key}</td>
                    <td className="p-3 font-semibold text-white">{s.service_name}</td>
                    <td className="p-3 text-slate-300">{s.category}</td>
                    <td className="p-3 text-right text-slate-400">₹{s.government_fee}</td>
                    <td className="p-3 text-right font-medium text-emerald-400">₹{s.professional_fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

