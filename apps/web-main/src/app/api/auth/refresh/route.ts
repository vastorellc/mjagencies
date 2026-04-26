/**
 * apps/web-main/src/app/api/auth/refresh/route.ts
 *
 * Token refresh route — rotates the refresh token and issues a new access + refresh pair.
 *
 * Requirements satisfied:
 *   REQ-022: Refresh token one-time-use enforced via rotateRefreshToken (atomic GETDEL in Redis)
 *   REQ-022: Family revocation on replay — returns null → 401 + clearAuthCookies
 *
 * Contract:
 *   - Request:  POST /api/auth/refresh (no body required — reads from httpOnly cookie)
 *   - Response: 200 { ok: true }        — new cookies set
 *               401 { error: string }   — no token, invalid token, or replay detected
 *
 * Node runtime only — imports server-only, next/headers via cookie helpers.
 */

import 'server-only'
import { NextResponse } from 'next/server'
import {
  createAuthRedis,
  rotateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  readRefreshCookie,
  verifyRefreshToken,
} from '@mjagency/auth'
import { createAgencyDb } from '@mjagency/db'

export async function POST(): Promise<NextResponse> {
  const refreshToken = await readRefreshCookie()
  if (!refreshToken) return NextResponse.json({ error: 'No refresh token' }, { status: 401 })

  // Decode (with verification) to get agencyId — needed to route to the per-agency DB + Redis.
  // rotateRefreshToken does its own jose verification internally; this call is to extract claims
  // so we can construct the per-agency DB client.
  const claims = await verifyRefreshToken(refreshToken).catch(() => null)
  if (!claims) {
    await clearAuthCookies()
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
  }

  const redis = createAuthRedis()
  const db    = createAgencyDb(claims.agencyId as never, process.env.DB_APP_PASSWORD!)

  const result = await rotateRefreshToken(refreshToken, redis, db, claims.agencyId)

  if (!result) {
    // Replay detected — family already revoked inside rotateRefreshToken
    await clearAuthCookies()
    return NextResponse.json({ error: 'Token replay detected; family revoked' }, { status: 401 })
  }

  await setAuthCookies(result.accessToken, result.refreshToken)
  return NextResponse.json({ ok: true })
}
