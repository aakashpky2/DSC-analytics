"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
exports.apiRouter = (0, express_1.Router)();
// Health check endpoint
exports.apiRouter.get('/health', async (_req, res) => {
    try {
        const { error } = await db_1.db.auth.getSession();
        if (error) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
        return res.json({
            status: 'ok',
            message: 'Node.js Express backend connected to Supabase',
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown server error';
        return res.status(500).json({ status: 'error', message: errorMsg });
    }
});
// Analytics data endpoint example
exports.apiRouter.get('/analytics/overview', async (_req, res) => {
    try {
        // In production, query your tables like: await db.from('analytics').select('*')
        return res.json({
            status: 'success',
            data: {
                activeUsers: 1420,
                eventsTracked: 89320,
                systemHealth: 'optimal',
                serverTimestamp: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error fetching analytics';
        return res.status(500).json({ status: 'error', message: errorMsg });
    }
});
