/**
 * packages/auth/src/require-session.ts
 *
 * requireSession() — MFA-aware session getter for Next.js server actions.
 *
 * MUST be called as the FIRST statement of every server action.
 * The ESLint rule `mjagency-auth/require-session-first` enforces this at
 * compile time (packages/auth/eslint/require-session-first.js).
 *
 * Requirements satisfied:
 *   REQ-031 / REQ-301 / CLAUDE.md §3 — first-line auth check in server actions;
 *     middleware alone is insufficient (CVE-2025-29927 demonstrated middleware bypass).
 *   REQ-310 / SEC-N8 — every verify path uses verifyAccessToken with locked alg/iss/aud.
 *   REQ-024 — MFA enforcement: super_admin + admin roles auto-require MFA;
 *     any role can opt-in via `requireSession({ requireMfa: true })`.
 *   T-03-018 — ESLint rule prevents auth bypass via pattern regression.
 *   T-03-019 — MFA enforcement gates for privileged roles.
 *   T-03-020 — Cookie hygiene: clearAuthCookies BEFORE redirect on verify failure
 *               prevents redirect loops caused by a corrupt/stale cookie.
 *
 * Security notes:
 *   - Plan 03-04's middleware provides fast-path optimistic redirects.
 *     This module provides the strong post-CVE check that runs on the Node side.
 *   - `redirect()` in Next.js throws internally — do NOT wrap in try/catch.
 *   - Call clearAuthCookies() BEFORE redirect on verify failure (T-03-020).
 */

import 'server-only'
import { redirect } from 'next/navigation'
import { verifyAccessToken, type VerifiedAccessPayload } from './tokens.js'
import { readAccessCookie, clearAuthCookies } from './cookie.js'

/** Roles that require MFA verification automatically. */
const MFA_REQUIRED_ROLES = new Set<string>(['super_admin', 'admin'])

export interface RequireSessionOpts {
  /**
   * Force MFA verification for this call regardless of role. Default: false (auto-detect by role).
   *
   * Use for:
   *   - Sensitive operations by editor-role users (e.g. deleting an agency).
   *   - Future roles that the auto-detection set does not yet cover.
   */
  requireMfa?: boolean
}

/**
 * Reads, verifies, and enforces MFA on the caller's session.
 *
 * MUST be called as the FIRST statement of every server action (CLAUDE.md §3, REQ-031):
 *
 * ```ts
 * 'use server'
 * export async function updatePage(data: PageData) {
 *   const session = await requireSession()           // ← FIRST LINE
 *   if (session.agencyId !== data.agencyId) throw new ForbiddenError()
 *   // ... action body
 * }
 * ```
 *
 * Throws via Next.js `redirect()` (which itself throws internally) when:
 * - No access cookie is present → redirects to `/login`
 * - JWT verification fails (expired, invalid signature, alg/iss/aud mismatch) → redirects to `/login`
 * - MFA is required (role-based or explicitly requested) but `mfaVerifiedAt` is absent → redirects to `/mfa/verify`
 *
 * On verify failure, stale cookies are cleared BEFORE redirecting (T-03-020).
 *
 * @param opts - Optional configuration (e.g., force-require MFA via `{ requireMfa: true }`).
 * @returns The verified access token payload (REQ-310: locked alg/iss/aud via verifyAccessToken).
 */
export async function requireSession(opts: RequireSessionOpts = {}): Promise<VerifiedAccessPayload> {
  // Step 1: Read access cookie — redirect to /login if absent
  const token = await readAccessCookie()
  if (!token) {
    redirect('/login') // throws — never returns
  }

  // Step 2: Verify JWT with locked claims (REQ-310, SEC-N8)
  let payload: VerifiedAccessPayload
  try {
    payload = await verifyAccessToken(token)
  } catch {
    // T-03-020: Clear stale/corrupt cookie BEFORE redirecting to prevent redirect loops
    await clearAuthCookies()
    redirect('/login')
  }

  // Step 3: MFA enforcement — auto-detected by role OR explicitly requested (REQ-024)
  const mustHaveMfa = opts.requireMfa === true || MFA_REQUIRED_ROLES.has(payload.role)
  if (mustHaveMfa && !payload.mfaVerifiedAt) {
    redirect('/mfa/verify')
  }

  return payload
}
