/**
 * Section 6: Mathematical Formulations & Business Logic Algorithms
 */

// 6.1 True Landed Cost Calculation
export interface LandedCostInput {
  quantityPurchased: number
  baseUnitPrice: number
  inwardShippingCost?: number
  customsOrTaxes?: number
  handlingCharges?: number
}

export interface LandedCostResult {
  totalBatchLandedCost: number
  unitLandedCost: number
  grossProfitPerBundle?: number
}

export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const {
    quantityPurchased,
    baseUnitPrice,
    inwardShippingCost = 0,
    customsOrTaxes = 0,
    handlingCharges = 0,
  } = input

  if (quantityPurchased <= 0) {
    throw new Error('Quantity purchased must be greater than zero')
  }

  const baseTotal = quantityPurchased * baseUnitPrice
  const totalBatchLandedCost =
    baseTotal + inwardShippingCost + customsOrTaxes + handlingCharges
  const unitLandedCost = Number((totalBatchLandedCost / quantityPurchased).toFixed(2))

  return {
    totalBatchLandedCost: Number(totalBatchLandedCost.toFixed(2)),
    unitLandedCost,
  }
}

export function calculateBundleGrossProfit(
  invoiceSalePrice: number,
  dscCaBaseFee: number,
  unitLandedCost: number
): number {
  return Number((invoiceSalePrice - (dscCaBaseFee + unitLandedCost)).toFixed(2))
}

// 6.2 Multi-Parameter Lead Deduplication Algorithm
export interface LeadDeduplicationInput {
  gstin?: string | null
  phone?: string | null
  email?: string | null
  pan?: string | null
  companyName?: string | null
}

export interface ExistingLeadRecord extends LeadDeduplicationInput {
  id: string
  leadCode?: string
}

export interface DuplicateMatchResult {
  matchedLeadId: string
  matchScore: number
  reasons: string[]
  isDuplicateAlert: boolean // Alert if matchScore >= 40
}

/**
 * Standard Levenshtein Distance calculation for fuzzy company name comparison
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim()
  const b = s2.toLowerCase().trim()
  if (a === b) return 1.0
  if (!a.length || !b.length) return 0.0

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const distance = matrix[b.length][a.length]
  const maxLength = Math.max(a.length, b.length)
  return 1 - distance / maxLength
}

export function evaluateLeadDuplicates(
  newLead: LeadDeduplicationInput,
  existingLeads: ExistingLeadRecord[]
): DuplicateMatchResult[] {
  const results: DuplicateMatchResult[] = []

  const cleanGstin = newLead.gstin?.trim().toUpperCase()
  const cleanPhone = newLead.phone?.replace(/[^0-9]/g, '').slice(-10)
  const cleanEmail = newLead.email?.trim().toLowerCase()
  const cleanPan = newLead.pan?.trim().toUpperCase()
  const cleanCompany = newLead.companyName?.trim()

  for (const lead of existingLeads) {
    let score = 0
    const reasons: string[] = []

    // 1. GSTIN Match (+50 Points)
    if (cleanGstin && lead.gstin && lead.gstin.trim().toUpperCase() === cleanGstin) {
      score += 50
      reasons.push('Exact GSTIN match (+50)')
    }

    // 2. Phone Match (+40 Points)
    if (cleanPhone && lead.phone) {
      const existingPhone = lead.phone.replace(/[^0-9]/g, '').slice(-10)
      if (existingPhone === cleanPhone && cleanPhone.length === 10) {
        score += 40
        reasons.push('Exact Phone match (+40)')
      }
    }

    // 3. Email Match (+35 Points)
    if (cleanEmail && lead.email && lead.email.trim().toLowerCase() === cleanEmail) {
      score += 35
      reasons.push('Exact Email match (+35)')
    }

    // 4. PAN Match (+30 Points)
    if (cleanPan && lead.pan && lead.pan.trim().toUpperCase() === cleanPan) {
      score += 30
      reasons.push('Exact PAN match (+30)')
    }

    // 5. Fuzzy Company Name Match (+20 Points if similarity > 85%)
    if (cleanCompany && lead.companyName) {
      const sim = levenshteinSimilarity(cleanCompany, lead.companyName)
      if (sim >= 0.85) {
        score += 20
        reasons.push(`Fuzzy company name similarity (${Math.round(sim * 100)}%) (+20)`)
      }
    }

    if (score > 0) {
      results.push({
        matchedLeadId: lead.id,
        matchScore: score,
        reasons,
        isDuplicateAlert: score >= 40,
      })
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore)
}

// 6.3 GST Tax Calculator
export interface GstCalculationResult {
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  total: number
  isInterstate: boolean
}

export function calculateGst(
  subtotal: number,
  clientStateCode: string,
  companyStateCode: string = '27', // Default Maharashtra 27
  gstRate: number = 0.18 // Standard 18%
): GstCalculationResult {
  const isInterstate = clientStateCode.trim() !== companyStateCode.trim()
  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isInterstate) {
    igst = Number((subtotal * gstRate).toFixed(2))
  } else {
    cgst = Number(((subtotal * gstRate) / 2).toFixed(2))
    sgst = Number(((subtotal * gstRate) / 2).toFixed(2))
  }

  const total = Number((subtotal + cgst + sgst + igst).toFixed(2))

  return {
    subtotal: Number(subtotal.toFixed(2)),
    cgst,
    sgst,
    igst,
    total,
    isInterstate,
  }
}

