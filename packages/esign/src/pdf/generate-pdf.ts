/**
 * packages/esign/src/pdf/generate-pdf.ts
 * REQ-126: generates ESIGN-compliant PDF with signature.
 * REQ-133: PDF includes proposal content + signature image + audit metadata.
 * Uses pdf-lib for PDF generation (no browser APIs required — runs in Node.js worker).
 *
 * NOTE on color values: rgb(0.4, 0.4, 0.4) uses pdf-lib's 0-1 float color space,
 * NOT CSS hex. These are NOT violations of the var(--mj-*) token rule — pdf-lib's
 * rgb() function takes floats in [0,1] range, not CSS color strings. This file
 * generates a PDF buffer server-side and never renders CSS.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { createHash } from 'crypto'

export interface GenerateEsignPdfInput {
  proposalTitle: string
  proposalBodyText: string
  signerName: string
  signatureDataUri: string
  disclosureText: string
  signedAt: Date
  proposalToken: string
  agencyName: string
}

export interface GenerateEsignPdfOutput {
  pdfBytes: Uint8Array
  pdfHash: string // SHA-256 of pdfBytes
}

/**
 * Generates a PDF document containing:
 * - Agency name + proposal title as header
 * - Proposal body text
 * - ESIGN Act disclosure text
 * - Signer name + timestamp
 * - Signature image (from base64 PNG data URI)
 * - Proposal token (audit reference)
 *
 * Returns pdfBytes (Uint8Array) and SHA-256 hash of the bytes.
 */
export async function generateEsignPdf(input: GenerateEsignPdfInput): Promise<GenerateEsignPdfOutput> {
  const {
    proposalTitle,
    proposalBodyText,
    signerName,
    signatureDataUri,
    disclosureText,
    signedAt,
    proposalToken,
    agencyName,
  } = input

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const margin = 50
  let y = height - margin

  // Header
  // pdf-lib rgb() uses 0-1 float color space (NOT CSS hex — see file header note)
  page.drawText(agencyName, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 24
  page.drawText(proposalTitle, {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
    maxWidth: width - margin * 2,
  })
  y -= 32
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 20

  // Body text (strip HTML tags; truncate to avoid overflow — full content in proposal CMS)
  const bodyLines = proposalBodyText.replace(/<[^>]+>/g, '').substring(0, 2000)
  const wrappedLines = wrapText(bodyLines, font, 11, width - margin * 2)
  for (const line of wrappedLines.slice(0, 40)) {
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
    if (y < 200) break // Reserve bottom for signature section
  }

  y = Math.min(y, 340) // Ensure signature section always has room

  // ESIGN disclosure section
  y -= 20
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 16
  page.drawText('Electronic Signature Disclosure', {
    x: margin,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  y -= 14
  const disclosureLines = wrapText(disclosureText, font, 9, width - margin * 2)
  for (const line of disclosureLines) {
    page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
    y -= 13
  }

  // Signature block
  y -= 16
  page.drawText('Signed by:', { x: margin, y, size: 10, font: boldFont, color: rgb(0, 0, 0) })
  y -= 14
  page.drawText(signerName, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) })
  y -= 14
  page.drawText(`Date: ${signedAt.toUTCString()}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  y -= 14
  page.drawText(`Proposal reference: ${proposalToken.substring(0, 16)}...`, {
    x: margin,
    y,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  // Signature image
  const base64Data = signatureDataUri.replace(/^data:image\/png;base64,/, '')
  const sigImageBytes = Buffer.from(base64Data, 'base64')
  if (sigImageBytes.length > 0 && sigImageBytes.length <= 500 * 1024) {
    const sigImage = await pdfDoc.embedPng(sigImageBytes)
    y -= 80
    page.drawImage(sigImage, { x: margin, y, width: 200, height: 60 })
  }

  const pdfBytes = await pdfDoc.save()
  // SHA-256 of pdfBytes — proof of PDF integrity (REQ-133)
  const pdfHash = createHash('sha256').update(pdfBytes).digest('hex')

  return { pdfBytes, pdfHash }
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
