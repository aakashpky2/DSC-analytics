import { Router, Request, Response } from 'express'
import { db } from '../db'

export const apiRouter = Router()

// Health check endpoint
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const { error } = await db.auth.getSession()

    if (error) {
      return res.status(500).json({ status: 'error', message: error.message })
    }

    return res.json({
      status: 'ok',
      message: 'Node.js Express backend connected to Supabase',
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown server error'
    return res.status(500).json({ status: 'error', message: errorMsg })
  }
})

// Analytics data endpoint example
apiRouter.get('/analytics/overview', async (_req: Request, res: Response) => {
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
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching analytics'
    return res.status(500).json({ status: 'error', message: errorMsg })
  }
})
