/**
 * apps/web-fitness/src/app/api/privacy/erasure-request/route.ts
 * Plan 11-05 / REQ-144 D-04 — public anonymous endpoint.
 */
export const runtime = 'nodejs'

import 'server-only'
import { headers } from 'next/headers'
import { randomUUID, createHash } from 'node:crypto'
import { createErasureToken } from '@mjagency/compliance'
import { createEmailQueue } from '@mjagency/email'
import { createAgencyDb, consentLog, withAgencyContext } from '@mjagency/db'
import { createLogger } from '@mjagency/config'

const AGENCY_SLUG = 'web-fitness'
const DB_AGENCY: 'brand' = 'brand'
const log = createLogger({ service: `${AGENCY_SLUG}-erasure-request` })

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ErasureRequestBody {
  email?: string
}

export async function POST(req: Request): Promise<Response> {
  let body: ErasureRequestBody = {}
  try {
    body = (await req.json()) as ErasureRequestBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const email = (body.email ?? '').trim()
  if (!email || !EMAIL_PATTERN.test(email)) {
    return Response.json({ ok: false, error: 'Invalid email' }, { status: 400 })
  }

  const agencyId = process.env['NEXT_PUBLIC_AGENCY_ID'] ?? process.env['AGENCY_ID']
  if (!agencyId) {
    return Response.json({ ok: false, error: 'Agency not configured' }, { status: 500 })
  }

  const requestId = randomUUID()
  let token: string
  try {
    token = await createErasureToken(email, agencyId, requestId)
  } catch (err) {
    log.error({ err, requestId }, 'token sign failed')
    return Response.json({ ok: false, error: 'Token generation failed' }, { status: 500 })
  }

  const baseUrl = process.env['PUBLIC_BASE_URL'] ?? `https://${AGENCY_SLUG}.mjagency.com`
  const confirmUrl = `${baseUrl}/privacy/erasure/confirm?token=${encodeURIComponent(token)}`

  try {
    const password = process.env['DB_APP_PASSWORD']
    if (password) {
      const h = await headers()
      const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for') ?? ''
      const ua = h.get('user-agent') ?? ''
      const ipHash = createHash('sha256').update(ip).digest('hex')
      const emailHash = createHash('sha256').update(email).digest('hex')
      const db = createAgencyDb(DB_AGENCY, password)
      await withAgencyContext(db, agencyId, async (tx) => {
        await tx.insert(consentLog).values({
          agencyId,
          emailHash,
          ipHash,
          userAgent: ua,
          action: 'erasure_requested',
        })
      })
    }
  } catch (err) {
    log.error({ err, requestId }, 'consent_log insert failed (best-effort)')
  }

  try {
    const queue = createEmailQueue(agencyId)
    await (queue as unknown as {
      add: (n: string, d: unknown, o: Record<string, unknown>) => Promise<unknown>
    }).add(
      'send',
      {
        to: email,
        subject: 'Confirm your data deletion request',
        html:
          `<p>You requested deletion of your personal data.</p>` +
          `<p>Click within 24 hours to confirm:</p>` +
          `<p><a href="${confirmUrl}">${confirmUrl}</a></p>` +
          `<p>If you did not request this, ignore this email.</p>`,
        from: process.env['EMAIL_FROM'] ?? `privacy@${AGENCY_SLUG}.mjagency.com`,
        agencyId,
      },
      { sensitiveData: true, jobId: `erasure-verify-${requestId}` },
    )
  } catch (err) {
    log.error({ err, requestId }, 'erasure email enqueue failed')
    return Response.json({ ok: false, error: 'Email enqueue failed' }, { status: 500 })
  }

  return Response.json({ ok: true, requestId })
}
