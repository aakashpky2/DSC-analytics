import { z } from 'zod'

// 1. Indian Phone: Exactly 10 digits starting with 6-9
export const phoneSchema = z
  .string()
  .trim()
  .refine((val) => {
    const clean = val.replace(/[\s+-]/g, '').slice(-10)
    return /^[6-9]\d{9}$/.test(clean)
  }, { message: 'Must be a valid 10-digit Indian mobile number starting with 6-9' })

// 2. Email Schema
export const emailSchema = z.string().trim().email({ message: 'Must be a valid email address' })

// 3. PAN: 5 letters + 4 digits + 1 letter
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'PAN format must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)' })

// 4. GSTIN: 15 alphanumeric characters with standard state code
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format (e.g. 27AAACA1234A1Z5)' })

// 5. IFSC: 11 characters, fifth character 0
export const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must be 11 characters with 5th character as 0 (e.g. HDFC0001234)' })

// 6. Bank Account: Numeric string preserving leading zeros (9 to 18 digits)
export const bankAccountSchema = z
  .string()
  .trim()
  .regex(/^\d{9,18}$/, { message: 'Bank account number must be between 9 and 18 digits' })

// 7. Amount: Positive number with maximum 2 decimal places
export const amountSchema = z
  .number()
  .positive({ message: 'Amount must be positive' })
  .refine((val) => Number(val.toFixed(2)) === val, { message: 'Maximum 2 decimal places allowed' })

// 8. Partner Form Validation Schema
export const partnerFormSchema = z.object({
  type: z.enum(['dsc_partner', 'token_partner', 'associate_partner', 'master_distributor']),
  company_name: z.string().trim().min(2, 'Company name is required'),
  contact_person: z.string().trim().min(2, 'Contact person name is required'),
  email: emailSchema,
  phone: phoneSchema,
  gstin: gstinSchema.optional().or(z.literal('')),
  pan: panSchema.optional().or(z.literal('')),
  billing_address: z.string().trim().min(5, 'Billing address is required'),
  state_code: z.string().trim().length(2, 'State code must be 2 digits (e.g. 27 for MH)'),
  credit_limit: z.number().min(0).default(0),
  credit_period_days: z.number().int().min(0).max(90).default(0),
})

// 9. Token Batch Inwarding Schema
export const tokenBatchFormSchema = z.object({
  token_model: z.enum(['epass2003_auto', 'watchdata_proxkey', 'mtoken_crypto', 'trustkey']),
  vendor_name: z.string().trim().min(2, 'Vendor name is required'),
  quantity_purchased: z.number().int().positive('Quantity must be greater than zero'),
  base_unit_price: z.number().positive('Base unit price must be positive'),
  inward_shipping_cost: z.number().min(0).default(0),
  customs_or_taxes: z.number().min(0).default(0),
  handling_charges: z.number().min(0).default(0),
})

// 10. CRM Lead Form Schema
export const crmLeadFormSchema = z.object({
  company_name: z.string().trim().min(2, 'Company name is required'),
  contact_person: z.string().trim().min(2, 'Contact person is required'),
  email: emailSchema,
  phone: phoneSchema,
  gstin: gstinSchema.optional().or(z.literal('')),
  pan: panSchema.optional().or(z.literal('')),
  requirement_summary: z.string().trim().min(5, 'Requirement summary is required'),
})

// 11. Invoice Creation Schema
export const invoiceCreationSchema = z.object({
  series_id: z.string().min(1, 'Series selection is required'),
  partner_id: z.string().min(1, 'Partner selection is required'),
  due_days: z.number().int().min(0).max(90).default(30),
  line_items: z.array(
    z.object({
      item: z.string().min(1, 'Item name required'),
      qty: z.number().int().positive('Quantity must be > 0'),
      rate: z.number().positive('Rate must be > 0'),
    })
  ).min(1, 'At least one line item is required'),
})

