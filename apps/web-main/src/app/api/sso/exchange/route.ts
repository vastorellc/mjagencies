/**
 * apps/web-main/src/app/api/sso/exchange/route.ts
 *
 * Server-to-server SSO code exchange endpoint — POST { code } → { accessToken, refreshToken }.
 *
 * Requirements satisfied:
 *   REQ-026: SSO at accounts.brand.com — the ONE login surface for all 12 agencies
 *   T-03-012 (Elevation of Privilege) mitigation: `x-mjagency-internal` header checked
 *             BEFORE body parse; production additionally gated by Cloudflare Access
 *             policy restricting source to internal cluster IPs.
 *
 * Q2 resolution (Plan 03-03):
 *   SSO codes are stored under `accounts:sso:code:<codeId>` — cross-agency platform namespace.
 *   The exchange happens cross-agency by design: agency subdomain app calls this endpoint to
 *   mint tokens for its own agency.
 *
 * Contract:
 *   - Request:  POST /api/sso/exchange
 *               Header: x-mjagency-internal: <SSO_INTERNAL_TOKEN>
 *               Body:   { code: string }  — must match /^[a-f0-9]{32}$/
 *   - Response: 200 { accessToken, refreshToken }
 *               400 Invalid body
 *               401 Code expired or already used
 *               403 Missing or wrong internal header
 *
 * Node runtime only — NOT callable from middleware.ts.
 */

import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthRedis, redeemSsoCode, signAccessToken, signRefreshToken } from '@mjagency/auth'
import { REDIS_KEY } from '@mjagency/config'

const Body = z.object({ code: z.string().regex(/^[a-f0-9]{32}$/) })

export async function POST(req: Request): Promise<NextResponse> {
  // T-03-012: Internal-header gate checked BEFORE body parse.
  // Defense-in-depth: Cloudflare Access policy restricts source IPs in production.
  const internal = req.headers.get('x-mjagency-internal')
  if (internal !== process.env.SSO_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const redis   = createAuthRedis()
  const payload = await redeemSsoCode(redis, parsed.data.code)
  if (!payload) return NextResponse.json({ error: 'Code expired or already used' }, { status: 401 })

  // Issue tokens for the target agency (NOT brand). Role defaults to 'editor' at this plan stage;
  // Plan 03-05 adds the lookup against the users table for the actual role.
  const accessJti  = crypto.randomUUID()
  const refreshJti = crypto.randomUUID()
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: payload.userId, agencyId: payload.agencyId, role: 'editor', jti: accessJti, familyId: payload.familyId }),
    signRefreshToken({ sub: payload.userId, agencyId: payload.agencyId, jti: refreshJti, familyId: payload.familyId }),
  ])

  // Register the new refresh marker + family set (per-agency session namespace)
  await redis.set(
    REDIS_KEY.session.rt(payload.agencyId, refreshJti),
    JSON.stringify({ familyId: payload.familyId, userId: payload.userId, usedAt: null }),
    'EX', 7 * 24 * 3600,
  )
  await redis.sadd(REDIS_KEY.session.family(payload.agencyId, payload.familyId), refreshJti)
  await redis.expire(REDIS_KEY.session.family(payload.agencyId, payload.familyId), 7 * 24 * 3600)

  return NextResponse.json({ accessToken, refreshToken })
}
