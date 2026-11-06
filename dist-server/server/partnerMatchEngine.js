"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePartnerMatch = evaluatePartnerMatch;
const supabase_1 = require("./supabase");
const leadStore_1 = require("./leadStore");
// Compute Levenshtein distance for fuzzy similarity
function levenshteinDistance(a, b) {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0)
        return bn;
    if (bn === 0)
        return an;
    const matrix = [];
    for (let i = 0; i <= bn; i++)
        matrix[i] = [i];
    for (let j = 0; j <= an; j++)
        matrix[0][j] = j;
    for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[bn][an];
}
async function evaluatePartnerMatch(lead) {
    const normPhone = (0, leadStore_1.normalizePhoneNumber)(lead.phone);
    const normEmail = (0, leadStore_1.normalizeEmail)(lead.email);
    const compName = (lead.company_name || '').trim().toLowerCase();
    const altName = (lead.alternate_name || '').trim().toLowerCase();
    // Fetch all partners
    const partners = await (0, supabase_1.queryAll)('SELECT id, partner_code, company_name, contact_person, email, phone FROM partners');
    const store = (0, leadStore_1.loadLeadStore)();
    const altContacts = store.partner_contacts || [];
    // Check 1: EXACT MATCH ON PRIMARY PHONE (LM-08)
    if (normPhone) {
        for (const p of partners) {
            const pPhone = (0, leadStore_1.normalizePhoneNumber)(p.phone);
            if (pPhone && pPhone === normPhone) {
                return {
                    hasMatch: true,
                    matchStatus: 'CONTACT_REVIEW',
                    matchType: 'EXACT_PHONE',
                    callBlocked: true, // LM-08: Suppress call action pending review
                    matchedPartner: p,
                    matchScore: 100,
                    matchFactors: [`Exact primary phone match: ${lead.phone} == ${p.phone}`],
                    reviewRequired: true
                };
            }
        }
        // Check 2: EXACT MATCH ON SECONDARY/ALTERNATE PARTNER PHONE (LM-08)
        for (const ac of altContacts) {
            if (ac.normalized_value === normPhone) {
                const matched = partners.find(p => p.id === ac.partner_id);
                if (matched) {
                    return {
                        hasMatch: true,
                        matchStatus: 'CONTACT_REVIEW',
                        matchType: 'ALTERNATE_PHONE',
                        callBlocked: true, // LM-08: Suppress call action pending review
                        matchedPartner: matched,
                        matchScore: 95,
                        matchFactors: [`Matches partner alternate contact phone: ${ac.contact_value}`],
                        reviewRequired: true
                    };
                }
            }
        }
    }
    // Check 3: EXACT PARTNER EMAIL MATCH (LM-10)
    if (normEmail) {
        for (const p of partners) {
            const pEmail = (0, leadStore_1.normalizeEmail)(p.email);
            if (pEmail && pEmail === normEmail) {
                return {
                    hasMatch: true,
                    matchStatus: 'CONTACT_REVIEW',
                    matchType: 'EXACT_EMAIL',
                    callBlocked: true, // LM-10: Suppress outreach to avoid contacting current partner as new lead
                    matchedPartner: p,
                    matchScore: 100,
                    matchFactors: [`Exact email match with active partner: ${lead.email}`],
                    reviewRequired: true
                };
            }
        }
    }
    // Check 4: PHONE SIMILARITY / PARTIAL MATCH (LM-09)
    // Flag for manual review; do not silently auto-link.
    if (normPhone && normPhone.length >= 8) {
        for (const p of partners) {
            const pPhone = (0, leadStore_1.normalizePhoneNumber)(p.phone);
            if (pPhone && pPhone.length >= 8) {
                // Check Levenshtein distance on 10-digit number
                const dist = levenshteinDistance(normPhone, pPhone);
                if (dist === 1 || (normPhone.endsWith(pPhone.slice(-8)) || pPhone.endsWith(normPhone.slice(-8)))) {
                    return {
                        hasMatch: true,
                        matchStatus: 'CONTACT_REVIEW',
                        matchType: 'PHONE_SIMILARITY',
                        callBlocked: true, // Require supervisor review before dialing
                        matchedPartner: p,
                        matchScore: 75,
                        matchFactors: [`Phone similarity detected (${dist <= 1 ? '1 digit difference' : '8-digit matching suffix'}) with partner ${p.partner_code}`],
                        reviewRequired: true
                    };
                }
            }
        }
    }
    // Check 5: EXACT PARTNER NAME MATCH ALONE (LM-11)
    // Show informational possible match, NOT an automatic duplicate decision or call block. Names are not unique.
    if (compName && compName.length > 2) {
        for (const p of partners) {
            const pName = (p.company_name || '').trim().toLowerCase();
            if (pName === compName || (altName && pName === altName)) {
                return {
                    hasMatch: true,
                    matchStatus: 'NAME_REVIEW',
                    matchType: 'NAME_SIMILARITY',
                    callBlocked: false, // LM-11: Names are not unique. Never block call action automatically.
                    matchedPartner: p,
                    matchScore: 50,
                    matchFactors: [`Name match detected: "${p.company_name}" (Informational alert only — names are not unique)`],
                    reviewRequired: true
                };
            }
        }
    }
    return {
        hasMatch: false,
        matchStatus: 'NO_MATCH',
        callBlocked: false,
        matchScore: 0,
        matchFactors: [],
        reviewRequired: false
    };
}
