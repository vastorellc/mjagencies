#!/usr/bin/env node
/**
 * One-shot generator for Plan 11-05 erasure-request and erasure-confirm route files
 * across the 11 skeletal agency apps. web-main and web-ecommerce have hand-written
 * copies; this script handles the remaining apps with identical templated content
 * (DB_AGENCY: 'brand' for all skeletal apps per existing csp-report convention).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const APPS = [
  'web-realestate',
  'web-healthcare',
  'web-legal',
  'web-homeservices',
  'web-fitness',
  'web-dental',
  'web-automotive',
  'web-restaurant',
  'web-education',
  'web-financial',
  'web-petcare',
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

function requestRoute(slug) {
  return `/**
 * apps/${slug}/src/app/api/privacy/erasure-request/route.ts
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

const AGENCY_SLUG = '${slug}'
const DB_AGENCY: 'brand' = 'brand'
const log = createLogger({ service: \`\${AGENCY_SLUG}-erasure-request\` })

const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/

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

  const baseUrl = process.env['PUBLIC_BASE_URL'] ?? \`https://\${AGENCY_SLUG}.mjagency.com\`
  const confirmUrl = \`\${baseUrl}/privacy/erasure/confirm?token=\${encodeURIComponent(token)}\`

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
          \`<p>You requested deletion of your personal data.</p>\` +
          \`<p>Click within 24 hours to confirm:</p>\` +
          \`<p><a href="\${confirmUrl}">\${confirmUrl}</a></p>\` +
          \`<p>If you did not request this, ignore this email.</p>\`,
        from: process.env['EMAIL_FROM'] ?? \`privacy@\${AGENCY_SLUG}.mjagency.com\`,
        agencyId,
      },
      { sensitiveData: true, jobId: \`erasure-verify-\${requestId}\` },
    )
  } catch (err) {
    log.error({ err, requestId }, 'erasure email enqueue failed')
    return Response.json({ ok: false, error: 'Email enqueue failed' }, { status: 500 })
  }

  return Response.json({ ok: true, requestId })
}
`
}

function confirmRoute(slug) {
  return `/**
 * apps/${slug}/src/app/api/privacy/erasure-confirm/route.ts
 * Plan 11-05 / REQ-144 D-04 — public anonymous endpoint.
 */
export const runtime = 'nodejs'

import 'server-only'
import { createHash } from 'node:crypto'
import { Redis } from 'ioredis'
import { verifyErasureToken, createErasureQueue } from '@mjagency/compliance'
import { createAgencyDb, consentLog, withAgencyContext } from '@mjagency/db'
import { REDIS_KEY, createLogger } from '@mjagency/config'

const AGENCY_SLUG = '${slug}'
const DB_AGENCY: 'brand' = 'brand'
const log = createLogger({ service: \`\${AGENCY_SLUG}-erasure-confirm\` })

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
    const replayKey = \`agency:\${verified.agencyId}:erasure:requestid:\${verified.requestId}\`
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
`
}

for (const slug of APPS) {
  const baseDir = join(repoRoot, 'apps', slug, 'src', 'app', 'api', 'privacy')
  mkdirSync(join(baseDir, 'erasure-request'), { recursive: true })
  mkdirSync(join(baseDir, 'erasure-confirm'), { recursive: true })
  writeFileSync(join(baseDir, 'erasure-request', 'route.ts'), requestRoute(slug))
  writeFileSync(join(baseDir, 'erasure-confirm', 'route.ts'), confirmRoute(slug))
  console.log(`generated ${slug} erasure-request + erasure-confirm`)
}
console.log('done')
