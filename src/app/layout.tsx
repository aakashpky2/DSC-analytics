import type { Metadata } from 'next'
import './globals.css'
import ShellLayout from '@/components/ShellLayout'
import { GlobalApiLogger } from '@/components/GlobalApiLogger'

export const metadata: Metadata = {
  title: 'SignSync B2B Enterprise Platform | v2.4',
  description: 'DSC & Hardware Token Logistics, CRM Deduplication, Multi-Account Billing & Ledger',
  icons: {
    icon: [
      { url: '/signsync-logo.png', sizes: 'any', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/signsync-logo.png',
    apple: '/signsync-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        <GlobalApiLogger />
        <ShellLayout>{children}</ShellLayout>
      </body>
    </html>
  )
}
