// Server-Side Dynamic PDF Invoice Compilation (/api/invoices/pdf)
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, queryAll } from '@/server/supabase'
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/server/auth'
import { getStatesMaster, getInvoiceTypesMaster } from '@/server/billingMasterStore'
import { numberToIndianWords } from '@/server/utils/indianCurrencyWords'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const invoiceNumber = request.nextUrl.searchParams.get('invoice_number')
  const isDownload = request.nextUrl.searchParams.get('download') === 'true'
  const copyType = (request.nextUrl.searchParams.get('copy') || 'ORIGINAL').toUpperCase()

  try {
    // 1. RBAC & Security Check: Validate active session from cookie or Authorization header
    const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    const sessionToken = cookie || bearerToken

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required to view or download invoices.' }, { status: 401 })
    }

    const sessionUser = await validateSessionToken(sessionToken)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Session invalid or expired.' }, { status: 401 })
    }

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number parameter is required.' }, { status: 400 })
    }

    // 2. Fetch Invoice from Database
    const invoice = await queryOne<any>(
      'SELECT * FROM invoices WHERE invoice_number = ?',
      [invoiceNumber]
    )

    if (!invoice) {
      return NextResponse.json({ error: `Invoice ${invoiceNumber} not found` }, { status: 404 })
    }

    // 3. Resolve Customer / Partner Details (prefer customer_snapshot if present for historical immutability)
    let partner = await queryOne<any>('SELECT * FROM partners WHERE id = ?', [invoice.partner_id])
    if (invoice.company_snapshot) {
      try {
        const snap = JSON.parse(invoice.company_snapshot)
        if (snap.customer_snapshot) {
          partner = { ...partner, ...snap.customer_snapshot }
        }
      } catch (e) {
        // Fallback to partner table
      }
    }

    // 4. Resolve Supplier / Company Details (prefer company_snapshot for historical immutability)
    let profile = await queryOne<any>('SELECT * FROM company_profile WHERE id = ?', ['comp-default'])
    if (!profile) {
      profile = await queryOne<any>('SELECT * FROM company_profile LIMIT 1')
    }

    if (invoice.company_snapshot) {
      try {
        const snap = JSON.parse(invoice.company_snapshot)
        if (snap.legal_name) {
          profile = { ...profile, ...snap }
        }
      } catch (e) {
        // Fallback to company_profile table
      }
    }

    // 5. Resolve Bank Account Details (prefer mapped series bank account or active bank)
    let bankAccount: any = null
    if (invoice.bank_account_snapshot_id) {
      bankAccount = await queryOne<any>('SELECT * FROM bank_accounts WHERE id = ?', [invoice.bank_account_snapshot_id])
    }
    if (!bankAccount) {
      bankAccount = await queryOne<any>('SELECT * FROM bank_accounts WHERE is_active = 1 LIMIT 1')
    }

    // 6. Dynamic Document Type Resolution
    const invoiceTypes = await getInvoiceTypesMaster()
    let documentTitle = 'TAX INVOICE'
    const invTypeKey = (invoice.invoice_type || 'gst_tax_invoice').toLowerCase()
    
    if (invTypeKey.includes('proforma')) {
      documentTitle = 'PROFORMA INVOICE'
    } else if (invTypeKey.includes('credit')) {
      documentTitle = 'CREDIT NOTE'
    } else if (invTypeKey.includes('debit')) {
      documentTitle = 'DEBIT NOTE'
    } else if (invTypeKey.includes('bill_of_supply')) {
      documentTitle = 'BILL OF SUPPLY'
    } else {
      const matched = invoiceTypes.find((t: any) => t.type_code === invoice.invoice_type)
      if (matched && matched.name) {
        documentTitle = matched.type_code === 'TAX_INVOICE' ? 'TAX INVOICE' : matched.name.toUpperCase()
      } else {
        documentTitle = 'TAX INVOICE'
      }
    }

    // 7. Resolve State and Place of Supply from dynamic states master
    const states = await getStatesMaster()
    const supplierStateCode = String(profile?.state_code || '27').padStart(2, '0')
    const supplierStateObj = states.find((s: any) => String(s.state_code).padStart(2, '0') === supplierStateCode)
    const supplierStateName = supplierStateObj?.state_name || profile?.state_name || 'Maharashtra'

    const customerStateCode = String(partner?.state_code || invoice.state_code || supplierStateCode).padStart(2, '0')
    const customerStateObj = states.find((s: any) => String(s.state_code).padStart(2, '0') === customerStateCode)
    const customerStateName = customerStateObj?.state_name || partner?.state_name || 'Maharashtra'

    const isInterState = customerStateCode !== supplierStateCode
    const placeOfSupplyText = `${customerStateName} (${customerStateCode})`

    // 8. Generate UPI QR Code Buffer
    const upiPayee = bankAccount?.upi_id || ''
    const payeeName = encodeURIComponent(profile?.trade_name || profile?.legal_name || 'Enterprise')
    const upiUrl = upiPayee ? `upi://pay?pa=${upiPayee}&pn=${payeeName}&am=${invoice.total_amount}&cu=INR&tn=Invoice%20${encodeURIComponent(invoice.invoice_number)}` : null
    
    let qrPngBuffer: Buffer | null = null
    if (upiUrl) {
      try {
        qrPngBuffer = await QRCode.toBuffer(upiUrl, { width: 110, margin: 1 })
      } catch (e) {
        console.error('QR generation error:', e)
      }
    }

    // 9. Document Copy Designation
    let copyLabel = 'ORIGINAL FOR RECIPIENT'
    if (copyType === 'DUPLICATE' || copyType === 'TRANSPORTER') {
      copyLabel = 'DUPLICATE FOR TRANSPORTER'
    } else if (copyType === 'TRIPLICATE' || copyType === 'SUPPLIER') {
      copyLabel = 'TRIPLICATE FOR SUPPLIER'
    }

    // 10. Parse Line Items
    let lineItems: any[] = []
    try {
      lineItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : (invoice.line_items || [])
    } catch {
      lineItems = []
    }

    // 11. Build PDF Document with dynamic multi-page flow
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true, bufferPages: true })
    const buffers: Buffer[] = []
    doc.on('data', (chunk) => buffers.push(chunk))

    // Helper: Draw Header Block
    function drawHeader() {
      // Copy indicator
      doc.fontSize(8).fillColor('#64748b').text(copyLabel, 40, 25, { align: 'right', width: 515 })

      // Supplier Details
      doc.fontSize(15).fillColor('#0f172a').font('Helvetica-Bold').text(profile?.legal_name || 'Legal Entity Name', 40, 38)
      doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
      if (profile?.trade_name && profile.trade_name !== profile.legal_name) {
        doc.text(`Trade Name: ${profile.trade_name}`, 40, 56)
      }
      doc.text(`Registered Address: ${profile?.registered_address || 'Registered Office Address'}`, 40, 68, { width: 515 })
      doc.text(`GSTIN: ${profile?.gstin || 'N/A'}  |  PAN: ${profile?.pan || 'N/A'}  |  State: ${supplierStateName} (Code ${supplierStateCode})`, 40, 80)
      doc.text(`Email: ${profile?.email || 'N/A'}  |  Phone: ${profile?.phone || 'N/A'}`, 40, 92)

      // Divider
      doc.moveTo(40, 105).lineTo(555, 105).strokeColor('#cbd5e1').lineWidth(1).stroke()
    }

    drawHeader()

    // Title Box & Metadata Grid
    doc.rect(40, 112, 515, 60).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(documentTitle, 50, 120)
    
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155')
    doc.text(`Invoice No: ${invoice.invoice_number}`, 50, 138)
    doc.text(`Invoice Date: ${invoice.invoice_date || ''}`, 50, 152)

    doc.text(`Due Date: ${invoice.due_date || 'Immediate'}`, 240, 138)
    doc.text(`Supply Type: ${isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}`, 240, 152)

    doc.text(`Place of Supply: ${placeOfSupplyText}`, 390, 138, { width: 160 })
    doc.text(`Status: ${(invoice.status || 'unpaid').toUpperCase()}`, 390, 152)

    // Recipient / Bill To Box
    const isB2B = !!(partner?.gstin && partner.gstin.trim() !== '' && partner.gstin.trim().toUpperCase() !== 'URP')
    doc.rect(40, 178, 515, 62).fillAndStroke('#f1f5f9', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(isB2B ? 'BILLED TO (RECIPIENT / B2B):' : 'BILLED TO (CONSUMER / B2C):', 50, 185)
    
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155')
    doc.text(`Name: ${partner?.company_name || partner?.contact_person || 'Customer / Partner'}`, 50, 198)
    doc.text(`GSTIN/UIN: ${isB2B ? partner.gstin : 'Unregistered (URP)'}  |  State: ${customerStateName} (${customerStateCode})`, 50, 211)
    doc.text(`Address: ${partner?.billing_address || 'Billing Address On File'}`, 50, 224, { width: 500 })

    // Line Items Table Header
    let currentY = 248
    function drawTableHeader(yPos: number) {
      doc.rect(40, yPos, 515, 20).fillAndStroke('#1e293b', '#1e293b')
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
      doc.text('#', 45, yPos + 6, { width: 15 })
      doc.text('ITEM DESCRIPTION', 65, yPos + 6, { width: 175 })
      doc.text('HSN/SAC', 245, yPos + 6, { width: 45 })
      doc.text('QTY', 295, yPos + 6, { width: 25, align: 'right' })
      doc.text('RATE (₹)', 325, yPos + 6, { width: 50, align: 'right' })
      doc.text('TAXABLE (₹)', 380, yPos + 6, { width: 55, align: 'right' })
      doc.text('TAX %', 440, yPos + 6, { width: 35, align: 'right' })
      doc.text('TOTAL (₹)', 480, yPos + 6, { width: 70, align: 'right' })
    }

    drawTableHeader(currentY)
    currentY += 20

    // Render Items
    doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
    lineItems.forEach((item, index) => {
      // Page break check if item exceeds page height
      if (currentY > 680) {
        doc.addPage()
        drawHeader()
        currentY = 120
        drawTableHeader(currentY)
        currentY += 20
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
      }

      const itemDesc = item.description || item.item || 'Supply of Goods / Services'
      const itemCode = item.hsn_sac || item.hsn || item.sac || (item.item_type === 'GOODS' ? '8471' : '998313')
      const qty = Number(item.quantity || item.qty || 1)
      const rate = Number(item.unit_price || item.rate || 0)
      const taxable = Number(item.taxable_value !== undefined ? item.taxable_value : (item.total || qty * rate))
      const taxRate = item.tax_rate_pct !== undefined ? item.tax_rate_pct : (invoice.cgst_amount > 0 ? 18 : 18)
      const total = Number(item.item_total !== undefined ? item.item_total : (taxable + (taxable * taxRate / 100)))

      const rowHeight = 20
      doc.rect(40, currentY, 515, rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke()
      doc.text(String(index + 1), 45, currentY + 5, { width: 15 })
      doc.text(itemDesc, 65, currentY + 5, { width: 175, lineBreak: false })
      doc.text(itemCode, 245, currentY + 5, { width: 45 })
      doc.text(String(qty), 295, currentY + 5, { width: 25, align: 'right' })
      doc.text(rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 325, currentY + 5, { width: 50, align: 'right' })
      doc.text(taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 380, currentY + 5, { width: 55, align: 'right' })
      doc.text(`${taxRate}%`, 440, currentY + 5, { width: 35, align: 'right' })
      doc.text(total.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 480, currentY + 5, { width: 70, align: 'right' })

      currentY += rowHeight
    })

    // Financial Calculation Summary Box
    if (currentY > 600) {
      doc.addPage()
      drawHeader()
      currentY = 120
    }

    currentY += 10
    const summaryBoxY = currentY

    // Amount in Words & Bank Details (Left side)
    const wordsText = numberToIndianWords(Number(invoice.total_amount || 0))
    doc.rect(40, summaryBoxY, 275, 115).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('AMOUNT IN WORDS (RUPEES):', 48, summaryBoxY + 8)
    doc.font('Helvetica').fontSize(8).fillColor('#1e293b').text(wordsText, 48, summaryBoxY + 22, { width: 260 })

    doc.moveTo(48, summaryBoxY + 45).lineTo(307, summaryBoxY + 45).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('BANK REMITTANCE DETAILS:', 48, summaryBoxY + 52)
    doc.font('Helvetica').fontSize(7.5).fillColor('#334155')
    doc.text(`Bank Name: ${bankAccount?.bank_name || 'HDFC Bank Ltd'}`, 48, summaryBoxY + 65)
    doc.text(`A/C Number: ${bankAccount?.account_number || 'N/A'}  |  IFSC: ${bankAccount?.ifsc_code || 'N/A'}`, 48, summaryBoxY + 77)
    doc.text(`Branch: ${bankAccount?.branch_name || 'Mumbai'}  |  UPI: ${bankAccount?.upi_id || 'N/A'}`, 48, summaryBoxY + 89)
    doc.text(`Account Name: ${bankAccount?.account_holder_name || profile?.legal_name || 'Legal Entity'}`, 48, summaryBoxY + 101)

    // Calculation Box (Right side)
    doc.rect(325, summaryBoxY, 230, 115).fillAndStroke('#f8fafc', '#cbd5e1')
    doc.font('Helvetica').fontSize(8.5).fillColor('#334155')
    doc.text('Taxable Subtotal:', 335, summaryBoxY + 10)
    doc.text(`₹${Number(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, summaryBoxY + 10, { align: 'right', width: 105 })

    if (Number(invoice.cgst_amount || 0) > 0 || Number(invoice.sgst_amount || 0) > 0) {
      doc.text('Central Tax (CGST 9%):', 335, summaryBoxY + 26)
      doc.text(`₹${Number(invoice.cgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, summaryBoxY + 26, { align: 'right', width: 105 })
      doc.text('State Tax (SGST 9%):', 335, summaryBoxY + 42)
      doc.text(`₹${Number(invoice.sgst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, summaryBoxY + 42, { align: 'right', width: 105 })
    } else {
      doc.text('Integrated Tax (IGST 18%):', 335, summaryBoxY + 26)
      doc.text(`₹${Number(invoice.igst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, summaryBoxY + 26, { align: 'right', width: 105 })
      doc.text('Central Tax (CGST 0%):', 335, summaryBoxY + 42)
      doc.text(`₹0.00`, 440, summaryBoxY + 42, { align: 'right', width: 105 })
    }

    const totalTaxVal = Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0)
    doc.text('Total GST Tax:', 335, summaryBoxY + 58)
    doc.text(`₹${totalTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 440, summaryBoxY + 58, { align: 'right', width: 105 })

    // Divider line before Grand Total
    doc.moveTo(335, summaryBoxY + 75).lineTo(545, summaryBoxY + 75).strokeColor('#cbd5e1').lineWidth(1).stroke()
    doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold').text('Total Invoice Value:', 335, summaryBoxY + 86)
    doc.text(`₹${Number(invoice.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 430, summaryBoxY + 86, { align: 'right', width: 115 })

    // Lower Section: QR Code and Authorized Signatory
    const lowerY = summaryBoxY + 125
    if (qrPngBuffer) {
      doc.image(qrPngBuffer, 40, lowerY, { width: 75, height: 75 })
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569')
      doc.text('Scan UPI QR to pay directly from BHIM, Google Pay, PhonePe, Paytm, or Mobile Banking.', 125, lowerY + 15, { width: 190 })
      doc.text(`Ref: ${invoice.invoice_number}`, 125, lowerY + 42, { width: 190 })
    }

    // Authorized Signatory Block
    doc.rect(345, lowerY, 210, 75).fillAndStroke('#ffffff', '#cbd5e1')
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(`For ${profile?.legal_name || 'SignSync Enterprise'}`, 355, lowerY + 8, { width: 190, align: 'center' })
    doc.fontSize(7).font('Helvetica').fillColor('#64748b').text('(Digitally Generated / Authorized Signatory)', 355, lowerY + 58, { width: 190, align: 'center' })

    // Statutory Declaration Footer (Rule 46 CGST Rules)
    const footerY = 765
    doc.fontSize(6.8).font('Helvetica').fillColor('#64748b')
    doc.text('Statutory Declaration: This document is a valid Tax Invoice / Document issued under Section 31 of CGST Act and Rule 46 of CGST Rules, 2017. Supply of cryptographic hardware tokens and electronic trust certification services.', 40, footerY, { width: 515, align: 'center' })
    doc.text(`Issued by DBIZ ERP Engine  |  Document ID: ${invoice.id}  |  Generated on: ${new Date().toISOString()}`, 40, footerY + 12, { width: 515, align: 'center' })

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
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (err: any) {
    console.error('Invoice PDF compilation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
