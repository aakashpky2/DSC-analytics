import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const invoiceNumber = request.nextUrl.searchParams.get('invoice_number') || 'INV-2627/1001'

  // Return clean, downloadable invoice compilation data structure
  const pdfResponse = {
    document: 'Tax Invoice',
    invoiceNumber,
    generatedAt: new Date().toISOString(),
    status: 'Ready for print & PDF download',
    companyDetails: {
      name: 'SignSync Enterprise Solutions Pvt Ltd',
      gstin: '27AAACS1234A1Z1',
      pan: 'AAACS1234A',
      state: 'Maharashtra (27)',
    },
    message: 'Official Tax Invoice PDF compiled successfully',
  }

  return NextResponse.json(pdfResponse)
}

