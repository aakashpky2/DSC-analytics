// Catch-all API Route for Next.js App Router on Serverless / Managed Hosting (Hostinger)
// Bridges all /api/* requests directly into Express apiRouter when running via 'next start'
import { NextRequest, NextResponse } from 'next/server'
import { apiRouter } from '@/server/routes/api'
import express from 'express'
import cookieParser from 'cookie-parser'

// Create Express app wrapper
const app = express()
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use(cookieParser())

// Mount API router
app.use('/api', apiRouter)

// Helper to convert NextRequest to Express request & capture response
async function handleNextApiRequest(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const url = new URL(req.url)
  const pathname = `/api/${(slug || []).join('/')}`
  const method = req.method
  const headers: Record<string, string> = {}
  req.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val
  })

  // Read body if method has body
  let body: any = undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = headers['content-type'] || ''
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      const searchParams = new URLSearchParams(text)
      body = Object.fromEntries(searchParams.entries())
    } else {
      body = await req.text().catch(() => '')
    }
  }

  return new Promise<NextResponse>((resolve) => {
    // Custom simulated response
    let statusCode = 200
    const resHeaders = new Headers()
    let responseBody: any = null
    const cookiesToSet: string[] = []

    const mockRes: any = {
      status(code: number) {
        statusCode = code
        return this
      },
      statusCode: 200,
      setHeader(name: string, value: any) {
        if (name.toLowerCase() === 'set-cookie') {
          if (Array.isArray(value)) {
            value.forEach((v) => cookiesToSet.push(v))
          } else {
            cookiesToSet.push(String(value))
          }
        } else {
          resHeaders.set(name, String(value))
        }
        return this
      },
      header(name: string, value: any) {
        return this.setHeader(name, value)
      },
      cookie(name: string, value: string, options: any = {}) {
        let cookieStr = `${name}=${encodeURIComponent(value)}`
        if (options.maxAge) cookieStr += `; Max-Age=${Math.floor(options.maxAge / 1000)}`
        if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`
        if (options.httpOnly) cookieStr += '; HttpOnly'
        if (options.secure) cookieStr += '; Secure'
        if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`
        cookieStr += `; Path=${options.path || '/'}`
        cookiesToSet.push(cookieStr)
        return this
      },
      clearCookie(name: string, options: any = {}) {
        let cookieStr = `${name}=; Max-Age=0; Path=${options.path || '/'}`
        cookiesToSet.push(cookieStr)
        return this
      },
      json(data: any) {
        resHeaders.set('Content-Type', 'application/json')
        responseBody = JSON.stringify(data)
        this.end()
      },
      send(data: any) {
        if (typeof data === 'object' && !Buffer.isBuffer(data)) {
          return this.json(data)
        }
        responseBody = data
        this.end()
      },
      end(data?: any) {
        if (data) responseBody = data

        const nextRes = new NextResponse(responseBody, {
          status: statusCode,
          headers: resHeaders,
        })

        // Attach cookies
        cookiesToSet.forEach((c) => {
          nextRes.headers.append('Set-Cookie', c)
        })

        resolve(nextRes)
      },
    }

    // Build mock request
    const mockReq: any = {
      method,
      url: `${pathname}${url.search}`,
      originalUrl: `${pathname}${url.search}`,
      path: pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers,
      cookies: parseCookies(headers['cookie'] || ''),
      body,
      ip: headers['x-forwarded-for']?.split(',')[0].trim() || '127.0.0.1',
    }

    // Pass into express app
    app(mockReq, mockRes, (err: any) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 }))
      } else {
        resolve(NextResponse.json({ error: `Cannot ${method} ${pathname}` }, { status: 404 }))
      }
    })
  })
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {}
  if (!cookieHeader) return list
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=')
    name = name?.trim()
    if (!name) return
    const value = rest.join('=').trim()
    list[name] = decodeURIComponent(value)
  })
  return list
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return handleNextApiRequest(req, context)
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return handleNextApiRequest(req, context)
}

export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return handleNextApiRequest(req, context)
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return handleNextApiRequest(req, context)
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return handleNextApiRequest(req, context)
}
