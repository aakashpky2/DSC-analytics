// Module 02: Partner 360 View (/partners/[id])
import React from 'react'
import Link from 'next/link'
import { PartnerDetailClient } from '@/components/PartnerDetailClient'

async function getPartnerDetails(id: string) {
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/partners/${id}?mask=true`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPartnerDetails(id)

  if (!data || !data.partner) {
    return (
      <div className="p-8 text-center text-slate-400">
        Partner not found.{' '}
        <Link href="/partners" className="text-indigo-400 underline">
          Back to Directory
        </Link>
      </div>
    )
  }

  return <PartnerDetailClient initialData={data} partnerId={id} />
}
