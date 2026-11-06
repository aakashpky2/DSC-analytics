const fs = require('fs');
let code = fs.readFileSync('src/server/routes/leadManagement.ts', 'utf8');

const v2Additions = `
// ==========================================
// 6. Lead Management v2.0 Extensions: Bulk Import, Reassignment, Detail, Analytics
// ==========================================

import * as XLSX from 'xlsx'
import { allocateNextReferenceNumber } from '../../lib/numberingEngine'

// Helper: Sanitize string to prevent CSV formula injection
function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return ''
  let str = String(val).trim()
  if (['=', '+', '-', '@'].includes(str.charAt(0))) {
    str = "'" + str
  }
  return str
}

// 6.1 Download CSV & XLSX Templates (LM-33)
leadManagementRouter.get('/crm/leads/templates/:format', async (req: Request, res: Response) => {
  try {
    const format = req.params.format.toLowerCase()
    const templateData = [
      {
        'Company Name': 'Acme FinTech Corp',
        'Alternate Name': 'Acme Services',
        'Contact Person': 'Rajesh Sharma',
        'Mobile Phone': '9820011223',
        'Email': 'rajesh@acmefintech.in',
        'City': 'Mumbai',
        'District': 'Mumbai Suburban',
        'State': 'Maharashtra',
        'Postal Code': '400051',
        'Address': '402 Trade Centre, BKC',
        'Requirement Description': 'Needs 50 USB Tokens and Class 3 Signing DSC',
        'Service Intent': 'Both',
        'Lead Source': 'Partner CA Referral',
        'Category Name': 'Corporate & Enterprise Clients'
      },
      {
        'Company Name': 'Solo Legal Practice',
        'Alternate Name': '',
        'Contact Person': 'Adv. Priya Verma',
        'Mobile Phone': '9811100222',
        'Email': 'priya.verma@legaladvisors.in',
        'City': 'New Delhi',
        'District': 'South Delhi',
        'State': 'Delhi',
        'Postal Code': '110001',
        'Address': 'Bar Council Chambers',
        'Requirement Description': 'Single Class 3 DSC certificate for e-Courts filing',
        'Service Intent': 'DSC',
        'Lead Source': 'Direct Website Walk-in',
        'Category Name': 'Chartered Accountants & Advocates'
      }
    ]

    if (format === 'csv') {
      const headers = Object.keys(templateData[0]).join(',')
      const rows = templateData.map(row => 
        Object.values(row).map(val => '"' + sanitizeCsvValue(val).replace(/"/g, '""') + '"').join(',')
      ).join('\\n')
      const csvContent = headers + '\\n' + rows
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="SignSync_Lead_Import_Template.csv"')
      return res.send(csvContent)
    } else if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(templateData)
      XLSX.utils.book_append_sheet(wb, ws, 'Lead_Template')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="SignSync_Lead_Import_Template.xlsx"')
      return res.send(buf)
    } else {
      return res.status(400).json({ error: 'Format must be csv or xlsx.' })
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.2 Bulk Upload & Preview with Validation, Internal Deduplication & Partner Conflict (LM-34, LM-35)
leadManagementRouter.post('/crm/leads/import/preview', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const { rawData, fileName } = req.body
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return res.status(400).json({ error: 'Empty or invalid spreadsheet data.' })
    }

    if (rawData.length > 500) {
      return res.status(400).json({ error: 'Maximum row limit of 500 rows per import batch exceeded.' })
    }

    const seenPhonesInBatch = new Set<string>()
    const seenEmailsInBatch = new Set<string>()

    const evaluatedRows = []
    const rejectedRows = []
    let validCount = 0
    let duplicateCount = 0
    let partnerConflictCount = 0

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i]
      const rowNum = i + 2 // Assuming row 1 is header

      const companyName = String(row['Company Name'] || row.company_name || row['Name'] || '').trim()
      const altName = String(row['Alternate Name'] || row.alternate_name || '').trim()
      const contactPerson = String(row['Contact Person'] || row.contact_person || '').trim()
      const phone = String(row['Mobile Phone'] || row.phone || row['Phone'] || row['Mobile'] || '').trim()
      const email = String(row['Email'] || row.email || row['Email ID'] || '').trim().toLowerCase()
      const city = String(row['City'] || row['City/Town'] || row.city || '').trim()
      const district = String(row['District'] || row.district || '').trim()
      const state = String(row['State'] || row.state || '').trim()
      const postalCode = String(row['Postal Code'] || row['PIN Code'] || row.pin_code || '').trim()
      const address = String(row['Address'] || row.address || '').trim()
      const reqSummary = String(row['Requirement Description'] || row['Notes'] || row.requirement_summary || '').trim()
      const serviceIntent = String(row['Service Intent'] || row.service_intent || 'Undecided').trim()

      // Check within-file duplicates
      const normPhone = phone.replace(/[^0-9]/g, '')
      let isBatchDuplicate = false
      if (normPhone && seenPhonesInBatch.has(normPhone)) {
        isBatchDuplicate = true
      }
      if (email && seenEmailsInBatch.has(email)) {
        isBatchDuplicate = true
      }
      if (normPhone) seenPhonesInBatch.add(normPhone)
      if (email) seenEmailsInBatch.add(email)

      if (isBatchDuplicate) {
        duplicateCount++
        rejectedRows.push({ row: rowNum, reason: 'Duplicate contact within same import spreadsheet', rowData: row })
        continue
      }

      // Partner match evaluation
      const partnerMatch = await evaluatePartnerMatch({
        company_name: companyName,
        alternate_name: altName,
        email,
        phone
      })

      if (partnerMatch.callBlocked) {
        partnerConflictCount++
      }

      validCount++
      evaluatedRows.push({
        rowNum,
        companyName,
        altName,
        contactPerson,
        phone,
        email,
        city,
        district,
        state,
        postalCode,
        address,
        reqSummary,
        serviceIntent,
        partnerMatch: {
          hasMatch: partnerMatch.hasMatch,
          matchStatus: partnerMatch.matchStatus,
          matchType: partnerMatch.matchType,
          callBlocked: partnerMatch.callBlocked,
          matchedPartnerName: partnerMatch.matchedPartner?.company_name,
          matchFactors: partnerMatch.matchFactors
        }
      })
    }

    const batchId = 'batch-' + Date.now()
    const fingerprint = 'fp-' + rawData.length + '-' + Date.now()

    return res.json({
      success: true,
      batchId,
      fingerprint,
      fileName: fileName || 'bulk_import.xlsx',
      summary: {
        totalRows: rawData.length,
        validRows: validCount,
        rejectedRows: rejectedRows.length,
        duplicateRows: duplicateCount,
        partnerConflictRows: partnerConflictCount
      },
      previewRows: evaluatedRows.slice(0, 50),
      rejectedSample: rejectedRows.slice(0, 10)
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.3 Commit Bulk Import Batch (LM-36, LM-37, LM-38)
leadManagementRouter.post('/crm/leads/import/commit', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const { rows, category_id, source_id, assigned_to } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No validated rows provided to commit.' })
    }

    const store = loadLeadStore()
    const committedLeadIds: string[] = []

    for (const r of rows) {
      const id = 'lead-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      const lead_code = await allocateNextReferenceNumber('lead')

      const cleanCompany = r.companyName ? String(r.companyName).trim() : ''
      const cleanContact = r.contactPerson ? String(r.contactPerson).trim() : ''
      const cleanEmail = r.email ? String(r.email).trim().toLowerCase() : ''
      const cleanPhone = r.phone ? String(r.phone).trim() : ''
      const cleanReq = r.reqSummary ? String(r.reqSummary).trim() : ''

      const partnerMatch = await evaluatePartnerMatch({
        company_name: cleanCompany,
        alternate_name: r.altName || null,
        email: cleanEmail,
        phone: cleanPhone
      })

      // Insert into PostgreSQL
      await run(\`
        INSERT INTO crm_leads (id, lead_code, company_name, contact_person, email, phone, gstin, pan, requirement_summary, status, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'new', ?)
      \`, [id, lead_code, cleanCompany, cleanContact, cleanEmail, cleanPhone, cleanReq, assigned_to || null])

      // Save extended metadata
      store.extended_leads[id] = {
        alternate_name: r.altName || null,
        city: r.city || null,
        state: r.state || null,
        district: r.district || null,
        address: r.address || null,
        pin_code: r.postalCode || null,
        source_id: source_id || null,
        category_id: category_id || null,
        service_intent: r.serviceIntent || 'Undecided',
        pipeline_status: 'NEW',
        match_status: partnerMatch.matchStatus,
        linked_partner_id: partnerMatch.matchedPartner?.id || null,
        partner_match_score: partnerMatch.matchScore,
        partner_match_factors: partnerMatch.matchFactors.join(' | '),
        assigned_to: assigned_to || null,
        assignment_history: assigned_to ? [{
          assigned_to,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          reason: 'Initial Bulk Import Assignment'
        }] : []
      }

      store.service_tracking[id] = {
        id: 'lst-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        lead_id: id,
        service_intent: r.serviceIntent || 'Undecided',
        token_requested: (r.serviceIntent === 'Token' || r.serviceIntent === 'Both') ? 1 : 0,
        token_fulfilled: 0,
        dsc_requested: (r.serviceIntent === 'DSC' || r.serviceIntent === 'Both') ? 1 : 0,
        dsc_fulfilled: 0,
        tracking_status: 'PENDING_QUALIFICATION',
        last_updated_by: user.id,
        updated_at: new Date().toISOString()
      }

      committedLeadIds.push(id)
    }

    saveLeadStore(store)
    return res.status(201).json({
      success: true,
      committedCount: committedLeadIds.length,
      leadIds: committedLeadIds,
      message: 'Successfully imported ' + committedLeadIds.length + ' customer leads.'
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.4 Lead Reassignment & Allocation (LM-39)
leadManagementRouter.patch('/crm/leads/:id/assign', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const leadId = String(req.params.id)
    const { assigned_to, reason } = req.body

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}

    // Enforce category access
    if (!canUserAccessLead(user, ext.category_id)) {
      return res.status(403).json({ error: 'You do not have access to manage leads in this category.' })
    }

    // Verify target executive has access to this category
    if (assigned_to) {
      const targetExecutive = await queryOne('SELECT id, full_name, hierarchy_level_id FROM user_profiles WHERE id = ?', [assigned_to])
      if (!targetExecutive) {
        return res.status(404).json({ error: 'Target staff account not found.' })
      }
      if (ext.category_id && !canUserAccessLead({ id: assigned_to, hierarchy_level_order: 3 }, ext.category_id)) {
        return res.status(400).json({ error: 'Target staff member is not authorized for this lead category.' })
      }
    }

    // Update assignment in PostgreSQL
    await run('UPDATE crm_leads SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [assigned_to || null, leadId])

    // Update assignment history
    if (!ext.assignment_history) ext.assignment_history = []
    ext.assignment_history.push({
      assigned_to: assigned_to || 'UNASSIGNED',
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      reason: reason || 'Supervisory Reallocation'
    })
    ext.assigned_to = assigned_to || null
    store.extended_leads[leadId] = ext
    saveLeadStore(store)

    return res.json({ success: true, message: 'Lead assignment successfully updated.', assigned_to })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.5 Comprehensive Follow-Up Action Center & KPIs (LM-40, LM-41)
leadManagementRouter.get('/crm/action-center', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const store = loadLeadStore()
    const tatDays = store.tat_settings?.[0]?.first_contact_tat_days || 2
    const todayStr = new Date().toISOString().split('T')[0]

    // Fetch accessible leads
    const allLeads = await queryAll<any>('SELECT l.*, u.full_name as assigned_agent_name FROM crm_leads l LEFT JOIN user_profiles u ON l.assigned_to = u.id WHERE l.is_merged = 0 ORDER BY l.created_at DESC')
    const scopedLeads = allLeads.filter(l => {
      const ext = store.extended_leads[l.id]
      return canUserAccessLead(user, ext?.category_id)
    })

    const followUps = await queryAll<any>('SELECT * FROM crm_follow_ups ORDER BY scheduled_at ASC')
    const fuMap = new Map<string, any>()
    followUps.forEach(f => {
      if (f.status === 'scheduled') fuMap.set(f.lead_id, f)
    })

    let newCount = 0
    let overdueCount = 0
    let dueTodayCount = 0
    let unassignedCount = 0
    let wonCount = 0
    let pendingTokenCount = 0
    let pendingDscCount = 0

    const enrichedQueue = scopedLeads.map(l => {
      const ext = store.extended_leads[l.id] || {}
      const st = store.service_tracking[l.id] || {}
      const fu = fuMap.get(l.id)

      if (l.status === 'new') newCount++
      if (!l.assigned_to) unassignedCount++
      if (l.status === 'won' || ext.pipeline_status === 'WON') wonCount++
      if (st.token_requested === 1 && st.token_fulfilled === 0) pendingTokenCount++
      if (st.dsc_requested === 1 && st.dsc_fulfilled === 0) pendingDscCount++

      const createdAt = new Date(l.created_at)
      const tatDue = new Date(createdAt.getTime() + tatDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      let bucket: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'UNSCHEDULED' = 'UNSCHEDULED'
      let effectiveDate = tatDue

      if (fu) {
        effectiveDate = fu.scheduled_at.split('T')[0]
        if (effectiveDate < todayStr) {
          bucket = 'OVERDUE'
          overdueCount++
        } else if (effectiveDate === todayStr) {
          bucket = 'DUE_TODAY'
          dueTodayCount++
        } else {
          bucket = 'UPCOMING'
        }
      } else {
        if (tatDue < todayStr) {
          bucket = 'OVERDUE'
          overdueCount++
        } else if (tatDue === todayStr) {
          bucket = 'DUE_TODAY'
          dueTodayCount++
        }
      }

      return {
        ...l,
        city: ext.city || null,
        alternate_name: ext.alternate_name || null,
        category_id: ext.category_id || null,
        source_id: ext.source_id || null,
        service_intent: ext.service_intent || 'Undecided',
        pipeline_status: ext.pipeline_status || l.status.toUpperCase(),
        match_status: ext.match_status || 'NO_MATCH',
        bucket,
        effectiveDueDate: effectiveDate,
        followUp: fu || null
      }
    })

    const totalLeads = scopedLeads.length
    const conversionRate = totalLeads > 0 ? Number(((wonCount / totalLeads) * 100).toFixed(1)) : 0

    return res.json({
      success: true,
      kpis: {
        totalLeads,
        newLeads: newCount,
        overdueCount,
        dueTodayCount,
        unassignedCount,
        conversionRate,
        pendingTokenCount,
        pendingDscCount
      },
      queue: enrichedQueue
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.6 Update CRM Pipeline Status (LM-42)
leadManagementRouter.patch('/crm/leads/:id/pipeline-status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const leadId = String(req.params.id)
    const { pipeline_status } = req.body

    const allowed = ['NEW', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']
    if (!allowed.includes(pipeline_status)) {
      return res.status(400).json({ error: 'Invalid pipeline status. Must be one of: ' + allowed.join(', ') })
    }

    const store = loadLeadStore()
    const ext = store.extended_leads[leadId] || {}
    if (!canUserAccessLead(user, ext.category_id)) {
      return res.status(403).json({ error: 'You do not have access to this lead.' })
    }

    ext.pipeline_status = pipeline_status
    store.extended_leads[leadId] = ext
    saveLeadStore(store)

    // Also update main status in PostgreSQL
    await run('UPDATE crm_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pipeline_status.toLowerCase(), leadId])

    return res.json({ success: true, pipeline_status })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// 6.7 Analytics & Performance Metrics (Phase 8)
leadManagementRouter.get('/crm/analytics', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Authentication required.' })

    const store = loadLeadStore()
    const allLeads = await queryAll<any>('SELECT l.*, u.full_name as assigned_agent_name FROM crm_leads l LEFT JOIN user_profiles u ON l.assigned_to = u.id WHERE l.is_merged = 0')
    const scoped = allLeads.filter(l => canUserAccessLead(user, store.extended_leads[l.id]?.category_id))

    // Sources breakdown
    const sourceMap: Record<string, { total: number; won: number }> = {}
    const categoryMap: Record<string, number> = {}

    for (const l of scoped) {
      const ext = store.extended_leads[l.id] || {}
      const sId = ext.source_id || 'Direct / Walk-in'
      const cId = ext.category_id || 'Uncategorized'

      if (!sourceMap[sId]) sourceMap[sId] = { total: 0, won: 0 }
      sourceMap[sId].total++
      if (l.status === 'won' || ext.pipeline_status === 'WON') sourceMap[sId].won++

      categoryMap[cId] = (categoryMap[cId] || 0) + 1
    }

    return res.json({
      success: true,
      totalLeads: scoped.length,
      bySource: sourceMap,
      byCategory: categoryMap
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})
`;

code += v2Additions;
fs.writeFileSync('src/server/routes/leadManagement.ts', code, 'utf8');
console.log('Appended Lead Management v2.0 routes successfully.');

