// Module 02: Partner Directory with Add Partner Action & Plain English Wording
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Users2, Wallet, CreditCard, ShieldCheck, ArrowRight, Plus, Search } from 'lucide-react'
import { AddPartnerModal } from '@/components/AddPartnerModal'
import { EditPartnerModal } from '@/components/EditPartnerModal'
import { Pagination } from '@/components/Pagination'
import { PartnerRecord } from '@/types/models'
import { UI_TERMS } from '@/lib/terms'

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerRecord[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // System overview KPIs (all records)
  const [typeFilter, setTypeFilter] = useState('')
  const [kpis, setKpis] = useState({ totalPartners: 0, totalWallet: 0, totalCreditLimit: 0, highRiskCount: 0 })

  const loadKpis = () => {
    fetch('/api/partners?mask=true')
      .then((r) => r.json())
      .then((d) => {
        const all: PartnerRecord[] = d.partners || []
        const totalWallet = all.reduce((sum, p) => sum + (p.wallet_balance || 0), 0)
        const totalCreditLimit = all.reduce((sum, p) => sum + (p.credit_limit || 0), 0)
        const highRiskCount = all.filter((p: any) => (p.credit_limit || 0) > 0 && (p.wallet_balance || 0) < 0).length
        setKpis({ totalPartners: all.length, totalWallet, totalCreditLimit, highRiskCount })
      })
      .catch(() => {})
  }

  const loadPartners = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      mask: 'true',
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) {
      params.append('search', search.trim())
    }
    if (typeFilter) {
      params.append('type', typeFilter)
    }

    fetch(`/api/partners?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setPartners(d.partners || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, search])

  useEffect(() => {
    loadKpis()
  }, [])

  useEffect(() => {
    loadPartners()
  }, [loadPartners, typeFilter])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setCurrentPage(1) // Reset to page 1 on search
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to page 1 on page size change
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{UI_TERMS.partners}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Module 02
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Directory of registered DSC and token partners with credit terms, wallets, and account statements.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" /> Add Partner
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Active Partners</div>
          <div className="text-2xl font-bold text-white mt-1">{kpis.totalPartners}</div>
          <div className="text-[11px] text-emerald-400 mt-1">100% KYC Verified</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Total Wallet Balance</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            ₹{kpis.totalWallet.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Available to issue certificates</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">Authorized Credit Lines</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            ₹{kpis.totalCreditLimit.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Net-30 / Net-45 credit terms</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs text-slate-400">High-Risk Aging Accounts</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{kpis.highRiskCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Overdue or threshold alerts</div>
        </div>
      </div>

      {/* Partners List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white">Registered Partners List</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Filter Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Partner Types</option>
                <option value="dsc_partner">DSC Partner</option>
                <option value="token_partner">Token Partner</option>
                <option value="associate_partner">Associate Partner</option>
                <option value="master_distributor">Master Distributor</option>
              </select>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search partner name or code..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3 font-semibold whitespace-nowrap">Partner Code</th>
                <th className="p-3 font-semibold whitespace-nowrap">Company & Contact</th>
                <th className="p-3 font-semibold whitespace-nowrap">Partner Type</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Credit Limit</th>
                <th className="p-3 font-semibold whitespace-nowrap">Payment Term</th>
                <th className="p-3 text-right font-semibold whitespace-nowrap">Wallet Balance</th>
                <th className="p-3 font-semibold whitespace-nowrap">Documents</th>
                <th className="p-3 font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && partners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 whitespace-nowrap">
                    Loading partners...
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 whitespace-nowrap">
                    No partners found matching your search.
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 h-12">
                    <td className="p-3 font-mono text-indigo-400 font-semibold whitespace-nowrap">{p.partner_code}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-semibold text-white">{p.company_name}</div>
                      <div className="text-[11px] text-slate-400">{p.contact_person} &bull; {p.phone}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize whitespace-nowrap">
                        {p.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-200 font-medium whitespace-nowrap">₹{p.credit_limit?.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">Net-{p.credit_period_days} Days</td>
                    <td className="p-3 text-right text-emerald-400 font-semibold whitespace-nowrap">₹{p.wallet_balance?.toLocaleString('en-IN')}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Link
                          href={`/partners/${p.id}`}
                          className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium whitespace-nowrap"
                        >
                          Details <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => setEditingPartner(p)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition cursor-pointer whitespace-nowrap"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination Bar */}
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          isLoading={loading}
        />
      </div>

      <AddPartnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadPartners()
          loadKpis()
        }}
      />

      <EditPartnerModal
        isOpen={Boolean(editingPartner)}
        partner={editingPartner}
        onClose={() => setEditingPartner(null)}
        onSuccess={() => {
          loadPartners()
          loadKpis()
        }}
      />
    </div>
  )
}
