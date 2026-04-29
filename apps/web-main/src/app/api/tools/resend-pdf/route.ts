/**
 * apps/web-main/src/app/api/tools/resend-pdf/route.ts
 *
 * Public API route for the "Re-send to my email" CTA on the PDF confirmation
 * page (UI-SPEC §Surface 6 / REQ-402).
 *
 * Mirror of /api/tools/email-gate — same wire format, same handler module,
 * separate handler function (handleResendPdf) so logging / error copy can
 * differentiate the two flows. Also missing prior to audit.
 */
export const runtime = 'nodejs'

import { handleResendPdf, type ResendPdfInput } from '@mjagency/tools'

export async function POST(req: Request): Promise<Response> {
  let body: Partial<ResendPdfInput>
  try {
    body = (await req.json()) as Partial<ResendPdfInput>
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await handleResendPdf({
    email:          body.email          ?? '',
    toolSlug:       body.toolSlug       ?? '',
    toolResultJson: body.toolResultJson ?? '',
    agencySlug:     body.agencySlug     ?? '',
    _hp:            body._hp,
  })

  return Response.json(result)
}
