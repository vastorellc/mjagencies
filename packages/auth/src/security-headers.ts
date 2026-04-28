/**
 * packages/auth/src/security-headers.ts
 *
 * Edge-safe security header writer for Next.js middleware responses.
 *
 * Requirements satisfied:
 *   REQ-029: CVE-2025-29927 defense layer — HSTS prevents protocol downgrade that could
 *            expose cookies. Part of the three-layer defense alongside CF WAF and Next.js patch.
 *   REQ-145 / Plan 11-07: CSP is set per-request as a nonce-CSP in middleware.ts.
 *            This module no longer sets Content-Security-Policy — having both a static
 *            and a per-request CSP causes browser intersection that defeats the nonce
 *            (RESEARCH §11 Pitfall 7.1). CI grep gate (.github/workflows/csp-static-grep-gate.yml)
 *            blocks regression.
 *
 * Edge runtime safe: imports ONLY from 'next/server' (type-only import). No Node-only modules.
 */

import type { NextResponse } from 'next/server'

/**
 * Applies security headers to an outgoing Next.js middleware response.
 * Called on EVERY outgoing response — both redirect and next() responses.
 *
 * Headers set (6 total — CSP moved to middleware nonce path per Plan 11-07):
 *   - Strict-Transport-Security (HSTS + includeSubDomains + preload)
 *   - X-Frame-Options
 *   - X-XSS-Protection
 *   - X-Content-Type-Options
 *   - Referrer-Policy
 *   - Permissions-Policy
 *
 * Content-Security-Policy is set in packages/auth/src/middleware.ts via per-request
 * crypto.randomUUID() nonce. DO NOT add CSP here — see CI grep gate workflow.
 */
export function applySecurityHeaders(response: NextResponse): void {
  const h = response.headers

  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  h.set('X-Frame-Options', 'DENY')
  h.set('X-XSS-Protection', '1; mode=block')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)')
}
