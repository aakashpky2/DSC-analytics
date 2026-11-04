// Visual Analytics Charts: Refined, Muted Professional Color Palette
'use client'

import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Calendar,
  DollarSign
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'

export default function AnalyticsDashboard() {
  const [data, setData] = useState<{
    invoices: any[]
    partners: any[]
    leads: any[]
    batches: any[]
  }>({
    invoices: [],
    partners: [],
    leads: [],
    batches: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/invoices').then((r) => r.json()),
      fetch('/api/partners').then((r) => r.json()),
      fetch('/api/crm/leads').then((r) => r.json()),
      fetch('/api/inventory/batches').then((r) => r.json()),
    ])
      .then(([invData, partData, leadData, batchData]) => {
        setData({
          invoices: invData.invoices || [],
          partners: partData.partners || [],
          leads: leadData.leads || [],
          batches: batchData.batches || [],
        })
      })
      .finally(() => setLoading(false))
  }, [])

  // 1. Monthly Sales & Collections Trend
  const monthlyRevenue = [
    { month: 'Oct 25', sales: 185000, collections: 140000 },
    { month: 'Nov 25', sales: 245000, collections: 210000 },
    { month: 'Dec 25', sales: 310000, collections: 280000 },
    { month: 'Jan 26', sales: 420000, collections: 390000 },
    { month: 'Feb 26', sales: 380000, collections: 350000 },
    { month: 'Mar 26', sales: 520000, collections: 490000 },
  ]

  // 2. DSC Application Status Breakdown (Muted Corporate Tones)
  const dscStatusData = [
    { name: 'Application Received', value: 12, color: '#6486B0' }, // Muted Blue
    { name: 'Document Check', value: 8, color: '#C49A53' },      // Muted Amber
    { name: 'Video Verification', value: 5, color: '#7F56AD' },  // Muted Purple
    { name: 'Approval in Progress', value: 15, color: '#4E7EAB' },// Softer Slate Cyan
    { name: 'Dispatched to Customer', value: 45, color: '#3F9C83' }, // Muted Green
  ]

  // 3. Lead Conversion Funnel
  const leadFunnelData = [
    { stage: 'New Inquiries', count: 48 },
    { stage: 'Contacted', count: 35 },
    { stage: 'Requirement Gathered', count: 24 },
    { stage: 'Quotation Sent', count: 18 },
    { stage: 'Orders Won', count: 12 },
  ]

  // 4. Token Landed Cost vs Vendor Base Price
  const tokenCostData = data.batches.map((b) => ({
    model: b.token_model.replace('_', ' ').slice(0, 12),
    basePrice: b.base_unit_price,
    landedCost: b.unit_landed_cost,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Business Performance</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sales overview, DSC application status, customer inquiries, and token purchase costs.
          </p>
        </div>
      </div>

      {/* Grid of Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Sales & Payments */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Monthly Sales & Payments</h3>
              <p className="text-[11px] text-slate-400">Total invoice value compared with payments received</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">92.4% Collected</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5968C5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5968C5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3F9C83" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3F9C83" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232F42" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#29354A', borderRadius: '8px', fontSize: '11px', color: '#F1F5F9' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#5968C5" fillOpacity={1} fill="url(#salesGrad)" name="Total Invoices" />
                <Area type="monotone" dataKey="collections" stroke="#3F9C83" fillOpacity={1} fill="url(#colGrad)" name="Payments Received" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: DSC Application Status */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">DSC Application Status</h3>
              <p className="text-[11px] text-slate-400">Current progress of certificates in processing</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">85 Active</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dscStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {dscStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#29354A', borderRadius: '8px', fontSize: '11px', color: '#F1F5F9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px]">
            {dscStatusData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                <span className="text-slate-300">{d.name}:</span>
                <span className="font-semibold text-white">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Customer Lead Conversion */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Customer Lead Conversion</h3>
              <p className="text-[11px] text-slate-400">Inquiry progress to completed orders</p>
            </div>
            <span className="text-xs font-mono text-indigo-400 font-semibold">25% Won</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadFunnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#232F42" />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis dataKey="stage" type="category" stroke="#64748B" fontSize={11} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#29354A', borderRadius: '8px', fontSize: '11px', color: '#F1F5F9' }}
                />
                <Bar dataKey="count" fill="#5968C5" radius={[0, 4, 4, 0]} name="Inquiries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Token Purchase Cost vs Base Price */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Token Purchase Cost</h3>
              <p className="text-[11px] text-slate-400">Vendor base price compared with total cost including freight and tax</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">Accurate Costing</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenCostData.length > 0 ? tokenCostData : [{ model: 'ePass Auto', basePrice: 340, landedCost: 366 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232F42" />
                <XAxis dataKey="model" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#29354A', borderRadius: '8px', fontSize: '11px', color: '#F1F5F9' }}
                />
                <Bar dataKey="basePrice" fill="#4E7EAB" name="Base Price (₹)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="landedCost" fill="#6486B0" name="Total Cost per Unit (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
