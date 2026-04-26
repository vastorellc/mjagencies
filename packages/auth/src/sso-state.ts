/**
 * packages/auth/src/sso-state.ts
 *
 * SSO CSRF state token — HMAC-SHA256 signed, base64url-encoded.
 *
 * THIS FILE IS A STUB created in Plan 03-04 to satisfy the type dependency of
 * apps/web-main/src/app/auth/callback/route.ts. Plan 03-03 will replace this stub
 * with the full HMAC implementation using node:crypto timingSafeEqual (RESEARCH §5.2).
 *
 * NOTE: This is Node-runtime only — node:crypto is not available in Edge middleware.
 * Import this module only from route handlers and server actions, NOT from middleware.ts.
 */

export interface SsoStateResult {
  valid: boolean
  returnTo: string
}

/**
 * Generates an HMAC-SHA256 signed SSO state token.
 * Stub implementation — Plan 03-03 provides the real crypto implementation.
 *
 * @param agencyId - The agency slug (e.g. 'ecommerce')
 * @param returnTo - The URL to redirect back to after successful auth
 */
export function generateSsoState(agencyId: string, returnTo: string): string {
  // Stub: Plan 03-03 replaces with createHmac('sha256', SSO_STATE_SECRET) implementation
  const payload = `${agencyId}:${encodeURIComponent(returnTo)}:stub-nonce`
  return Buffer.from(payload).toString('base64url')
}

/**
 * Verifies an HMAC-signed SSO state token and extracts the returnTo URL.
 * Returns { valid: false, returnTo: '/dashboard' } if the state is tampered or agency mismatch.
 * Stub implementation — Plan 03-03 provides the real timingSafeEqual implementation.
 *
 * @param state - The base64url-encoded signed state string from the query param
 * @param expectedAgencyId - The agency slug from the current Host header
 */
export function verifySsoState(state: string, expectedAgencyId: string): SsoStateResult {
  // Stub: Plan 03-03 replaces with full HMAC verification using timingSafeEqual
  // This stub always returns invalid so the callback route fails safely until 03-03 is in place.
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) return { valid: false, returnTo: '/dashboard' }
    const [agencyId, encodedReturnTo] = parts as [string, string]
    if (agencyId !== expectedAgencyId) return { valid: false, returnTo: '/dashboard' }
    return { valid: false, returnTo: decodeURIComponent(encodedReturnTo) }
  } catch {
    return { valid: false, returnTo: '/dashboard' }
  }
}
