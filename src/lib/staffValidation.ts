/**
 * Robust Name Validator:
 * - 2 to 100 characters
 * - Only alphabetic letters, spaces, dots, apostrophes, and hyphens
 * - Rejects digits and meaningless symbols
 */
export function validateEmployeeName(rawName: string): { valid: boolean; name: string; error?: string } {
  if (!rawName || typeof rawName !== 'string') {
    return { valid: false, name: '', error: 'Employee Full Name is required.' }
  }

  // Trim and collapse repeated spaces
  const cleaned = rawName.trim().replace(/\s+/g, ' ')

  if (cleaned.length < 2) {
    return { valid: false, name: cleaned, error: 'Employee name must be at least 2 characters.' }
  }

  if (cleaned.length > 100) {
    return { valid: false, name: cleaned, error: 'Employee name cannot exceed 100 characters.' }
  }

  // Reject digits
  if (/\d/.test(cleaned)) {
    return { valid: false, name: cleaned, error: 'Employee name cannot contain numbers.' }
  }

  // Allow alphabetic characters, spaces, and valid punctuation: . ' -
  const nameRegex = /^[a-zA-Z\s.'-]+$/
  if (!nameRegex.test(cleaned)) {
    return { valid: false, name: cleaned, error: 'Employee name contains invalid special characters.' }
  }

  // Must have at least two alphabetic characters
  const lettersOnly = cleaned.replace(/[^a-zA-Z]/g, '')
  if (lettersOnly.length < 2) {
    return { valid: false, name: cleaned, error: 'Employee name must contain letters.' }
  }

  return { valid: true, name: cleaned }
}

/**
 * Company Email Validator:
 * - Standard RFC-compliant email pattern
 * - Max length 254 chars
 * - Trim and lowercase
 */
export function validateCompanyEmail(rawEmail: string): { valid: boolean; email: string; error?: string } {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, email: '', error: 'Please enter a valid email address.' }
  }

  const cleaned = rawEmail.trim().toLowerCase()

  if (cleaned.length === 0 || cleaned.length > 254) {
    return { valid: false, email: cleaned, error: 'Please enter a valid email address.' }
  }

  // Standard strict email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(cleaned)) {
    return { valid: false, email: cleaned, error: 'Please enter a valid email address.' }
  }

  return { valid: true, email: cleaned }
}

/**
 * Indian Mobile Number Validator:
 * - Exactly 10 digits
 * - Starts with 6, 7, 8, or 9
 * - Digits only
 */
export function validateMobileNumber(rawMobile: string): { valid: boolean; mobile: string; error?: string } {
  if (!rawMobile || typeof rawMobile !== 'string') {
    return { valid: false, mobile: '', error: 'Please enter a valid 10-digit mobile number.' }
  }

  let cleaned = rawMobile.trim().replace(/\s+/g, '')
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3)
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1)
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, mobile: cleaned, error: 'Mobile number must contain digits only.' }
  }

  if (cleaned.length !== 10) {
    return { valid: false, mobile: cleaned, error: 'Please enter a valid 10-digit mobile number.' }
  }

  if (!/^[6-9]/.test(cleaned)) {
    return { valid: false, mobile: cleaned, error: 'Mobile number must start with 6, 7, 8, or 9.' }
  }

  return { valid: true, mobile: cleaned }
}

/**
 * Initial Password Validator:
 * - Min 8, Max 128 characters
 * - No whitespace
 */
export function validateInitialPassword(rawPassword: string): { valid: boolean; password: string; error?: string } {
  if (!rawPassword || typeof rawPassword !== 'string') {
    return { valid: false, password: '', error: 'Initial password is required.' }
  }

  if (/\s/.test(rawPassword)) {
    return { valid: false, password: rawPassword, error: 'Password cannot contain spaces.' }
  }

  if (rawPassword.length < 8) {
    return { valid: false, password: rawPassword, error: 'Password must be at least 8 characters long.' }
  }

  if (rawPassword.length > 128) {
    return { valid: false, password: rawPassword, error: 'Password cannot exceed 128 characters.' }
  }

  return { valid: true, password: rawPassword }
}
