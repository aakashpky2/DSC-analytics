// Business Overview Dashboard & Role-Based Operational Home
import React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PartnerRecord, TokenPurchaseBatchRecord, CrmLeadRecord, InvoiceRecord } from '@/types/models'
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/server/auth'
import HomeDashboardClient from '@/components/HomeDashboardClient'

async function getDashboardData() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  // Server-side auth check: immediately redirect unauthenticated requests to /login
  if (!token) {
    redirect('/login')
  }

  const sessionUser = await validateSessionToken(token)
  if (!sessionUser) {
    redirect('/login')
  }

  const port = process.env.PORT || '3000'
  try {
    const cookieHeader = cookieStore.toString()
    const headers: Record<string, string> = {}
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
    }

    const [healthRes, partnersRes, dscRes, batchesRes, leadsRes, invoicesRes] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/health`, { cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/partners`, { headers, cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/dsc/catalog`, { headers, cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/inventory/batches`, { headers, cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/crm/leads`, { headers, cache: 'no-store' }),
      fetch(`http://127.0.0.1:${port}/api/billing/invoices`, { headers, cache: 'no-store' }),
    ])

    return {
      sessionUser: {
        id: sessionUser.id,
        full_name: sessionUser.full_name,
        role_name: sessionUser.role_name,
        level_name: sessionUser.level_name,
        hierarchy_level_order: sessionUser.hierarchy_level_order,
      },
      health: healthRes.ok ? await healthRes.json() : null,
      partners: partnersRes.ok ? ((await partnersRes.json()).partners as PartnerRecord[]) : [],
      catalog: dscRes.ok ? (await dscRes.json()).catalog : [],
      batches: batchesRes.ok ? ((await batchesRes.json()).batches as TokenPurchaseBatchRecord[]) : [],
      leads: leadsRes.ok ? ((await leadsRes.json()).leads as CrmLeadRecord[]) : [],
      invoices: invoicesRes.ok ? ((await invoicesRes.json()).invoices as InvoiceRecord[]) : [],
    }
  } catch {
    return {
      sessionUser: {
        id: sessionUser.id,
        full_name: sessionUser.full_name,
        role_name: sessionUser.role_name,
        level_name: sessionUser.level_name,
        hierarchy_level_order: sessionUser.hierarchy_level_order,
      },
      health: null,
      partners: [],
      catalog: [],
      batches: [],
      leads: [],
      invoices: [],
    }
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <HomeDashboardClient
      initialUser={data.sessionUser}
      initialData={{
        health: data.health,
        partners: data.partners,
        catalog: data.catalog,
        batches: data.batches,
        leads: data.leads,
        invoices: data.invoices,
      }}
    />
  )
}
