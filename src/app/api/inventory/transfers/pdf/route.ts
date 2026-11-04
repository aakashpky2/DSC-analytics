// Delivery Challan / Transfer Document Route (/api/inventory/transfers/pdf)
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const challanNumber = request.nextUrl.searchParams.get('challan_number') || 'DC-2026-0001'
  const port = process.env.PORT || '3000'

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/inventory/transfers`, { cache: 'no-store' })
    const data = await res.json()
    const challan = (data.challans || []).find((c: any) => c.challan_number === challanNumber)

    const doc = {
      documentType: 'Inter-Branch Stock Transfer Delivery Challan',
      challanNumber: challan ? challan.challan_number : challanNumber,
      transferDate: challan ? challan.created_at : new Date().toISOString().split('T')[0],
      sourceBranch: {
        name: challan?.source_branch_name || 'Headquarters - Mumbai',
        code: challan?.source_branch_code || 'HQ-MUM',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
      destinationBranch: {
        name: challan?.destination_branch_name || 'Regional Branch - Delhi',
        code: challan?.destination_branch_code || 'BR-DEL',
        city: 'New Delhi',
        state: 'Delhi',
      },
      lineItems: [
        {
          item: challan ? challan.token_model.toUpperCase().replace('_', ' ') : 'EPASS2003 AUTO',
          description: 'FIPS 140-2 Level 3 Cryptographic USB Hardware Token',
          quantity: challan ? challan.quantity : 50,
          purpose: challan?.purpose || 'Stock replenishment for local branch operations',
        }
      ],
      companyDetails: {
        legalName: 'SignSync Enterprise Solutions Pvt Ltd',
        gstin: '27AAACS1234A1Z1',
        registeredOffice: 'Express Towers, Nariman Point, Mumbai, Maharashtra 400021',
      },
      authorizedBy: challan?.issued_by_name || 'Operations Manager',
      status: challan?.status || 'dispatched',
      rulesCompliance: 'Under Rule 55 of CGST Rules 2017 - Movement of goods without supply',
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(doc)
  } catch {
    return NextResponse.json({
      documentType: 'Delivery Challan',
      challanNumber,
      error: 'Failed to retrieve delivery challan details.',
    }, { status: 500 })
  }
}
