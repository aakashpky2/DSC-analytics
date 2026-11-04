// Next.js Server Component (SSR)
// This page is rendered on the server before being sent to the browser.

interface HealthData {
  status: string
  message: string
  timestamp: string
}

interface AnalyticsData {
  status: string
  data: {
    activeUsers: number
    eventsTracked: number
    systemHealth: string
    serverTimestamp: string
  }
}

async function getHealth(): Promise<HealthData | null> {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      cache: 'no-store', // Ensures fresh Server-Side Rendering (SSR)
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function getAnalytics(): Promise<AnalyticsData | null> {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/analytics/overview`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [health, analytics] = await Promise.all([
    getHealth(),
    getAnalytics(),
  ])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-950 text-white font-sans">
      <main className="max-w-2xl w-full p-8 border border-zinc-800 rounded-2xl bg-zinc-900/60 shadow-2xl backdrop-blur-md space-y-6">
        <div>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
            Next.js SSR + Express Architecture
          </div>
          <h1 className="text-3xl font-bold text-zinc-100">DSC Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Rendered via <strong>Next.js SSR</strong> &bull; Backend APIs powered by <strong>Node.js + Express</strong> &bull; Database in <strong>Supabase</strong>
          </p>
        </div>

        {/* Backend Status Section */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-2">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
            Express Backend &rarr; Supabase DB Link
          </div>
          {health?.status === 'ok' ? (
            <div className="flex items-center space-x-2 text-emerald-400 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{health.message}</span>
            </div>
          ) : (
            <div className="text-amber-400 text-sm font-medium">
              Backend connecting... (Live SSR fetch from Express /api/health)
            </div>
          )}
          {health?.timestamp && (
            <div className="text-xs text-zinc-500">
              SSR Rendered at: {new Date(health.timestamp).toLocaleString()}
            </div>
          )}
        </div>

        {/* Analytics Card */}
        {analytics?.data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              <div className="text-xs text-zinc-400">Active Users</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">
                {analytics.data.activeUsers.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              <div className="text-xs text-zinc-400">Events Tracked</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">
                {analytics.data.eventsTracked.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-zinc-800/80 pt-4 text-xs text-zinc-500 space-y-1">
          <div>&bull; <strong>Frontend:</strong> Next.js Server Components (SSR) with Tailwind CSS.</div>
          <div>&bull; <strong>Backend:</strong> Node.js Express server located in <code className="text-zinc-300">src/server/</code>.</div>
          <div>&bull; <strong>Database:</strong> Supabase DB connection strictly handled inside Node.js Express backend routes.</div>
          <div>&bull; <strong>Deployment:</strong> Single unified web app ready for Hostinger Node.js Application Manager via <code className="text-zinc-300">server.js</code>.</div>
        </div>
      </main>
    </div>
  )
}
