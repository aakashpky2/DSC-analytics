'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>('Checking backend connection...')
  const [timestamp, setTimestamp] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Frontend only speaks to backend API (/api/health)
    fetch('/api/health')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'API request failed')
        setApiStatus(data.message)
        setTimestamp(data.timestamp)
      })
      .catch((err) => {
        setError(err.message)
      })
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-950 text-white font-sans">
      <main className="max-w-xl w-full p-8 border border-zinc-800 rounded-2xl bg-zinc-900/60 shadow-2xl backdrop-blur-md">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">DSC Analytics</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Strict 3-tier architecture: Frontend &rarr; Backend API &rarr; Supabase DB
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
            Backend API Status
          </div>
          {error ? (
            <div className="text-red-400 text-sm font-medium">
              Error connecting to API: {error}
            </div>
          ) : (
            <div className="text-emerald-400 text-sm font-medium">
              {apiStatus}
            </div>
          )}
          {timestamp && (
            <div className="text-xs text-zinc-500">
              Response Time: {new Date(timestamp).toLocaleString()}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-zinc-800/80 pt-4 text-xs text-zinc-500">
          Frontend communicates exclusively via standard HTTP REST/RPC endpoints in <code className="text-zinc-300">/api/*</code>. No database SDKs or keys are exposed to the browser.
        </div>
      </main>
    </div>
  )
}
