/**
 * packages/compliance/src/erasure/generate-pdf.ts
 * Plan 11-05 / REQ-144 D-06:
 *
 * Generates the CCPA deletion receipt PDF. Reuses the pdf-lib pattern from
 * Phase 10 (packages/esign/src/pdf/generate-pdf.ts).
 *
 * NOTE on color values: pdf-lib's rgb() function takes 0-1 floats, NOT CSS hex.
 * These calls are NOT violations of the var(--mj-*) token rule — pdf-lib is a
 * server-side PDF byte generator, never renders CSS, and floats are the only
 * supported color form. Tracked in code comment per Phase 10 precedent.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface GenerateErasureReceiptPdfInput {
  email: string
  requestId: string
  agencyId: string
  agencyName?: string
  completedAt: Date
  /** Final record_hash from the chain (last system row's hash) — included on receipt for verification. */
  finalRecordHash: string
  /** Optional summary of what was deleted/skipped per system. */
  systemSummary?: Array<{
    system: string
    deleted?: number
    skipped?: number
    reason?: string
  }>
}

const SYSTEM_SUMMARY_DEFAULT =
  'We have deleted your personal data from: Postgres, Redis, R2, GA4, Meta CAPI, Microsoft Clarity, and LiteLLM call logs.'

export async function generateErasureReceiptPdf(
  input: GenerateErasureReceiptPdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0, 0, 0)
  const dim = rgb(0.3, 0.3, 0.3)

  const margin = 50
  let y = 800

  // Header
  page.drawText('CCPA Data Deletion Receipt', {
    x: margin,
    y,
    size: 22,
    font: fontBold,
    color: black,
  })
  y -= 18
  page.drawLine({
    start: { x: margin, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  y -= 28

  // Identity block
  page.drawText(`Email: ${input.email}`, { x: margin, y, size: 11, font })
  y -= 18
  page.drawText(`Request ID: ${input.requestId}`, { x: margin, y, size: 11, font })
  y -= 18
  page.drawText(`Agency: ${input.agencyName ?? input.agencyId}`, { x: margin, y, size: 11, font })
  y -= 18
  page.drawText(`Completed at: ${input.completedAt.toISOString()}`, { x: margin, y, size: 11, font })
  y -= 32

  // Summary
  page.drawText('Summary', { x: margin, y, size: 14, font: fontBold, color: black })
  y -= 18
  page.drawText(SYSTEM_SUMMARY_DEFAULT, { x: margin, y, size: 11, font, maxWidth: 495 })
  y -= 28

  // Per-system table (if provided)
  if (input.systemSummary && input.systemSummary.length > 0) {
    page.drawText('Per-system results', { x: margin, y, size: 12, font: fontBold, color: black })
    y -= 16
    for (const row of input.systemSummary) {
      const counts = `deleted=${row.deleted ?? 0}` +
        (row.skipped ? `, skipped=${row.skipped}` : '') +
        (row.reason ? ` (${row.reason})` : '')
      page.drawText(`• ${row.system}: ${counts}`, { x: margin, y, size: 10, font, color: dim })
      y -= 14
      if (y < 200) break // reserve bottom for legal block
    }
    y -= 12
  }

  // Hash-chain attestation
  page.drawText('Hash-chain attestation', {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: black,
  })
  y -= 18
  page.drawText(`Final record_hash: ${input.finalRecordHash}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: dim,
  })
  y -= 24

  // Legal block
  page.drawText('California Civil Code §1798.105 — request fulfilled.', {
    x: margin,
    y,
    size: 11,
    font,
    color: black,
  })
  y -= 16
  page.drawText(
    'This receipt is generated server-side and bound to the immutable ccpa_erasure_records audit chain.',
    { x: margin, y, size: 9, font, color: dim, maxWidth: 495 },
  )

  return await pdf.save()
}
