"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocumentNumberingSeries = getDocumentNumberingSeries;
exports.saveDocumentNumberingSeries = saveDocumentNumberingSeries;
exports.getDocumentNumberingRules = getDocumentNumberingRules;
exports.saveDocumentNumberingRule = saveDocumentNumberingRule;
exports.evaluateSmartSeriesRule = evaluateSmartSeriesRule;
exports.allocateNextDocumentNumber = allocateNextDocumentNumber;
const supabase_1 = require("./supabase");
const dscMasterStore_1 = require("./dscMasterStore");
const STORE_NUMBERING_SERIES = 'document_numbering_series';
const STORE_NUMBERING_RULES = 'document_numbering_rules';
/**
 * Fetch all numbering series for an organization, optionally filtered by profile and document type
 */
async function getDocumentNumberingSeries(orgId, profileId, docType) {
    try {
        let query = supabase_1.supabase.from('document_numbering_series').select('*').eq('organization_id', orgId);
        if (profileId)
            query = query.eq('company_profile_id', profileId);
        if (docType)
            query = query.eq('document_type', docType);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            return data;
        }
    }
    catch (err) {
        // fallback
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_NUMBERING_SERIES);
    return all.filter(s => s.organization_id === orgId &&
        (!profileId || s.company_profile_id === profileId) &&
        (!docType || s.document_type === docType));
}
/**
 * Save or update a numbering series in Supabase and relational store
 */
async function saveDocumentNumberingSeries(series) {
    try {
        await supabase_1.supabase.from('document_numbering_series').upsert({
            id: series.id,
            organization_id: series.organization_id,
            company_profile_id: series.company_profile_id,
            document_type: series.document_type,
            series_name: series.series_name,
            prefix: series.prefix,
            suffix: series.suffix || '',
            starting_number: series.starting_number,
            current_counter: series.current_counter,
            padding_length: series.padding_length,
            effective_from: series.effective_from,
            effective_to: series.effective_to || null,
            is_active: series.is_active,
            is_default: series.is_default,
            allow_reuse_on_cancellation: series.allow_reuse_on_cancellation || false,
            updated_at: new Date().toISOString()
        });
    }
    catch (err) {
        console.warn('Could not upsert to document_numbering_series table:', err);
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_NUMBERING_SERIES);
    const idx = all.findIndex(s => s.id === series.id && s.organization_id === series.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign({}, series), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(Object.assign(Object.assign({}, series), { created_at: series.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }));
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_NUMBERING_SERIES, all);
}
/**
 * Fetch all numbering rules for an organization, optionally filtered by profile and document type
 */
async function getDocumentNumberingRules(orgId, profileId, docType) {
    try {
        let query = supabase_1.supabase.from('document_numbering_rules').select('*').eq('organization_id', orgId);
        if (profileId)
            query = query.eq('company_profile_id', profileId);
        if (docType)
            query = query.eq('document_type', docType);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
            return data.sort((a, b) => (a.priority || 100) - (b.priority || 100));
        }
    }
    catch (err) {
        // fallback
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_NUMBERING_RULES);
    return all
        .filter(r => r.organization_id === orgId &&
        (!profileId || r.company_profile_id === profileId) &&
        (!docType || r.document_type === docType))
        .sort((a, b) => (a.priority || 100) - (b.priority || 100));
}
/**
 * Save or update a numbering rule in Supabase and relational store
 */
