// Module 05: Customer Leads with Add Lead, Deduplication & Simple Wording
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Layers, ShieldAlert, GitMerge, UserCheck, Plus, Search } from 'lucide-react'
import { AddLeadModal } from '@/components/AddLeadModal'
import { Pagination } from '@/components/Pagination'
import { CrmLeadRecord } from '@/types/models'
import { UI_TERMS } from '@/lib/terms'

export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<CrmLeadRecord[]>([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const loadLeads = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      mask: 'true',
      page: String(currentPage),
      limit: String(pageSize),
    })
    if (search.trim()) params.append('search', search.trim())

    fetch(`/api/crm/leads?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads || [])
        setTotalCount(d.totalCount || 0)
        setTotalPages(d.totalPages || 1)
      })
      .finally(() => setLoading(false))
  }, [currentPage, pageSize, search])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{UI_TERMS.crmLeads}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Module 05
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track inquiries, check duplicate customers, and manage sales calls and callbacks.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" /> Add Customer Lead
        </button>
      </div>

      {/* Duplicate Check Notice Banner */}
      <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-purple-300">Automatic Duplicate Customer Check:</span> Whenever you enter a customer, the system automatically checks matching Phone, Email, or GSTIN to avoid duplicate follow-ups.
          </div>
        </div>
        <div className="font-mono text-xs text-purple-300 font-medium px-2.5 py-1 rounded bg-purple-900/40 border border-purple-700/50">
          Match Threshold: 40 pts
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-white">Customer Leads Pipeline</div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer or phone..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <th className="p-3">Customer Code</th>
                <th className="p-3">Company Name</th>
                <th className="p-3">Contact Details</th>
                <th className="p-3">GSTIN</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Lead Status</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Loading customer leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No customer leads found matching your search.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-purple-300 font-semibold">{l.lead_code}</td>
                    <td className="p-3 font-medium text-white">{l.company_name}</td>
                    <td className="p-3">
                      <div className="text-slate-200">{l.contact_person}</div>
                      <div className="text-[11px] text-slate-400">{l.phone} &bull; {l.email}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{l.gstin || 'N/A'}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{l.requirement_summary}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
                        {l.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Primary Record
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Database Pagination for Leads */}
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

      <AddLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadLeads}
      />
    </div>
  )
}
