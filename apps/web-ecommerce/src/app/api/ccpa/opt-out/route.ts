/**
 * apps/web-ecommerce/src/app/api/ccpa/opt-out/route.ts
 * Plan 11-05 / REQ-144 D-03:
 *
 * Public POST endpoint — no auth (anyone can opt-out without an account).
 * Sets mj_consent cookie + writes consent_log audit row + enqueues fan-out.
 *
 * Pitfall 5.5: POST-only — GET prefetch never triggers writes.
 * Middleware exclusion: /api/* is already excluded from middleware (Plan 11-07).
 */
export const runtime = 'nodejs'

import 'server-only'
import { cookies, headers } from 'next/headers'
import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createAgencyDb, consentLog, withAgencyContext } from '@mjagency/db'
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const AGENCY_SLUG = 'web-ecommerce'
const DB_AGENCY: 'ecommerce' = 'ecommerce'

const log = createLogger({ service: `${AGENCY_SLUG}-ccpa-opt-out` })

interface OptOutRequest {
  /** 'opt_out' (default) or 'opt_in' (re-enable tracking from already-blocked state) */
  action?: 'opt_out' | 'opt_in'
}

interface OptOutFanoutData {
  agencyId: string
  requestId: string
  gaClientId: string | null
  clarityUserId: string | null
  emailHash?: string | null
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(req: Request): Promise<Response> {
  let body: OptOutRequest = {}
  try {
    body = (await req.json()) as OptOutRequest
  } catch {
    // Empty / non-JSON body is allowed — default to opt_out
  }
  const action = body.action === 'opt_in' ? 'opt_in' : 'opt_out'

  const h = await headers()
  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for') ?? ''
  const ua = h.get('user-agent') ?? ''
  const ipHash = createHash('sha256').update(ip).digest('hex')

  // Set mj_consent cookie (SameSite=Lax, Secure, NOT httpOnly — client must read via useConsent).
  const cookieJar = await cookies()
  const newConsent = action === 'opt_out' ? 'tracking_blocked' : 'tracking_allowed'
  cookieJar.set('mj_consent', newConsent, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
  })

  const gaClientId = cookieJar.get('_ga')?.value ?? null
  const clarityUserId = cookieJar.get('mj_clarity_id')?.value ?? null

  const requestId = randomUUID()
  const agencyId = process.env['NEXT_PUBLIC_AGENCY_ID'] ?? process.env['AGENCY_ID']

  // Audit row in consent_log (RLS via app.agency_id session var).
  if (agencyId) {
    try {
      const password = process.env['DB_APP_PASSWORD']
      if (password) {
        const db = createAgencyDb(DB_AGENCY, password)
        await withAgencyContext(db, agencyId, async (tx) => {
          await tx.insert(consentLog).values({
            agencyId,
            ipHash,
            userAgent: ua,
            clarityUserId,
            gaClientId,
            action,
          })
        })
      }
    } catch (err) {
      log.error({ err, requestId }, 'consent_log insert failed (best-effort)')
    }
  }

  // Enqueue fan-out (GA4 + Meta + Clarity Delete) — only on opt_out (re-enable does not delete).
  if (action === 'opt_out' && agencyId) {
    try {
      const queue = createEncryptedQueue<OptOutFanoutData>('ccpa-opt-out', {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        keyPrefix: REDIS_KEY.bullPrefix(agencyId),
      })
      await (queue as unknown as {
        add: (n: string, d: OptOutFanoutData, o: Record<string, unknown>) => Promise<unknown>
      }).add(
        'opt-out-fanout',
        { agencyId, requestId, gaClientId, clarityUserId },
        { sensitiveData: true, jobId: requestId, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      )
    } catch (err) {
      log.error({ err, requestId }, 'opt-out fan-out enqueue failed')
    }
  }

  // Touch the slug constant so tree-shake doesn't drop it.
  void AGENCY_SLUG
  void sql

  return Response.json({ ok: true, requestId, action })
}
