/**
 * apps/web-restaurant/src/app/api/privacy/erasure-confirm/route.ts
 * Plan 11-05 / REQ-144 D-04 — public anonymous endpoint.
 */
export const runtime = 'nodejs'

import 'server-only'
import { createHash } from 'node:crypto'
import { Redis } from 'ioredis'
import { verifyErasureToken, createErasureQueue } from '@mjagency/compliance'
import { createAgencyDb, consentLog, withAgencyContext } from '@mjagency/db'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const AGENCY_SLUG = 'web-restaurant'
const DB_AGENCY: 'brand' = 'brand'
const log = createLogger({ service: `${AGENCY_SLUG}-erasure-confirm` })

interface ErasureConfirmBody {
  token?: string
}

export async function POST(req: Request): Promise<Response> {
  let body: ErasureConfirmBody
  try {
    body = (await req.json()) as ErasureConfirmBody
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 })
  }

  const token = body.token
  if (!token || typeof token !== 'string') {
    return Response.json({ ok: false, error: 'Missing token' }, { status: 400 })
  }

  let verified: { email: string; agencyId: string; requestId: string }
  try {
    verified = await verifyErasureToken(token)
  } catch (err) {
    log.warn({ err: String(err) }, 'erasure token verification failed')
    return Response.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 })
  }

  const redis = new Redis({
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  })
  try {
    const replayKey = `agency:${verified.agencyId}:erasure:requestid:${verified.requestId}`
    const acquired = await redis.set(replayKey, '1', 'EX', 86400, 'NX')
    if (!acquired) {
      return Response.json({ ok: false, error: 'Token already used' }, { status: 409 })
    }
  } finally {
    await redis.quit().catch(() => {
      /* ignore */
    })
  }

  try {
    const password = process.env['DB_APP_PASSWORD']
    if (password) {
      const emailHash = createHash('sha256').update(verified.email).digest('hex')
      const ipHash = createHash('sha256').update('').digest('hex')
      const db = createAgencyDb(DB_AGENCY, password)
      await withAgencyContext(db, verified.agencyId, async (tx) => {
        await tx.insert(consentLog).values({
          agencyId: verified.agencyId,
          emailHash,
          ipHash,
          action: 'erasure_confirmed',
        })
      })
    }
  } catch (err) {
    log.error({ err, requestId: verified.requestId }, 'consent_log erasure_confirmed insert failed (best-effort)')
  }

  try {
    const queue = createErasureQueue(verified.agencyId)
    await (queue as unknown as {
      add: (n: string, d: unknown, o: Record<string, unknown>) => Promise<unknown>
    }).add(
      'erasure-fanout',
      {
        agencyId: verified.agencyId,
        dbAgencySlug: DB_AGENCY,
        agencyName: process.env['NEXT_PUBLIC_AGENCY_NAME'] ?? AGENCY_SLUG,
        email: verified.email,
        requestId: verified.requestId,
      },
      {
        sensitiveData: true,
        jobId: verified.requestId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      },
    )
  } catch (err) {
    log.error({ err, requestId: verified.requestId }, 'erasure job enqueue failed')
    return Response.json({ ok: false, error: 'Erasure enqueue failed' }, { status: 500 })
  }

  void REDIS_KEY

  return Response.json({ ok: true, requestId: verified.requestId })
}
