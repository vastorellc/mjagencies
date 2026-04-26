/**
 * packages/auth/src/security-headers.ts
 *
 * Edge-safe security header writer for Next.js middleware responses.
 *
 * Requirements satisfied:
 *   REQ-029: CVE-2025-29927 defense layer — HSTS prevents protocol downgrade that could
 *            expose cookies. Part of the three-layer defense alongside CF WAF and Next.js patch.
 *   SEC-N3: Static CSP at this plan. Phase 11 (M011) ships the nonce-per-request CSP as a
 *           Cloudflare Worker, replacing `script-src 'unsafe-inline'` with a per-request nonce.
 *
 * Edge runtime safe: imports ONLY from 'next/server' (type-only import). No Node-only modules.
 */

import type { NextResponse } from 'next/server'

/**
 * Applies security headers to an outgoing Next.js middleware response.
 * Called on EVERY outgoing response — both redirect and next() responses.
 *
 * Headers set (7 total):
 *   - Strict-Transport-Security (HSTS + includeSubDomains + preload)
 *   - X-Frame-Options
 *   - X-XSS-Protection
 *   - X-Content-Type-Options
 *   - Referrer-Policy
 *   - Permissions-Policy
 *   - Content-Security-Policy (static; replaced by nonce-CSP in Phase 11 / M011 / SEC-N3)
 */
export function applySecurityHeaders(response: NextResponse): void {
  const h = response.headers

  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  h.set('X-Frame-Options', 'DENY')
  h.set('X-XSS-Protection', '1; mode=block')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')

  // Static CSP. Phase 11 (M011) ships the nonce-per-request CSP as a Cloudflare Worker (SEC-N3).
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // tightened to nonce in Phase 11
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://imagedelivery.net",
      "connect-src 'self' https://api.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  )
}
