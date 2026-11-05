// Server-Side Dynamic PDF Invoice Compilation (/api/invoices/pdf)
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll } from '@/server/localDb'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const invoiceNumber = request.nextUrl.searchParams.get('invoice_number') || 'INV-2627/1001'
  const isDownload = request.nextUrl.searchParams.get('download') === 'true'

  try {
    // 1. Fetch Invoice
    const invoice = await queryOne<any>(
      'SELECT * FROM invoices WHERE invoice_number = ?',
      [invoiceNumber]
    )

    if (!invoice) {
      return NextResponse.json({ error: `Invoice ${invoiceNumber} not found` }, { status: 404 })
    }

    // 2. Fetch Partner
    const partner = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [invoice.partner_id])

    // 3. Fetch Company Profile
    const profile = await queryOne<any>('SELECT * FROM company_profile LIMIT 1')

    // 4. Fetch Bank Account Details
    const bankAccount = await queryOne<any>(
      'SELECT * FROM bank_accounts WHERE is_active = 1 LIMIT 1'
    )

    // 5. Generate UPI QR Code Buffer
    const upiPayee = bankAccount?.upi_id || 'signsync@hdfcbank'
    const payeeName = encodeURIComponent(profile?.trade_name || 'SignSync Enterprise')
    const upiUrl = `upi://pay?pa=${upiPayee}&pn=${payeeName}&am=${invoice.total_amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.invoice_number)}`
    
    let qrPngBuffer: Buffer | null = null
    try {
      qrPngBuffer = await QRCode.toBuffer(upiUrl, { width: 120, margin: 1 })
    } catch (e) {
      console.error('QR generation error:', e)
    }

    // 6. Build PDFDocument
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const buffers: Buffer[] = []
    doc.on('data', (chunk) => buffers.push(chunk))

    // Header & Company Branding
    doc.fontSize(18).fillColor('#0f172a').text(profile?.legal_name || 'SignSync Digital Services Private Limited', { align: 'left' })
    doc.fontSize(9).fillColor('#475569').text(`${profile?.trade_name || 'SignSync B2B Enterprise'} | GSTIN: ${profile?.gstin || '27AAECS1234F1Z5'} | PAN: ${profile?.pan || 'AAECS1234F'}`)
    doc.text(`${profile?.registered_address || 'Suite 404, Tech Park, Andheri East, Mumbai, Maharashtra (27)'}`)
    doc.text(`Email: ${profile?.email || 'billing@signsync.in'} | Phone: ${profile?.phone || '+91 22 4567 8900'}`)
    doc.moveDown()

    // Title & Invoice Meta Box
    doc.rect(40, 110, 515, 65).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(14).text('TAX INVOICE', 50, 118)
    
    doc.fontSize(9).fillColor('#334155')
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 50, 140)
    doc.text(`Invoice Date: ${invoice.invoice_date || new Date().toISOString().slice(0, 10)}`, 50, 153)
    doc.text(`Due Date: ${invoice.due_date || 'Net-30 Days'}`, 250, 140)
    doc.text(`Payment Status: ${(invoice.status || 'unpaid').toUpperCase()}`, 250, 153)
    doc.text(`Place of Supply: State Code ${invoice.state_code || '27'}`, 400, 140)

    // Bill To Section
    doc.rect(40, 185, 515, 65).fillAndStroke('#f1f5f9', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(10).text('BILLED TO (PARTNER):', 50, 192)
    doc.fontSize(9).fillColor('#334155')
    doc.text(`Company: ${partner?.company_name || 'Demo Partner'}`, 50, 207)
    doc.text(`Contact: ${partner?.contact_person || 'Authorized Representative'} | Phone: ${partner?.phone || 'N/A'}`, 50, 220)
    doc.text(`GSTIN: ${partner?.gstin || 'Unregistered'} | State: Code ${partner?.state_code || '27'}`, 50, 233)
    doc.text(`Address: ${partner?.billing_address || 'Registered Corporate Address'}`, 280, 207, { width: 260 })

    // Line Items Table Header
    let y = 265
    doc.rect(40, y, 515, 20).fillAndStroke('#1e293b', '#1e293b')
    doc.fillColor('#ffffff').fontSize(8)
    doc.text('ITEM DESCRIPTION', 45, y + 6)
    doc.text('HSN/SAC', 280, y + 6)
    doc.text('QTY', 345, y + 6)
    doc.text('UNIT PRICE', 390, y + 6)
    doc.text('TOTAL (INR)', 460, y + 6, { align: 'right', width: 85 })

    y += 20
    const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [
      { description: 'Class 3 Signing 2-Year DSC Certificate', hsn: '998313', quantity: 2, unit_price: 1500, total: 3000 },
      { description: 'ePass2003Auto USB Hardware Token', hsn: '847170', quantity: 2, unit_price: 500, total: 1000 }
    ]

    doc.fillColor('#0f172a').fontSize(8)
    lineItems.forEach((item) => {
      doc.rect(40, y, 515, 18).stroke('#e2e8f0')
      doc.text(item.description || 'Service Line Item', 45, y + 5)
      doc.text(item.hsn || '998313', 280, y + 5)
      doc.text(String(item.quantity || 1), 345, y + 5)
      doc.text(`₹${Number(item.unit_price || 0).toLocaleString('en-IN')}`, 390, y + 5)
      doc.text(`₹${Number(item.total || 0).toLocaleString('en-IN')}`, 460, y + 5, { align: 'right', width: 85 })
      y += 18
    })

    // Financial Calculation Summary Box
    y += 10
    doc.rect(310, y, 245, 95).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.fillColor('#334155').fontSize(9)
    doc.text('Subtotal:', 320, y + 8)
    doc.text(`₹${Number(invoice.subtotal || 4000).toLocaleString('en-IN')}`, 450, y + 8, { align: 'right', width: 95 })

    if (Number(invoice.cgst_amount) > 0) {
      doc.text('CGST (9%):', 320, y + 23)
      doc.text(`₹${Number(invoice.cgst_amount).toLocaleString('en-IN')}`, 450, y + 23, { align: 'right', width: 95 })
      doc.text('SGST (9%):', 320, y + 38)
      doc.text(`₹${Number(invoice.sgst_amount).toLocaleString('en-IN')}`, 450, y + 38, { align: 'right', width: 95 })
    } else {
      doc.text('IGST (18%):', 320, y + 23)
      doc.text(`₹${Number(invoice.igst_amount || 720).toLocaleString('en-IN')}`, 450, y + 23, { align: 'right', width: 95 })
    }

    doc.rect(310, y + 55, 245, 1).fill('#cbd5e1')
    doc.fillColor('#0f172a').fontSize(11).text('Grand Total:', 320, y + 68)
    doc.text(`₹${Number(invoice.total_amount || 4720).toLocaleString('en-IN')}`, 430, y + 68, { align: 'right', width: 115 })

    // Bank Account & UPI Payment QR Box
    const bankBoxY = y
    doc.rect(40, bankBoxY, 255, 95).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(9).text('BANK TRANSFER & PAYMENT DETAILS', 50, bankBoxY + 8)
    doc.fontSize(8).fillColor('#334155')
    doc.text(`Bank: ${bankAccount?.bank_name || 'HDFC Bank Ltd'}`, 50, bankBoxY + 23)
    doc.text(`A/C Number: ${bankAccount?.account_number || '50200088992211'}`, 50, bankBoxY + 36)
    doc.text(`IFSC Code: ${bankAccount?.ifsc_code || 'HDFC0001234'}`, 50, bankBoxY + 49)
    doc.text(`Branch: ${bankAccount?.branch_name || 'Nariman Point, Mumbai'}`, 50, bankBoxY + 62)
    doc.text(`UPI Handle: ${bankAccount?.upi_id || 'signsync@hdfcbank'}`, 50, bankBoxY + 75)

    // Ingest Dynamic UPI QR Code
    if (qrPngBuffer) {
      doc.image(qrPngBuffer, 40, bankBoxY + 110, { width: 85, height: 85 })
      doc.fontSize(8).fillColor('#475569')
      doc.text('Scan with BHIM, Google Pay, PhonePe or Paytm to pay directly', 135, bankBoxY + 135, { width: 200 })
      doc.text(`Payload: ${upiUrl.slice(0, 50)}...`, 135, bankBoxY + 155, { width: 200 })
    }

    // Terms & Declaration Footer
    const footerY = 560
    doc.fontSize(7).fillColor('#64748b')
    doc.text('Declaration: This is a computer-generated tax invoice issued in accordance with Rule 46 of CGST Rules 2017. Goods once sold are subject to standard return and warranty policies.', 40, footerY, { width: 515 })
    doc.text(`Generated at: ${new Date().toISOString()} | SignSync Automated Billing Gateway`, 40, footerY + 16, { width: 515 })

    doc.end()

    // Await document stream to finish
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)))
    })

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': isDownload ? `attachment; filename="${invoice.invoice_number}.pdf"` : `inline; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (err: any) {
    console.error('Invoice PDF compilation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
