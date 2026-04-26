/**
 * apps/web-main/src/app/api/auth/logout/route.ts
 *
 * Logout route — revokes the token family and clears auth cookies.
 *
 * Requirements satisfied:
 *   REQ-022: Family revocation — revokeFamilyTokens deletes all refresh markers in the family
 *   CLAUDE.md §7: Token storage cleared via httpOnly cookie clearing
 *
 * Contract:
 *   - Request:  POST /api/auth/logout (no body)
 *   - Response: 200 { ok: true }  — always succeeds (idempotent; gracefully handles missing token)
 *
 * Order: revokeFamilyTokens FIRST, then clearAuthCookies (SEC-17 analogy — revoke before clear).
 *
 * Node runtime only — imports server-only, next/headers via cookie helpers.
 */

import 'server-only'
import { NextResponse } from 'next/server'
import {
  createAuthRedis,
  revokeFamilyTokens,
  clearAuthCookies,
  readAccessCookie,
  verifyAccessToken,
} from '@mjagency/auth'

export async function POST(): Promise<NextResponse> {
  const accessToken = await readAccessCookie()
  if (accessToken) {
    const claims = await verifyAccessToken(accessToken).catch(() => null)
    if (claims) {
      const redis = createAuthRedis()
      await revokeFamilyTokens(redis, claims.agencyId, claims.familyId)
    }
  }
  await clearAuthCookies()
  return NextResponse.json({ ok: true })
}
