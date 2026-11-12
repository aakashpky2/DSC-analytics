// Central Administrator Master Configuration & Settings (/admin/settings)
'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
  Hash,
  Layers,
  Search,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  CreditCard,
  Tag,
  AlertTriangle,
  Sliders,
  X,
  FolderTree,
} from 'lucide-react'
import { MasterNavigationTreeManager } from '@/components/MasterNavigationTreeManager'

// Master Category & Key definitions for DBIZ two-column navigation
type MasterKey =
  | 'company'
  | 'partner_types'
  | 'branches'
  | 'ca'
  | 'catalog'
  | 'token_models'
  | 'vendors'
  | 'reasons'
  | 'lead_sources'
  | 'lead_categories'
  | 'lead_statuses'
  | 'communication_channels'
  | 'services'
  | 'bank_accounts'
  | 'couriers'

interface MasterDefinition {
  key: MasterKey
  title: string
  subtitle: string
  endpoint: string
  listKey: string
  canAdd: boolean
  fields: {
    name: string
    label: string
    type: 'text' | 'number' | 'email' | 'textarea' | 'select'
    required: boolean
    editable: boolean
    order: number
    defaultValue?: any
    options?: { label: string; value: any }[]
    description?: string
  }[]
}

const MASTER_DEFINITIONS: Record<MasterKey, MasterDefinition> = {
  company: {
    key: 'company',
    title: 'Company Profile & Tax Legal Entities',
    subtitle: 'Official legal business entity details printed on invoices, challans, and compliance certificates',
    endpoint: '/api/admin/settings/company',
    listKey: 'profile',
    canAdd: false,
    fields: [
      { name: 'legal_name', label: 'Legal Business Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'trade_name', label: 'Trade / Brand Name', type: 'text', required: false, editable: true, order: 2 },
      { name: 'gstin', label: 'GSTIN Number', type: 'text', required: true, editable: true, order: 3 },
      { name: 'pan', label: 'PAN Card Number', type: 'text', required: true, editable: true, order: 4 },
      { name: 'email', label: 'Billing Official Email', type: 'email', required: true, editable: true, order: 5 },
      { name: 'phone', label: 'Official Phone Helpline', type: 'text', required: true, editable: true, order: 6 },
      { name: 'registered_address', label: 'Registered Office Address', type: 'textarea', required: true, editable: true, order: 7 },
      { name: 'state_code', label: 'State Code (GST 2-digit)', type: 'text', required: true, editable: true, order: 8 },
      { name: 'state_name', label: 'State Name', type: 'text', required: true, editable: true, order: 9 },
    ],
  },
  partner_types: {
    key: 'partner_types',
    title: 'B2B Partner Categories & Channels',
    subtitle: 'Configurable business partner tiers, distributors, stockists, and commission levels',
    endpoint: '/api/admin/masters/partner-types',
    listKey: 'partner_types',
    canAdd: true,
    fields: [
      { name: 'type_key', label: 'Category Unique Key (e.g. dsc_partner)', type: 'text', required: true, editable: true, order: 1 },
      { name: 'type_name', label: 'Category Display Title (e.g. DSC Retail Partner)', type: 'text', required: true, editable: true, order: 2 },
    ],
  },
  branches: {
    key: 'branches',
    title: 'Branch Office Locations',
    subtitle: 'Physical operational centers, inventory stock custody points, and billing branches',
    endpoint: '/api/admin/branches',
    listKey: 'branches',
    canAdd: true,
    fields: [
      { name: 'branch_name', label: 'Branch Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'branch_code', label: 'Branch Short Code', type: 'text', required: true, editable: true, order: 2 },
      { name: 'city', label: 'City', type: 'text', required: true, editable: true, order: 3 },
      { name: 'state_code', label: 'State Code (GST)', type: 'text', required: true, editable: true, order: 4 },
      { name: 'address', label: 'Full Physical Address', type: 'textarea', required: false, editable: true, order: 5 },
    ],
  },
  ca: {
    key: 'ca',
    title: 'Certifying Authorities (CAs)',
    subtitle: 'Licensed statutory DSC issuers (eMudhra, SignX, Vsign, Capricorn, etc.)',
    endpoint: '/api/admin/masters/ca',
    listKey: 'authorities',
    canAdd: true,
    fields: [
      { name: 'ca_name', label: 'Certifying Authority Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'ca_code', label: 'CA Identification Code', type: 'text', required: true, editable: true, order: 2 },
      { name: 'api_endpoint', label: 'Integration API Endpoint', type: 'text', required: false, editable: true, order: 3 },
      { name: 'support_contact', label: 'Support Email / Contact', type: 'text', required: false, editable: true, order: 4 },
    ],
  },
  catalog: {
    key: 'catalog',
    title: 'DSC Certificate Catalog & Pricing',
    subtitle: 'Digital certificate classes, validation validity periods, partner prices and MRP tiers',
    endpoint: '/api/dsc/catalog',
    listKey: 'catalog',
    canAdd: true,
    fields: [
      { name: 'product_code', label: 'Product Code', type: 'text', required: true, editable: true, order: 1 },
      { name: 'class_type', label: 'DSC Class', type: 'text', required: true, editable: true, order: 2 },
      { name: 'certificate_type', label: 'Certificate Type', type: 'text', required: true, editable: true, order: 3 },
      { name: 'validity_years', label: 'Validity (Years)', type: 'number', required: true, editable: true, order: 4 },
      { name: 'partner_price', label: 'Partner Buy Price (₹)', type: 'number', required: true, editable: true, order: 5 },
      { name: 'mrp', label: 'Customer MRP (₹)', type: 'number', required: true, editable: true, order: 6 },
    ],
  },
  token_models: {
    key: 'token_models',
    title: 'Hardware USB Token Models',
    subtitle: 'FIPS 140-2 cryptotoken specifications, cryptographic chip manufacturers, and low-stock alerts',
    endpoint: '/api/admin/settings/tokens',
    listKey: 'models',
    canAdd: true,
    fields: [
      { name: 'model_name', label: 'Token Model Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'manufacturer', label: 'Hardware Manufacturer', type: 'text', required: true, editable: true, order: 2 },
      { name: 'min_threshold', label: 'Min Alert Stock Threshold', type: 'number', required: true, editable: true, order: 3 },
      { name: 'vendor_contact', label: 'Supplier Contact Info', type: 'text', required: false, editable: true, order: 4 },
    ],
  },
  vendors: {
    key: 'vendors',
    title: 'Hardware Procurement Vendors',
    subtitle: 'Approved suppliers for bulk cryptotoken hardware stock purchases',
    endpoint: '/api/admin/masters/vendors',
    listKey: 'vendors',
    canAdd: true,
    fields: [
      { name: 'vendor_name', label: 'Vendor Legal Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'contact_person', label: 'Key Contact Person', type: 'text', required: false, editable: true, order: 2 },
      { name: 'gstin', label: 'Vendor GSTIN', type: 'text', required: false, editable: true, order: 3 },
      { name: 'email', label: 'Official Email', type: 'email', required: false, editable: true, order: 4 },
      { name: 'phone', label: 'Phone Number', type: 'text', required: false, editable: true, order: 5 },
      { name: 'address', label: 'Vendor Warehouse / Address', type: 'textarea', required: false, editable: true, order: 6 },
    ],
  },
  reasons: {
    key: 'reasons',
    title: 'Stock Adjustment & Quarantine Reasons',
    subtitle: 'Standardized compliance reasons for token write-offs, physical defects, and audit surplus',
    endpoint: '/api/admin/masters/reasons',
    listKey: 'reasons',
    canAdd: true,
    fields: [
      { name: 'reason_code', label: 'Reason Code', type: 'text', required: true, editable: true, order: 1 },
      { name: 'reason_label', label: 'Display Reason Label', type: 'text', required: true, editable: true, order: 2 },
      {
        name: 'adjustment_type',
        label: 'Adjustment Nature',
        type: 'select',
        required: true,
        editable: true,
        order: 3,
        options: [
          { label: 'Damaged / Hardware Quarantine', value: 'DAMAGE' },
          { label: 'Audit Surplus (Physical count high)', value: 'AUDIT_SURPLUS' },
          { label: 'Audit Shortage (Physical count low)', value: 'AUDIT_SHORTAGE' },
        ],
      },
    ],
  },
  lead_sources: {
    key: 'lead_sources',
    title: 'CRM Lead Acquisition Sources',
    subtitle: 'Authorized lead attribution channels for sales conversion tracking and analytics',
    endpoint: '/api/crm/lead-sources',
    listKey: 'sources',
    canAdd: true,
    fields: [{ name: 'source_name', label: 'Lead Source Channel Name', type: 'text', required: true, editable: true, order: 1 }],
  },
  lead_categories: {
    key: 'lead_categories',
    title: 'CRM Lead Categories',
    subtitle: 'Authorized business customer segments and RBAC category scope definitions (LM-16/LM-17)',
    endpoint: '/api/crm/lead-categories',
    listKey: 'categories',
    canAdd: true,
    fields: [
      { name: 'category_name', label: 'Category Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'description', label: 'Category Description', type: 'textarea', required: false, editable: true, order: 2 },
    ],
  },
  lead_statuses: {
    key: 'lead_statuses',
    title: 'CRM Lead Pipeline Statuses',
    subtitle: 'Lifecycle stages of sales pipeline from new intake to won partner conversion',
    endpoint: '/api/crm/lead-statuses',
    listKey: 'statuses',
    canAdd: false,
    fields: [
      { name: 'code', label: 'Status Code', type: 'text', required: true, editable: false, order: 1 },
      { name: 'name', label: 'Status Display Name', type: 'text', required: true, editable: true, order: 2 },
    ],
  },
  communication_channels: {
    key: 'communication_channels',
    title: 'Communication Channels',
    subtitle: 'Verified outreach and customer interaction media (Phone, WhatsApp, Email, Meetings)',
    endpoint: '/api/crm/communication-channels',
    listKey: 'channels',
    canAdd: true,
    fields: [
      { name: 'channel_name', label: 'Channel Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'channel_icon', label: 'Icon Identifier (e.g. Phone, Mail, MessageSquare)', type: 'text', required: true, editable: true, order: 2 },
    ],
  },
  services: {
    key: 'services',
    title: 'Business Compliance Services Catalog',
    subtitle: 'Corporate compliance, trademark, GST and MCA filing fee catalog',
    endpoint: '/api/admin/settings/services',
    listKey: 'services',
    canAdd: true,
    fields: [
      { name: 'service_key', label: 'Unique Service Key', type: 'text', required: true, editable: true, order: 1 },
      { name: 'service_name', label: 'Official Service Name', type: 'text', required: true, editable: true, order: 2 },
      {
        name: 'category',
        label: 'Compliance Category',
        type: 'select',
        required: true,
        editable: true,
        order: 3,
        options: [
          { label: 'Corporate Services', value: 'Corporate' },
          { label: 'Tax & GST Compliance', value: 'Taxation' },
          { label: 'Intellectual Property & Trademark', value: 'IPR' },
          { label: 'Licensing & Certification', value: 'Licensing' },
        ],
      },
      { name: 'government_fee', label: 'Government Fee (₹)', type: 'number', required: true, editable: true, order: 4 },
      { name: 'professional_fee', label: 'Professional Service Charge (₹)', type: 'number', required: true, editable: true, order: 5 },
    ],
  },
  bank_accounts: {
    key: 'bank_accounts',
    title: 'Settlement Bank & UPI Accounts',
    subtitle: 'Corporate bank accounts and UPI IDs displayed on partner invoices and settlement receipts',
    endpoint: '/api/billing/accounts',
    listKey: 'accounts',
    canAdd: true,
    fields: [
      { name: 'nickname', label: 'Account Display Nickname', type: 'text', required: true, editable: true, order: 1 },
      { name: 'bank_name', label: 'Bank Name', type: 'text', required: true, editable: true, order: 2 },
      { name: 'account_number', label: 'Bank Account Number', type: 'text', required: true, editable: true, order: 3 },
      { name: 'ifsc_code', label: 'IFSC Code', type: 'text', required: true, editable: true, order: 4 },
      { name: 'branch_name', label: 'Branch Location', type: 'text', required: false, editable: true, order: 5 },
      { name: 'upi_id', label: 'Corporate UPI ID', type: 'text', required: false, editable: true, order: 6 },
    ],
  },
  couriers: {
    key: 'couriers',
    title: 'Logistics & Courier Delivery Partners',
    subtitle: 'Authorized shipping carriers with integrated AWB tracking URL formats for physical token dispatches',
    endpoint: '/api/admin/settings/couriers',
    listKey: 'couriers',
    canAdd: true,
    fields: [
      { name: 'company_name', label: 'Courier Company Name', type: 'text', required: true, editable: true, order: 1 },
      { name: 'tracking_url_template', label: 'Tracking URL Template ({awb})', type: 'text', required: false, editable: true, order: 2 },
      { name: 'support_phone', label: 'Carrier Support Helpline', type: 'text', required: false, editable: true, order: 3 },
    ],
  },
}

// Left Navigation Category Groups
interface NavGroup {
  id: string
  title: string
  icon: any
  masters: MasterKey[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'organization',
    title: 'Business & Organization',
    icon: Building2,
    masters: ['company', 'partner_types', 'branches'],
  },
  {
    id: 'certificates',
    title: 'DSC Certificates',
    icon: ShieldCheck,
    masters: ['ca', 'catalog'],
  },
  {
    id: 'tokens',
    title: 'Hardware Tokens',
    icon: Cpu,
    masters: ['token_models', 'vendors', 'reasons'],
  },
  {
    id: 'crm',
    title: 'Customer CRM',
    icon: Tag,
    masters: ['lead_sources', 'lead_categories', 'lead_statuses', 'communication_channels'],
  },
  {
    id: 'services_group',
    title: 'Business Services',
    icon: Sparkles,
    masters: ['services'],
  },
  {
    id: 'billing_group',
    title: 'Billing & Payments',
    icon: CreditCard,
    masters: ['bank_accounts'],
  },
  {
    id: 'logistics',
    title: 'Courier & Logistics',
    icon: Truck,
    masters: ['couriers'],
  },
]

export default function AdminSettingsPage() {
  // ONLY TWO TOP-LEVEL TABS AS REQUIRED BY DBIZ APPROACH:
  // 1. CONFIGURATION
  // 2. NUMBERING
  // 3. NAVIGATION (Configurable Hierarchical Master Tree)
  const [activeTopTab, setActiveTopTab] = useState<'configuration' | 'navigation' | 'numbering'>('configuration')

  // DBIZ Configuration State
  const [selectedMasterKey, setSelectedMasterKey] = useState<MasterKey>('company')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [masterSearchQuery, setMasterSearchQuery] = useState('')
  const [showMetadataDrawer, setShowMetadataDrawer] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Standard Pagination State for Master Lists
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Master Data Stores
  const [masterData, setMasterData] = useState<Record<MasterKey, any[] | any>>({
    company: {
      legal_name: '',
      trade_name: '',
      gstin: '',
      pan: '',
      email: '',
      phone: '',
      registered_address: '',
      state_code: '27',
      state_name: 'Maharashtra',
    },
    partner_types: [],
    branches: [],
    ca: [],
    catalog: [],
    token_models: [],
    vendors: [],
    reasons: [],
    lead_sources: [],
    lead_categories: [],
    lead_statuses: [],
    communication_channels: [],
    services: [],
    bank_accounts: [],
    couriers: [],
  })

  // Numbering Configuration State (Tab 2)
  const [numberingConfigs, setNumberingConfigs] = useState<any[]>([])
  const [selectedDocType, setSelectedDocType] = useState('invoice')
  const [numForm, setNumForm] = useState({
    series_name: '',
    prefix: '',
    suffix: '',
    separator: '-',
    parts_order: ['prefix', 'fy', 'counter', 'suffix'],
    fy_format: 'YY-YY',
    counter_padding: 5,
    starting_counter: 1001,
  })
  const [livePreview, setLivePreview] = useState('')
  const [numSaving, setNumSaving] = useState(false)
  const [numSuccess, setNumSuccess] = useState('')

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Fetch Master Data
  const loadMasterData = async (key: MasterKey) => {
    const def = MASTER_DEFINITIONS[key]
    try {
      const res = await fetch(def.endpoint)
      const json = await res.json()
      if (key === 'company') {
        if (json.profile) {
          setMasterData((prev) => ({ ...prev, company: json.profile }))
        }
      } else {
        const list = json[def.listKey] || []
        setMasterData((prev) => ({ ...prev, [key]: list }))
      }
    } catch (e) {
      console.error(`Failed to load master ${key}`, e)
    }
  }

  const loadAllMasters = () => {
    Object.keys(MASTER_DEFINITIONS).forEach((k) => loadMasterData(k as MasterKey))

    // Numbering configs
    fetch('/api/admin/numbering')
      .then((r) => r.json())
      .then((d) => {
        const configs = d.configs || []
        setNumberingConfigs(configs)
        if (configs.length > 0) {
          const first = configs[0]
          setSelectedDocType(first.document_type)
          let order = ['prefix', 'fy', 'counter', 'suffix']
          try {
            order = typeof first.parts_order === 'string' ? JSON.parse(first.parts_order) : first.parts_order
          } catch {}
          setNumForm({
            series_name: first.series_name,
            prefix: first.prefix || '',
            suffix: first.suffix || '',
            separator: first.separator !== undefined ? first.separator : '-',
            parts_order: order,
            fy_format: first.fy_format || 'YY-YY',
            counter_padding: first.counter_padding || 5,
            starting_counter: first.starting_counter || 1001,
          })
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadAllMasters()
  }, [])

  // Numbering Live Preview calculation
  useEffect(() => {
    fetch('/api/admin/numbering/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prefix: numForm.prefix,
        suffix: numForm.suffix,
        separator: numForm.separator,
        parts_order: numForm.parts_order,
        fy_format: numForm.fy_format,
        counter_padding: numForm.counter_padding,
        counter: numForm.starting_counter,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.preview) setLivePreview(d.preview)
      })
      .catch(() => {})
  }, [numForm])

  const handleSelectDocType = (docType: string) => {
    setSelectedDocType(docType)
    const conf = numberingConfigs.find((c) => c.document_type === docType)
    if (conf) {
      let order = ['prefix', 'fy', 'counter', 'suffix']
      try {
        order = typeof conf.parts_order === 'string' ? JSON.parse(conf.parts_order) : conf.parts_order
      } catch {}
      setNumForm({
        series_name: conf.series_name,
        prefix: conf.prefix || '',
        suffix: conf.suffix || '',
        separator: conf.separator !== undefined ? conf.separator : '-',
        parts_order: order,
        fy_format: conf.fy_format || 'YY-YY',
        counter_padding: conf.counter_padding || 5,
        starting_counter: conf.starting_counter || 1001,
      })
    }
  }

  const handleSaveNumbering = async (e: React.FormEvent) => {
    e.preventDefault()
    setNumSaving(true)
    setNumSuccess('')
    try {
      const res = await fetch('/api/admin/numbering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: selectedDocType,
          series_name: numForm.series_name,
          prefix: numForm.prefix,
          suffix: numForm.suffix,
          separator: numForm.separator,
          parts_order: numForm.parts_order,
          fy_format: numForm.fy_format,
          counter_padding: numForm.counter_padding,
          starting_counter: numForm.starting_counter,
        }),
      })
      if (res.ok) {
        setNumSuccess('Numbering format configuration saved successfully!')
        setTimeout(() => setNumSuccess(''), 3000)
        loadAllMasters()
      } else {
        const d = await res.json()
        showToast('error', d.error || 'Failed to save numbering configuration')
      }
    } finally {
      setNumSaving(false)
    }
  }

  // Toggle master group collapse
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  // Toggle active/inactive status for master records
  const handleToggleActive = async (masterKey: MasterKey, item: any) => {
    const isCurrentlyActive = item.is_active === 1 || item.is_active === true
    const targetStatus = !isCurrentlyActive

    let patchUrl = ''
    if (masterKey === 'partner_types') patchUrl = `/api/admin/masters/partner-types/${item.id}/deactivate`
    else if (masterKey === 'ca') patchUrl = `/api/admin/masters/ca/${item.id}/deactivate`
    else if (masterKey === 'branches') patchUrl = `/api/admin/branches/${item.id}/deactivate`
    else if (masterKey === 'catalog') patchUrl = `/api/dsc/catalog/${item.id}/deactivate`
    else if (masterKey === 'token_models') patchUrl = `/api/admin/settings/tokens/${item.id}/deactivate`
    else if (masterKey === 'vendors') patchUrl = `/api/admin/masters/vendors/${item.id}/deactivate`
    else if (masterKey === 'reasons') patchUrl = `/api/admin/masters/reasons/${item.id}/deactivate`
    else if (masterKey === 'lead_sources') patchUrl = `/api/crm/lead-sources/${item.id}/deactivate`
    else if (masterKey === 'services') patchUrl = `/api/admin/settings/services/${item.id}/deactivate`
    else if (masterKey === 'bank_accounts') patchUrl = `/api/billing/accounts/${item.id}/deactivate`
    else if (masterKey === 'couriers') patchUrl = `/api/admin/settings/couriers/${item.id}/deactivate`

    if (!patchUrl) {
      showToast('error', 'Status toggle not supported for this entity.')
      return
    }

    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: targetStatus ? 1 : 0 }),
      })
      if (res.ok) {
        showToast('success', `Status updated to ${targetStatus ? 'Active' : 'Inactive'}.`)
        loadMasterData(masterKey)
      } else {
        const d = await res.json()
        showToast('error', d.error || 'Failed to update status.')
      }
    } catch {
      showToast('error', 'Network error updating record status.')
    }
  }

  // Submit Master Form (Add or Edit)
  const handleSaveMasterRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const currentDef = MASTER_DEFINITIONS[selectedMasterKey]

    try {
      if (selectedMasterKey === 'company') {
        const res = await fetch('/api/admin/settings/company', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.ok) {
          showToast('success', 'Company Profile saved successfully.')
          loadMasterData('company')
        } else {
          const d = await res.json()
          showToast('error', d.error || 'Failed to update company profile.')
        }
      } else {
        const isEdit = Boolean(editingItem)
        let url = currentDef.endpoint
        let method = 'POST'

        if (isEdit) {
          if (selectedMasterKey === 'branches') {
            url = `/api/admin/branches/${editingItem.id}`
            method = 'PUT'
          } else if (selectedMasterKey === 'catalog') {
            url = `/api/dsc/catalog/${editingItem.id}`
            method = 'PUT'
          }
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (res.ok) {
          showToast('success', `${currentDef.title} ${isEdit ? 'updated' : 'added'} successfully.`)
          setShowAddModal(false)
          setEditingItem(null)
          setFormData({})
          loadMasterData(selectedMasterKey)
        } else {
          const d = await res.json()
          showToast('error', d.error || 'Error saving master record.')
        }
      }
    } catch {
      showToast('error', 'Network error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  // Current active master definition
  const activeDef = MASTER_DEFINITIONS[selectedMasterKey]
  const rawList: any[] = Array.isArray(masterData[selectedMasterKey]) ? masterData[selectedMasterKey] : []

  // Filter list by search query
  const filteredList = useMemo(() => {
    if (!masterSearchQuery.trim()) return rawList
    const q = masterSearchQuery.toLowerCase()
    return rawList.filter((item) => {
      return Object.values(item).some((val) => typeof val === 'string' && val.toLowerCase().includes(q))
    })
  }, [rawList, masterSearchQuery])

  // Pagination calculation
  const totalRecords = filteredList.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage))
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredList.slice(start, start + rowsPerPage)
  }, [filteredList, currentPage, rowsPerPage])

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const endRecord = Math.min(currentPage * rowsPerPage, totalRecords)

  // Initialize company profile form data on select
  useEffect(() => {
    if (selectedMasterKey === 'company') {
      setFormData(masterData.company)
    } else {
      setFormData({})
    }
    setCurrentPage(1)
    setMasterSearchQuery('')
    setEditingItem(null)
    setShowAddModal(false)
  }, [selectedMasterKey, masterData.company])

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <span>/</span>
            <span className="text-white">Administration</span>
            <span>/</span>
            <span className="text-white">Master Configuration</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Central Master Administration & Configuration
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centrally control business entities, drop-down options, validation requirements, and reference numbering.
          </p>
        </div>

        {/* Master Field Builder Metadata Button */}
        {activeTopTab === 'configuration' && (
          <button
            onClick={() => setShowMetadataDrawer(!showMetadataDrawer)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              showMetadataDrawer
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            {showMetadataDrawer ? 'Hide Field Rules' : 'Master Field Rules'}
          </button>
        )}
      </div>

      {/* EXACT TOP-LEVEL TABS (CONFIGURATION, HIERARCHICAL NAVIGATION & NUMBERING) */}
      <div className="flex items-center gap-3 border-b border-slate-800">
        <button
          onClick={() => setActiveTopTab('configuration')}
          className={`pb-3 px-2 text-xs font-semibold tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTopTab === 'configuration'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          1. CONFIGURATION
        </button>

        <button
          onClick={() => setActiveTopTab('navigation')}
          className={`pb-3 px-2 text-xs font-semibold tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTopTab === 'navigation'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          2. HIERARCHICAL NAVIGATION
        </button>

        <button
          onClick={() => setActiveTopTab('numbering')}
          className={`pb-3 px-2 text-xs font-semibold tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTopTab === 'numbering'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Hash className="w-4 h-4" />
          3. NUMBERING
        </button>
      </div>

      {/* TAB 2: HIERARCHICAL MASTER NAVIGATION TREE */}
      {activeTopTab === 'navigation' && (
        <MasterNavigationTreeManager
          currentResourceKey={selectedMasterKey}
          onSelectMaster={(resourceKey) => {
            if (resourceKey in MASTER_DEFINITIONS) {
              setSelectedMasterKey(resourceKey as MasterKey)
              setActiveTopTab('configuration')
            }
          }}
        />
      )}

      {/* TAB 1: CONFIGURATION (TWO-COLUMN DBIZ ARCHITECTURE) */}
      {activeTopTab === 'configuration' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT PANEL: Grouped Collapsible Navigation (w-72 shrink-0) */}
          <aside className="w-full lg:w-72 shrink-0 space-y-3">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Master Modules</h2>
              <div className="space-y-1.5">
                {NAV_GROUPS.map((group) => {
                  const Icon = group.icon
                  const isCollapsed = Boolean(collapsedGroups[group.id])
                  const hasActive = group.masters.includes(selectedMasterKey)

                  return (
                    <div key={group.id} className="rounded-lg overflow-hidden border border-slate-800/60 bg-slate-950/40">
                      {/* Accordion Group Header */}
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.id)}
                        className={`w-full flex items-center justify-between p-2.5 text-xs font-semibold transition cursor-pointer ${
                          hasActive ? 'text-indigo-400 bg-indigo-950/20' : 'text-slate-300 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-3.5 h-3.5 ${hasActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                          <span>{group.title}</span>
                        </div>
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>

                      {/* Group Master Sub-links */}
                      {!isCollapsed && (
                        <div className="divide-y divide-slate-900/60 bg-slate-950/80 px-1 py-1">
                          {group.masters.map((mKey) => {
                            const def = MASTER_DEFINITIONS[mKey]
                            const isSelected = selectedMasterKey === mKey
                            return (
                              <button
                                key={mKey}
                                type="button"
                                onClick={() => setSelectedMasterKey(mKey)}
                                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                                }`}
                              >
                                <span className="truncate">{def.title}</span>
                                {Array.isArray(masterData[mKey]) && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                      isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {(masterData[mKey] as any[]).length}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick System Policy Alert */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Central Governance Rules</span>
              </div>
              <p>• Staff cannot add arbitrary options in sales and order forms.</p>
              <p>• Deactivated records remain visible on historical audits.</p>
              <p>• Changes made here take immediate effect across all modules.</p>
            </div>
          </aside>

          {/* RIGHT PANEL: Master Entity Management & Editor (flex-1) */}
          <main className="flex-1 w-full space-y-5">
            {/* Master Header Card */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{activeDef.title}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{activeDef.subtitle}</p>
              </div>

              {activeDef.canAdd && (
                <button
                  onClick={() => {
                    setEditingItem(null)
                    setFormData({})
                    setShowAddModal(true)
                  }}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Record
                </button>
              )}
            </div>

            {/* Master Field Rules / Metadata Drawer */}
            {showMetadataDrawer && (
              <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span>Master Field Builder & Validation Schema</span>
                  </div>
                  <span className="text-[11px] text-indigo-400">Strict Server-side Field Governance</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {activeDef.fields.map((fld) => (
                    <div key={fld.name} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{fld.label}</span>
                        <span className="text-[10px] font-mono text-indigo-400">#{fld.order}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{fld.type}</span>
                        {fld.required ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Required
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Optional</span>
                        )}
                        <span className="text-emerald-400">Editable</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CASE A: COMPANY PROFILE (Single Record Dedicated Editor) */}
            {selectedMasterKey === 'company' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
                <form onSubmit={handleSaveMasterRecord} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Legal Business Name *</label>
                      <input
                        required
                        value={formData.legal_name || ''}
                        onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Trade / Brand Name</label>
                      <input
                        value={formData.trade_name || ''}
                        onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">GSTIN Number *</label>
                      <input
                        required
                        value={formData.gstin || ''}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Company PAN *</label>
                      <input
                        required
                        value={formData.pan || ''}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Billing Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
                      <input
                        required
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Registered Office Address *</label>
                    <textarea
                      rows={2}
                      required
                      value={formData.registered_address || ''}
                      onChange={(e) => setFormData({ ...formData, registered_address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">State Code (GST 2-Digit) *</label>
                      <input
                        required
                        value={formData.state_code || ''}
                        onChange={(e) => setFormData({ ...formData, state_code: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 outline-none"
                        placeholder="27"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">State Name *</label>
                      <input
                        required
                        value={formData.state_name || ''}
                        onChange={(e) => setFormData({ ...formData, state_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                        placeholder="Maharashtra"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Company Profile'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CASE B: DATA TABLE VIEW WITH SEARCH & PAGINATION FOR ALL LIST MASTERS */}
            {selectedMasterKey !== 'company' && (
              <div className="space-y-4">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      placeholder={`Search ${activeDef.title.toLowerCase()}...`}
                      value={masterSearchQuery}
                      onChange={(e) => {
                        setMasterSearchQuery(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="text-xs text-slate-400">
                    Showing <span className="text-white font-semibold">{startRecord}</span>–
                    <span className="text-white font-semibold">{endRecord}</span> of{' '}
                    <span className="text-white font-semibold">{totalRecords}</span> records
                  </div>
                </div>

                {/* Table Container */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-slate-400 bg-slate-950/80 border-b border-slate-800">
                          {activeDef.fields.slice(0, 4).map((fld) => (
                            <th key={fld.name} className="p-3 font-semibold whitespace-nowrap">
                              {fld.label}
                            </th>
                          ))}
                          <th className="p-3 font-semibold text-center whitespace-nowrap">Status</th>
                          <th className="p-3 font-semibold text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paginatedList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-500 text-xs whitespace-nowrap">
                              No records found for {activeDef.title}. Click &quot;Add New Record&quot; to configure.
                            </td>
                          </tr>
                        ) : (
                          paginatedList.map((item) => {
                            const isActive = item.is_active === 1 || item.is_active === true
                            return (
                              <tr key={item.id} className="hover:bg-slate-800/40 transition h-12">
                                {activeDef.fields.slice(0, 4).map((fld, idx) => {
                                  const val = item[fld.name]
                                  const isCurrency =
                                    fld.type === 'number' &&
                                    (fld.name.includes('price') || fld.name.includes('mrp') || fld.name.includes('fee'))
                                  const isStockUnits = fld.name === 'min_threshold'
                                  const isUrl = fld.name.includes('url') || fld.name.includes('endpoint')

                                  return (
                                    <td
                                      key={fld.name}
                                      className={`p-3 whitespace-nowrap ${idx === 0 ? 'font-semibold text-white' : 'text-slate-300'}`}
                                      title={val ? String(val) : undefined}
                                    >
                                      {val !== null && val !== undefined
                                        ? isCurrency
                                          ? `₹${val}`
                                          : isStockUnits
                                          ? `${val} units`
                                          : isUrl
                                          ? (
                                            <span className="font-mono text-[11px] text-cyan-400 max-w-[280px] inline-block truncate align-middle">
                                              {String(val)}
                                            </span>
                                          )
                                          : String(val)
                                        : '—'}
                                    </td>
                                  )
                                })}
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${
                                      isActive
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    }`}
                                  >
                                    {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                                  </span>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                    {/* Active / Inactive Toggle */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActive(selectedMasterKey, item)}
                                      title={isActive ? 'Deactivate record' : 'Activate record'}
                                      className={`p-1 rounded transition cursor-pointer ${
                                        isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-white'
                                      }`}
                                    >
                                      {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                    </button>

                                    {/* Edit button if supported */}
                                    {(selectedMasterKey === 'branches' || selectedMasterKey === 'catalog') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingItem(item)
                                          setFormData(item)
                                          setShowAddModal(true)
                                        }}
                                        className="text-indigo-400 hover:text-indigo-300 font-medium text-[11px] px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-500/30 cursor-pointer whitespace-nowrap"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Standard Professional Pagination Footer */}
                  {totalRecords > 0 && (
                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      {/* Rows per page selector */}
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Rows per page:</span>
                        <select
                          value={rowsPerPage}
                          onChange={(e) => {
                            setRowsPerPage(Number(e.target.value))
                            setCurrentPage(1)
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs outline-none"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      {/* Page Buttons with Previous and Next */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Previous
                        </button>

                        {Array.from({ length: totalPages }).map((_, i) => {
                          const pNum = i + 1
                          return (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => setCurrentPage(pNum)}
                              className={`w-7 h-7 rounded text-xs font-semibold transition cursor-pointer ${
                                currentPage === pNum
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
                              }`}
                            >
                              {pNum}
                            </button>
                          )
                        })}

                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="px-2.5 py-1 rounded border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* TAB 2: NUMBERING (CENTRAL ID & REFERENCE NUMBER ENGINE) */}
      {activeTopTab === 'numbering' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-amber-400" />
                  Configurable Business Reference Numbering Engine
                </h2>
                <p className="text-[11px] text-slate-400">
                  Configure prefix, suffix, zero-padding, sequence counter, financial year formats, and ordered segments across all business records.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-right">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-semibold">
                  Live Next Number Preview
                </span>
                <span className="font-mono text-sm font-bold text-amber-300">{livePreview || 'GENERATING...'}</span>
              </div>
            </div>

            {numSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{numSuccess}</span>
              </div>
            )}

            {/* Document Selector Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {numberingConfigs.map((c) => (
                <button
                  key={c.document_type}
                  type="button"
                  onClick={() => handleSelectDocType(c.document_type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    selectedDocType === c.document_type
                      ? 'bg-amber-600/20 border-amber-500/40 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.series_name}
                </button>
              ))}
            </div>

            {/* Numbering Form */}
            <form onSubmit={handleSaveNumbering} className="space-y-4 text-xs pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Prefix</label>
                  <input
                    placeholder="e.g. INV, DSC, PRT"
                    value={numForm.prefix}
                    onChange={(e) => setNumForm({ ...numForm, prefix: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Suffix (Optional)</label>
                  <input
                    placeholder="e.g. TAX, EXP"
                    value={numForm.suffix}
                    onChange={(e) => setNumForm({ ...numForm, suffix: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Separator</label>
                  <select
                    value={numForm.separator}
                    onChange={(e) => setNumForm({ ...numForm, separator: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="-">Hyphen (-)</option>
                    <option value="/">Slash (/)</option>
                    <option value="_">Underscore (_)</option>
                    <option value="">None (Concatenated)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Year / Date Segment</label>
                  <select
                    value={numForm.fy_format}
                    onChange={(e) => setNumForm({ ...numForm, fy_format: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="none">None (No Year Segment)</option>
                    <option value="YY-YY">Financial Year (e.g. 26-27)</option>
                    <option value="YYYY-YY">Full Fiscal Year (e.g. 2026-27)</option>
                    <option value="YYYY">Calendar Year (e.g. 2026)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Zero Padding (Digits)</label>
                  <select
                    value={numForm.counter_padding}
                    onChange={(e) => setNumForm({ ...numForm, counter_padding: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  >
                    <option value={3}>3 Digits (001)</option>
                    <option value={4}>4 Digits (0001)</option>
                    <option value={5}>5 Digits (00001)</option>
                    <option value={6}>6 Digits (000001)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Starting / Next Sequence</label>
                  <input
                    type="number"
                    value={numForm.starting_counter}
                    onChange={(e) => setNumForm({ ...numForm, starting_counter: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Ordered Segments Configuration */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium">Segment Arrangement & Positioning</label>
                <p className="text-[11px] text-slate-500">
                  Select segment ordering pattern. The reference string will assemble segments in this exact order.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: 'PREFIX / FY / SEQUENCE / SUFFIX', val: ['prefix', 'fy', 'counter', 'suffix'] },
                    { label: 'PREFIX / SEQUENCE / SUFFIX', val: ['prefix', 'counter', 'suffix'] },
                    { label: 'PREFIX / SUFFIX / SEQUENCE', val: ['prefix', 'suffix', 'counter'] },
                    { label: 'SEQUENCE / PREFIX / SUFFIX', val: ['counter', 'prefix', 'suffix'] },
                  ].map((pat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNumForm({ ...numForm, parts_order: pat.val })}
                      className={`px-3 py-1 rounded text-[11px] font-mono border cursor-pointer transition ${
                        JSON.stringify(numForm.parts_order) === JSON.stringify(pat.val)
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={numSaving}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Numbering Pattern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT MASTER RECORD */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {editingItem ? 'Edit Master Record' : `Add to ${activeDef.title}`}
                </h3>
                <p className="text-[11px] text-slate-400">Configure central parameter attributes</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setEditingItem(null)
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMasterRecord} className="space-y-3.5 text-xs">
              {activeDef.fields.map((fld) => (
                <div key={fld.name}>
                  <label className="block text-slate-300 font-medium mb-1">
                    {fld.label} {fld.required && <span className="text-rose-400">*</span>}
                  </label>
                  {fld.type === 'textarea' ? (
                    <textarea
                      rows={2}
                      required={fld.required}
                      value={formData[fld.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [fld.name]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                    />
                  ) : fld.type === 'select' ? (
                    <select
                      required={fld.required}
                      value={formData[fld.name] || (fld.options ? fld.options[0].value : '')}
                      onChange={(e) => setFormData({ ...formData, [fld.name]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                    >
                      {fld.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={fld.type}
                      required={fld.required}
                      value={formData[fld.name] !== undefined ? formData[fld.name] : ''}
                      onChange={(e) => setFormData({ ...formData, [fld.name]: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  )}
                </div>
              ))}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
