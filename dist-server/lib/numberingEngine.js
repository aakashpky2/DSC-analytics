"use strict";
/**
 * Centralized Business Numbering Engine
 * Generates customizable reference numbers:
 * - Configurable prefix, suffix, and separator (/, -, _, or none)
 * - Flexible ordered segments: ['prefix', 'company', 'branch', 'fy', 'counter', 'suffix']
 * - Financial Year formats (e.g. 26-27, 2026-27, 2026, none)
 * - Zero padding (e.g., 00001)
 * - Concurrency safe counter progression
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatYearSegment = formatYearSegment;
exports.formatReferenceNumber = formatReferenceNumber;
/**
 * Returns formatted Financial Year or Calendar Year string based on format
 */
function formatYearSegment(fyFormat, date = new Date()) {
    const fullYear = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    // Indian Fiscal Year starts in April (Month 4)
    const fyStart = month >= 4 ? fullYear : fullYear - 1;
    const fyEnd = fyStart + 1;
    switch (fyFormat) {
        case 'YYYY':
            return String(fullYear);
        case 'YY-YY': {
            const start2 = String(fyStart).slice(-2);
            const end2 = String(fyEnd).slice(-2);
            return `${start2}-${end2}`;
        }
        case 'YYYY-YY': {
            const end2 = String(fyEnd).slice(-2);
            return `${fyStart}-${end2}`;
        }
        case 'none':
        default:
            return '';
    }
}
/**
 * Generates formatted reference number according to parts_order
 */
function formatReferenceNumber(config, counterValue, options) {
    const date = (options === null || options === void 0 ? void 0 : options.date) || new Date();
    let order = ['prefix', 'fy', 'counter', 'suffix'];
    try {
        if (typeof config.parts_order === 'string') {
            order = JSON.parse(config.parts_order);
        }
        else if (Array.isArray(config.parts_order)) {
            order = config.parts_order;
        }
    }
    catch (_a) {
        order = ['prefix', 'fy', 'counter', 'suffix'];
    }
    const paddedCounter = String(counterValue).padStart(config.counter_padding || 5, '0');
    const yearSegment = formatYearSegment(config.fy_format || 'none', date);
    const sep = config.separator !== undefined && config.separator !== null ? config.separator : '-';
    const segments = [];
    for (const part of order) {
        switch (part) {
            case 'prefix':
                if (config.prefix && config.prefix.trim()) {
                    segments.push(config.prefix.trim().toUpperCase());
                }
                break;
            case 'company': {
                const comp = (options === null || options === void 0 ? void 0 : options.companyCode) || config.company_code;
                if (comp && comp.trim())
                    segments.push(comp.trim().toUpperCase());
                break;
            }
            case 'branch': {
                const br = (options === null || options === void 0 ? void 0 : options.branchCode) || config.branch_code;
                if (br && br.trim())
                    segments.push(br.trim().toUpperCase());
                break;
            }
            case 'fy':
                if (yearSegment)
                    segments.push(yearSegment);
                break;
            case 'counter':
                segments.push(paddedCounter);
                break;
            case 'suffix':
                if (config.suffix && config.suffix.trim()) {
                    segments.push(config.suffix.trim().toUpperCase());
                }
                break;
            default:
                break;
        }
    }
    return segments.join(sep);
}
