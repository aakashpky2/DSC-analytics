import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { awb_number, carrier, current_status, event_time, location } = payload

    return NextResponse.json({
      status: 'success',
      received: true,
      awb_number,
      carrier,
      updated_status: current_status || 'in_transit',
      processed_at: new Date().toISOString(),
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'error', message: 'Invalid courier webhook payload' },
      { status: 400 }
    )
  }
}

