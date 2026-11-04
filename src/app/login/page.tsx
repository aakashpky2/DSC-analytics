// Module 01: Login Portal (/login)
'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@signsync.io')
  const [password, setPassword] = useState('admin123')
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Standard credential check
    setTimeout(() => {
      if (email && password) {
        router.push('/')
      } else {
        setError('Please enter your company email and password.')
        setLoading(false)
      }
    }, 600)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg mx-auto text-lg">
            SS
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SignSync Portal</h1>
          <p className="text-xs text-slate-400">Sign in to your office or partner account</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Company Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white text-xs"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white text-xs"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
              />
              Keep me signed in
            </label>
            <a href="#" className="text-indigo-400 hover:underline">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
          Protected by company access control &bull; SignSync Enterprise
        </div>
      </div>
    </div>
  )
}

