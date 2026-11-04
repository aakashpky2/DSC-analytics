import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import next from 'next'
import { apiRouter } from './routes/api'
import { SESSION_COOKIE_NAME, validateSessionToken } from './auth'
import { run } from './localDb'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

// Initialize Next.js app with SSR
const nextApp = next({ dev, hostname, port })
const handle = nextApp.getRequestHandler()

// Public frontend routes and static assets that do not require authentication
const PUBLIC_PAGE_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/_next',
  '/favicon.ico',
  '/favicon.png',
  '/icon.png',
  '/apple-icon.png',
  '/signsync-logo.png',
  '/logo.png',
  '/next.svg',
  '/vercel.svg',
]

async function startServer() {
  await nextApp.prepare()

  // Ensure sessions and password reset tables exist
  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const server = express()

  server.use(cors())
  server.use(cookieParser())
  server.use(express.json())
  server.use(express.urlencoded({ extended: true }))

  // Backend API endpoints mounted on /api
  server.use('/api', apiRouter)

  // SSR Page Level Authentication Guard:
  // Protect all commercial business pages. Unauthenticated users are redirected to /login.
  server.use(async (req, res, nextRoute) => {
    const urlPath = req.path

    // Allow Next.js internal static assets and public auth pages
    const isPublic = PUBLIC_PAGE_PREFIXES.some((prefix) => urlPath.startsWith(prefix))
    if (isPublic) {
      // If user is already authenticated and visits /login, redirect to /
      if (urlPath === '/login') {
        const token = req.cookies?.[SESSION_COOKIE_NAME]
        if (token) {
          const user = await validateSessionToken(token)
          if (user) {
            return res.redirect('/')
          }
        }
      }
      return nextRoute()
    }

    // Check for valid session cookie
    const token = req.cookies?.[SESSION_COOKIE_NAME]
    if (!token) {
      return res.redirect('/login')
    }

    const user = await validateSessionToken(token)
    if (!user) {
      // Invalidate expired/bad cookie and redirect to login
      res.clearCookie(SESSION_COOKIE_NAME)
      return res.redirect('/login')
    }

    // Set cache prevention headers on protected responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    // Attach user to request for SSR handlers
    ;(req as any).user = user
    return nextRoute()
  })

  // Next.js handles page rendering via Server-Side Rendering (SSR)
  server.all('{*path}', (req, res) => {
    return handle(req, res)
  })

  server.listen(port, () => {
    console.log(`> [SignSync B2B] Server running on http://${hostname}:${port}`)
    console.log(`> Backend API mounted at /api/* with strict RBAC & session verification`)
    console.log(`> Next.js SSR protected by server-side authentication guard`)
  })
}

startServer().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})
