// SignSync Enterprise Domain Model Definitions

export type UserStatus = 'active' | 'suspended' | 'invited' | 'deactivated'
export type PartnerType = 'dsc_partner' | 'token_partner' | 'associate_partner' | 'master_distributor'
export type DscClassType = 'class_3_individual' | 'class_3_organization' | 'dgft' | 'foreign_national' | 'document_signer'
export type DscValidityYears = '1_year' | '2_years' | '3_years'
export type TokenType = 'epass2003_auto' | 'watchdata_proxkey' | 'mtoken_crypto' | 'trustkey'
export type LeadStatus = 'new' | 'contacted' | 'requirement_gathered' | 'quoted' | 'negotiation' | 'won' | 'lost' | 'merged'
export type InvoiceType = 'gst_tax_invoice' | 'non_gst_bill_of_supply' | 'proforma'
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'under_verification' | 'rejected'
export type CourierStatus = 'manifested' | 'pickup_scheduled' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'rto_undelivered'
export type ServiceOrderType = 'trademark' | 'fssai_basic' | 'fssai_state' | 'fssai_central' | 'gst_registration' | 'company_incorporation'
export type ServiceStage = 'draft_review' | 'govt_submission' | 'hearing_query' | 'completed_certificate'

export interface HierarchyLevelRecord {
  id: string
  level_order: number // 0 to 4
  level_name: string
  can_delegate_default: number
  created_at?: string
}

export interface UserProfileRecord {
  id: string
  email: string
  full_name: string
  phone_number?: string
  role_id: string
  role_name?: string
  hierarchy_level_id: string
  hierarchy_level_order?: number
  level_order?: number
  level_name?: string
  reports_to_user_id?: string
  can_grant_permissions: number | boolean
  permissions_frozen: number | boolean
  branch_id?: string
  branch_name?: string
  status: UserStatus
  created_at: string
}

export interface PartnerRecord {
  id: string
  partner_code: string
  type: PartnerType
  company_name: string
  contact_person: string
  email: string
  phone: string
  gstin?: string
  pan?: string
  billing_address: string
  state_code: string
  credit_period_days: number
  credit_limit: number
  wallet_balance: number
  kyc_verified: number | boolean
  status: UserStatus
  created_at: string
}

export interface DscCatalogRecord {
  id: string
  class_type: DscClassType
  certificate_type: string
  validity_years: DscValidityYears
  vendor_base_price: number
  partner_price: number
  mrp: number
  is_active: number | boolean
  created_at: string
}

export interface TokenPurchaseBatchRecord {
  id: string
  batch_number: string
  token_model: TokenType
  vendor_name: string
  quantity_purchased: number
  base_unit_price: number
  inward_shipping_cost: number
  customs_or_taxes: number
  handling_charges: number
  total_landed_cost: number
  unit_landed_cost: number
  allocated_quantity: number
  damaged_quantity: number
  created_at: string
}

export interface BranchStockRecord {
  id: string
  branch_id: string
  branch_name?: string
  branch_code?: string
  token_model: TokenType
  quantity_on_hand: number
  quarantine_damaged: number
  min_threshold: number
  created_at: string
}

export interface CrmLeadRecord {
  id: string
  lead_code: string
  company_name: string
  contact_person: string
  email: string
  phone: string
  gstin?: string
  pan?: string
  status: LeadStatus
  requirement_summary?: string
  assigned_to?: string
  assigned_agent_name?: string
  is_merged: number | boolean
  merged_into_lead_id?: string
  created_at: string
  updated_at: string
}

export interface BankAccountRecord {
  id: string
  account_nickname: string
  bank_name: string
  account_number: string
  ifsc_code: string
  branch_name: string
  account_holder_name: string
  upi_id?: string
  google_pay_number?: string
  qr_code_image_path?: string
  is_active: number | boolean
}

export interface InvoiceLineItem {
  item: string
  qty: number
  rate: number
  total: number
}

export interface InvoiceRecord {
  id: string
  invoice_number: string
  series_id: string
  partner_id: string
  partner_company?: string
  invoice_type: InvoiceType
  invoice_date: string
  due_date: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  paid_amount: number
  outstanding_balance: number
  status: PaymentStatus
  bank_account_snapshot_id?: string
  bank_name?: string
  account_number?: string
  upi_id?: string
  line_items: string | InvoiceLineItem[]
  created_at: string
}

export interface PaymentReceivedRecord {
  id: string
  invoice_id: string
  partner_id: string
  partner_company?: string
  invoice_number?: string
  total_amount?: number
  outstanding_balance?: number
  amount_paid: number
  payment_mode: string
  bank_account_id?: string
  bank_name?: string
  account_number?: string
  transaction_reference_utr?: string
  screenshot_proof_url?: string
  verified_status: string
  verified_by?: string
  verified_at?: string
  rejection_remarks?: string
  created_at: string
}

export interface FinancialLedgerRecord {
  id: string
  partner_id: string
  entry_date: string
  transaction_type: string
  reference_id?: string
  debit: number
  credit: number
  running_balance: number
  remarks?: string
  created_at: string
}

export interface ServiceOrderRecord {
  id: string
  order_number: string
  service_type: ServiceOrderType
  partner_id?: string
  partner_company?: string
  client_name: string
  client_contact: string
  stage: ServiceStage
  portal_ack_number?: string
  government_fees: number
  professional_fees: number
  uploaded_documents?: string
  final_certificate_url?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CourierDispatchRecord {
  id: string
  dispatch_number: string
  carrier_name: string
  awb_number: string
  recipient_name: string
  recipient_phone: string
  shipping_address: string
  package_contents: string
  status: CourierStatus
  delivery_challan_id?: string
  proof_of_delivery_url?: string
  dispatched_at: string
  delivered_at?: string
  notes?: string
  created_at: string
}

