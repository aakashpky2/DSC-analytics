"use strict";
/**
 * Controlled Safe HTML Template Engine for Purchase Orders
 * Does NOT execute arbitrary JavaScript or database queries.
 * Evaluates controlled {{path.property}} and repeatable {{#items}}...{{/items}} blocks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePoTemplateHtml = validatePoTemplateHtml;
exports.renderPoHtml = renderPoHtml;
exports.getSamplePreviewContext = getSamplePreviewContext;
/**
 * Validate that an HTML template string is secure and well-formed.
 * Checks for prohibited script tags, external exploits, and required variable blocks.
 */
function validatePoTemplateHtml(html) {
    const errors = [];
    if (!html || typeof html !== 'string' || !html.trim()) {
        return { valid: false, errors: ['HTML template content is empty.'] };
    }
    // Security checks: Disallow executable scripts
    if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(html) || /javascript:/gi.test(html) || /onload\s*=/gi.test(html) || /onerror\s*=/gi.test(html)) {
        errors.push('Executable JavaScript, <script> tags, and inline event handlers are strictly prohibited in PO templates.');
    }
    // Check for repeatable items block
    if (!html.includes('{{#items}}') || !html.includes('{{/items}}')) {
        errors.push('Template must contain a repeatable {{#items}} ... {{/items}} block for the line items table.');
    }
    // Check essential variables
    const essentialPlaceholders = ['{{po.number}}', '{{buyer.legal_name}}', '{{vendor.party_name}}'];
    for (const ph of essentialPlaceholders) {
        if (!html.includes(ph)) {
            errors.push(`Template is missing essential placeholder: ${ph}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Resolves a nested key safely from the context object.
 */
function resolveValue(context, path) {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
        if (current === undefined || current === null)
            return '';
        current = current[part];
    }
    if (current === undefined || current === null)
        return '';
    return String(current);
}
/**
 * Renders the PO HTML by substituting placeholders with real PO context values.
 */
function renderPoHtml(templateHtml, context) {
    let rendered = templateHtml;
    // 1. Process repeatable items block: {{#items}} ... {{/items}}
    const itemsRegex = /\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/g;
    rendered = rendered.replace(itemsRegex, (_match, rowTemplate) => {
        if (!Array.isArray(context.items) || context.items.length === 0) {
            return '';
        }
        return context.items
            .map((item, idx) => {
            let row = rowTemplate;
            const itemWithIndex = Object.assign(Object.assign({}, item), { index: idx + 1 });
            // Replace {{item.*}}
            row = row.replace(/\{\{item\.([a-zA-Z0-9_]+)\}\}/g, (_m, field) => {
                const val = itemWithIndex[field];
                return val !== undefined && val !== null ? String(val) : '';
            });
            return row;
        })
            .join('\n');
    });
    // 2. Process simple condition: {{#if condition}} ... {{/if}}
    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    rendered = rendered.replace(ifRegex, (_match, condPath, content) => {
        const val = resolveValue(context, condPath);
        if (val && val !== '0' && val !== 'false' && val.trim() !== '') {
            return content;
        }
        return '';
    });
    // 3. Process all top-level placeholders: {{buyer.*}}, {{vendor.*}}, {{po.*}}, {{delivery.*}}
    const varRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
    rendered = rendered.replace(varRegex, (_match, varPath) => {
        return resolveValue(context, varPath);
    });
    // 4. Sanitize against executable scripts and event handlers in rendered output
    rendered = rendered
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\s*on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript:[^"'\s>]+/gi, '');
    return rendered;
}
/**
 * Builds a realistic preview PO context for live template previewing.
 */
function getSamplePreviewContext() {
    return {
        buyer: {
            legal_name: 'DBIZ Consultancy Services Pvt Ltd',
            trade_name: 'SignSync Central Procurement',
            gstin: '29AABCS1234F1Z5',
            pan: 'AABCS1234F',
            address: 'Corporate Towers, 4th Floor, Infopark',
            city: 'Bengaluru',
            district: 'Bengaluru Urban',
            state: 'Karnataka',
            country: 'India',
            pincode: '560100',
            email: 'procurement@dbizcorp.com',
            mobile: '+91 9845012345',
            contact_person: 'Procurement Manager'
        },
        vendor: {
            party_name: 'Feitian Technologies India Pvt Ltd',
            contact_person: 'Anil Kumar',
            address: 'Plot 42, Electronics City Phase 2',
            city: 'Bengaluru',
            district: 'Bengaluru Urban',
            state: 'Karnataka',
            country: 'India',
            pincode: '560100',
            email: 'sales@feitian.co.in',
            mobile: '+91 9888877777',
            gstin: '29AABCF1234F1Z8',
            pan: 'AABCF1234F'
        },
        po: {
            number: 'PO/26-27/0042',
            date: new Date().toISOString().slice(0, 10),
            status: 'ISSUED',
            currency: 'INR',
            subtotal: '22,500.00',
            gst_amount: '4,050.00',
            other_charges: '0.00',
            grand_total: '26,550.00',
            payment_terms: '100% advance against Proforma Invoice',
            delivery_terms: 'Door delivery within 5-7 working days',
            validity_terms: 'Valid for 15 days from PO date',
            inspection_terms: 'Defective tokens covered under instant 1-year RMA replacement warranty',
            remarks: 'FIPS 140-2 Level 3 certified tokens required with dual USB Type-A/Type-C packaging'
        },
        delivery: {
            location_name: 'Bangalore Central Tech Hub',
            address: 'Plot 18, Electronics City Phase 1',
            city: 'Bengaluru',
            district: 'Bengaluru Urban',
            state: 'Karnataka',
            country: 'India',
            pincode: '560100',
            contact_person: 'Warehouse Receiving Officer',
            mobile: '+91 9845098765',
            email: 'warehouse@dbizcorp.com'
        },
        items: [
            {
                index: 1,
                description: 'ePass2003 Auto Cryptographic USB Token',
                company: 'Feitian',
                product: 'ePass2003 Auto',
                version: 'v2.0 Standard',
                quantity: 50,
                unit_rate: '450.00',
                taxable_amount: '22,500.00',
                gst_percentage: 18,
                gst_amount: '4,050.00',
                other_charges: '0.00',
                total_amount: '26,550.00'
            }
        ]
    };
}