async function saveDocumentNumberingRule(rule) {
    try {
        await supabase_1.supabase.from('document_numbering_rules').upsert({
            id: rule.id,
            organization_id: rule.organization_id,
            company_profile_id: rule.company_profile_id,
            document_type: rule.document_type,
            series_id: rule.series_id,
            rule_name: rule.rule_name,
            priority: rule.priority,
            field: rule.field,
            operator: rule.operator,
            value: rule.value,
            is_active: rule.is_active,
            updated_at: new Date().toISOString()
        });
    }
    catch (err) {
        console.warn('Could not upsert to document_numbering_rules table:', err);
    }
    const all = await (0, dscMasterStore_1.getRelationalStore)(STORE_NUMBERING_RULES);
    const idx = all.findIndex(r => r.id === rule.id && r.organization_id === rule.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign({}, rule), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(Object.assign(Object.assign({}, rule), { created_at: rule.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }));
    }
    await (0, dscMasterStore_1.saveRelationalStore)(STORE_NUMBERING_RULES, all);
}
/**
 * Evaluates rules against customer and transaction context to select the best series automatically.
 * Explains WHY the series was chosen.
 */
async function evaluateSmartSeriesRule(orgId, profileId, docType, context) {
    const [rules, allSeries] = await Promise.all([
        getDocumentNumberingRules(orgId, profileId, docType),
        getDocumentNumberingSeries(orgId, profileId, docType)
    ]);
    const targetDate = context.document_date || new Date().toISOString().slice(0, 10);
    const activeSeries = allSeries.filter(s => {
        if (!s.is_active)
            return false;
        if (s.effective_from && s.effective_from > targetDate)
            return false;
        if (s.effective_to && s.effective_to < targetDate)
            return false;
        return true;
    });
    // Evaluate rules by priority
    const activeRules = rules.filter(r => r.is_active).sort((a, b) => a.priority - b.priority);
    const customer = context.customer || {};
    for (const rule of activeRules) {
        let rawVal = undefined;
        if (rule.field === 'customer.gst_registered') {
            rawVal = Boolean(customer.gstin && customer.gstin.trim() !== '' && customer.gstin !== 'UNREGISTERED');
        }
        else if (rule.field === 'customer.gstin') {
            rawVal = customer.gstin || '';
        }
        else if (rule.field === 'customer.state') {
            rawVal = customer.state || customer.state_name || '';
        }
        else if (rule.field === 'customer.state_code') {
            rawVal = customer.state_code || '';
        }
        else if (rule.field === 'customer.district') {
            rawVal = customer.district || '';
        }
        else if (rule.field === 'customer.city') {
            rawVal = customer.city || '';
        }
        else if (rule.field === 'customer.type') {
            rawVal = customer.type || '';
        }
        else if (rule.field === 'place_of_supply') {
            rawVal = context.place_of_supply || customer.state_code || '';
        }
        let isMatch = false;
        const targetVal = String(rule.value || '').trim().toLowerCase();
        const currentValStr = String(rawVal || '').trim().toLowerCase();
        switch (rule.operator) {
            case 'EQUALS':
                if (rule.field === 'customer.gst_registered') {
                    const expectBool = targetVal === 'true' || targetVal === '1' || targetVal === 'yes';
                    isMatch = Boolean(rawVal) === expectBool;
                }
                else {
                    isMatch = currentValStr === targetVal;
                }
                break;
            case 'NOT_EQUALS':
                if (rule.field === 'customer.gst_registered') {
                    const expectBool = targetVal === 'true' || targetVal === '1' || targetVal === 'yes';
                    isMatch = Boolean(rawVal) !== expectBool;
                }
                else {
                    isMatch = currentValStr !== targetVal;
                }
                break;
            case 'EXISTS':
                isMatch = rawVal !== undefined && rawVal !== null && currentValStr !== '';
                break;
            case 'NOT_EXISTS':
                isMatch = rawVal === undefined || rawVal === null || currentValStr === '';
                break;
            case 'IN': {
                const allowed = targetVal.split(',').map(s => s.trim());
                isMatch = allowed.includes(currentValStr);
                break;
            }
            case 'CONTAINS':
                isMatch = currentValStr.includes(targetVal);
                break;
        }
        if (isMatch) {
            const matchedSeries = activeSeries.find(s => s.id === rule.series_id);
            if (matchedSeries) {
                return {
                    matched: true,
                    selectedSeries: matchedSeries,
                    rule,
                    reason: `Rule '${rule.rule_name}' (Priority ${rule.priority}) matched on ${rule.field} ${rule.operator} '${rule.value}'.`
                };
            }
        }
    }
    // Fallback to active default series for this profile and document type
    const defaultSeries = activeSeries.find(s => s.is_default) || activeSeries[0] || null;
    if (defaultSeries) {
        return {
            matched: false,
            selectedSeries: defaultSeries,
            reason: `No custom rule matched. Reverted to default active series: '${defaultSeries.series_name}'.`
        };
    }
    return {
        matched: false,
        selectedSeries: null,
        reason: `No active series configured for profile ${profileId} and document ${docType}.`
    };
}
// Lock for in-process atomic number sequence generation
let allocationMutex = Promise.resolve();
/**
 * Concurrency-safe atomic number allocation using sequence or relational store counter.
 */
