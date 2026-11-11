"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DOCUMENT_REQUIREMENTS = exports.DEFAULT_WORKFLOW_STAGES = exports.STORE_DSC_STAGE_HISTORY = exports.STORE_DSC_APPLICATIONS = exports.STORE_DSC_ESTIMATES = exports.STORE_DSC_DOCUMENT_REQUIREMENTS = exports.STORE_DSC_WORKFLOW_STAGES = exports.STORE_DSC_DIRECT_RATE_CARDS = exports.STORE_DSC_ASSOCIATE_PARTNERS = void 0;
exports.getAssociatePartners = getAssociatePartners;
exports.getAssociatePartnerByPartnerId = getAssociatePartnerByPartnerId;
exports.saveAssociatePartner = saveAssociatePartner;
exports.deleteAssociatePartner = deleteAssociatePartner;
exports.getDscDirectRateCards = getDscDirectRateCards;
exports.saveDscDirectRateCard = saveDscDirectRateCard;
exports.deleteDscDirectRateCard = deleteDscDirectRateCard;
exports.getDscWorkflowStages = getDscWorkflowStages;
exports.saveDscWorkflowStage = saveDscWorkflowStage;
exports.getDscDocumentRequirements = getDscDocumentRequirements;
exports.saveDscDocumentRequirement = saveDscDocumentRequirement;
exports.getDscEstimates = getDscEstimates;
exports.saveDscEstimate = saveDscEstimate;
exports.deleteDscEstimate = deleteDscEstimate;
exports.getDscApplications = getDscApplications;
exports.saveDscApplication = saveDscApplication;
exports.deleteDscApplication = deleteDscApplication;
exports.getDscStageHistory = getDscStageHistory;
exports.addDscStageHistory = addDscStageHistory;
const dscMasterStore_1 = require("./dscMasterStore");
// Store table names in relational persistence
exports.STORE_DSC_ASSOCIATE_PARTNERS = 'dsc_associate_partners';
exports.STORE_DSC_DIRECT_RATE_CARDS = 'dsc_direct_rate_cards';
exports.STORE_DSC_WORKFLOW_STAGES = 'dsc_issuance_workflow_stages';
exports.STORE_DSC_DOCUMENT_REQUIREMENTS = 'dsc_issuance_document_requirements';
exports.STORE_DSC_ESTIMATES = 'dsc_issuance_estimates';
exports.STORE_DSC_APPLICATIONS = 'dsc_issuance_applications';
exports.STORE_DSC_STAGE_HISTORY = 'dsc_issuance_stage_history';
// ----------------------------------------------------------------------------
// Default Seed Workflow Stages & Document Requirements
// ----------------------------------------------------------------------------
exports.DEFAULT_WORKFLOW_STAGES = [
    { stage_key: 'APPL_RCVD', stage_name: 'Application Received', stage_order: 1, color: 'blue', description: 'Application initiated' },
    { stage_key: 'DOCS_PEND', stage_name: 'Documents Verification', stage_order: 2, color: 'amber', description: 'Collecting and verifying KYC documents' },
    { stage_key: 'PAY_CONF', stage_name: 'Payment Confirmed', stage_order: 3, color: 'indigo', description: 'Payment received and verified' },
    { stage_key: 'DSC_PROC', stage_name: 'DSC Processing / CA Verification', stage_order: 4, color: 'purple', description: 'CA video verification and approval' },
    { stage_key: 'TOK_ALLOC', stage_name: 'Token Allocation', stage_order: 5, color: 'cyan', description: 'Physical USB hardware token allocation from inventory' },
    { stage_key: 'DSC_ISSUED', stage_name: 'DSC Issued & Dispatched', stage_order: 6, color: 'emerald', description: 'Digital certificate issued and dispatched' },
    { stage_key: 'COMPLETED', stage_name: 'Completed', stage_order: 7, color: 'slate', description: 'Lifecycle finalized' },
];
exports.DEFAULT_DOCUMENT_REQUIREMENTS = [
    { stage_key: 'DOCS_PEND', name: 'Applicant PAN Card', field_type: 'DOCUMENT', is_mandatory: true },
    { stage_key: 'DOCS_PEND', name: 'Aadhaar / Address Proof', field_type: 'DOCUMENT', is_mandatory: true },
    { stage_key: 'DOCS_PEND', name: 'Passport Size Photograph', field_type: 'DOCUMENT', is_mandatory: false },
    { stage_key: 'DOCS_PEND', name: 'Organization Authorization Letter', field_type: 'DOCUMENT', is_mandatory: false },
];
// ----------------------------------------------------------------------------
// 1. Associate Partner Master Accessors
// ----------------------------------------------------------------------------
async function getAssociatePartners(orgId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ASSOCIATE_PARTNERS);
    return all.filter((r) => r.organization_id === orgId);
}
async function getAssociatePartnerByPartnerId(orgId, partnerId) {
    const all = await getAssociatePartners(orgId);
    return all.find((r) => r.partner_id === partnerId) || null;
}
async function saveAssociatePartner(config) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ASSOCIATE_PARTNERS);
    const idx = all.findIndex((r) => r.id === config.id && r.organization_id === config.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), config), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(config);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_ASSOCIATE_PARTNERS, all);
}
async function deleteAssociatePartner(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ASSOCIATE_PARTNERS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_ASSOCIATE_PARTNERS, filtered);
}
// ----------------------------------------------------------------------------
// 2. Direct DSC Rate Cards Accessors
// ----------------------------------------------------------------------------
async function getDscDirectRateCards(orgId, filter) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_DIRECT_RATE_CARDS);
    return all.filter((r) => {
        if (r.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.rateCardType) && r.rate_card_type !== filter.rateCardType)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyProfileId) && r.company_profile_id && r.company_profile_id !== filter.companyProfileId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyId) && r.company_id !== filter.companyId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.productId) && r.product_id !== filter.productId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.activeOnly) && !r.is_active)
            return false;
        return true;
    });
}
async function saveDscDirectRateCard(card) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_DIRECT_RATE_CARDS);
    const idx = all.findIndex((r) => r.id === card.id && r.organization_id === card.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), card), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(card);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_DIRECT_RATE_CARDS, all);
}
async function deleteDscDirectRateCard(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_DIRECT_RATE_CARDS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_DIRECT_RATE_CARDS, filtered);
}
// ----------------------------------------------------------------------------
// 3. Workflow Stages & Document Requirements Accessors
// ----------------------------------------------------------------------------
async function getDscWorkflowStages(orgId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_WORKFLOW_STAGES);
    let orgStages = all.filter((r) => r.organization_id === orgId);
    if (orgStages.length === 0) {
        // Seed default stages for organization
        const seeded = exports.DEFAULT_WORKFLOW_STAGES.map((s, idx) => ({
            id: `stg-def-${idx + 1}`,
            organization_id: orgId,
            stage_key: s.stage_key,
            stage_name: s.stage_name,
            stage_order: s.stage_order,
            color: s.color,
            description: s.description,
            is_active: true,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));
        await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_WORKFLOW_STAGES, [...all, ...seeded]);
        orgStages = seeded;
    }
    return orgStages.sort((a, b) => a.stage_order - b.stage_order);
}
async function saveDscWorkflowStage(stage) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_WORKFLOW_STAGES);
    const idx = all.findIndex((r) => r.id === stage.id && r.organization_id === stage.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), stage), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(stage);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_WORKFLOW_STAGES, all);
}
async function getDscDocumentRequirements(orgId, stageId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_DOCUMENT_REQUIREMENTS);
    let orgReqs = all.filter((r) => r.organization_id === orgId);
    if (orgReqs.length === 0) {
        // Seed default document requirements linked to stages
        const stages = await getDscWorkflowStages(orgId);
        const docsStage = stages.find((s) => s.stage_key === 'DOCS_PEND') || stages[1] || stages[0];
        const seeded = exports.DEFAULT_DOCUMENT_REQUIREMENTS.map((d, idx) => ({
            id: `doc-req-${idx + 1}`,
            organization_id: orgId,
            stage_id: docsStage.id,
            name: d.name,
            field_type: d.field_type,
            is_mandatory: d.is_mandatory,
            is_active: true,
            description: `Required verification: ${d.name}`,
            created_by: 'system',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));
        await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_DOCUMENT_REQUIREMENTS, [...all, ...seeded]);
        orgReqs = seeded;
    }
    if (stageId) {
        return orgReqs.filter((r) => r.stage_id === stageId);
    }
    return orgReqs;
}
async function saveDscDocumentRequirement(req) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_DOCUMENT_REQUIREMENTS);
    const idx = all.findIndex((r) => r.id === req.id && r.organization_id === req.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), req), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(req);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_DOCUMENT_REQUIREMENTS, all);
}
// ----------------------------------------------------------------------------
// 4. DSC Issuance Estimates Accessors
// ----------------------------------------------------------------------------
async function getDscEstimates(orgId, filter) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ESTIMATES);
    return all.filter((r) => {
        if (r.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyProfileId) && r.company_profile_id !== filter.companyProfileId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.clientId) && r.client_id !== filter.clientId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.status) && r.status !== filter.status)
            return false;
        return true;
    });
}
async function saveDscEstimate(est) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ESTIMATES);
    const idx = all.findIndex((r) => r.id === est.id && r.organization_id === est.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), est), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(est);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_ESTIMATES, all);
}
async function deleteDscEstimate(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_ESTIMATES);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_ESTIMATES, filtered);
}
// ----------------------------------------------------------------------------
// 5. DSC Issuance Applications Accessors
// ----------------------------------------------------------------------------
async function getDscApplications(orgId, filter) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_APPLICATIONS);
    return all.filter((r) => {
        if (r.organization_id !== orgId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.companyProfileId) && r.company_profile_id !== filter.companyProfileId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.clientId) && r.client_id !== filter.clientId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.stageId) && r.current_stage_id !== filter.stageId)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.status) && r.status !== filter.status)
            return false;
        if ((filter === null || filter === void 0 ? void 0 : filter.associatePartnerId) && r.associate_partner_id !== filter.associatePartnerId)
            return false;
        return true;
    });
}
async function saveDscApplication(app) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_APPLICATIONS);
    const idx = all.findIndex((r) => r.id === app.id && r.organization_id === app.organization_id);
    if (idx >= 0) {
        all[idx] = Object.assign(Object.assign(Object.assign({}, all[idx]), app), { updated_at: new Date().toISOString() });
    }
    else {
        all.push(app);
    }
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_APPLICATIONS, all);
}
async function deleteDscApplication(orgId, id) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_APPLICATIONS);
    const filtered = all.filter((r) => !(r.id === id && r.organization_id === orgId));
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_APPLICATIONS, filtered);
}
// ----------------------------------------------------------------------------
// 6. Application Stage History Accessors
// ----------------------------------------------------------------------------
async function getDscStageHistory(orgId, applicationId) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_STAGE_HISTORY);
    return all
        .filter((r) => r.organization_id === orgId && r.application_id === applicationId)
        .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
}
async function addDscStageHistory(history) {
    const all = await (0, dscMasterStore_1.getRelationalStore)(exports.STORE_DSC_STAGE_HISTORY);
    all.push(history);
    return await (0, dscMasterStore_1.saveRelationalStore)(exports.STORE_DSC_STAGE_HISTORY, all);
}
