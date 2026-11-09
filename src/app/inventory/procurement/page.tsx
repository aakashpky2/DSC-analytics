'use client'

import React, { useState, useEffect } from 'react'
import {
  ShoppingBag,
  Building2,
  FileSpreadsheet,
  Calculator,
  FileText,
  Truck,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Ban,
  Printer,
  FileCode2,
  Eye,
  Edit2
} from 'lucide-react'

export default function TokenProcurementPage() {
  const [activeTab, setActiveTab] = useState<
    'calculator' | 'quotes' | 'orders' | 'bills' | 'opening-stock' | 'profile-stocks' | 'sales-estimates' | 'sales-invoices' | 'sales-payments' | 'customer-analytics' | 'vendor-analytics' | 'party-ledgers' | 'outstanding-ageing' | 'sales-monthly' | 'sales-annual' | 'purchase-overall' | 'estimate-pipeline' | 'templates' | 'receipts' | 'inwards' | 'couriers' | 'analytics' | 'vendors' | 'estimates' | 'profiles' | 'locations'
  >('calculator')

  // Master States
  const [loading, setLoading] = useState(true)
  const [masters, setMasters] = useState<{
    tokenCompanies: any[]
    tokenProducts: any[]
    tokenVersions: any[]
    countries: any[]
    states: any[]
  }>({
    tokenCompanies: [],
    tokenProducts: [],
    tokenVersions: [],
    countries: [],
    states: []
  })

  // Data collections
  const [parties, setParties] = useState<any[]>([])
  const [quotes, setQuotes] = useState<any[]>([])
  const [estimates, setEstimates] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [purchaseReceipts, setPurchaseReceipts] = useState<any[]>([])
  const [courierInwards, setCourierInwards] = useState<any[]>([])
  const [couriers, setCouriers] = useState<any[]>([])
  const [courierAnalytics, setCourierAnalytics] = useState<any | null>(null)

  // Purchase Bills & Stock Ledgers
  const [purchaseBills, setPurchaseBills] = useState<any[]>([])
  const [openingStockList, setOpeningStockList] = useState<any[]>([])
  const [profileStockList, setProfileStockList] = useState<any[]>([])
  const [showBillModal, setShowBillModal] = useState(false)
  const [billForm, setBillForm] = useState<any>({
    company_profile_id: '',
    vendor_party_id: '',
    purchase_order_id: '',
    courier_dispatch_id: '',
    freight_amount: 0,
    voucher_number: '',
    supplier_invoice_number: '',
    accounting_date: new Date().toISOString().slice(0, 10),
    supplier_invoice_date: new Date().toISOString().slice(0, 10),
    other_charges: 0,
    notes: '',
    items: [
      {
        token_model_id: 'tm-1',
        description: 'Cryptographic USB Token',
        quantity: 10,
        unit_rate: 100,
        gst_rate: 18,
        other_charges: 0
      }
    ]
  })
  const [showOpeningStockModal, setShowOpeningStockModal] = useState(false)
  const [openingStockForm, setOpeningStockForm] = useState<any>({
    company_profile_id: '',
    token_model_id: 'tm-1',
    opening_date: new Date().toISOString().slice(0, 10),
    item_description: 'Cryptographic USB Token',
    quantity: 100,
    purchase_rate: 250,
    notes: ''
  })

  // Token Sales Module State
  const [salesEstimates, setSalesEstimates] = useState<any[]>([])
  const [salesInvoices, setSalesInvoices] = useState<any[]>([])
  const [salesPayments, setSalesPayments] = useState<any[]>([])
  const [customerAnalytics, setCustomerAnalytics] = useState<any | null>(null)
  const [vendorComparison, setVendorComparison] = useState<any | null>(null)
  const [vendorHistory, setVendorHistory] = useState<any | null>(null)
  const [partnersList, setPartnersList] = useState<any[]>([])

  // Modals for Sales
  const [showSalesEstModal, setShowSalesEstModal] = useState(false)
  const [salesEstForm, setSalesEstForm] = useState<any>({
    company_profile_id: '',
    customer_id: '',
    estimate_date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    notes: '',
    items: [
      {
        token_model_id: 'tm-1',
        model_name: 'EPASS2003 AUTO Cryptographic Token',
        quantity: 50,
        unit_price: 450,
        gst_rate: 18
      }
    ]
  })

  // Party Ledgers, Outstanding & Periodic Reports State
  const [ledgerPartyType, setLedgerPartyType] = useState<'VENDOR' | 'CUSTOMER'>('VENDOR')
  const [ledgerPartyId, setLedgerPartyId] = useState<string>('')
  const [ledgerProfileId, setLedgerProfileId] = useState<string>('')
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('')
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('')
  const [partyLedgerData, setPartyLedgerData] = useState<any | null>(null)
  const [isLoadingLedger, setIsLoadingLedger] = useState(false)

  const [outstandingType, setOutstandingType] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES')
  const [outstandingData, setOutstandingData] = useState<any | null>(null)
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(false)

  const [dashboardTotals, setDashboardTotals] = useState<any | null>(null)
  const [monthlySalesReport, setMonthlySalesReport] = useState<any | null>(null)
  const [annualSalesReport, setAnnualSalesReport] = useState<any | null>(null)
  const [overallPurchaseReport, setOverallPurchaseReport] = useState<any | null>(null)
  const [pendingEstimatesReport, setPendingEstimatesReport] = useState<any | null>(null)

  // Vendor Payment Modal
  const [showVendorPayModal, setShowVendorPayModal] = useState<any | null>(null)
  const [vendorPayForm, setVendorPayForm] = useState<any>({
    purchase_bill_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_mode: 'NEFT',
    transaction_reference_utr: '',
    notes: ''
  })

  // Credit Terms Modal
  const [showCreditTermsModal, setShowCreditTermsModal] = useState<any | null>(null)
  const [creditTermsForm, setCreditTermsForm] = useState<any>({
    party_id: '',
    party_type: 'VENDOR',
    credit_period_days: 0
  })

  const [showSalesInvModal, setShowSalesInvModal] = useState(false)
  const [salesInvForm, setSalesInvForm] = useState<any>({
    company_profile_id: '',
    customer_id: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    is_post_immediately: false,
    items: [
      {
        token_model_id: 'tm-1',
        model_name: 'EPASS2003 AUTO Cryptographic Token',
        quantity: 20,
        unit_price: 450,
        gst_rate: 18
      }
    ]
  })

  const [showSalesPayModal, setShowSalesPayModal] = useState<any | null>(null)
  const [salesPayForm, setSalesPayForm] = useState<any>({
    invoice_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_mode: 'NEFT',
    transaction_reference_utr: '',
    notes: ''
  })

  // Modals for Purchase Entry & Courier Inward
  const [showReceiptModal, setShowReceiptModal] = useState<any | null>(null)
  const [receiptForm, setReceiptForm] = useState<any>({
    purchase_order_id: '',
    items: [],
    notes: ''
  })
  const [showInwardModal, setShowInwardModal] = useState<any | null>(null)
  const [inwardForm, setInwardForm] = useState<any>({
    purchase_receipt_id: '',
    courier_partner_id: '',
    tracking_number: '',
    dispatch_datetime: new Date().toISOString().slice(0, 16),
    expected_delivery_datetime: '',
    courier_charge: '0',
    current_location: 'Vendor Origin Hub',
    notes: ''
  })
  const [showTrackingModal, setShowTrackingModal] = useState<any | null>(null)
  const [trackingData, setTrackingData] = useState<any | null>(null)
  const [statusUpdateForm, setStatusUpdateForm] = useState<any>({
    status: 'IN_TRANSIT',
    current_location: '',
    delay_reason: '',
    notes: ''
  })
  const [showAddCourierModal, setShowAddCourierModal] = useState(false)
  const [courierForm, setCourierForm] = useState({
    company_name: '',
    tracking_url_template: '',
    support_phone: ''
  })

  // Estimate Calculator Form
  const [calcForm, setCalcForm] = useState({
    party_id: '',
    token_company_id: '',
    token_product_id: '',
    token_version_id: '',
    quantity: '100',
    estimate_date: new Date().toISOString().slice(0, 10)
  })
  const [calcResult, setCalcResult] = useState<any | null>(null)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Modals & Active Viewers
  const [selectedPO, setSelectedPO] = useState<any | null>(null)
  const [showPOModal, setShowPOModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('Vendor price changed')
  const [cancelOtherDesc, setCancelOtherDesc] = useState('')

  // Template Master Modal & Editor
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    id: '',
    template_name: '',
    template_code: '',
    description: '',
    html_content: '',
    is_active: true,
    is_default: false,
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: ''
  })
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [templateErrors, setTemplateErrors] = useState<string[]>([])

  const [poForm, setPoForm] = useState({
    internal_profile_id: '',
    delivery_location_id: '',
    template_id: '',
    payment_terms: '100% advance against Proforma Invoice',
    delivery_terms: 'Door delivery within 5-7 working days',
    validity_terms: 'Quotation valid for 15 days from PO date',
    remarks: ''
  })

  // Load initial data
  const loadAllData = async () => {
    try {
      setLoading(true)
      const [mRes, pRes, qRes, eRes, poRes, profRes, locRes, tmplRes, recRes, inwRes, courRes, analRes, pbRes, osRes, psRes] = await Promise.all([
        fetch('/api/token-procurement/masters').then(r => r.json()),
        fetch('/api/token-procurement/parties').then(r => r.json()),
        fetch('/api/token-procurement/quotes').then(r => r.json()),
        fetch('/api/token-procurement/estimates').then(r => r.json()),
        fetch('/api/token-procurement/purchase-orders').then(r => r.json()),
        fetch('/api/token-procurement/internal-profiles').then(r => r.json()),
        fetch('/api/token-procurement/delivery-locations').then(r => r.json()),
        fetch('/api/token-procurement/templates').then(r => r.json()),
        fetch('/api/token-procurement/purchase-receipts').then(r => r.json()).catch(() => ({ receipts: [] })),
        fetch('/api/token-procurement/courier-inwards').then(r => r.json()).catch(() => ({ inwards: [] })),
        fetch('/api/token-procurement/couriers').then(r => r.json()).catch(() => ({ couriers: [] })),
        fetch('/api/token-procurement/analytics/courier-performance').then(r => r.json()).catch(() => null),
        fetch('/api/token-procurement/purchase-bills').then(r => r.json()).catch(() => ({ purchase_bills: [] })),
        fetch('/api/token-procurement/opening-stock').then(r => r.json()).catch(() => ({ opening_stock: [] })),
        fetch('/api/token-procurement/profile-stocks').then(r => r.json()).catch(() => ({ profile_stocks: [] })),
        fetch('/api/token-sales/estimates').then(r => r.json()).catch(() => ({ estimates: [] })),
        fetch('/api/token-sales/invoices').then(r => r.json()).catch(() => ({ invoices: [] })),
        fetch('/api/token-sales/payments').then(r => r.json()).catch(() => ({ payments: [] })),
        fetch('/api/token-sales/analytics/customer-history').then(r => r.json()).catch(() => null),
        fetch('/api/token-sales/analytics/vendor-comparison').then(r => r.json()).catch(() => null),
        fetch('/api/partners').then(r => r.json()).catch(() => ({ partners: [] }))
      ])

      setMasters(mRes || {})
      setParties(pRes.parties || [])
      setQuotes(qRes.quotes || [])
      setEstimates(eRes.estimates || [])
      setPurchaseOrders(poRes.purchase_orders || [])
      setProfiles(profRes.profiles || [])
      setLocations(locRes.locations || [])
      setTemplates(tmplRes.templates || [])
      setPurchaseReceipts(recRes.receipts || [])
      setCourierInwards(inwRes.inwards || [])
      setCouriers(courRes.couriers || [])
      setCourierAnalytics(analRes)
      setPurchaseBills(pbRes.purchase_bills || [])
      setOpeningStockList(osRes.opening_stock || [])
      setProfileStockList(psRes.profile_stocks || [])
      setSalesEstimates(arguments[0] || [])

      // Process additional sales & analytics responses
      fetch('/api/token-sales/estimates').then(r => r.json()).then(d => setSalesEstimates(d.estimates || [])).catch(() => {})
      fetch('/api/token-sales/invoices').then(r => r.json()).then(d => setSalesInvoices(d.invoices || [])).catch(() => {})
      fetch('/api/token-sales/payments').then(r => r.json()).then(d => setSalesPayments(d.payments || [])).catch(() => {})
      fetch('/api/token-sales/analytics/customer-history').then(r => r.json()).then(d => setCustomerAnalytics(d)).catch(() => {})
      fetch('/api/token-sales/analytics/vendor-comparison').then(r => r.json()).then(d => setVendorComparison(d)).catch(() => {})
      fetch('/api/partners').then(r => r.json()).then(d => setPartnersList(d.partners || [])).catch(() => {})

      // Fetch reports & dashboard totals
      fetch('/api/reports/dashboard-totals').then(r => r.json()).then(d => setDashboardTotals(d)).catch(() => {})
      fetch('/api/reports/outstanding?type=RECEIVABLES').then(r => r.json()).then(d => setOutstandingData(d)).catch(() => {})
      fetch('/api/reports/sales-monthly').then(r => r.json()).then(d => setMonthlySalesReport(d)).catch(() => {})
      fetch('/api/reports/sales-annual').then(r => r.json()).then(d => setAnnualSalesReport(d)).catch(() => {})
      fetch('/api/reports/purchase-overall').then(r => r.json()).then(d => setOverallPurchaseReport(d)).catch(() => {})
      fetch('/api/reports/pending-estimates').then(r => r.json()).then(d => setPendingEstimatesReport(d)).catch(() => {})

      if (pRes.parties?.length > 0 && !calcForm.party_id) {
        setCalcForm(prev => ({ ...prev, party_id: pRes.parties[0].id }))
      }
      if (profRes.profiles?.length > 0) {
        const def = profRes.profiles.find((p: any) => p.is_default) || profRes.profiles[0]
        setPoForm(prev => ({ ...prev, internal_profile_id: def.id }))
      }
      if (locRes.locations?.length > 0) {
        const def = locRes.locations.find((l: any) => l.is_default) || locRes.locations[0]
        setPoForm(prev => ({ ...prev, delivery_location_id: def.id }))
      }
      if (tmplRes.templates?.length > 0) {
        const def = tmplRes.templates.find((t: any) => t.is_default) || tmplRes.templates[0]
        setPoForm(prev => ({ ...prev, template_id: def.id }))
      }
    } catch (e) {
      console.error('Failed to load procurement data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // Handle Estimate Calculation
  const handleCalculateEstimate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCalculating(true)
    setCalcError(null)
    setCalcResult(null)

    try {
      const res = await fetch('/api/token-procurement/estimate/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calcForm)
      })
      const data = await res.json()
      if (!res.ok) {
        setCalcError(data.error || 'Failed to calculate estimate.')
      } else {
        setCalcResult(data.calculation)
      }
    } catch (err: any) {
      setCalcError(err.message || 'Error executing calculation.')
    } finally {
      setIsCalculating(false)
    }
  }

  // Save Estimate and open PO modal
  const handleSaveAndCreatePO = async () => {
    if (!calcResult) return
    try {
      const estRes = await fetch('/api/token-procurement/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_id: calcForm.party_id,
          quote_id: calcResult.quote?.id,
          token_company_id: calcForm.token_company_id,
          token_product_id: calcForm.token_product_id,
          token_version_id: calcForm.token_version_id,
          quantity: calcResult.quantity,
          estimate_date: calcResult.estimate_date,
          calculation: calcResult
        })
      })
      const estData = await estRes.json()
      if (!estRes.ok) {
        alert(estData.error || 'Failed to save estimate')
        return
      }

      setShowPOModal(true)
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Confirm PO Creation (Initial Status: DRAFT)
  const handleConfirmCreatePO = async () => {
    if (!calcResult) return
    try {
      const res = await fetch('/api/token-procurement/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internal_profile_id: poForm.internal_profile_id,
          party_id: calcForm.party_id,
          delivery_location_id: poForm.delivery_location_id,
          template_id: poForm.template_id || null,
          payment_terms: poForm.payment_terms,
          delivery_terms: poForm.delivery_terms,
          validity_terms: poForm.validity_terms,
          remarks: poForm.remarks,
          items: [
            {
              token_company_id: calcForm.token_company_id,
              token_product_id: calcForm.token_product_id,
              token_version_id: calcForm.token_version_id,
              description: `Cryptographic USB Token (${calcResult.quantity} units)`,
              quantity: calcResult.quantity,
              unit_rate: calcResult.unit_rate,
              gst_percentage: calcResult.gst_percentage,
              other_charges: calcResult.other_charges
            }
          ]
        })
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to create PO')
      } else {
        setShowPOModal(false)
        setActiveTab('orders')
        loadAllData()
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // DIRECT PO ISSUE (NO APPROVAL WORKFLOW - DRAFT -> ISSUED)
  const handleDirectIssuePO = async (poId: string) => {
    if (!confirm('Are you sure you want to directly ISSUE this Purchase Order to the vendor? This will create an immutable historical snapshot.')) return
    try {
      const res = await fetch(`/api/token-procurement/purchase-orders/${poId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to issue Purchase Order.')
      } else {
        alert(data.message)
        loadAllData()
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // PO Cancellation
  const handleConfirmCancelPO = async () => {
    if (!showCancelModal) return
    try {
      const res = await fetch(`/api/token-procurement/purchase-orders/${showCancelModal}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          reason_description: cancelOtherDesc
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to cancel PO')
      } else {
        setShowCancelModal(null)
        loadAllData()
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Template Preview
  const handlePreviewTemplate = async () => {
    setTemplateErrors([])
    try {
      const res = await fetch('/api/token-procurement/templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_content: templateForm.html_content })
      })
      const data = await res.json()
      if (!res.ok) {
        setTemplateErrors(data.errors || [data.error])
      } else {
        setPreviewHtml(data.renderedHtml)
      }
    } catch (e: any) {
      setTemplateErrors([e.message])
    }
  }

  // Template Save
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setTemplateErrors([])
    try {
      const url = templateForm.id
        ? `/api/token-procurement/templates/${templateForm.id}`
        : '/api/token-procurement/templates'
      const method = templateForm.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm)
      })
      const data = await res.json()
      if (!res.ok) {
        setTemplateErrors(data.errors || [data.error])
      } else {
        setShowTemplateModal(false)
        loadAllData()
      }
    } catch (e: any) {
      setTemplateErrors([e.message])
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* Module Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Token Procurement & Purchase Orders</h1>
              <p className="text-sm text-slate-400">
                HTML Template Engine, Direct Issue, Statutory A4 Printable Layout & Multi-Tenant Procurement
              </p>
            </div>
          </div>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setTemplateForm({
                id: '',
                template_name: '',
                template_code: '',
                description: '',
                html_content: '',
                is_active: true,
                is_default: false,
                effective_from: new Date().toISOString().slice(0, 10),
                effective_to: ''
              })
              setPreviewHtml(null)
              setShowTemplateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" /> New PO Template
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'calculator', label: 'Estimate Calculator', icon: Calculator },
          { id: 'quotes', label: 'Vendor Quotes', icon: FileSpreadsheet, badge: quotes.length },
          { id: 'orders', label: 'Purchase Orders', icon: FileText, badge: purchaseOrders.length },
          { id: 'bills', label: 'Purchase Bills', icon: ShoppingBag, badge: purchaseBills.length },
          { id: 'opening-stock', label: 'Opening Stock', icon: CheckCircle2, badge: openingStockList.length },
          { id: 'profile-stocks', label: 'Profile Stock Ledger', icon: ShieldCheck, badge: profileStockList.length },
          { id: 'sales-estimates', label: 'Sales Estimates', icon: FileText },
          { id: 'sales-invoices', label: 'Sales Invoices', icon: ShoppingBag },
          { id: 'sales-payments', label: 'Customer Payments', icon: CheckCircle2 },
          { id: 'party-ledgers', label: 'Party Ledgers', icon: FileText },
          { id: 'outstanding-ageing', label: 'Outstanding & Ageing', icon: AlertCircle },
          { id: 'sales-monthly', label: 'Monthly Sales (FY)', icon: FileSpreadsheet },
          { id: 'sales-annual', label: 'Annual Sales (FY)', icon: ShieldCheck },
          { id: 'purchase-overall', label: 'Procurement Report', icon: ShoppingBag },
          { id: 'estimate-pipeline', label: 'Estimate Pipeline', icon: Calculator },
          { id: 'customer-analytics', label: 'Customer Profit Analytics', icon: ShieldCheck },
          { id: 'vendor-analytics', label: 'Vendor Landed Cost Comparison', icon: Calculator },
          { id: 'receipts', label: 'Purchase Entries', icon: ShoppingBag, badge: purchaseReceipts.length },
          { id: 'inwards', label: 'Freight / Courier Inward', icon: Truck, badge: courierInwards.length },
          { id: 'couriers', label: 'Courier Masters', icon: Building2, badge: couriers.length },
          { id: 'analytics', label: 'Courier Performance', icon: CheckCircle2 },
          { id: 'templates', label: 'PO HTML Templates', icon: FileCode2, badge: templates.length },
          { id: 'vendors', label: 'Vendors / Suppliers', icon: Building2, badge: parties.length },
          { id: 'estimates', label: 'Saved Estimates', icon: CheckCircle2, badge: estimates.length },
          { id: 'profiles', label: 'Our Internal Profiles', icon: ShieldCheck, badge: profiles.length },
          { id: 'locations', label: 'Delivery Hubs', icon: Truck, badge: locations.length },
        ].map(t => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.badge !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT 1: ESTIMATE CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-400" />
              Configure Token Purchase Request
            </h2>

            <form onSubmit={handleCalculateEstimate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Vendor / Supplier *
                </label>
                <select
                  value={calcForm.party_id}
                  onChange={e => setCalcForm({ ...calcForm, party_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Choose Vendor --</option>
                  {parties.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.party_name} ({p.city || 'India'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Token Company
                  </label>
                  <select
                    value={calcForm.token_company_id}
                    onChange={e => setCalcForm({ ...calcForm, token_company_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">All Companies</option>
                    {masters.tokenCompanies.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Token Product
                  </label>
                  <select
                    value={calcForm.token_product_id}
                    onChange={e => setCalcForm({ ...calcForm, token_product_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="">All Products</option>
                    {masters.tokenProducts
                      .filter(p => !calcForm.token_company_id || p.company_id === calcForm.token_company_id)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.product_name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Purchase Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={calcForm.quantity}
                    onChange={e => setCalcForm({ ...calcForm, quantity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Estimate Date *
                  </label>
                  <input
                    type="date"
                    value={calcForm.estimate_date}
                    onChange={e => setCalcForm({ ...calcForm, estimate_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCalculating}
                className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                {isCalculating ? 'Computing Active Rate Slabs...' : 'Calculate Estimate'}
              </button>
            </form>

            {calcError && (
              <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <div className="font-semibold">No Matching Rate Slab</div>
                  <div className="text-xs text-rose-300/80 mt-0.5">{calcError}</div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {calcResult ? (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                      Automated Quote Match Found
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">
                      {calcResult.vendor?.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Applied Quote: <span className="text-slate-200 font-mono">{calcResult.quote?.quote_number}</span> (Valid {calcResult.quote?.valid_from} to {calcResult.quote?.valid_to || 'Ongoing'})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Applicable Slab</span>
                    <div className="text-sm font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                      {calcResult.slab?.label} tokens
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-700/50 space-y-3">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Base Unit Rate</span>
                    <span className="font-mono font-medium">₹{Number(calcResult.unit_rate).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Quantity</span>
                    <span className="font-mono font-medium">{calcResult.quantity} units</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-white border-t border-slate-800 pt-2">
                    <span>Taxable Base Amount</span>
                    <span className="font-mono font-semibold">₹{Number(calcResult.base_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>GST ({calcResult.gst_percentage}%)</span>
                    <span className="font-mono">₹{Number(calcResult.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-emerald-400 border-t border-slate-700 pt-3">
                    <span>Estimated Grand Total</span>
                    <span className="font-mono">₹{Number(calcResult.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleSaveAndCreatePO}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Create Purchase Order from Estimate
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <Calculator className="w-12 h-12 mb-3 text-slate-600" />
                <div className="font-medium text-slate-400">Estimate Calculator Ready</div>
                <div className="text-xs max-w-sm mt-1 text-slate-500">
                  Select a vendor, token model, and quantity to automatically retrieve the active rate slab and preview the statutory Indian PO cost.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PURCHASE ORDERS (DIRECT ISSUE & CANCEL) */}
      {activeTab === 'orders' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Purchase Orders Register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">PO Number</th>
                  <th className="p-3.5">PO Date</th>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5">Purchasing Entity</th>
                  <th className="p-3.5">Delivery Hub</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseOrders.map(po => (
                  <tr key={po.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono font-medium text-blue-400">{po.po_number}</td>
                    <td className="p-3.5 text-xs text-slate-400">{po.po_date}</td>
                    <td className="p-3.5 text-slate-200">{po.current_party_name || po.vendor_snapshot?.party_name}</td>
                    <td className="p-3.5 text-xs text-slate-300">{po.current_profile_name || po.internal_profile_snapshot?.legal_name}</td>
                    <td className="p-3.5 text-xs text-slate-400">{po.current_location_name || po.delivery_location_snapshot?.location_name}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-white">
                      ₹{Number(po.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        po.status === 'ISSUED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        po.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <a
                        href={`/api/token-procurement/purchase-orders/${po.id}/render-html`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      >
                        <Printer className="w-3 h-3" /> A4 Print
                      </a>
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => handleDirectIssuePO(po.id)}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded text-xs transition font-semibold"
                        >
                          Direct Issue
                        </button>
                      )}
                      {(po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          onClick={() => {
                            const defProf = profiles.find((p: any) => p.id === po.internal_profile_id) || profiles[0]
                            setBillForm({
                              company_profile_id: defProf?.id || '',
                              vendor_party_id: po.party_id,
                              purchase_order_id: po.id,
                              voucher_number: '',
                              supplier_invoice_number: `INV-${po.po_number.split('/').pop()}`,
                              accounting_date: new Date().toISOString().slice(0, 10),
                              supplier_invoice_date: new Date().toISOString().slice(0, 10),
                              other_charges: 0,
                              notes: `Created against PO: ${po.po_number}`,
                              items: [
                                {
                                  token_model_id: 'tm-1',
                                  description: `Cryptographic USB Token (Ref: ${po.po_number})`,
                                  quantity: 10,
                                  unit_rate: Number((po.subtotal / 10).toFixed(2)) || 100,
                                  gst_rate: 18,
                                  other_charges: 0
                                }
                              ]
                            })
                            setShowBillModal(true)
                          }}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition font-semibold shadow-sm"
                        >
                          + Create Purchase Bill
                        </button>
                      )}
                      {(po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/token-procurement/purchase-orders/${po.id}`).then(r => r.json())
                            const poDetail = res.purchase_order || po
                            setReceiptForm({
                              purchase_order_id: po.id,
                              po_number: po.po_number,
                              vendor_name: po.current_party_name || po.vendor_snapshot?.party_name,
                              items: (poDetail.items || []).map((it: any) => ({
                                purchase_order_item_id: it.id,
                                description: it.description || `${it.token_snapshot?.company || 'Token'} ${it.token_snapshot?.product || ''}`,
                                quantity_ordered: it.quantity,
                                quantity_received: it.quantity,
                                unit_rate: it.unit_rate,
                                gst_percentage: it.gst_percentage || 18
                              })),
                              notes: ''
                            })
                            setShowReceiptModal(poDetail)
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition font-semibold shadow-sm"
                        >
                          Record Purchase
                        </button>
                      )}
                      {po.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            setShowCancelModal(po.id)
                            setCancelReason('Vendor price changed')
                            setCancelOtherDesc('')
                          }}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded text-xs transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PURCHASE BILLS */}
      {activeTab === 'bills' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Purchase Bills (Supplier Invoices)</h3>
              <p className="text-xs text-slate-400">Accounted vendor purchase bills with dual dates, profile ledger & automatic stock posting.</p>
            </div>
            <button
              onClick={() => {
                const defProf = profiles.find((p: any) => p.is_default) || profiles[0]
                const defVen = parties[0]
                setBillForm({
                  company_profile_id: defProf?.id || '',
                  vendor_party_id: defVen?.id || '',
                  purchase_order_id: '',
                  voucher_number: '',
                  supplier_invoice_number: '',
                  accounting_date: new Date().toISOString().slice(0, 10),
                  supplier_invoice_date: new Date().toISOString().slice(0, 10),
                  other_charges: 0,
                  notes: '',
                  items: [
                    {
                      token_model_id: 'tm-1',
                      description: 'EPASS2003 AUTO Cryptographic Token',
                      quantity: 10,
                      unit_rate: 100,
                      gst_rate: 18,
                      other_charges: 0
                    }
                  ]
                })
                setShowBillModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> + New Purchase Bill
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Voucher #</th>
                  <th className="p-3.5">Supplier Inv #</th>
                  <th className="p-3.5">Accounting Date</th>
                  <th className="p-3.5">Inv Date</th>
                  <th className="p-3.5">Vendor</th>
                  <th className="p-3.5">Company Profile</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No purchase bills recorded yet. Click &quot;+ New Purchase Bill&quot; or issue one directly from an issued PO.
                    </td>
                  </tr>
                ) : (
                  purchaseBills.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-blue-400">{b.voucher_number}</td>
                      <td className="p-3.5 font-mono font-semibold text-white">{b.supplier_invoice_number}</td>
                      <td className="p-3.5 text-xs text-slate-300">{b.accounting_date}</td>
                      <td className="p-3.5 text-xs text-slate-400">{b.supplier_invoice_date}</td>
                      <td className="p-3.5 text-slate-200">{b.vendor_name || 'Vendor'}</td>
                      <td className="p-3.5 text-xs text-blue-300 font-medium">{b.company_name || 'D-BIZ CONSULTANCY'}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold">₹{Number(b.grand_total).toFixed(2)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          b.status === 'POSTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          b.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {b.status === 'DRAFT' && (
                          <button
                            onClick={async () => {
                              if (confirm(`Post & account Purchase Bill ${b.voucher_number}? This will automatically increase inventory stock in ${b.company_name || 'Company Profile'}.`)) {
                                const res = await fetch(`/api/token-procurement/purchase-bills/${b.id}/post`, {
                                  method: 'POST'
                                }).then(r => r.json())
                                if (res.success) {
                                  alert(`Purchase Bill ${b.voucher_number} POSTED successfully! Stock increased.`)
                                  loadAllData()
                                } else {
                                  alert(res.error || 'Failed to post bill.')
                                }
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
                          >
                            Post / Account
                          </button>
                        )}
                        <span className="text-xs text-slate-500">
                          {b.status === 'POSTED' ? `Accounted` : 'Draft'}
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

      {/* TAB CONTENT: OPENING STOCK */}
      {activeTab === 'opening-stock' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Opening Stock Master Position</h3>
              <p className="text-xs text-slate-400">Independent opening inventory position by Company Profile & Token Model without creating payables.</p>
            </div>
            <button
              onClick={() => {
                const defProf = profiles.find((p: any) => p.is_default) || profiles[0]
                setOpeningStockForm({
                  company_profile_id: defProf?.id || '',
                  token_model_id: 'tm-1',
                  opening_date: new Date().toISOString().slice(0, 10),
                  item_description: 'EPASS2003 AUTO Cryptographic Token',
                  quantity: 100,
                  purchase_rate: 250,
                  notes: 'Initial FY opening stock position'
                })
                setShowOpeningStockModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> + Record Opening Stock
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Opening Date</th>
                  <th className="p-3.5">Company Profile</th>
                  <th className="p-3.5">Token Model / Description</th>
                  <th className="p-3.5 text-center">Quantity</th>
                  <th className="p-3.5 text-right">Purchase Rate</th>
                  <th className="p-3.5 text-right">Total Valuation</th>
                  <th className="p-3.5">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {openingStockList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No opening stock records found. Click &quot;+ Record Opening Stock&quot; to establish an opening balance.
                    </td>
                  </tr>
                ) : (
                  openingStockList.map(os => (
                    <tr key={os.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-slate-300">{os.opening_date}</td>
                      <td className="p-3.5 text-blue-300 font-semibold">{os.company_name || 'D-BIZ CONSULTANCY'}</td>
                      <td className="p-3.5 text-white">{os.item_description || os.model_name}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-amber-400">{os.quantity}</td>
                      <td className="p-3.5 text-right font-mono">₹{Number(os.purchase_rate).toFixed(2)}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold">₹{Number(os.total_valuation).toFixed(2)}</td>
                      <td className="p-3.5 text-xs text-slate-400">{new Date(os.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PROFILE STOCK LEDGER */}
      {activeTab === 'profile-stocks' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Profile-Specific Stock Ledger</h3>
              <p className="text-xs text-slate-400">Real-time inventory on hand, opening, and purchased quantities strictly segregated by Company Profile.</p>
            </div>
            <button
              onClick={() => loadAllData()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
            >
              Refresh Stock
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Company Profile</th>
                  <th className="p-3.5">Token Model</th>
                  <th className="p-3.5 text-center">Opening Qty</th>
                  <th className="p-3.5 text-center">Purchased Qty</th>
                  <th className="p-3.5 text-center">Issued Qty</th>
                  <th className="p-3.5 text-center font-bold">Qty On Hand</th>
                  <th className="p-3.5 text-right">Last Purchase Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {profileStockList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No stock positions active yet. Post a Purchase Bill or record Opening Stock.
                    </td>
                  </tr>
                ) : (
                  profileStockList.map(ps => (
                    <tr key={ps.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 text-blue-300 font-semibold">{ps.company_name}</td>
                      <td className="p-3.5 text-white font-medium">{ps.model_name}</td>
                      <td className="p-3.5 text-center font-mono text-slate-400">{ps.opening_quantity}</td>
                      <td className="p-3.5 text-center font-mono text-emerald-400 font-semibold">+{ps.purchased_quantity}</td>
                      <td className="p-3.5 text-center font-mono text-rose-400">-{ps.issued_quantity}</td>
                      <td className="p-3.5 text-center font-mono text-lg font-bold text-white bg-slate-900/40">{ps.quantity_on_hand}</td>
                      <td className="p-3.5 text-right font-mono text-slate-200">
                        {ps.last_purchase_rate ? `₹${Number(ps.last_purchase_rate).toFixed(2)}` : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PURCHASE RECEIPTS (PURCHASE ENTRIES) */}
      {activeTab === 'receipts' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Purchase / Procurement Entries (GRN)</h3>
              <p className="text-xs text-slate-400">Track recorded token receipts linked to issued purchase orders.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">PO Number</th>
                  <th className="p-3.5">Purchase Date-Time</th>
                  <th className="p-3.5">Vendor / Supplier</th>
                  <th className="p-3.5 text-right">Taxable</th>
                  <th className="p-3.5 text-right">GST</th>
                  <th className="p-3.5 text-right">Total</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No purchase entries recorded yet. Open an ISSUED Purchase Order and click &quot;Record Purchase&quot;.
                    </td>
                  </tr>
                ) : (
                  purchaseReceipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-emerald-400">{rec.purchase_receipt_number}</td>
                      <td className="p-3.5 font-mono text-xs text-blue-400">{rec.po_number}</td>
                      <td className="p-3.5 text-xs text-slate-400">
                        {new Date(rec.purchase_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="p-3.5 text-slate-200">{rec.vendor_name || rec.vendor_snapshot?.party_name}</td>
                      <td className="p-3.5 text-right font-mono text-slate-300">₹{Number(rec.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-right font-mono text-slate-400">₹{Number(rec.gst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-white">₹{Number(rec.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {rec.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setInwardForm({
                              purchase_receipt_id: rec.id,
                              receipt_number: rec.purchase_receipt_number,
                              po_number: rec.po_number,
                              courier_partner_id: couriers[0]?.id || '',
                              tracking_number: '',
                              dispatch_datetime: new Date().toISOString().slice(0, 16),
                              expected_delivery_datetime: '',
                              courier_charge: '350',
                              current_location: 'Vendor Origin Warehouse',
                              notes: ''
                            })
                            setShowInwardModal(rec)
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition font-semibold"
                        >
                          Create Freight Inward
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: FREIGHT / COURIER INWARD */}
      {activeTab === 'inwards' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Freight / Courier Inward & Tracking</h3>
              <p className="text-xs text-slate-400">Consignment dispatch, transit updates, and real-time inward delivery tracking.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Inward #</th>
                  <th className="p-3.5">Tracking / AWB</th>
                  <th className="p-3.5">Courier Carrier</th>
                  <th className="p-3.5">PO / Receipt</th>
                  <th className="p-3.5">Current Location</th>
                  <th className="p-3.5">Freight Charge</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {courierInwards.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No freight inward shipments created yet. Go to &quot;Purchase Entries&quot; and click &quot;Create Freight Inward&quot;.
                    </td>
                  </tr>
                ) : (
                  courierInwards.map(inw => (
                    <tr key={inw.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-medium text-blue-400">{inw.dispatch_number}</td>
                      <td className="p-3.5 font-mono font-semibold text-white">
                        {inw.tracking_number || inw.awb_number}
                      </td>
                      <td className="p-3.5 text-slate-200">{inw.courier_name || inw.carrier_name}</td>
                      <td className="p-3.5 text-xs text-slate-400">
                        {inw.po_number} <br />
                        <span className="text-slate-500">{inw.purchase_receipt_number}</span>
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">{inw.current_location || 'Hub'}</td>
                      <td className="p-3.5 font-mono text-slate-300">₹{Number(inw.courier_charge || 0).toFixed(2)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          inw.current_status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          inw.current_status === 'DELAYED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inw.current_status || inw.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/token-procurement/courier-inwards/${inw.id}/tracking`).then(r => r.json())
                            setTrackingData(res)
                            setShowTrackingModal(inw)
                            setStatusUpdateForm({
                              status: inw.current_status === 'DISPATCHED' ? 'IN_TRANSIT' : 'OUT_FOR_DELIVERY',
                              current_location: inw.current_location || '',
                              delay_reason: '',
                              notes: ''
                            })
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                        >
                          Timeline & Tracking
                        </button>
                        {inw.current_status !== 'DELIVERED' && (
                          <button
                            onClick={async () => {
                              if (confirm(`Confirm actual physical delivery of consignment ${inw.tracking_number}?`)) {
                                await fetch(`/api/token-procurement/courier-inwards/${inw.id}/deliver`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ actual_delivery_datetime: new Date().toISOString() })
                                })
                                loadAllData()
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition font-semibold"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COURIER MASTERS */}
      {activeTab === 'couriers' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Courier Partners Master</h3>
              <p className="text-xs text-slate-400">Integrated courier & cargo logistics partners for token consignments.</p>
            </div>
            <button
              onClick={() => {
                setCourierForm({ company_name: '', tracking_url_template: '', support_phone: '' })
                setShowAddCourierModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> + Add Courier Company
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Company Name</th>
                  <th className="p-3.5">Tracking URL Template</th>
                  <th className="p-3.5">Support Phone</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {couriers.map(cp => (
                  <tr key={cp.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-semibold text-white">{cp.company_name}</td>
                    <td className="p-3.5 font-mono text-xs text-blue-400">{cp.tracking_url_template || 'N/A'}</td>
                    <td className="p-3.5 text-xs text-slate-400">{cp.support_phone || 'N/A'}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {cp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COURIER PERFORMANCE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-2">Courier Performance & Destination Recommendation</h3>
            <p className="text-xs text-slate-400 mb-6">
              Precision turnaround analytics based on actual historical consignment events (Dispatch &rarr; Delivery).
            </p>

            {courierAnalytics?.destination_recommendation?.has_data ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Recommended Carrier</span>
                <h4 className="text-lg font-bold text-white mt-1">
                  {courierAnalytics.destination_recommendation.recommended_courier?.courier_name}
                </h4>
                <p className="text-xs text-emerald-200 mt-1">
                  {courierAnalytics.destination_recommendation.details}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-900/60 border border-slate-700/60 rounded-xl mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-slate-300">
                  {courierAnalytics?.destination_recommendation?.message || 'Insufficient historical data for automatic destination recommendation.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(courierAnalytics?.courier_performance || []).map((cp: any) => (
                <div key={cp.courier_id} className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-semibold text-white text-sm">{cp.courier_name}</span>
                    <span className="text-xs font-mono text-emerald-400">{cp.delivery_success_rate}% Success</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total Consignments:</span>
                    <span className="font-mono text-white">{cp.total_shipments}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Average Transit Time:</span>
                    <span className="font-mono text-white">{cp.avg_transit_days} days</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Average Delay:</span>
                    <span className="font-mono text-amber-400">{cp.avg_delay_hours} hrs</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Return Rate:</span>
                    <span className="font-mono text-rose-400">{cp.return_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SALES ESTIMATES */}
      {activeTab === 'sales-estimates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <div>
              <h2 className="text-lg font-semibold text-white">Token Sales Estimates</h2>
              <p className="text-xs text-slate-400">Create quotes for customers. Stock is NOT deducted on Estimate creation or approval.</p>
            </div>
            <button
              onClick={() => setShowSalesEstModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Create Sales Estimate
            </button>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Estimate #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Total Amount</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {salesEstimates.map(est => (
                  <tr key={est.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-white">{est.estimate_number}</td>
                    <td className="p-3.5 text-xs text-slate-400">{est.estimate_date}</td>
                    <td className="p-3.5 text-slate-200">{est.customer_snapshot?.company_name || est.customer_id}</td>
                    <td className="p-3.5 font-mono text-emerald-400">₹{Number(est.grand_total).toFixed(2)}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        est.status === 'CONVERTED' ? 'bg-purple-500/20 text-purple-400' :
                        est.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {est.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {est.status !== 'APPROVED' && est.status !== 'CONVERTED' && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/token-sales/estimates/${est.id}/status`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'APPROVED' })
                            })
                            loadAllData()
                          }}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded text-xs"
                        >
                          Approve
                        </button>
                      )}
                      {est.status !== 'CONVERTED' && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/token-sales/estimates/${est.id}/convert-to-invoice`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({})
                            }).then(r => r.json())
                            if (res.success) {
                              alert(`Converted to Invoice ${res.invoice.invoice_number}!`)
                              loadAllData()
                              setActiveTab('sales-invoices')
                            } else {
                              alert(res.error || 'Conversion failed')
                            }
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                        >
                          Convert to Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {salesEstimates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 text-xs">No sales estimates created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SALES INVOICES */}
      {activeTab === 'sales-invoices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <div>
              <h2 className="text-lg font-semibold text-white">Token Sales Invoices</h2>
              <p className="text-xs text-slate-400">Inventory stock decreases only upon POST / confirmation. Cancelling handles series numbering reuse.</p>
            </div>
            <button
              onClick={() => setShowSalesInvModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Create Sales Invoice
            </button>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Grand Total</th>
                  <th className="p-3.5">Paid / Outstanding</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {salesInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-white">{inv.invoice_number}</td>
                    <td className="p-3.5 text-xs text-slate-400">{inv.invoice_date}</td>
                    <td className="p-3.5 text-slate-200">{inv.customer_snapshot?.company_name || inv.customer_id}</td>
                    <td className="p-3.5 font-mono text-emerald-400">₹{Number(inv.grand_total).toFixed(2)}</td>
                    <td className="p-3.5 font-mono text-xs">
                      <span className="text-emerald-400">₹{Number(inv.paid_amount || 0).toFixed(2)}</span> /{' '}
                      <span className="text-amber-400">₹{Number(inv.outstanding_balance || 0).toFixed(2)}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        inv.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                        inv.status === 'POSTED' ? 'bg-blue-500/20 text-blue-400' :
                        inv.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {inv.status === 'DRAFT' && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/token-sales/invoices/${inv.id}/post`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' }
                            }).then(r => r.json())
                            if (res.success) {
                              alert('Invoice POSTED. Inventory stock deducted!')
                              loadAllData()
                            } else {
                              alert(res.error || 'Failed to post invoice')
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                        >
                          Confirm & Post
                        </button>
                      )}
                      {inv.status !== 'CANCELLED' && inv.outstanding_balance > 0 && (
                        <button
                          onClick={() => {
                            setSalesPayForm({
                              invoice_id: inv.id,
                              payment_date: new Date().toISOString().slice(0, 10),
                              amount: inv.outstanding_balance,
                              payment_mode: 'NEFT',
                              transaction_reference_utr: '',
                              notes: ''
                            })
                            setShowSalesPayModal(inv)
                          }}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                        >
                          Record Payment
                        </button>
                      )}
                      {inv.status !== 'CANCELLED' && (
                        <button
                          onClick={async () => {
                            const reason = prompt('Enter cancellation reason:')
                            if (!reason) return
                            const res = await fetch(`/api/token-sales/invoices/${inv.id}/cancel`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ cancellation_reason: reason })
                            }).then(r => r.json())
                            if (res.success) {
                              alert(res.message)
                              loadAllData()
                            } else {
                              alert(res.error || 'Failed to cancel')
                            }
                          }}
                          className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 rounded text-xs"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {salesInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 text-xs">No sales invoices recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CUSTOMER PROFIT ANALYTICS */}
      {activeTab === 'customer-analytics' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white mb-2">Customer Purchase & Gross Profit Margin History</h2>
            <p className="text-xs text-slate-400 mb-4">
              Financial Year: Indian Standard (1 April - 31 March). Calculates gross profit using actual historical landed cost at purchase time.
            </p>
            {customerAnalytics && customerAnalytics.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-700/50">
                  <span className="text-xs text-slate-400">Total Tokens Sold</span>
                  <div className="text-2xl font-bold text-white font-mono">{customerAnalytics.summary.total_tokens_sold}</div>
                </div>
                <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-700/50">
                  <span className="text-xs text-slate-400">Total Taxable Revenue</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">₹{customerAnalytics.summary.total_taxable_revenue?.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-700/50">
                  <span className="text-xs text-slate-400">Actual Landed Cost</span>
                  <div className="text-2xl font-bold text-amber-400 font-mono">₹{customerAnalytics.summary.total_actual_landed_cost?.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-700/50">
                  <span className="text-xs text-slate-400">Gross Margin</span>
                  <div className="text-2xl font-bold text-blue-400 font-mono">{customerAnalytics.summary.overall_gross_profit_margin_pct}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: VENDOR LANDED COST COMPARISON */}
      {activeTab === 'vendor-analytics' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white mb-2">Multi-Vendor Landed Cost Comparison Engine</h2>
            <p className="text-xs text-slate-400 mb-4">
              Compares active vendor quotes and estimates inward freight based on destination state to recommend the lowest landed cost (not just nominal quote price).
            </p>
            {vendorComparison?.recommended_vendor && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl mb-4 text-xs">
                <span className="font-bold text-emerald-400 uppercase tracking-wider">Top Recommendation:</span>
                <p className="text-slate-200 mt-1">{vendorComparison.recommended_vendor.recommendation_reason}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(vendorComparison?.all_options || []).map((opt: any, idx: number) => (
                <div key={idx} className="bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-sm text-white border-b border-slate-800 pb-2">
                    <span>{opt.vendor_name}</span>
                    <span className="text-emerald-400 font-mono">₹{opt.landed_unit_cost}/unit</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Base Rate:</span> <span className="text-slate-200 font-mono">₹{opt.base_unit_rate}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Est. Inward Freight:</span> <span className="text-amber-400 font-mono">₹{opt.estimated_freight_per_unit}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Landed ({opt.quantity} qty):</span> <span className="text-emerald-400 font-bold font-mono">₹{opt.total_landed_cost?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE SALES ESTIMATE */}
      {showSalesEstModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create Token Sales Estimate</h3>
              <button onClick={() => setShowSalesEstModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/token-sales/estimates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(salesEstForm)
                }).then(r => r.json())
                if (res.success) {
                  setShowSalesEstModal(false)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to create sales estimate')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Company Profile *</label>
                <select
                  value={salesEstForm.company_profile_id}
                  onChange={(e) => setSalesEstForm({ ...salesEstForm, company_profile_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  required
                >
                  <option value="">-- Select Company Profile --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.legal_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Customer *</label>
                <select
                  value={salesEstForm.customer_id}
                  onChange={(e) => setSalesEstForm({ ...salesEstForm, customer_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  required
                >
                  <option value="">-- Select Customer --</option>
                  {partnersList.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.company_name} ({pt.gstin || 'Non-GST'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={salesEstForm.items[0]?.quantity || 1}
                    onChange={(e) => {
                      const items = [...salesEstForm.items]
                      items[0].quantity = parseInt(e.target.value, 10)
                      setSalesEstForm({ ...salesEstForm, items })
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Selling Price / Unit (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={salesEstForm.items[0]?.unit_price || 450}
                    onChange={(e) => {
                      const items = [...salesEstForm.items]
                      items[0].unit_price = parseFloat(e.target.value)
                      setSalesEstForm({ ...salesEstForm, items })
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSalesEstModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold">Save Estimate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD CUSTOMER PAYMENT */}
      {showSalesPayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Record Customer Payment</h3>
              <button onClick={() => setShowSalesPayModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/token-sales/payments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(salesPayForm)
                }).then(r => r.json())
                if (res.success) {
                  alert(`Payment recorded! Receipt: ${res.payment.receipt_number}`)
                  setShowSalesPayModal(null)
                  loadAllData()
                } else {
                  alert(res.error || 'Payment recording failed')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={salesPayForm.amount}
                  onChange={(e) => setSalesPayForm({ ...salesPayForm, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold">Payment Mode *</label>
                <select
                  value={salesPayForm.payment_mode}
                  onChange={(e) => setSalesPayForm({ ...salesPayForm, payment_mode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-semibold">Transaction Reference / UTR</label>
                <input
                  type="text"
                  value={salesPayForm.transaction_reference_utr}
                  onChange={(e) => setSalesPayForm({ ...salesPayForm, transaction_reference_utr: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                  placeholder="e.g. UTR-9876543210"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSalesPayModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold">Save & Generate Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: PARTY LEDGERS */}
      {activeTab === 'party-ledgers' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Party Ledgers & Chronological Statements
                </h2>
                <p className="text-xs text-slate-400">
                  Comprehensive vendor payables & customer receivables statements with opening balance, debit, credit & running balance.
                </p>
              </div>

              {partyLedgerData && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Statement
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-900/60 p-4 rounded-lg border border-slate-700/50 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Party Type *</label>
                <select
                  value={ledgerPartyType}
                  onChange={(e) => {
                    const t = e.target.value as any
                    setLedgerPartyType(t)
                    setLedgerPartyId('')
                    setPartyLedgerData(null)
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="VENDOR">Vendor / Purchasing Party</option>
                  <option value="CUSTOMER">Customer / Partner</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Select Party *</label>
                <select
                  value={ledgerPartyId}
                  onChange={(e) => setLedgerPartyId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="">-- Choose {ledgerPartyType === 'VENDOR' ? 'Vendor' : 'Customer'} --</option>
                  {ledgerPartyType === 'VENDOR' ? (
                    parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name} ({p.credit_period_days || 0}d credit)</option>
                    ))
                  ) : (
                    partnersList.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name} ({c.credit_period_days || 0}d credit)</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Company Profile</label>
                <select
                  value={ledgerProfileId}
                  onChange={(e) => setLedgerProfileId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="">All Profiles</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.legal_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Date Range</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-[11px]"
                  />
                  <input
                    type="date"
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={async () => {
                    if (!ledgerPartyId) {
                      alert('Please select a party first.')
                      return
                    }
                    setIsLoadingLedger(true)
                    try {
                      const params = new URLSearchParams({
                        party_type: ledgerPartyType,
                        party_id: ledgerPartyId
                      })
                      if (ledgerProfileId) params.append('company_profile_id', ledgerProfileId)
                      if (ledgerStartDate) params.append('start_date', ledgerStartDate)
                      if (ledgerEndDate) params.append('end_date', ledgerEndDate)

                      const res = await fetch(`/api/reports/party-ledger?${params.toString()}`).then(r => r.json())
                      setPartyLedgerData(res)
                    } catch (err: any) {
                      alert(err.message)
                    } finally {
                      setIsLoadingLedger(false)
                    }
                  }}
                  disabled={isLoadingLedger}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded text-xs"
                >
                  {isLoadingLedger ? 'Loading Statement...' : 'Generate Statement'}
                </button>
              </div>
            </div>
          </div>

          {/* Statement View */}
          {partyLedgerData && (
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/60 space-y-4 print:bg-white print:text-black">
              {/* Header block */}
              <div className="flex justify-between items-start border-b border-slate-700/80 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white print:text-black">
                    {partyLedgerData.party_type === 'VENDOR' ? partyLedgerData.party?.party_name : partyLedgerData.party?.company_name}
                  </h3>
                  <p className="text-xs text-slate-400 print:text-slate-600">
                    {partyLedgerData.party?.contact_person && `Contact: ${partyLedgerData.party.contact_person} | `}
                    {partyLedgerData.party?.mobile && `Phone: ${partyLedgerData.party.mobile} | `}
                    {partyLedgerData.party?.email && `Email: ${partyLedgerData.party.email}`}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-300 font-medium">Credit Period:</span>
                    <span className="px-2 py-0.5 bg-blue-950/60 border border-blue-500/40 text-blue-400 rounded text-xs font-mono font-bold">
                      {partyLedgerData.master_credit_period_days > 0 ? `${partyLedgerData.master_credit_period_days} Days` : 'Nil (0 Days)'}
                    </span>
                    <button
                      onClick={() => {
                        setCreditTermsForm({
                          party_id: partyLedgerData.party.id,
                          party_type: partyLedgerData.party_type,
                          credit_period_days: partyLedgerData.master_credit_period_days || 0
                        })
                        setShowCreditTermsModal(true)
                      }}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1 ml-2"
                    >
                      <Edit2 className="w-3 h-3" /> Edit Credit Terms
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Statement Balance</span>
                  <span className={`text-2xl font-bold font-mono ${partyLedgerData.closing_balance > 0 ? (partyLedgerData.party_type === 'VENDOR' ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-400'}`}>
                    ₹{partyLedgerData.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {partyLedgerData.party_type === 'VENDOR' ? 'Net Outstanding Payable' : 'Net Outstanding Receivable'}
                  </span>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-900/60 rounded border border-slate-700/50">
                  <span className="text-[11px] text-slate-400">Opening Balance</span>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">
                    ₹{partyLedgerData.opening_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded border border-slate-700/50">
                  <span className="text-[11px] text-slate-400">
                    {partyLedgerData.party_type === 'VENDOR' ? 'Total Billed (Liability)' : 'Total Invoiced (Receivable)'}
                  </span>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">
                    ₹{(partyLedgerData.total_billed || partyLedgerData.total_invoiced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded border border-slate-700/50">
                  <span className="text-[11px] text-slate-400">
                    {partyLedgerData.party_type === 'VENDOR' ? 'Total Paid (Settlements)' : 'Total Collected (Receipts)'}
                  </span>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                    ₹{(partyLedgerData.total_paid || partyLedgerData.total_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded border border-slate-700/50">
                  <span className="text-[11px] text-slate-400">Closing Balance</span>
                  <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                    ₹{partyLedgerData.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="overflow-x-auto rounded border border-slate-700">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Transaction</th>
                      <th className="p-3">Voucher #</th>
                      <th className="p-3">Reference / UTR</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                      <th className="p-3 text-right">Balance (₹)</th>
                      <th className="p-3 text-center">Due Date</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {partyLedgerData.statement.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-slate-500 italic">No ledger transactions found for this party.</td>
                      </tr>
                    ) : (
                      partyLedgerData.statement.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-700/30">
                          <td className="p-3 font-mono">{it.date}</td>
                          <td className="p-3 font-semibold">{it.type.replace('_', ' ')}</td>
                          <td className="p-3 font-mono font-bold text-blue-400">{it.voucher_number}</td>
                          <td className="p-3 font-mono text-slate-400">{it.reference || '-'}</td>
                          <td className="p-3 text-right font-mono font-semibold">
                            {it.debit > 0 ? `₹${it.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">
                            {it.credit > 0 ? `₹${it.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-300">
                            ₹{it.running_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center font-mono">
                            {it.credit_period_days > 0 ? (
                              <span className="text-slate-300">{it.due_date} ({it.credit_period_days}d)</span>
                            ) : (
                              <span className="text-slate-500 italic">Nil</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              it.status === 'PAID' || it.status === 'SETTLED' || it.status === 'VERIFIED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : it.status === 'OVERDUE'
                                ? 'bg-red-950 text-red-400 border border-red-500/30'
                                : it.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {it.status} {it.days_overdue > 0 && `(${it.days_overdue}d)`}
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
        </div>
      )}

      {/* TAB: OUTSTANDING & AGEING */}
      {activeTab === 'outstanding-ageing' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  Outstanding & Ageing Analysis
                </h2>
                <p className="text-xs text-slate-400">
                  Categorized receivables and payables with actual days overdue against credit terms: Not Due, 1–30, 31–60, 61–90, Above 90 Days.
                </p>
              </div>

              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={async () => {
                    setOutstandingType('RECEIVABLES')
                    setIsLoadingOutstanding(true)
                    const d = await fetch('/api/reports/outstanding?type=RECEIVABLES').then(r => r.json()).catch(() => null)
                    setOutstandingData(d)
                    setIsLoadingOutstanding(false)
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition ${outstandingType === 'RECEIVABLES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Customer Receivables
                </button>
                <button
                  onClick={async () => {
                    setOutstandingType('PAYABLES')
                    setIsLoadingOutstanding(true)
                    const d = await fetch('/api/reports/outstanding?type=PAYABLES').then(r => r.json()).catch(() => null)
                    setOutstandingData(d)
                    setIsLoadingOutstanding(false)
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition ${outstandingType === 'PAYABLES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Vendor Payables
                </button>
              </div>
            </div>

            {/* Ageing Buckets Cards */}
            {outstandingData && outstandingData.summary && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Outstanding</span>
                  <div className="text-base font-bold text-white font-mono mt-1">
                    ₹{outstandingData.summary.total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Not Due Yet</span>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-1">
                    ₹{outstandingData.summary.not_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-yellow-400 uppercase font-semibold">1–30 Days</span>
                  <div className="text-base font-bold text-yellow-400 font-mono mt-1">
                    ₹{outstandingData.summary.bucket_1_to_30.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">31–60 Days</span>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">
                    ₹{outstandingData.summary.bucket_31_to_60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-orange-400 uppercase font-semibold">61–90 Days</span>
                  <div className="text-base font-bold text-orange-400 font-mono mt-1">
                    ₹{outstandingData.summary.bucket_61_to_90.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-red-400 uppercase font-semibold">Above 90 Days</span>
                  <div className="text-base font-bold text-red-400 font-mono mt-1">
                    ₹{outstandingData.summary.bucket_above_90.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Doc #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">{outstandingType === 'RECEIVABLES' ? 'Customer' : 'Vendor'}</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-right">Outstanding</th>
                    <th className="p-3 text-center">Days Overdue</th>
                    <th className="p-3 text-center">Ageing Bucket</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {outstandingData?.items?.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-500 italic">No outstanding records. All settled!</td>
                    </tr>
                  ) : (
                    outstandingData?.items?.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="p-3 font-mono font-bold text-blue-400">{it.invoice_number || it.voucher_number}</td>
                        <td className="p-3 font-mono">{it.invoice_date || it.accounting_date}</td>
                        <td className="p-3 font-mono">
                          {it.due_date} {it.credit_period_days > 0 ? `(${it.credit_period_days}d)` : '(Nil)'}
                        </td>
                        <td className="p-3 font-semibold">{it.customer_name || it.vendor_name}</td>
                        <td className="p-3 text-right font-mono">₹{it.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-300">
                          ₹{it.outstanding_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          {it.days_overdue > 0 ? <span className="text-red-400">+{it.days_overdue}d</span> : <span className="text-emerald-400">0d</span>}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.ageing_bucket === 'Not Due' ? 'bg-emerald-950 text-emerald-400' :
                            it.ageing_bucket === '1–30 Days' ? 'bg-yellow-950 text-yellow-400' :
                            it.ageing_bucket === '31–60 Days' ? 'bg-amber-950 text-amber-400' :
                            it.ageing_bucket === '61–90 Days' ? 'bg-orange-950 text-orange-400' :
                            'bg-red-950 text-red-400'
                          }`}>
                            {it.ageing_bucket}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {outstandingType === 'RECEIVABLES' ? (
                            <button
                              onClick={() => {
                                setSalesPayForm({
                                  invoice_id: it.invoice_id,
                                  payment_date: new Date().toISOString().slice(0, 10),
                                  amount: it.outstanding_balance,
                                  payment_mode: 'NEFT',
                                  transaction_reference_utr: '',
                                  notes: ''
                                })
                                setShowSalesPayModal(it)
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold"
                            >
                              Receive Pay
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setVendorPayForm({
                                  purchase_bill_id: it.bill_id,
                                  payment_date: new Date().toISOString().slice(0, 10),
                                  amount: it.outstanding_balance,
                                  payment_mode: 'NEFT',
                                  transaction_reference_utr: '',
                                  notes: ''
                                })
                                setShowVendorPayModal(it)
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold"
                            >
                              Record Payment
                            </button>
                          )}
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

      {/* TAB: MONTHLY SALES REPORT (INDIAN FY) */}
      {activeTab === 'sales-monthly' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              Monthly Sales & Landed Gross Profit Report (Indian FY: 1 April – 31 March)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Breakdown of token quantity, taxable revenue, GST, collections, outstanding, landed cost, and gross profit.
            </p>

            {monthlySalesReport?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Tokens Sold</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {monthlySalesReport.summary.tokens_sold} units
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue (with GST)</span>
                  <div className="text-lg font-bold text-blue-400 font-mono mt-1">
                    ₹{monthlySalesReport.summary.gross_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Actual Landed Cost</span>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                    ₹{monthlySalesReport.summary.actual_landed_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Total Gross Profit ({monthlySalesReport.summary.gross_profit_margin_pct}%)</span>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    ₹{monthlySalesReport.summary.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Month</th>
                    <th className="p-3 text-center">Invoices</th>
                    <th className="p-3 text-center">Tokens Sold</th>
                    <th className="p-3 text-right">Taxable Sales (₹)</th>
                    <th className="p-3 text-right">GST (₹)</th>
                    <th className="p-3 text-right">Gross Sales (₹)</th>
                    <th className="p-3 text-right">Landed Cost (₹)</th>
                    <th className="p-3 text-right">Gross Profit (₹)</th>
                    <th className="p-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {monthlySalesReport?.monthly?.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-700/30">
                      <td className="p-3 font-semibold text-white">{m.month_name}</td>
                      <td className="p-3 text-center font-mono">{m.invoice_count}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-300">{m.tokens_sold}</td>
                      <td className="p-3 text-right font-mono">₹{m.taxable_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono">₹{m.gst_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono font-semibold">₹{m.gross_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-slate-400">₹{m.actual_landed_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{m.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-300">{m.gross_profit_margin_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ANNUAL SALES REPORT */}
      {activeTab === 'sales-annual' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Annual Multi-Year Sales Comparison (Financial Years)
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Year-over-year summary of tokens sold, revenue, landed cost, and gross profit margins.
            </p>

            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Financial Year</th>
                    <th className="p-3 text-center">Invoices</th>
                    <th className="p-3 text-center">Tokens Sold</th>
                    <th className="p-3 text-right">Taxable Sales (₹)</th>
                    <th className="p-3 text-right">Gross Sales (₹)</th>
                    <th className="p-3 text-right">Landed Cost (₹)</th>
                    <th className="p-3 text-right">Gross Profit (₹)</th>
                    <th className="p-3 text-right">Margin %</th>
                    <th className="p-3 text-right">Outstanding (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {annualSalesReport?.annual_sales?.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-500 italic">No annual data recorded.</td>
                    </tr>
                  ) : (
                    annualSalesReport?.annual_sales?.map((y: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="p-3 font-bold text-blue-400 font-mono">FY {y.financial_year}</td>
                        <td className="p-3 text-center font-mono">{y.invoice_count}</td>
                        <td className="p-3 text-center font-mono font-bold text-white">{y.tokens_sold}</td>
                        <td className="p-3 text-right font-mono">₹{y.taxable_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{y.gross_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono text-slate-400">₹{y.actual_landed_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{y.gross_profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono text-emerald-300 font-bold">{y.gross_profit_margin_pct}%</td>
                        <td className="p-3 text-right font-mono text-amber-400">₹{y.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROCUREMENT REPORT */}
      {activeTab === 'purchase-overall' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              Overall Procurement & Inward Spend Report
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Comprehensive report of purchase orders, vendor invoices, freight inward allocation, payments, and outstanding payables.
            </p>

            {overallPurchaseReport?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Procured Tokens</span>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {overallPurchaseReport.summary.total_procured_quantity} units
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Spend (with GST)</span>
                  <div className="text-lg font-bold text-blue-400 font-mono mt-1">
                    ₹{overallPurchaseReport.summary.total_procurement_spend_with_gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Freight Paid</span>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                    ₹{overallPurchaseReport.summary.total_freight_paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded border border-slate-700">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">Net Outstanding Payables</span>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-1">
                    ₹{overallPurchaseReport.summary.net_outstanding_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Voucher #</th>
                    <th className="p-3">Accounting Date</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">Company Profile</th>
                    <th className="p-3 text-center">Tokens</th>
                    <th className="p-3 text-right">Taxable (₹)</th>
                    <th className="p-3 text-right">Freight (₹)</th>
                    <th className="p-3 text-right">Total (₹)</th>
                    <th className="p-3 text-right">Paid (₹)</th>
                    <th className="p-3 text-right">Payable (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overallPurchaseReport?.bills?.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-slate-500 italic">No purchase bills recorded for this period.</td>
                    </tr>
                  ) : (
                    overallPurchaseReport?.bills?.map((b: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="p-3 font-mono font-bold text-blue-400">{b.voucher_number}</td>
                        <td className="p-3 font-mono">{b.accounting_date}</td>
                        <td className="p-3 font-semibold text-white">{b.vendor_name}</td>
                        <td className="p-3 text-slate-300">{b.company_name}</td>
                        <td className="p-3 text-center font-mono font-bold">{b.procured_quantity}</td>
                        <td className="p-3 text-right font-mono">₹{b.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono">₹{b.freight_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{b.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono text-emerald-400">₹{b.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-300">₹{b.outstanding_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ESTIMATE PIPELINE */}
      {activeTab === 'estimate-pipeline' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-blue-400" />
              Pending Sales Estimates & Pipeline Forecast
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Tracks active, unconverted estimates with expected closure dates and ageing buckets (Expected Today, Upcoming, Due for Closure, Overdue Closure).
            </p>

            {pendingEstimatesReport?.summary?.pipeline_breakdown && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-blue-950/40 rounded border border-blue-500/40">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold">Expected Today</span>
                  <div className="text-base font-bold text-white font-mono mt-1">
                    {pendingEstimatesReport.summary.pipeline_breakdown.expected_today.count} est. (₹{pendingEstimatesReport.summary.pipeline_breakdown.expected_today.value.toLocaleString('en-IN')})
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/40 rounded border border-emerald-500/40">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">Upcoming</span>
                  <div className="text-base font-bold text-emerald-300 font-mono mt-1">
                    {pendingEstimatesReport.summary.pipeline_breakdown.upcoming.count} est. (₹{pendingEstimatesReport.summary.pipeline_breakdown.upcoming.value.toLocaleString('en-IN')})
                  </div>
                </div>

                <div className="p-3 bg-yellow-950/40 rounded border border-yellow-500/40">
                  <span className="text-[10px] text-yellow-400 uppercase font-semibold">Due for Closure</span>
                  <div className="text-base font-bold text-yellow-300 font-mono mt-1">
                    {pendingEstimatesReport.summary.pipeline_breakdown.due_for_closure.count} est. (₹{pendingEstimatesReport.summary.pipeline_breakdown.due_for_closure.value.toLocaleString('en-IN')})
                  </div>
                </div>

                <div className="p-3 bg-red-950/40 rounded border border-red-500/40">
                  <span className="text-[10px] text-red-400 uppercase font-semibold">Overdue Closure</span>
                  <div className="text-base font-bold text-red-300 font-mono mt-1">
                    {pendingEstimatesReport.summary.pipeline_breakdown.overdue_closure.count} est. (₹{pendingEstimatesReport.summary.pipeline_breakdown.overdue_closure.value.toLocaleString('en-IN')})
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded border border-slate-700">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="bg-slate-900/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Estimate #</th>
                    <th className="p-3">Estimate Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Sales Rep</th>
                    <th className="p-3 text-center">Tokens</th>
                    <th className="p-3 text-right">Value (₹)</th>
                    <th className="p-3 text-center">Expected Closure</th>
                    <th className="p-3 text-center">Days Pending</th>
                    <th className="p-3 text-center">Pipeline Category</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendingEstimatesReport?.estimates?.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-slate-500 italic">No pending estimates in the pipeline.</td>
                    </tr>
                  ) : (
                    pendingEstimatesReport?.estimates?.map((e: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="p-3 font-mono font-bold text-blue-400">{e.estimate_number}</td>
                        <td className="p-3 font-mono">{e.estimate_date}</td>
                        <td className="p-3 font-semibold text-white">{e.customer_name}</td>
                        <td className="p-3 text-slate-400">{e.assigned_to}</td>
                        <td className="p-3 text-center font-mono font-bold">{e.token_quantity}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{e.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-center font-mono font-semibold">{e.expected_closure_date}</td>
                        <td className="p-3 text-center font-mono">{e.days_pending}d</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            e.pipeline_category === 'Expected Today' ? 'bg-blue-950 text-blue-400 border border-blue-500/40' :
                            e.pipeline_category === 'Due for Closure' ? 'bg-yellow-950 text-yellow-400 border border-yellow-500/40' :
                            e.pipeline_category === 'Upcoming' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' :
                            'bg-red-950 text-red-400 border border-red-500/40'
                          }`}>
                            {e.pipeline_category}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/token-sales/estimates/${e.estimate_id}/convert-to-invoice`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({})
                              }).then(r => r.json())
                              if (res.success) {
                                alert(`Converted! Invoice: ${res.invoice.invoice_number}`)
                                loadAllData()
                              } else {
                                alert(res.error || 'Conversion failed')
                              }
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold"
                          >
                            Convert to Invoice
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

      {/* MODAL: RECORD VENDOR PAYMENT */}
      {showVendorPayModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Record Vendor Payment</h3>
              <button onClick={() => setShowVendorPayModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/reports/vendor-payments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(vendorPayForm)
                }).then(r => r.json())
                if (res.success) {
                  alert(`Vendor payment recorded! Receipt: ${res.payment.receipt_number}`)
                  setShowVendorPayModal(null)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to record payment')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={vendorPayForm.amount}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold">Payment Mode *</label>
                <select
                  value={vendorPayForm.payment_mode}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, payment_mode: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="IMPS">IMPS</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-semibold">Transaction Reference / UTR</label>
                <input
                  type="text"
                  value={vendorPayForm.transaction_reference_utr}
                  onChange={(e) => setVendorPayForm({ ...vendorPayForm, transaction_reference_utr: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                  placeholder="e.g. UTR-VEN-9876543210"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowVendorPayModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold">Save Vendor Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CREDIT TERMS */}
      {showCreditTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Configure Credit Period</h3>
              <button onClick={() => setShowCreditTermsModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/reports/parties/credit-terms', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(creditTermsForm)
                }).then(r => r.json())
                if (res.success) {
                  alert(res.message)
                  setShowCreditTermsModal(null)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to update credit terms')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold">Credit Period (Days)</label>
                <div className="grid grid-cols-4 gap-2 my-2">
                  {[0, 15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCreditTermsForm({ ...creditTermsForm, credit_period_days: d })}
                      className={`py-1.5 rounded font-mono font-bold text-xs ${creditTermsForm.credit_period_days === d ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {d === 0 ? 'Nil' : `${d}d`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  value={creditTermsForm.credit_period_days}
                  onChange={(e) => setCreditTermsForm({ ...creditTermsForm, credit_period_days: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                  placeholder="Custom days..."
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Default is 0 (Nil). Changing this master credit period will NOT alter historical invoice or bill due dates.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreditTermsModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold">Save Credit Terms</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activeTab === 'templates' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-white">Purchase Order HTML Templates</h3>
              <p className="text-xs text-slate-400">Manage organization-isolated A4 templates with dynamic placeholders.</p>
            </div>
            <button
              onClick={() => {
                setTemplateForm({
                  id: '',
                  template_name: '',
                  template_code: '',
                  description: '',
                  html_content: '',
                  is_active: true,
                  is_default: false,
                  effective_from: new Date().toISOString().slice(0, 10),
                  effective_to: ''
                })
                setPreviewHtml(null)
                setShowTemplateModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add Template
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3.5">Template Code</th>
                  <th className="p-3.5">Template Name</th>
                  <th className="p-3.5">Effective Window</th>
                  <th className="p-3.5">Default?</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {templates.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono font-medium text-white">{t.template_code}</td>
                    <td className="p-3.5 font-medium text-slate-200">{t.template_name}</td>
                    <td className="p-3.5 text-xs text-slate-400">
                      {t.effective_from} {t.effective_to ? `to ${t.effective_to}` : '(No expiry)'}
                    </td>
                    <td className="p-3.5">
                      {t.is_default ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active Default
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Secondary</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.is_active ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/token-procurement/templates/${t.id}`)
                          const data = await res.json()
                          if (data.template) {
                            setTemplateForm({
                              id: data.template.id,
                              template_name: data.template.template_name,
                              template_code: data.template.template_code,
                              description: data.template.description || '',
                              html_content: data.template.html_content,
                              is_active: data.template.is_active,
                              is_default: data.template.is_default,
                              effective_from: data.template.effective_from || '',
                              effective_to: data.template.effective_to || ''
                            })
                            setShowTemplateModal(true)
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                      >
                        Edit / View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE PO MODAL */}
      {showPOModal && calcResult && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Generate Purchase Order from Estimate
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Our Purchasing Entity *
                </label>
                <select
                  value={poForm.internal_profile_id}
                  onChange={e => setPoForm({ ...poForm, internal_profile_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.legal_name} {p.gst_registered ? `(GSTIN: ${p.gstin})` : '(Non-GST)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Delivery Location / Receiving Hub *
                </label>
                <select
                  value={poForm.delivery_location_id}
                  onChange={e => setPoForm({ ...poForm, delivery_location_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.location_name} - {l.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  PO HTML Template
                </label>
                <select
                  value={poForm.template_id}
                  onChange={e => setPoForm({ ...poForm, template_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs"
                >
                  {templates.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.template_name} ({t.template_code}) {t.is_default ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700/60 space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-slate-200">
                  <span>Vendor:</span> <span>{calcResult.vendor?.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Quantity:</span> <span>{calcResult.quantity} tokens</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold text-sm pt-1 border-t border-slate-700">
                  <span>Grand Total:</span>
                  <span>₹{Number(calcResult.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPOModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreatePO}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20"
              >
                Create PO (Draft)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PO CANCELLATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 text-rose-400">
              <Ban className="w-5 h-5" /> Cancel Purchase Order
            </h3>

            <p className="text-xs text-slate-300">
              Cancelled Purchase Orders cannot be issued or edited, and remain in the audit register permanently.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Cancellation Reason *
                </label>
                <select
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                >
                  <option value="Vendor price changed">Vendor price changed</option>
                  <option value="Incorrect quantity">Incorrect quantity</option>
                  <option value="Wrong delivery location">Wrong delivery location</option>
                  <option value="Vendor unavailable">Vendor unavailable</option>
                  <option value="Purchase no longer required">Purchase no longer required</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {cancelReason === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Please describe reason *
                  </label>
                  <textarea
                    rows={2}
                    value={cancelOtherDesc}
                    onChange={e => setCancelOtherDesc(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                    placeholder="Enter mandatory cancellation remarks..."
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Back
              </button>
              <button
                onClick={handleConfirmCancelPO}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-rose-600/20"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE EDITOR & PREVIEW MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl my-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-blue-400" />
                {templateForm.id ? 'Edit PO HTML Template' : 'Create PO HTML Template'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
                >
                  <Eye className="w-3.5 h-3.5" /> Validate & Preview
                </button>
              </div>
            </div>

            {templateErrors.length > 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs space-y-1">
                <div className="font-bold">Validation Errors:</div>
                {templateErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Template Name *</label>
                  <input
                    type="text"
                    value={templateForm.template_name}
                    onChange={e => setTemplateForm({ ...templateForm, template_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100"
                    placeholder="e.g. Standard Corporate PO (A4)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Template Code * (Unique per Org)</label>
                  <input
                    type="text"
                    disabled={!!templateForm.id}
                    value={templateForm.template_code}
                    onChange={e => setTemplateForm({ ...templateForm, template_code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono"
                    placeholder="PO_STANDARD"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={templateForm.effective_from}
                    onChange={e => setTemplateForm({ ...templateForm, effective_from: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={templateForm.effective_to}
                    onChange={e => setTemplateForm({ ...templateForm, effective_to: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.is_default}
                      onChange={e => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                    />
                    <span>Set as Default</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={templateForm.is_active}
                      onChange={e => setTemplateForm({ ...templateForm, is_active: e.target.checked })}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">HTML Content with Placeholders *</label>
                <textarea
                  rows={12}
                  value={templateForm.html_content}
                  onChange={e => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                  className="w-full bg-slate-950 font-mono text-xs text-slate-200 border border-slate-700 rounded-lg p-3"
                  placeholder="<!DOCTYPE html><html>...{{#items}}...{{/items}}</html>"
                  required
                />
              </div>

              {previewHtml && (
                <div className="border border-slate-700 rounded-lg p-3 bg-white text-slate-900 max-h-64 overflow-y-auto">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Live Preview Rendering:</div>
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: RECORD PURCHASE ENTRY */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Record Purchase / Procurement (GRN)</h3>
                <p className="text-xs text-slate-400">PO: {receiptForm.po_number} &mdash; Vendor: {receiptForm.vendor_name}</p>
              </div>
              <button onClick={() => setShowReceiptModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const res = await fetch('/api/token-procurement/purchase-receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(receiptForm)
              }).then(r => r.json())
              if (res.success) {
                setShowReceiptModal(null)
                loadAllData()
                setActiveTab('receipts')
              } else {
                alert(res.error || 'Failed to record purchase entry.')
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Received Line Items</label>
                {receiptForm.items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white">{it.description}</div>
                      <div className="text-xs text-slate-400">Ordered: {it.quantity_ordered} &bull; Rate: ₹{it.unit_rate} &bull; GST: {it.gst_percentage}%</div>
                    </div>
                    <div className="w-32">
                      <label className="text-[10px] uppercase text-slate-400">Qty Received</label>
                      <input
                        type="number"
                        min="1"
                        max={it.quantity_ordered}
                        value={it.quantity_received}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0
                          const updated = [...receiptForm.items]
                          updated[idx].quantity_received = val
                          setReceiptForm({ ...receiptForm, items: updated })
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-sm font-mono text-white text-right"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  placeholder="Consignment packaging condition, delivery remarks..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowReceiptModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">Save Purchase Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE FREIGHT / COURIER INWARD */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Create Freight / Courier Inward</h3>
                <p className="text-xs text-slate-400">Receipt: {inwardForm.receipt_number} &bull; PO: {inwardForm.po_number}</p>
              </div>
              <button onClick={() => setShowInwardModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const res = await fetch('/api/token-procurement/courier-inwards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inwardForm)
              }).then(r => r.json())
              if (res.success) {
                setShowInwardModal(null)
                loadAllData()
                setActiveTab('inwards')
              } else {
                alert(res.error || 'Failed to create freight inward.')
              }
            }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Courier Partner *</label>
                <select
                  value={inwardForm.courier_partner_id}
                  onChange={(e) => setInwardForm({ ...inwardForm, courier_partner_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  required
                >
                  <option value="">-- Select Courier Partner --</option>
                  {couriers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Tracking / Consignment Number *</label>
                <input
                  type="text"
                  value={inwardForm.tracking_number}
                  onChange={(e) => setInwardForm({ ...inwardForm, tracking_number: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono"
                  placeholder="e.g. BLU-987654321"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Dispatch Date-Time *</label>
                  <input
                    type="datetime-local"
                    value={inwardForm.dispatch_datetime}
                    onChange={(e) => setInwardForm({ ...inwardForm, dispatch_datetime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Expected Delivery</label>
                  <input
                    type="datetime-local"
                    value={inwardForm.expected_delivery_datetime}
                    onChange={(e) => setInwardForm({ ...inwardForm, expected_delivery_datetime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Freight Charge (₹)</label>
                  <input
                    type="number"
                    value={inwardForm.courier_charge}
                    onChange={(e) => setInwardForm({ ...inwardForm, courier_charge: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Initial Location</label>
                  <input
                    type="text"
                    value={inwardForm.current_location}
                    onChange={(e) => setInwardForm({ ...inwardForm, current_location: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInwardModal(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">Save Inward Shipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TIMELINE & STATUS UPDATE */}
      {showTrackingModal && trackingData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Consignment Tracking & Precision Turnaround</h3>
                <p className="text-xs text-slate-400">AWB: {trackingData.dispatch?.tracking_number} &bull; Carrier: {trackingData.dispatch?.courier_name}</p>
              </div>
              <button onClick={() => setShowTrackingModal(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            {/* Turnaround Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 text-center">
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Transit Time</div>
                <div className="text-base font-bold text-white font-mono">
                  {trackingData.turnaround?.transit_time_hours != null ? `${trackingData.turnaround.transit_time_hours} hrs` : 'In Transit'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Delay Duration</div>
                <div className="text-base font-bold text-amber-400 font-mono">
                  {trackingData.turnaround?.delay_hours != null ? `${trackingData.turnaround.delay_hours} hrs` : '0 hrs'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Total Turnaround</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {trackingData.turnaround?.total_procurement_hours != null ? `${trackingData.turnaround.total_procurement_hours} hrs` : 'Active'}
                </div>
              </div>
            </div>

            {/* Immutable Timeline Events */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Status History (Immutable Audit Trail)</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(trackingData.history || []).map((ev: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-start text-xs">
                    <div>
                      <span className="font-semibold text-white mr-2">{ev.status}</span>
                      <span className="text-slate-400">({ev.current_location || 'Hub'})</span>
                      {ev.delay_reason && <div className="text-rose-400 text-[11px] mt-0.5">Reason: {ev.delay_reason}</div>}
                      {ev.notes && <div className="text-slate-400 text-[11px] mt-0.5">{ev.notes}</div>}
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {new Date(ev.status_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Append Status Update Form */}
            {trackingData.dispatch?.current_status !== 'DELIVERED' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                const res = await fetch(`/api/token-procurement/courier-inwards/${trackingData.dispatch.id}/status-update`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(statusUpdateForm)
                }).then(r => r.json())
                if (res.success) {
                  const updatedRes = await fetch(`/api/token-procurement/courier-inwards/${trackingData.dispatch.id}/tracking`).then(r => r.json())
                  setTrackingData(updatedRes)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to update tracking.')
                }
              }} className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 space-y-3">
                <span className="text-xs font-bold text-slate-300">Add Tracking Update</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400">New Status</label>
                    <select
                      value={statusUpdateForm.status}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                    >
                      <option value="IN_TRANSIT">IN_TRANSIT</option>
                      <option value="DELAYED">DELAYED</option>
                      <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="RETURNED">RETURNED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Current Location *</label>
                    <input
                      type="text"
                      value={statusUpdateForm.current_location}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, current_location: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                      placeholder="e.g. Pune Hub / Local Delivery Hub"
                      required
                    />
                  </div>
                </div>
                {statusUpdateForm.status === 'DELAYED' && (
                  <div>
                    <label className="text-[10px] text-rose-400">Delay Reason *</label>
                    <input
                      type="text"
                      value={statusUpdateForm.delay_reason}
                      onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, delay_reason: e.target.value })}
                      className="w-full bg-slate-900 border border-rose-500/50 rounded p-1.5 text-xs text-white"
                      placeholder="Weather, vehicular breakdown, checkpost inspection..."
                      required
                    />
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">Post Status Event</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD COURIER MASTER */}
      {showAddCourierModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add Courier Partner</h3>
              <button onClick={() => setShowAddCourierModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              const res = await fetch('/api/token-procurement/couriers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(courierForm)
              }).then(r => r.json())
              if (res.success) {
                setShowAddCourierModal(false)
                loadAllData()
              } else {
                alert(res.error || 'Failed to add courier.')
              }
            }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Company Name *</label>
                <input
                  type="text"
                  value={courierForm.company_name}
                  onChange={(e) => setCourierForm({ ...courierForm, company_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  placeholder="e.g. DHL Express / FedEx"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Tracking URL Template</label>
                <input
                  type="text"
                  value={courierForm.tracking_url_template}
                  onChange={(e) => setCourierForm({ ...courierForm, tracking_url_template: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                  placeholder="https://track.carrier.com?awb={awb}"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300">Support Phone</label>
                <input
                  type="text"
                  value={courierForm.support_phone}
                  onChange={(e) => setCourierForm({ ...courierForm, support_phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  placeholder="+91 1800 000 000"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCourierModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold">Save Partner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE BILL */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Create Purchase Bill (Inward Accounting)</h3>
                <p className="text-xs text-slate-400">Account vendor invoice against mandatory internal profile with automated stock posting on post.</p>
              </div>
              <button onClick={() => setShowBillModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/token-procurement/purchase-bills', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(billForm)
                }).then(r => r.json())

                if (res.success) {
                  alert(`Purchase Bill draft created with internal voucher: ${res.purchase_bill.voucher_number}`)
                  setShowBillModal(false)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to create Purchase Bill')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company Profile (Purchasing Entity) *</label>
                  <select
                    value={billForm.company_profile_id}
                    onChange={(e) => setBillForm({ ...billForm, company_profile_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    required
                  >
                    <option value="">-- Select Legal Entity --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.legal_name} {p.gstin ? `(${p.gstin})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Vendor / Supplier *</label>
                  <select
                    value={billForm.vendor_party_id}
                    onChange={(e) => setBillForm({ ...billForm, vendor_party_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    required
                  >
                    <option value="">-- Select Vendor --</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.party_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Invoice Number *</label>
                  <input
                    type="text"
                    value={billForm.supplier_invoice_number}
                    onChange={(e) => setBillForm({ ...billForm, supplier_invoice_number: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                    placeholder="e.g. ABC/INV/2026/041"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Invoice Date *</label>
                  <input
                    type="date"
                    value={billForm.supplier_invoice_date}
                    onChange={(e) => setBillForm({ ...billForm, supplier_invoice_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Accounting / Posting Date *</label>
                  <input
                    type="date"
                    value={billForm.accounting_date}
                    onChange={(e) => setBillForm({ ...billForm, accounting_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Order Reference (Optional)</label>
                  <select
                    value={billForm.purchase_order_id}
                    onChange={(e) => setBillForm({ ...billForm, purchase_order_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  >
                    <option value="">-- No PO (Direct Bill) --</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>{po.po_number} ({po.current_party_name || 'Vendor'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Courier Dispatch / Inward Linkage</label>
                  <select
                    value={billForm.courier_dispatch_id}
                    onChange={(e) => {
                      const dispId = e.target.value
                      const selDisp = courierInwards.find(ci => ci.id === dispId)
                      setBillForm({
                        ...billForm,
                        courier_dispatch_id: dispId,
                        freight_amount: selDisp ? Number(selDisp.courier_charge || 0) : billForm.freight_amount
                      })
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  >
                    <option value="">-- No Courier Inward Linkage --</option>
                    {courierInwards.map(ci => (
                      <option key={ci.id} value={ci.id}>
                        {ci.dispatch_number || ci.awb_number} ({ci.carrier_name || 'Courier'} - ₹{ci.courier_charge || 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Inward Freight Charge (₹) — Auto-Allocated to Landed Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billForm.freight_amount}
                  onChange={(e) => setBillForm({ ...billForm, freight_amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  placeholder="0.00"
                />
              </div>

              {/* Line Items */}
              <div className="border border-slate-800 rounded-lg p-3 space-y-3 bg-slate-950/40">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill Line Items</div>
                {billForm.items.map((it: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-500">Token Model</label>
                      <select
                        value={it.token_model_id}
                        onChange={(e) => {
                          const n = [...billForm.items]
                          n[idx].token_model_id = e.target.value
                          setBillForm({ ...billForm, items: n })
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                      >
                        <option value="tm-1">EPASS2003 AUTO</option>
                        <option value="tm-2">WATCHDATA PROXKEY</option>
                        <option value="tm-3">MTOKEN CRYPTO</option>
                        <option value="tm-1793784774120">EPASS-TEST-4117</option>
                        <option value="tm-1793960313811">FEITIAN EPASS2003 PLUS</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-500">Description</label>
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => {
                          const n = [...billForm.items]
                          n[idx].description = e.target.value
                          setBillForm({ ...billForm, items: n })
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const n = [...billForm.items]
                          n[idx].quantity = e.target.value
                          setBillForm({ ...billForm, items: n })
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white font-mono"
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-500">Unit Rate (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unit_rate}
                        onChange={(e) => {
                          const n = [...billForm.items]
                          n[idx].unit_rate = e.target.value
                          setBillForm({ ...billForm, items: n })
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white font-mono"
                        required
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="text-[10px] text-slate-500">GST %</label>
                      <input
                        type="number"
                        value={it.gst_rate}
                        onChange={(e) => {
                          const n = [...billForm.items]
                          n[idx].gst_rate = e.target.value
                          setBillForm({ ...billForm, items: n })
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={billForm.notes}
                  onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  placeholder="Terms, dispatch details, reference numbers..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowBillModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-md">Save Draft Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD OPENING STOCK */}
      {showOpeningStockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Record Opening Stock Position</h3>
                <p className="text-xs text-slate-400">Establishes initial quantity and valuation per Company Profile & Token Model.</p>
              </div>
              <button onClick={() => setShowOpeningStockModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const res = await fetch('/api/token-procurement/opening-stock', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(openingStockForm)
                }).then(r => r.json())

                if (res.success) {
                  alert('Opening stock successfully recorded and ledger updated!')
                  setShowOpeningStockModal(false)
                  loadAllData()
                } else {
                  alert(res.error || 'Failed to record opening stock')
                }
              } catch (err: any) {
                alert(err.message)
              }
            }} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Company Profile *</label>
                <select
                  value={openingStockForm.company_profile_id}
                  onChange={(e) => setOpeningStockForm({ ...openingStockForm, company_profile_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  required
                >
                  <option value="">-- Select Company Profile --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.legal_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Token Model *</label>
                  <select
                    value={openingStockForm.token_model_id}
                    onChange={(e) => setOpeningStockForm({ ...openingStockForm, token_model_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                    required
                  >
                    <option value="tm-1">EPASS2003 AUTO</option>
                    <option value="tm-2">WATCHDATA PROXKEY</option>
                    <option value="tm-3">MTOKEN CRYPTO</option>
                    <option value="tm-1793784774120">EPASS-TEST-4117</option>
                    <option value="tm-1793960313811">FEITIAN EPASS2003 PLUS</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Opening Date *</label>
                  <input
                    type="date"
                    value={openingStockForm.opening_date}
                    onChange={(e) => setOpeningStockForm({ ...openingStockForm, opening_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Item Description *</label>
                <input
                  type="text"
                  value={openingStockForm.item_description}
                  onChange={(e) => setOpeningStockForm({ ...openingStockForm, item_description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={openingStockForm.quantity}
                    onChange={(e) => setOpeningStockForm({ ...openingStockForm, quantity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Purchase Rate (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingStockForm.purchase_rate}
                    onChange={(e) => setOpeningStockForm({ ...openingStockForm, purchase_rate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-800/80 rounded border border-slate-700 text-xs flex justify-between items-center">
                <span className="text-slate-400">Computed Opening Valuation:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ₹{(Number(openingStockForm.quantity || 0) * Number(openingStockForm.purchase_rate || 0)).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowOpeningStockModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-semibold shadow-sm">Save Opening Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
