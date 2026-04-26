/**
 * apps/web-main/src/app/auth/callback/route.ts
 *
 * SSO callback route handler — consumes the one-time SSO code issued by accounts.brand.com,
 * exchanges it server-to-server for a JWT pair, sets cookies, and redirects the user.
 *
 * This file is the reference implementation for Plan 03-04. Per-agency app copies ship
 * in Plan 03-05 or a follow-up. See docs/runbooks/cloudflare-edge.md §Per-Agency Callback Gap.
 *
 * SSO flow step 5 (RESEARCH §5.1):
 *   a. Verify CSRF state param (verifySsoState — Plan 03-03 provides HMAC implementation)
 *   b. POST code to accounts.brand.com/api/sso/exchange with x-mjagency-internal header
 *   c. Set __Host-access + __Host-refresh cookies via setAuthCookies()
 *   d. Redirect to validated returnTo
 *
 * Node runtime only — imports server-only, next/headers, @mjagency/auth (cookie writer).
 * NOT importable from middleware.ts (Edge runtime).
 */

import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { verifySsoState, setAuthCookies } from '@mjagency/auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Extract expected agency from host (e.g. ecommerce.brand.com → 'ecommerce')
  const host = req.headers.get('host') ?? ''
  const expectedSlug = host.split(':')[0]?.split('.')[0] ?? ''

  const stateResult = verifySsoState(state, expectedSlug)
  if (!stateResult.valid) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Server-to-server exchange against accounts.brand.com (REQ-026)
  // x-mjagency-internal header gates this endpoint to internal callers only
  const exchangeUrl = `https://${process.env.ACCOUNTS_HOST ?? 'accounts.brand.com'}/api/sso/exchange`
  const res = await fetch(exchangeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mjagency-internal': process.env.SSO_INTERNAL_TOKEN ?? '',
    },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const tokens = (await res.json()) as { accessToken: string; refreshToken: string }
  await setAuthCookies(tokens.accessToken, tokens.refreshToken)

  // Redirect to validated returnTo (open-redirect safe: Plan 03-03 validateReturnTo wraps this)
  return NextResponse.redirect(new URL(stateResult.returnTo, req.url))
}
