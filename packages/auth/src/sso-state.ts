/**
 * packages/auth/src/sso-state.ts
 *
 * SSO CSRF state token — HMAC-SHA256 signed, base64url-encoded.
 *
 * Requirements satisfied:
 *   REQ-026: SSO at accounts.brand.com — the ONE login surface for all agencies
 *   T-03-010 mitigation: HMAC-SHA256 with platform secret + timingSafeEqual compare +
 *             agency embedded in payload AND verified against expectedAgencyId
 *
 * Design (RESEARCH §5.2 verbatim implementation):
 *   - State = base64url( agencyId:encodedReturnTo:nonce:hmacSig )
 *   - nonce = 16 random bytes (32 hex chars) — replay prevention
 *   - signature = HMAC-SHA256( agencyId:encodedReturnTo:nonce, SSO_STATE_SECRET )
 *   - Verification: timing-safe compare with buffer-length guard (throws if lengths mismatch)
 *
 * NOTE: Node-runtime only — node:crypto is not available in Edge middleware.
 * Import this module only from route handlers and server actions, NOT from middleware.ts.
 */

import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function getStateSecret(): string {
  const raw = process.env.SSO_STATE_SECRET
  if (!raw) throw new Error('SSO_STATE_SECRET not set in Doppler env')
  return raw
}

/**
 * Generates an HMAC-SHA256 signed SSO state token.
 *
 * The state encodes: agencyId, URL-encoded returnTo, a random nonce, and an HMAC signature.
 * The result is base64url-encoded for safe transport as a query parameter.
 *
 * @param agencyId - The agency slug (e.g. 'ecommerce')
 * @param returnTo - The URL to redirect back to after successful auth
 */
export function generateSsoState(agencyId: string, returnTo: string): string {
  const nonce     = randomBytes(16).toString('hex')
  const payload   = `${agencyId}:${encodeURIComponent(returnTo)}:${nonce}`
  const signature = createHmac('sha256', getStateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export interface SsoStateVerifyResult {
  valid: boolean
  returnTo: string
  agencyId: string | null
}

/**
 * Verifies an HMAC-signed SSO state token and extracts the returnTo URL.
 *
 * Returns `{ valid: false, returnTo: '/dashboard', agencyId: null }` if the state is:
 *   - Tampered (signature mismatch — T-03-010)
 *   - Agency mismatch (agencyId in state !== expectedAgencyId)
 *   - Malformed (base64url parse failure, wrong part count)
 *   - Length-mismatched signature buffer (guarded before timingSafeEqual to prevent throw)
 *
 * @param state - The base64url-encoded signed state string from the query param
 * @param expectedAgencyId - The agency slug from the current Host header
 */
export function verifySsoState(state: string, expectedAgencyId: string): SsoStateVerifyResult {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parts   = decoded.split(':')
    if (parts.length < 4) return { valid: false, returnTo: '/dashboard', agencyId: null }

    const [agencyId, encodedReturnTo, nonce, signature] = parts as [string, string, string, string]
    const payload  = `${agencyId}:${encodedReturnTo}:${nonce}`
    const expected = createHmac('sha256', getStateSecret()).update(payload).digest('hex')

    // Length-mismatched buffers → reject before timingSafeEqual (which throws on mismatched lengths)
    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return { valid: false, returnTo: '/dashboard', agencyId: null }

    const sigOk    = timingSafeEqual(sigBuf, expBuf)
    const agencyOk = agencyId === expectedAgencyId

    return {
      valid:    sigOk && agencyOk,
      returnTo: (sigOk && agencyOk) ? decodeURIComponent(encodedReturnTo) : '/dashboard',
      agencyId,
    }
  } catch {
    return { valid: false, returnTo: '/dashboard', agencyId: null }
  }
}
