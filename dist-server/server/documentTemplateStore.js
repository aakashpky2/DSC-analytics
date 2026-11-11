"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultTemplatesForOrg = ensureDefaultTemplatesForOrg;
exports.getDocumentTemplates = getDocumentTemplates;
exports.getDocumentTemplateById = getDocumentTemplateById;
exports.saveDocumentTemplate = saveDocumentTemplate;
exports.resolveActiveDocumentTemplate = resolveActiveDocumentTemplate;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
const documentTemplateEngine_1 = require("./documentTemplateEngine");
const STORE_TEMPLATES = 'document_html_templates';
/**
 * Seed default templates for any missing document types in an organization
 */
async function ensureDefaultTemplatesForOrg(orgId) {
    const types = ['PURCHASE_ORDER', 'PURCHASE_BILL', 'SALES_ESTIMATE', 'SALES_INVOICE'];
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_TEMPLATES);
    let changed = false;
    for (const docType of types) {
        const exists = all.some(t => t.organization_id === orgId && t.document_type === docType && t.is_default);
        if (!exists) {
            const def = (0, documentTemplateEngine_1.getDefaultTemplateHtmlForType)(docType);
            all.push({
                id: `tmpl-${docType.toLowerCase().replace('_', '-')}-default-${orgId}`,
                organization_id: orgId,
                company_profile_id: null,
                document_type: docType,
                template_name: def.template_name,
                template_code: `${def.template_code}_DEFAULT`,
                description: `Official statutory A4 printable ${docType.replace('_', ' ')} template.`,
                html_content: def.html_content,
                css_content: def.css_content,
                is_active: true,
                is_default: true,
                effective_from: '2026-01-01',
                effective_to: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            changed = true;
        }
    }
    if (changed) {
        await (0, dscMasterStore_1.saveRelationalStore)(STORE_TEMPLATES, all);
    }
}
/**
 * Retrieve templates with tenant and profile filtering (reads directly from Supabase document_html_templates with relational store fallback)
 */
async function getDocumentTemplates(orgId, docType, profileId) {
    await ensureDefaultTemplatesForOrg(orgId);
    try {
        let query = supabase_1.supabase.from('document_html_templates').select('*').eq('organization_id', orgId);
        if (docType) {
            query = query.eq('document_type', docType);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            return data
                .filter(t => !profileId || !t.company_profile_id || t.company_profile_id === profileId)
                .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
        }
    }
    catch (err) {
        // fallback to relational store
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_TEMPLATES);
    return all
        .filter(t => {
        if (t.organization_id !== orgId)
            return false;
        if (docType && t.document_type !== docType)
            return false;
        if (profileId && t.company_profile_id && t.company_profile_id !== profileId)
            return false;
        return true;
    })
        .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
}
/**
 * Retrieve a specific template by ID with organization verification
 */
async function getDocumentTemplateById(orgId, templateId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('document_html_templates')
            .select('*')
            .eq('organization_id', orgId)
            .eq('id', templateId)
            .maybeSingle();
        if (!error && data) {
            return data;
        }
    }
    catch (err) {
        // fallback
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_TEMPLATES);
    return all.find(t => t.id === templateId && t.organization_id === orgId) || null;
}
/**
 * Save or update a template in both Supabase table and relational store
 */
async function saveDocumentTemplate(template) {
    // 1. Supabase persistence
    try {
        await supabase_1.supabase.from('document_html_templates').upsert({
            id: template.id,
            organization_id: template.organization_id,
            company_profile_id: template.company_profile_id || null,
            document_type: template.document_type,
            template_name: template.template_name,
            template_code: template.template_code,
            description: template.description || null,
            html_content: template.html_content,
            css_content: template.css_content || null,
            is_active: template.is_active,
            is_default: template.is_default,
            effective_from: template.effective_from || '2026-04-01',
            effective_to: template.effective_to || null,
            updated_at: new Date().toISOString()
        });
    }
    catch (err) {
        console.warn('Could not upsert to document_html_templates table:', err);
    }
    // 2. Relational store persistence
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_TEMPLATES);
    const idx = all.findIndex(t => t.id === template.id && t.organization_id === template.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign({}, template), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(Object.assign(Object.assign({}, template), { created_at: template.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }));
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_TEMPLATES, all);
}
/**
 * Resolves the active template for a document following the priority rules:
 * 1. Explicit template selected for the transaction.
 * 2. Active template assigned to the selected Company Profile + Document Type.
 * 3. Organization-level active default template.
 */
async function resolveActiveDocumentTemplate(orgId, docType, profileId, explicitTemplateId, docDate) {
    await ensureDefaultTemplatesForOrg(orgId);
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_TEMPLATES);
    const targetDate = docDate || new Date().toISOString().slice(0, 10);
    // 1. Explicit template selection
    if (explicitTemplateId) {
        const explicit = all.find(t => t.id === explicitTemplateId && t.organization_id === orgId);
        if (explicit && explicit.is_active) {
            return explicit;
        }
    }
    // 2. Active template assigned to selected Profile + Document Type
    if (profileId) {
        const profileMatch = all.find(t => t.organization_id === orgId &&
            t.company_profile_id === profileId &&
            t.document_type === docType &&
            t.is_active &&
            (!t.effective_from || t.effective_from <= targetDate) &&
            (!t.effective_to || t.effective_to >= targetDate));
        if (profileMatch) {
            return profileMatch;
        }
    }
    // 3. Organization-level active default template
    const orgDefault = all.find(t => t.organization_id === orgId &&
        t.document_type === docType &&
        t.is_default &&
        t.is_active &&
        (!t.company_profile_id || t.company_profile_id === profileId));
    if (orgDefault) {
        return orgDefault;
    }
    // 4. Any active template of this type
    const fallback = all.find(t => t.organization_id === orgId && t.document_type === docType && t.is_active);
    return fallback || null;
}
