/**
 * Field-Level PII Masking Implementation (Section 4.3)
 * Redacts customer and partner sensitive data when mask_pii_fields is TRUE.
 */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  const parts = email.split('@')
  if (parts.length !== 2) return '***@***.com'
  const [name, domain] = parts
  const maskedName =
    name.length <= 2
      ? `${name[0]}*`
      : `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}`

  const domainParts = domain.split('.')
  const domName = domainParts[0]
  const ext = domainParts.slice(1).join('.')
  const maskedDomain =
    domName.length <= 2
      ? `${domName[0]}*`
      : `${domName[0]}${'*'.repeat(Math.min(domName.length - 2, 4))}${domName[domName.length - 1]}`

  return `${maskedName}@${maskedDomain}.${ext}`
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const clean = phone.trim()
  if (clean.length < 6) return '******'
  const prefix = clean.startsWith('+91') ? '+91 ' : ''
  const digits = clean.replace(/[^0-9]/g, '')
  const last4 = digits.slice(-4)
  return `${prefix}******${last4}`
}

export function maskPan(pan: string | null | undefined): string {
  if (!pan) return ''
  const clean = pan.trim().toUpperCase()
  if (clean.length !== 10) return '*****' + clean.slice(-4)
  return `*****${clean.slice(-5)}`
}

export function maskBankAccount(accountNumber: string | null | undefined): string {
  if (!accountNumber) return ''
  const clean = accountNumber.trim()
  if (clean.length <= 4) return '****'
  return `${'*'.repeat(Math.max(clean.length - 4, 8))}${clean.slice(-4)}`
}

export function applyPiiMasking<T extends Record<string, any>>(
  record: T,
  shouldMask: boolean
): T {
  if (!shouldMask || !record) return record

  const masked: any = { ...record }

  if (typeof masked.email === 'string') masked.email = maskEmail(masked.email)
  if (typeof masked.applicant_email === 'string') masked.applicant_email = maskEmail(masked.applicant_email)

  if (typeof masked.phone === 'string') masked.phone = maskPhone(masked.phone)
  if (typeof masked.phone_number === 'string') masked.phone_number = maskPhone(masked.phone_number)
  if (typeof masked.applicant_phone === 'string') masked.applicant_phone = maskPhone(masked.applicant_phone)
  if (typeof masked.recipient_phone === 'string') masked.recipient_phone = maskPhone(masked.recipient_phone)

  if (typeof masked.pan === 'string') masked.pan = maskPan(masked.pan)
  if (typeof masked.applicant_pan === 'string') masked.applicant_pan = maskPan(masked.applicant_pan)

  if (typeof masked.account_number === 'string') masked.account_number = maskBankAccount(masked.account_number)

  return masked as T
}
