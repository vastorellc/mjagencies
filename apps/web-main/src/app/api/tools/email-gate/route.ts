/**
 * apps/web-main/src/app/api/tools/email-gate/route.ts
 *
 * Public API route for the tool email-gate modal (UI-SPEC §Surface 2 / REQ-123).
 *
 * The handler logic lives in `packages/tools/src/actions/email-gate.ts`. This
 * file is the thin Next.js wrapper that:
 *   1. Parses the JSON body
 *   2. Delegates to handleEmailGate (which validates honeypot, email format,
 *      and enqueues the encrypted PDF-email job)
 *   3. Returns the handler's { ok, error? } payload as JSON
 *
 * Why this is NOT a server action (per CLAUDE.md Rule 3 reasoning):
 *   Tool users are public, anonymous visitors — they have no session.
 *   The Phase 9 ContactForm pattern (fetch from 'use client') applies here.
 *   honeypot + sensitiveData:true + queue prefix isolation keep abuse contained.
 *
 * Background: this route was missing — the EmailGateModal POSTed to a 404
 * endpoint, so every "Get my PDF" click failed silently. Audit-discovered.
 */
export const runtime = 'nodejs'

import { handleEmailGate, type EmailGateInput } from '@mjagency/tools'

export async function POST(req: Request): Promise<Response> {
  let body: Partial<EmailGateInput>
  try {
    body = (await req.json()) as Partial<EmailGateInput>
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await handleEmailGate({
    email:          body.email          ?? '',
    toolSlug:       body.toolSlug       ?? '',
    toolResultJson: body.toolResultJson ?? '',
    agencySlug:     body.agencySlug     ?? '',
    _hp:            body._hp,
  })

  // Always return 200 — the handler distinguishes ok:true / ok:false in the
  // body. Returning 4xx leaks bot signal (a successful honeypot trap returns
  // ok:true to confuse scrapers). Match the contract the modal expects.
  return Response.json(result)
}