async function allocateNextDocumentNumber(orgId, profileId, docType, preferredSeriesId, docDate) {
    return new Promise((resolve, reject) => {
        allocationMutex = allocationMutex.then(async () => {
            try {
                const allSeries = await (0, dscMasterStore_1.getRelationalStore)(STORE_NUMBERING_SERIES);
                const targetDate = docDate || new Date().toISOString().slice(0, 10);
                let series = allSeries.find(s => s.organization_id === orgId &&
                    s.company_profile_id === profileId &&
                    s.document_type === docType &&
                    (!preferredSeriesId || s.id === preferredSeriesId) &&
                    s.is_active &&
                    (!s.effective_from || s.effective_from <= targetDate) &&
                    (!s.effective_to || s.effective_to >= targetDate));
                if (!series) {
                    // If not found, look for any active series for this profile & docType
                    series = allSeries.find(s => s.organization_id === orgId &&
                        s.company_profile_id === profileId &&
                        s.document_type === docType &&
                        s.is_active &&
                        (!s.effective_from || s.effective_from <= targetDate) &&
                        (!s.effective_to || s.effective_to >= targetDate));
                }
                if (!series) {
                    // Create an initial default series for this profile & document type
                    const shortProf = profileId.slice(-4).toUpperCase();
                    let prefix = '';
                    switch (docType) {
                        case 'SALES_ESTIMATE':
                            prefix = `EST-${shortProf}/26-27/`;
                            break;
                        case 'SALES_INVOICE':
                            prefix = `TSI-${shortProf}/26-27/`;
                            break;
                        case 'PURCHASE_ORDER':
                            prefix = `PO-${shortProf}/26-27/`;
                            break;
                        case 'PURCHASE_BILL':
                            prefix = `PB-${shortProf}/26-27/`;
                            break;
                    }
                    series = {
                        id: `series-${docType.toLowerCase()}-${profileId}-${Date.now()}`,
                        organization_id: orgId,
                        company_profile_id: profileId,
                        document_type: docType,
                        series_name: `Standard ${docType.replace('_', ' ')}`,
                        prefix,
                        suffix: '',
                        starting_number: 1001,
                        current_counter: 1000,
                        padding_length: 4,
                        effective_from: '2026-04-01',
                        effective_to: null,
                        is_active: true,
                        is_default: true,
                        allow_reuse_on_cancellation: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                    allSeries.push(series);
                }
                // Atomic increment
                if (series.current_counter === undefined || series.current_counter === null) {
                    series.current_counter = (series.starting_number || 1001) - 1;
                }
                series.current_counter = series.current_counter + 1;
                series.updated_at = new Date().toISOString();
                await (0, dscMasterStore_1.saveRelationalStore)(STORE_NUMBERING_SERIES, allSeries);
                const pad = series.padding_length || 4;
                const numStr = String(series.current_counter).padStart(pad, '0');
                const documentNumber = `${series.prefix}${numStr}${series.suffix || ''}`;
                resolve({ documentNumber, series });
            }
            catch (err) {
                reject(err);
            }
        });
    });
}
