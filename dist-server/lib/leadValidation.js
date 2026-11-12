"use strict";
/**
 * SignSync Lead Intake Validation Library (LM-06 & LM-32)
 *
 * Rules:
 * - LM-06: Optional intake. All personal, contact, and company fields are optional.
 *   Blank / undefined / null inputs are VALID.
 * - Supplied values must be strictly validated.
 * - Missing values are normalized to null (no fabricated strings like 'N/A').
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLeadPhone = validateLeadPhone;
exports.validateLeadEmail = validateLeadEmail;
exports.validateLeadContactPerson = validateLeadContactPerson;
exports.validateLeadCompanyName = validateLeadCompanyName;
exports.validateLeadPinCode = validateLeadPinCode;
exports.validateLeadPan = validateLeadPan;
exports.validateLeadPayload = validateLeadPayload;
// 1. Phone validation: Optional. If supplied, must be exactly 10 digits starting with 6, 7, 8, or 9
function validateLeadPhone(phone) {
    if (!phone || typeof phone !== 'string')
        return { valid: true, value: null };
    const raw = phone.trim();
    if (raw === '')
        return { valid: true, value: null };
    // Strip non-digits and optional +91 prefix
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2);
    }
    if (digits.length !== 10) {
        return { valid: false, value: digits, error: 'Enter a valid 10-digit mobile number.' };
    }
    if (!/^[6-9]/.test(digits)) {
        return { valid: false, value: digits, error: 'Mobile number must start with 6, 7, 8, or 9.' };
    }
    return { valid: true, value: digits };
}
// 2. Email validation: Optional. If supplied, RFC-compliant format
function validateLeadEmail(email) {
    if (!email || typeof email !== 'string')
        return { valid: true, value: null };
    const raw = email.trim();
    if (raw === '')
        return { valid: true, value: null };
    const clean = raw.toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(clean) || clean.includes('..') || clean.startsWith('@') || clean.endsWith('@')) {
        return { valid: false, value: clean, error: 'Enter a valid email address.' };
    }
    return { valid: true, value: clean };
}
// 3. Contact Person validation: Optional. If supplied, letters, spaces, dots, hyphens, min 2 chars
function validateLeadContactPerson(name) {
    if (!name || typeof name !== 'string')
        return { valid: true, value: null };
    const raw = name.trim().replace(/\s+/g, ' ');
    if (raw === '')
        return { valid: true, value: null };
    if (raw.length < 2) {
        return { valid: false, value: raw, error: 'Contact person name must be at least 2 characters.' };
    }
    if (/\d/.test(raw)) {
        return { valid: false, value: raw, error: 'Contact person name cannot contain numbers.' };
    }
    // Reject symbols-only or invalid characters
    if (!/^[a-zA-Z\s.'-]+$/.test(raw)) {
        return { valid: false, value: raw, error: 'Contact person name contains invalid characters.' };
    }
    return { valid: true, value: raw };
}
// 4. Company Name validation: Optional. If supplied, min 2 chars, not purely special chars
function validateLeadCompanyName(name) {
    if (!name || typeof name !== 'string')
        return { valid: true, value: null };
    const raw = name.trim().replace(/\s+/g, ' ');
    if (raw === '')
        return { valid: true, value: null };
    if (raw.length < 2) {
        return { valid: false, value: raw, error: 'Company name must be at least 2 characters.' };
    }
    // Reject strings made purely of symbols/punctuation
    if (!/[a-zA-Z0-9]/.test(raw)) {
        return { valid: false, value: raw, error: 'Company name must contain valid alphanumeric characters.' };
    }
    return { valid: true, value: raw };
}
// 5. PIN Code validation: Optional. If supplied, exactly 6 digits
function validateLeadPinCode(pin) {
    if (!pin || typeof pin !== 'string')
        return { valid: true, value: null };
    const raw = pin.trim();
    if (raw === '')
        return { valid: true, value: null };
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 6 || raw !== digits) {
        return { valid: false, value: digits, error: 'PIN code must contain exactly 6 digits.' };
    }
    return { valid: true, value: digits };
}
// 6. PAN validation: Optional. If supplied, Indian PAN format: 5 letters + 4 digits + 1 letter
function validateLeadPan(pan) {
    if (!pan || typeof pan !== 'string')
        return { valid: true, value: null };
    const raw = pan.trim().toUpperCase();
    if (raw === '')
        return { valid: true, value: null };
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(raw)) {
        return { valid: false, value: raw, error: 'Enter a valid PAN (e.g. ABCDE1234F).' };
    }
    return { valid: true, value: raw };
}
/**
 * Validate complete Lead intake payload
 */
function validateLeadPayload(payload) {
    const errors = {};
    const phoneRes = validateLeadPhone(payload.phone);
    if (!phoneRes.valid && phoneRes.error)
        errors.phone = phoneRes.error;
    const emailRes = validateLeadEmail(payload.email);
    if (!emailRes.valid && emailRes.error)
        errors.email = emailRes.error;
    const contactRes = validateLeadContactPerson(payload.contact_person);
    if (!contactRes.valid && contactRes.error)
        errors.contact_person = contactRes.error;
    const companyRes = validateLeadCompanyName(payload.company_name);
    if (!companyRes.valid && companyRes.error)
        errors.company_name = companyRes.error;
    const pinRes = validateLeadPinCode(payload.pin_code);
    if (!pinRes.valid && pinRes.error)
        errors.pin_code = pinRes.error;
    const panRes = validateLeadPan(payload.pan);
    if (!panRes.valid && panRes.error)
        errors.pan = panRes.error;
    return {
        valid: Object.keys(errors).length === 0,
        errors,
        sanitized: {
            company_name: companyRes.value,
            alternate_name: payload.alternate_name ? String(payload.alternate_name).trim() : null,
            contact_person: contactRes.value,
            email: emailRes.value,
            phone: phoneRes.value,
            city: payload.city ? String(payload.city).trim() : null,
            state: payload.state ? String(payload.state).trim() : null,
            district: payload.district ? String(payload.district).trim() : null,
            address: payload.address ? String(payload.address).trim() : null,
            pin_code: pinRes.value,
            pan: panRes.value,
            source_id: payload.source_id ? String(payload.source_id).trim() : null,
            category_id: payload.category_id ? String(payload.category_id).trim() : null,
            service_intent: payload.service_intent || 'Undecided',
            requirement_summary: payload.requirement_summary ? String(payload.requirement_summary).trim() : null,
        },
    };
}
