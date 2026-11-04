"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
exports.apiRouter = (0, express_1.Router)();
// Helper: Extract current user from header or session (mockable auth header: x-user-id)
function getCurrentUser(req) {
    const userId = req.headers['x-user-id'] || 'usr_admin';
    const role = req.headers['x-user-role'] || 'admin';
    return { userId, role };
}
// ==========================================
// 1. HEALTH & METRICS CHECK
// ==========================================
exports.apiRouter.get('/health', async (_req, res) => {
    try {
        const check = await (0, db_1.getOne)('SELECT count(*) as count FROM leads');
        return res.json({
            status: 'ok',
            message: 'Node.js Express backend connected to database',
            leadCount: (check === null || check === void 0 ? void 0 : check.count) || 0,
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});
// ==========================================
// 2. DASHBOARD KPI & ANALYTICS
// ==========================================
exports.apiRouter.get('/dashboard', async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const { period = 'month', staff_id } = req.query;
        const { userId, role } = getCurrentUser(req);
        // Role-based staff filtering
        const effectiveStaffId = role === 'admin' ? (staff_id || null) : userId;
        // Date range calculations
        let dateFilterSql = "";
        const dateParams = [];
        if (period === 'today') {
            dateFilterSql = "date(created_at) = date('now', 'localtime')";
        }
        else if (period === 'yesterday') {
            dateFilterSql = "date(created_at) = date('now', '-1 day', 'localtime')";
        }
        else if (period === 'week') {
            dateFilterSql = "created_at >= datetime('now', '-7 days', 'localtime')";
        }
        else {
            // default month
            dateFilterSql = "created_at >= datetime('now', '-30 days', 'localtime')";
        }
        // Staff filter
        let staffFilterSql = "";
        if (effectiveStaffId) {
            staffFilterSql = " AND assigned_staff_id = ?";
        }
        // 1. Total Leads
        const leadsSql = `SELECT count(*) as count FROM leads WHERE ${dateFilterSql} ${staffFilterSql}`;
        const leadsParams = effectiveStaffId ? [effectiveStaffId] : [];
        const totalLeads = ((_a = (await (0, db_1.getOne)(leadsSql, leadsParams))) === null || _a === void 0 ? void 0 : _a.count) || 0;
        // 2. Calls Made & Connected
        let callStaffSql = "";
        const callParams = [];
        if (effectiveStaffId) {
            callStaffSql = " AND staff_id = ?";
            callParams.push(effectiveStaffId);
        }
        const callSql = `
      SELECT 
        count(*) as total_calls,
        sum(case when is_connected = 1 then 1 else 0 end) as connected_calls
      FROM call_activities
      WHERE ${dateFilterSql.replace(/created_at/g, 'call_timestamp')} ${callStaffSql}
    `;
        const callStats = await (0, db_1.getOne)(callSql, callParams);
        const totalCalls = (callStats === null || callStats === void 0 ? void 0 : callStats.total_calls) || 0;
        const connectedCalls = (callStats === null || callStats === void 0 ? void 0 : callStats.connected_calls) || 0;
        const connectionRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 1000) / 10 : 0;
        // 3. Interested Leads
        const interestedSql = `SELECT count(*) as count FROM leads WHERE status = 'Interested' ${staffFilterSql}`;
        const interestedCount = ((_b = (await (0, db_1.getOne)(interestedSql, leadsParams))) === null || _b === void 0 ? void 0 : _b.count) || 0;
        // 4. Overdue & Due Follow-ups
        let fuStaffSql = "";
        const fuParams = [];
        if (effectiveStaffId) {
            fuStaffSql = " AND assigned_staff_id = ?";
            fuParams.push(effectiveStaffId);
        }
        const overdueSql = `
      SELECT count(*) as count 
      FROM follow_ups 
      WHERE status = 'Pending' AND due_at < datetime('now', 'localtime') ${fuStaffSql}
    `;
        const overdueFollowups = ((_c = (await (0, db_1.getOne)(overdueSql, fuParams))) === null || _c === void 0 ? void 0 : _c.count) || 0;
        const dueTodaySql = `
      SELECT count(*) as count 
      FROM follow_ups 
      WHERE status = 'Pending' AND date(due_at) = date('now', 'localtime') ${fuStaffSql}
    `;
        const dueTodayFollowups = ((_d = (await (0, db_1.getOne)(dueTodaySql, fuParams))) === null || _d === void 0 ? void 0 : _d.count) || 0;
        // 5. Conversions & Conversion Rate
        let convStaffSql = "";
        const convParams = [];
        if (effectiveStaffId) {
            convStaffSql = " AND converted_by_staff_id = ?";
            convParams.push(effectiveStaffId);
        }
        const convSql = `
      SELECT count(*) as count, coalesce(sum(amount), 0) as total_amount
      FROM conversions
      WHERE ${dateFilterSql.replace(/created_at/g, 'converted_at')} ${convStaffSql}
    `;
        const convStats = await (0, db_1.getOne)(convSql, convParams);
        const totalConversions = (convStats === null || convStats === void 0 ? void 0 : convStats.count) || 0;
        const totalRevenue = (convStats === null || convStats === void 0 ? void 0 : convStats.total_amount) || 0;
        const conversionRate = totalLeads > 0 ? Math.round((totalConversions / totalLeads) * 1000) / 10 : 0;
        // 6. Lead Status Distribution
        const statusDist = await (0, db_1.query)(`
      SELECT status, count(*) as count 
      FROM leads 
      GROUP BY status
    `);
        // 7. Lead Source Performance
        const sourceStats = await (0, db_1.query)(`
      SELECT 
        lead_source_name as source,
        count(*) as total,
        sum(case when is_converted = 1 then 1 else 0 end) as converted
      FROM leads
      GROUP BY lead_source_name
      ORDER BY total DESC
    `);
        // 8. Hourly Calling Heatmap / Best Calling Hours
        const hourlyStats = await (0, db_1.query)(`
      SELECT 
        strftime('%H', call_timestamp) || ':00' as hour,
        count(*) as calls,
        sum(case when is_connected = 1 then 1 else 0 end) as connected,
        sum(case when outcome = 'Converted' then 1 else 0 end) as conversions
      FROM call_activities
      GROUP BY strftime('%H', call_timestamp)
      ORDER BY calls DESC
    `);
        const bestHour = hourlyStats.length > 0 ? hourlyStats[0] : null;
        // 9. Staff Leaderboard (for admins)
        const staffLeaderboard = await (0, db_1.query)(`
      SELECT 
        s.id,
        s.name,
        count(distinct c.id) as calls,
        count(distinct case when c.is_connected = 1 then c.id end) as connected,
        count(distinct conv.id) as conversions,
        case when count(distinct c.id) > 0 
          then round((count(distinct conv.id) * 100.0) / count(distinct c.id), 1)
          else 0 end as conv_rate
      FROM staff s
      LEFT JOIN call_activities c ON c.staff_id = s.id
      LEFT JOIN conversions conv ON conv.converted_by_staff_id = s.id
      GROUP BY s.id, s.name
      ORDER BY conversions DESC, calls DESC
    `);
        // 10. Recent Calling Activities
        const recentActivities = await (0, db_1.query)(`
      SELECT 
        c.id,
        c.call_timestamp,
        c.outcome,
        c.is_connected,
        c.duration_seconds,
        c.notes,
        l.customer_name,
        l.company_name,
        l.mobile_number,
        s.name as staff_name
      FROM call_activities c
      JOIN leads l ON l.id = c.lead_id
      JOIN staff s ON s.id = c.staff_id
      ORDER BY c.call_timestamp DESC
      LIMIT 6
    `);
        return res.json({
            kpis: {
                totalLeads,
                totalCalls,
                connectedCalls,
                connectionRate,
                interestedCount,
                overdueFollowups,
                dueTodayFollowups,
                totalConversions,
                totalRevenue,
                conversionRate,
            },
            statusDistribution: statusDist,
            sourcePerformance: sourceStats,
            hourlyStats,
            bestHour,
            staffLeaderboard,
            recentActivities,
        });
    }
    catch (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 3. LEADS MANAGEMENT APIS
// ==========================================
// GET /leads with search, pagination, status & source filters
exports.apiRouter.get('/leads', async (req, res) => {
    try {
        const { page = '1', limit = '15', search = '', status = '', source = '', staff_id = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
        const { userId, role } = getCurrentUser(req);
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 15;
        const offset = (pageNum - 1) * limitNum;
        const conditions = [];
        const params = [];
        // Security: non-admin only sees assigned leads unless specified
        if (role !== 'admin') {
            conditions.push('assigned_staff_id = ?');
            params.push(userId);
        }
        else if (staff_id) {
            conditions.push('assigned_staff_id = ?');
            params.push(staff_id);
        }
        if (search.trim()) {
            conditions.push('(customer_name LIKE ? OR mobile_number LIKE ? OR company_name LIKE ? OR email LIKE ?)');
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (source) {
            conditions.push('lead_source_name = ?');
            params.push(source);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const totalRow = await (0, db_1.getOne)(`SELECT count(*) as count FROM leads ${whereClause}`, params);
        const total = (totalRow === null || totalRow === void 0 ? void 0 : totalRow.count) || 0;
        // Fetch page items with assigned staff info
        const allowedSortCols = {
            created_at: 'l.created_at',
            customer_name: 'l.customer_name',
            status: 'l.status',
            last_contacted_at: 'l.last_contacted_at',
        };
        const orderCol = allowedSortCols[sortBy] || 'l.created_at';
        const direction = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const rows = await (0, db_1.query)(`
      SELECT 
        l.*,
        s.name as assigned_staff_name
      FROM leads l
      LEFT JOIN staff s ON s.id = l.assigned_staff_id
      ${whereClause}
      ORDER BY ${orderCol} ${direction}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);
        return res.json({
            leads: rows,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /leads/:id details with call history and followups
exports.apiRouter.get('/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await (0, db_1.getOne)(`
      SELECT l.*, s.name as assigned_staff_name 
      FROM leads l 
      LEFT JOIN staff s ON s.id = l.assigned_staff_id 
      WHERE l.id = ?
    `, [id]);
        if (!lead)
            return res.status(404).json({ error: 'Lead not found' });
        const calls = await (0, db_1.query)(`
      SELECT c.*, s.name as staff_name 
      FROM call_activities c
      JOIN staff s ON s.id = c.staff_id
      WHERE c.lead_id = ?
      ORDER BY c.call_timestamp DESC
    `, [id]);
        const followups = await (0, db_1.query)(`
      SELECT f.*, s.name as assigned_staff_name
      FROM follow_ups f
      JOIN staff s ON s.id = f.assigned_staff_id
      WHERE f.lead_id = ?
      ORDER BY f.due_at DESC
    `, [id]);
        const conversion = await (0, db_1.getOne)(`
      SELECT conv.*, s.name as staff_name
      FROM conversions conv
      JOIN staff s ON s.id = conv.converted_by_staff_id
      WHERE conv.lead_id = ?
    `, [id]);
        return res.json({
            lead,
            calls,
            followups,
            conversion
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /leads - Create new lead with duplicate mobile check
exports.apiRouter.post('/leads', async (req, res) => {
    try {
        const { customer_name, mobile_number, company_name, email, dsc_requirement, lead_source_name = 'Direct Enquiry', assigned_staff_id, notes, next_followup_at, } = req.body;
        if (!customer_name || !mobile_number) {
            return res.status(400).json({ error: 'Customer name and mobile number are required' });
        }
        // Duplicate check
        const existing = await (0, db_1.getOne)('SELECT id, customer_name, assigned_staff_id FROM leads WHERE mobile_number = ?', [mobile_number]);
        if (existing) {
            return res.status(409).json({
                error: `A lead with mobile number ${mobile_number} already exists (${existing.customer_name}).`,
                existingLeadId: existing.id,
            });
        }
        const id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        await (0, db_1.run)(`
      INSERT INTO leads (
        id, customer_name, mobile_number, company_name, email, 
        dsc_requirement, lead_source_name, assigned_staff_id, status, notes, next_followup_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)
    `, [
            id, customer_name, mobile_number, company_name || null, email || null,
            dsc_requirement || null, lead_source_name, assigned_staff_id || null, notes || null, next_followup_at || null
        ]);
        // If follow-up date was provided during creation, create follow-up record
        if (next_followup_at && assigned_staff_id) {
            const fId = `flw_${Date.now()}`;
            await (0, db_1.run)(`
        INSERT INTO follow_ups (id, lead_id, assigned_staff_id, due_at, priority, notes)
        VALUES (?, ?, ?, ?, 'Medium', 'Scheduled on lead creation')
      `, [fId, id, assigned_staff_id, next_followup_at]);
        }
        return res.status(201).json({ id, message: 'Lead created successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PUT /leads/:id - Update lead details
exports.apiRouter.put('/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { customer_name, mobile_number, company_name, email, dsc_requirement, lead_source_name, assigned_staff_id, status, notes, } = req.body;
        const existing = await (0, db_1.getOne)('SELECT * FROM leads WHERE id = ?', [id]);
        if (!existing)
            return res.status(404).json({ error: 'Lead not found' });
        // Business rule: Once converted, status cannot be accidentally reverted back to New or Contacted
        let finalStatus = status || existing.status;
        if (existing.is_converted === 1 && status !== 'Converted') {
            finalStatus = 'Converted';
        }
        await (0, db_1.run)(`
      UPDATE leads SET
        customer_name = coalesce(?, customer_name),
        mobile_number = coalesce(?, mobile_number),
        company_name = coalesce(?, company_name),
        email = coalesce(?, email),
        dsc_requirement = coalesce(?, dsc_requirement),
        lead_source_name = coalesce(?, lead_source_name),
        assigned_staff_id = coalesce(?, assigned_staff_id),
        status = ?,
        notes = coalesce(?, notes),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [
            customer_name, mobile_number, company_name, email, dsc_requirement,
            lead_source_name, assigned_staff_id, finalStatus, notes, id
        ]);
        return res.json({ message: 'Lead updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /leads/bulk-import - Excel / CSV batch import
exports.apiRouter.post('/leads/bulk-import', async (req, res) => {
    try {
        const { rows = [], default_source = 'Imported Database', assigned_staff_id } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'No rows provided for import' });
        }
        let importedCount = 0;
        let duplicatesSkipped = 0;
        let invalidSkipped = 0;
        for (const row of rows) {
            const name = (row.customer_name || row['Name'] || row['Customer Name'] || '').trim();
            let mobile = (row.mobile_number || row['Mobile'] || row['Phone'] || row['Phone Number'] || '').toString().trim();
            if (!name || !mobile) {
                invalidSkipped++;
                continue;
            }
            // Check duplicate mobile
            const dup = await (0, db_1.getOne)('SELECT id FROM leads WHERE mobile_number = ?', [mobile]);
            if (dup) {
                duplicatesSkipped++;
                continue;
            }
            const id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const company = row.company_name || row['Company'] || null;
            const email = row.email || row['Email'] || null;
            const dsc = row.dsc_requirement || row['Requirement'] || row['DSC Type'] || null;
            const source = row.lead_source_name || row['Source'] || default_source;
            await (0, db_1.run)(`
        INSERT INTO leads (
          id, customer_name, mobile_number, company_name, email, 
          dsc_requirement, lead_source_name, assigned_staff_id, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Imported via CSV/Excel')
      `, [id, name, mobile, company, email, dsc, source, assigned_staff_id || null]);
            importedCount++;
        }
        return res.json({
            message: 'Batch import complete',
            importedCount,
            duplicatesSkipped,
            invalidSkipped,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 4. CALLING WORKSPACE APIS
// ==========================================
// GET /calling/queue - Get assigned leads ready for calling
exports.apiRouter.get('/calling/queue', async (req, res) => {
    try {
        const { userId, role } = getCurrentUser(req);
        const { staff_id } = req.query;
        const targetStaff = role === 'admin' && staff_id ? staff_id : userId;
        // Fetch leads needing calls (excluding already converted or not-interested leads)
        const queue = await (0, db_1.query)(`
      SELECT 
        l.*,
        s.name as assigned_staff_name,
        (SELECT outcome FROM call_activities WHERE lead_id = l.id ORDER BY call_timestamp DESC LIMIT 1) as last_call_outcome,
        (SELECT call_timestamp FROM call_activities WHERE lead_id = l.id ORDER BY call_timestamp DESC LIMIT 1) as last_call_date
      FROM leads l
      LEFT JOIN staff s ON s.id = l.assigned_staff_id
      WHERE (l.assigned_staff_id = ? OR ? = 'usr_admin')
        AND l.status NOT IN ('Converted', 'Not Interested')
      ORDER BY 
        CASE 
          WHEN l.status = 'Interested' THEN 1
          WHEN l.status = 'Follow-up' THEN 2
          WHEN l.status = 'New' THEN 3
          ELSE 4 
        END,
        l.created_at DESC
      LIMIT 50
    `, [targetStaff, targetStaff]);
        return res.json({ queue });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /calling/log - Fast 1-click call logging
exports.apiRouter.post('/calling/log', async (req, res) => {
    try {
        const { userId } = getCurrentUser(req);
        const { lead_id, outcome, duration_seconds = 0, notes = '', followup_date, followup_priority = 'Medium', dsc_type, conversion_amount, } = req.body;
        if (!lead_id || !outcome) {
            return res.status(400).json({ error: 'lead_id and outcome are required' });
        }
        // Determine connection flag based on outcome
        const connectedOutcomes = [
            'Connected — Interested',
            'Connected — Not Interested',
            'Connected — Call Back Later',
            'Converted',
        ];
        const isConnected = connectedOutcomes.includes(outcome) ? 1 : 0;
        // 1. Insert Call Activity
        const callId = `call_${Date.now()}`;
        await (0, db_1.run)(`
      INSERT INTO call_activities (
        id, lead_id, staff_id, call_timestamp, outcome, is_connected, duration_seconds, notes
      ) VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?)
    `, [callId, lead_id, userId, outcome, isConnected, duration_seconds, notes]);
        // 2. Map Outcome to Lead Status
        let nextLeadStatus = 'Contacted';
        let isConverted = 0;
        if (outcome === 'Connected — Interested') {
            nextLeadStatus = 'Interested';
        }
        else if (outcome === 'Connected — Not Interested') {
            nextLeadStatus = 'Not Interested';
        }
        else if (outcome === 'Connected — Call Back Later') {
            nextLeadStatus = 'Follow-up';
        }
        else if (outcome === 'No Answer' || outcome === 'Switched Off') {
            nextLeadStatus = 'No Response';
        }
        else if (outcome === 'Converted') {
            nextLeadStatus = 'Converted';
            isConverted = 1;
        }
        // 3. Update Lead Record
        await (0, db_1.run)(`
      UPDATE leads SET 
        status = ?, 
        is_converted = max(is_converted, ?),
        last_contacted_at = datetime('now', 'localtime'),
        next_followup_at = coalesce(?, next_followup_at),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [nextLeadStatus, isConverted, followup_date || null, lead_id]);
        // 4. Create Follow-up if scheduled
        if (followup_date) {
            const fId = `flw_${Date.now()}`;
            await (0, db_1.run)(`
        INSERT INTO follow_ups (id, lead_id, assigned_staff_id, due_at, priority, status, notes)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?)
      `, [fId, lead_id, userId, followup_date, followup_priority, notes || 'Scheduled from calling session']);
        }
        // 5. If outcome was 'Converted', record conversion event
        if (outcome === 'Converted') {
            const convId = `conv_${Date.now()}`;
            const dsc = dsc_type || 'Class 3 - Individual Signing';
            const amount = parseFloat(conversion_amount) || 0;
            await (0, db_1.run)(`
        INSERT OR REPLACE INTO conversions (id, lead_id, converted_by_staff_id, converted_at, dsc_type, amount, notes)
        VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
      `, [convId, lead_id, userId, dsc, amount, notes]);
        }
        return res.json({
            message: 'Call logged successfully',
            call_id: callId,
            updated_status: nextLeadStatus,
        });
    }
    catch (err) {
        console.error('Call logging error:', err);
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 5. FOLLOW-UP WORKSPACE APIS
// ==========================================
exports.apiRouter.get('/followups', async (req, res) => {
    try {
        const { filter = 'today', staff_id } = req.query;
        const { userId, role } = getCurrentUser(req);
        const effectiveStaff = role === 'admin' ? (staff_id || null) : userId;
        let filterCondition = "";
        if (filter === 'due_today') {
            filterCondition = "f.status = 'Pending' AND date(f.due_at) = date('now', 'localtime')";
        }
        else if (filter === 'overdue') {
            filterCondition = "f.status = 'Pending' AND f.due_at < datetime('now', 'localtime')";
        }
        else if (filter === 'upcoming') {
            filterCondition = "f.status = 'Pending' AND f.due_at > datetime('now', 'localtime')";
        }
        else if (filter === 'completed') {
            filterCondition = "f.status = 'Completed'";
        }
        else {
            filterCondition = "f.status = 'Pending'";
        }
        const staffCondition = effectiveStaff ? "AND f.assigned_staff_id = ?" : "";
        const params = effectiveStaff ? [effectiveStaff] : [];
        const followups = await (0, db_1.query)(`
      SELECT 
        f.*,
        l.customer_name,
        l.company_name,
        l.mobile_number,
        l.dsc_requirement,
        s.name as assigned_staff_name,
        (SELECT outcome FROM call_activities WHERE lead_id = l.id ORDER BY call_timestamp DESC LIMIT 1) as last_call_outcome
      FROM follow_ups f
      JOIN leads l ON l.id = f.lead_id
      JOIN staff s ON s.id = f.assigned_staff_id
      WHERE ${filterCondition} ${staffCondition}
      ORDER BY f.due_at ASC
    `, params);
        return res.json({ followups });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PATCH /followups/:id/complete
exports.apiRouter.patch('/followups/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        await (0, db_1.run)(`
      UPDATE follow_ups SET 
        status = 'Completed',
        completed_at = datetime('now', 'localtime'),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [id]);
        return res.json({ message: 'Follow-up marked completed' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// PATCH /followups/:id/reschedule
exports.apiRouter.patch('/followups/:id/reschedule', async (req, res) => {
    try {
        const { id } = req.params;
        const { due_at, notes } = req.body;
        if (!due_at)
            return res.status(400).json({ error: 'due_at date is required' });
        await (0, db_1.run)(`
      UPDATE follow_ups SET 
        due_at = ?,
        notes = coalesce(?, notes),
        status = 'Pending',
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [due_at, notes || null, id]);
        return res.json({ message: 'Follow-up rescheduled successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 6. STAFF PERFORMANCE & TARGETS APIS
// ==========================================
exports.apiRouter.get('/staff/performance', async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let dateCond = "c.call_timestamp >= datetime('now', '-30 days', 'localtime')";
        if (period === 'today')
            dateCond = "date(c.call_timestamp) = date('now', 'localtime')";
        if (period === 'week')
            dateCond = "c.call_timestamp >= datetime('now', '-7 days', 'localtime')";
        const performance = await (0, db_1.query)(`
      SELECT 
        s.id,
        s.name,
        s.email,
        s.role,
        s.daily_call_target,
        s.daily_conversion_target,
        count(distinct c.id) as calls_made,
        count(distinct case when c.is_connected = 1 then c.id end) as calls_connected,
        count(distinct case when c.outcome = 'Connected — Interested' then l.id end) as interested_leads,
        count(distinct case when f.status = 'Completed' then f.id end) as followups_completed,
        count(distinct conv.id) as conversions,
        case when count(distinct c.id) > 0 
          then round((count(distinct case when c.is_connected = 1 then c.id end) * 100.0) / count(distinct c.id), 1)
          else 0 end as connection_rate,
        case when count(distinct case when c.is_connected = 1 then c.id end) > 0
          then round((count(distinct conv.id) * 100.0) / count(distinct case when c.is_connected = 1 then c.id end), 1)
          else 0 end as conversion_rate
      FROM staff s
      LEFT JOIN call_activities c ON c.staff_id = s.id AND ${dateCond}
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN follow_ups f ON f.assigned_staff_id = s.id
      LEFT JOIN conversions conv ON conv.converted_by_staff_id = s.id
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY conversions DESC, calls_made DESC
    `);
        return res.json({ performance });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 7. SETTINGS APIS
// ==========================================
exports.apiRouter.get('/settings', async (_req, res) => {
    try {
        const staffList = await (0, db_1.query)('SELECT id, name, email, role, daily_call_target, daily_conversion_target, is_active FROM staff ORDER BY name ASC');
        const sources = await (0, db_1.query)('SELECT * FROM lead_sources ORDER BY name ASC');
        const dscTypes = await (0, db_1.query)('SELECT * FROM dsc_types ORDER BY name ASC');
        return res.json({
            staff: staffList,
            leadSources: sources,
            dscTypes: dscTypes,
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/settings/sources', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Source name is required' });
        const id = `src_${Date.now()}`;
        await (0, db_1.run)('INSERT INTO lead_sources (id, name) VALUES (?, ?)', [id, name]);
        return res.json({ id, message: 'Source added' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.post('/settings/dsc-types', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name)
            return res.status(400).json({ error: 'DSC name is required' });
        const id = `dsc_${Date.now()}`;
        await (0, db_1.run)('INSERT INTO dsc_types (id, name, description) VALUES (?, ?, ?)', [id, name, description || null]);
        return res.json({ id, message: 'DSC type added' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.put('/settings/staff/:id/targets', async (req, res) => {
    try {
        const { id } = req.params;
        const { daily_call_target, daily_conversion_target } = req.body;
        await (0, db_1.run)(`
      UPDATE staff SET 
        daily_call_target = ?, 
        daily_conversion_target = ? 
      WHERE id = ?
    `, [daily_call_target, daily_conversion_target, id]);
        return res.json({ message: 'Targets updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ==========================================
// 8. DATA EXPORT APIS (CSV / JSON)
// ==========================================
exports.apiRouter.get('/export/leads', async (_req, res) => {
    try {
        const leads = await (0, db_1.query)(`
      SELECT 
        l.customer_name as "Customer Name",
        l.mobile_number as "Mobile Number",
        l.company_name as "Company",
        l.email as "Email",
        l.dsc_requirement as "DSC Requirement",
        l.lead_source_name as "Lead Source",
        l.status as "Status",
        s.name as "Assigned Staff",
        l.created_at as "Created Date"
      FROM leads l
      LEFT JOIN staff s ON s.id = l.assigned_staff_id
      ORDER BY l.created_at DESC
    `);
        res.setHeader('Content-Type', 'application/json');
        return res.json(leads);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.apiRouter.get('/export/calls', async (_req, res) => {
    try {
        const calls = await (0, db_1.query)(`
      SELECT 
        c.call_timestamp as "Call Time",
        l.customer_name as "Customer Name",
        l.mobile_number as "Phone",
        s.name as "Caller Staff",
        c.outcome as "Call Outcome",
        c.is_connected as "Connected",
        c.duration_seconds as "Duration (Sec)",
        c.notes as "Notes"
      FROM call_activities c
      JOIN leads l ON l.id = c.lead_id
      JOIN staff s ON s.id = c.staff_id
      ORDER BY c.call_timestamp DESC
    `);
        res.setHeader('Content-Type', 'application/json');
        return res.json(calls);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
