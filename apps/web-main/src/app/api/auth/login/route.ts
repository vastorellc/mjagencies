/**
 * apps/web-main/src/app/api/auth/login/route.ts
 *
 * Login route — direct login on accounts.brand.com AND the SSO entry path.
 *
 * PHASE 3 SCAFFOLDING: This route is intentionally incomplete until users.password_hash
 * ships in a later plan. Production mode returns 501 before any credential check (T-03-013).
 * Dev mode uses LOGIN_DEV_USER_EMAIL / LOGIN_DEV_USER_PASSWORD / LOGIN_DEV_USER_ID env vars.
 * Full credential validation lands when the `users.password_hash` column is added (Phase 5+).
 *
 * Requirements satisfied:
 *   REQ-026: SSO entry path — creates an opaque code and redirects to agency /auth/callback
 *   T-03-013 mitigation: Production returns 501 BEFORE any credential check; dev fallback
 *             only fires when NODE_ENV !== 'production'. README documents the Phase 5 gap.
 *
 * Contract:
 *   - Request:  POST /api/auth/login
 *               Body: { email: string, password: string, agency: AgencySlug, returnTo?: string, state?: string }
 *   - Response: 200 { ok: true }  — direct login path (no state param); cookies set
 *               302 → https://<agency>.<ACCOUNTS_HOST_PARENT>/auth/callback?code=<codeId>&state=<state>
 *                         — SSO entry path (state param present)
 *               400 Invalid body
 *               401 Invalid credentials (dev mode)
 *               501 Not implemented (production — password column not yet added)
 *
 * Open redirect defense (Plan 03-06 follow-up):
 *   returnTo uses a temporary inline same-origin check: new URL(returnTo, origin).origin !== origin → '/dashboard'.
 *   Plan 03-06 ships the canonical validateReturnTo() helper which will replace this inline check.
 *
 * Node runtime only — server-only guard prevents accidental Edge import.
 */

import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createAuthRedis,
  regenerateSession,
  setAuthCookies,
  createSsoCode,
} from '@mjagency/auth'
import { AGENCIES, type AgencySlug } from '@mjagency/config'

const BodySchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  agency:   z.enum(AGENCIES),
  returnTo: z.string().optional(),
  state:    z.string().optional(),
})

/**
 * Inline same-origin returnTo validation.
 * Plan 03-06 will replace this with the canonical validateReturnTo() helper.
 * Returns '/dashboard' if returnTo is invalid or points cross-origin.
 */
function validateReturnToInline(returnTo: string | undefined, origin: string): string {
  if (!returnTo) return '/dashboard'
  try {
    const resolved = new URL(returnTo, origin)
    if (resolved.origin !== origin) return '/dashboard'
    return returnTo
  } catch {
    return '/dashboard'
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  // T-03-013: Production returns 501 BEFORE any credential check.
  // Dev fallback only fires when NODE_ENV !== 'production'.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Login pending Phase 5 user password column' },
      { status: 501 },
    )
  }

  // Parse + validate body
  const rawBody = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  }

  const { email, password, agency, returnTo, state } = parsed.data

  // Dev-only credential check against Doppler env vars
  const devEmail    = process.env.LOGIN_DEV_USER_EMAIL
  const devPassword = process.env.LOGIN_DEV_USER_PASSWORD
  const devUserId   = process.env.LOGIN_DEV_USER_ID

  if (!devEmail || !devPassword || !devUserId) {
    return NextResponse.json({ error: 'Dev login env vars not configured' }, { status: 500 })
  }

  if (email !== devEmail || password !== devPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Validate userId is a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(devUserId)) {
    return NextResponse.json({ error: 'Invalid LOGIN_DEV_USER_ID — must be a UUID' }, { status: 500 })
  }

  const redis = createAuthRedis()

  // regenerateSession revokes any placeholder old family and issues a fresh family
  // crypto.randomUUID() is used as the placeholder old family — it doesn't exist in Redis
  // so revokeFamilyTokens is a no-op, and a new family is issued cleanly.
  const session = await regenerateSession(
    crypto.randomUUID(), // placeholder old family (no existing session to revoke)
    devUserId,
    agency,
    'admin',             // dev user is admin; Plan 03-05 adds role lookup
    redis,
  )

  if (state) {
    // SSO entry path: user is logging in from an agency subdomain redirect.
    // Create a single-use opaque code and 302 back to the agency /auth/callback.
    const code = await createSsoCode(redis, {
      userId:   devUserId,
      agencyId: agency,
      familyId: session.familyId,
      issuedAt: Date.now(),
    })

    // Build the callback URL: https://<agency>.<ACCOUNTS_HOST_PARENT>/auth/callback?code=...&state=...
    // ACCOUNTS_HOST_PARENT = host parent for agency subdomains (e.g. brand.com or localhost:3001)
    const hostParent = process.env.ACCOUNTS_HOST_PARENT ?? 'brand.com'
    const callbackUrl = `https://${agency as AgencySlug}.${hostParent}/auth/callback?code=${code}&state=${encodeURIComponent(state)}`
    return NextResponse.redirect(callbackUrl, 302)
  }

  // Direct login path (no state): set cookies on accounts.brand.com itself
  const origin = new URL(req.url).origin
  const safeReturnTo = validateReturnToInline(returnTo, origin)

  await setAuthCookies(session.accessToken, session.refreshToken)
  return NextResponse.json({ ok: true, returnTo: safeReturnTo })
}
