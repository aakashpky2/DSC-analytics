/**
 * Centralized Business Numbering Engine
 * Generates customizable reference numbers:
 * - Configurable prefix, suffix, and separator (/, -, _, or none)
 * - Flexible ordered segments: ['prefix', 'company', 'branch', 'fy', 'counter', 'suffix']
 * - Financial Year formats (e.g. 26-27, 2026-27, 2026, none)
 * - Zero padding (e.g., 00001)
 * - Concurrency safe counter progression
 */

export interface NumberingConfig {
  id: string
  series_name: string
  document_type: string
  prefix?: string | null
  suffix?: string | null
  separator: string // '/', '-', '_', ''
  parts_order: string // JSON string of string[] e.g. ["prefix", "fy", "counter", "suffix"]
  fy_format: string // 'none', 'YYYY', 'YY-YY', 'YYYY-YY'
  company_code?: string | null
  branch_code?: string | null
  counter_padding: number
  current_counter: number
  starting_counter: number
  is_active: number
}

/**
 * Returns formatted Financial Year or Calendar Year string based on format
 */
export function formatYearSegment(fyFormat: string, date: Date = new Date()): string {
  const fullYear = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  // Indian Fiscal Year starts in April (Month 4)
  const fyStart = month >= 4 ? fullYear : fullYear - 1
  const fyEnd = fyStart + 1

  switch (fyFormat) {
    case 'YYYY':
      return String(fullYear)
    case 'YY-YY': {
      const start2 = String(fyStart).slice(-2)
      const end2 = String(fyEnd).slice(-2)
      return `${start2}-${end2}`
    }
    case 'YYYY-YY': {
      const end2 = String(fyEnd).slice(-2)
      return `${fyStart}-${end2}`
    }
    case 'none':
    default:
      return ''
  }
}

/**
 * Generates formatted reference number according to parts_order
 */
export function formatReferenceNumber(
  config: NumberingConfig,
  counterValue: number,
  options?: { companyCode?: string; branchCode?: string; date?: Date }
): string {
  const date = options?.date || new Date()
  let order: string[] = ['prefix', 'fy', 'counter', 'suffix']
  try {
    if (typeof config.parts_order === 'string') {
      order = JSON.parse(config.parts_order)
    } else if (Array.isArray(config.parts_order)) {
      order = config.parts_order
    }
  } catch {
    order = ['prefix', 'fy', 'counter', 'suffix']
  }

  const paddedCounter = String(counterValue).padStart(config.counter_padding || 5, '0')
  const yearSegment = formatYearSegment(config.fy_format || 'none', date)
  const sep = config.separator !== undefined && config.separator !== null ? config.separator : '-'

  const segments: string[] = []

  for (const part of order) {
    switch (part) {
      case 'prefix':
        if (config.prefix && config.prefix.trim()) {
          segments.push(config.prefix.trim().toUpperCase())
        }
        break
      case 'company': {
        const comp = options?.companyCode || config.company_code
        if (comp && comp.trim()) segments.push(comp.trim().toUpperCase())
        break
      }
      case 'branch': {
        const br = options?.branchCode || config.branch_code
        if (br && br.trim()) segments.push(br.trim().toUpperCase())
        break
      }
      case 'fy':
        if (yearSegment) segments.push(yearSegment)
        break
      case 'counter':
        segments.push(paddedCounter)
        break
      case 'suffix':
        if (config.suffix && config.suffix.trim()) {
          segments.push(config.suffix.trim().toUpperCase())
        }
        break
      default:
        break
    }
  }

  return segments.join(sep)
}

