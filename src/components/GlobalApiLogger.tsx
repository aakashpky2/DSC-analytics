'use client'

import { useEffect } from 'react'

/**
 * Global HTTP Interceptor for Browser DevTools
 * Logs all frontend CRUD operations (GET, POST, PUT, PATCH, DELETE)
 * with URL, method, payload, status, response time, and detailed error tracking.
 */
export function GlobalApiLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const originalFetch = window.fetch

    window.fetch = async function (...args) {
      const [resource, config] = args
      const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : String(resource)
      const method = (config?.method || (resource instanceof Request ? resource.method : 'GET')).toUpperCase()

      // Only intercept application API calls
      if (!url.includes('/api/')) {
        return originalFetch.apply(this, args)
      }

      const startTime = performance.now()
      let bodyPreview: any = config?.body

      if (typeof bodyPreview === 'string') {
        try {
          bodyPreview = JSON.parse(bodyPreview)
        } catch {
          // Keep raw string
        }
      }

      const logPrefix = `[API ${method}] ${url.split('?')[0]}`

      console.groupCollapsed(
        `%c${method}%c ${url.split('?')[0]} %c(Pending)`,
        'background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
        'color: #93c5fd; font-weight: normal;',
        'color: #fbbf24; font-style: italic;'
      )
      console.log('Full URL:', url)
      console.log('Method:', method)
      if (bodyPreview) console.log('Request Payload:', bodyPreview)
      console.groupEnd()

      try {
        const response = await originalFetch.apply(this, args)
        const duration = (performance.now() - startTime).toFixed(1)
        const status = response.status
        const isSuccess = response.ok

        // Clone response to safely read and log payload without consuming original body stream
        response.clone().json().then((data) => {
          if (isSuccess) {
            console.groupCollapsed(
              `%c${method}%c ${url.split('?')[0]} %c${status} OK (${duration}ms)`,
              'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
              'color: #a7f3d0; font-weight: normal;',
              'color: #34d399; font-weight: bold;'
            )
            console.log('Response Status:', status)
            console.log('Duration:', `${duration}ms`)
            console.log('Response Data:', data)
            console.groupEnd()
          } else {
            console.group(
              `%c${method}%c ${url.split('?')[0]} %c${status} ERROR (${duration}ms)`,
              'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
              'color: #fca5a5; font-weight: normal;',
              'color: #f87171; font-weight: bold;'
            )
            console.error('Response Status:', status)
            console.error('Duration:', `${duration}ms`)
            console.error('Error Payload:', data)
            console.groupEnd()
          }
        }).catch(() => {
          // If response is not JSON (e.g. text/html/binary)
          const badgeStyle = isSuccess
            ? 'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
            : 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
          console.log(
            `%c${method}%c ${url.split('?')[0]} %c${status} (${duration}ms)`,
            badgeStyle,
            'color: #cbd5e1;',
            'font-weight: bold;'
          )
        })

        return response
      } catch (networkError: any) {
        const duration = (performance.now() - startTime).toFixed(1)
        console.group(
          `%c${method}%c ${url.split('?')[0]} %cNETWORK FAILED (${duration}ms)`,
          'background: #b91c1c; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
          'color: #fecaca; font-weight: normal;',
          'color: #f87171; font-weight: bold;'
        )
        console.error('Network Exception:', networkError.message || networkError)
        console.groupEnd()
        throw networkError
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}

