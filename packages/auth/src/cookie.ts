/**
 * packages/auth/src/cookie.ts
 *
 * Auth cookie writer for Next.js server components and server actions.
 * Imports 'server-only' to prevent accidental client-side use.
 *
 * Requirements satisfied:
 *   REQ-023: httpOnly + SameSite=Strict + Secure cookies with __Host- prefix in production
 *
 * Plan-time decision Open Q5 resolution:
 *   Production (NODE_ENV === 'production'): uses __Host-access / __Host-refresh.
 *   The __Host- prefix requires Secure=true AND no Domain attribute AND path=/ — this does NOT
 *   work on http://localhost. Dev mode falls back to bare names (mj-access / mj-refresh) with
 *   secure:false so localhost http auth works without self-signed cert hassle.
 *
 * Pitfall 3 (RESEARCH §3.3): Do NOT set a `domain` attribute — __Host- prefix forbids it and
 *   it also leaks cookies to subdomains on custom domain setups.
 * Pitfall 4 (RESEARCH §3.2): `await cookies()` — Next.js 15 cookies() returns a Promise.
 *
 * clearAuthCookies() issues maxAge:0 set calls for BOTH the active name AND all legacy names
 * (__Host-access, __Host-refresh, mj-access, mj-refresh). This ensures a NODE_ENV toggle
 * (e.g., switching from prod deploy back to dev) never leaves a stale cookie on the browser.
 */

import 'server-only'
import { cookies } from 'next/headers'

const IS_PROD = process.env.NODE_ENV === 'production'

// Open Q5 resolution: __Host- prefix requires Secure + no Domain — does not work on http://localhost.
// Dev fallback uses bare names without the prefix and secure:false so localhost http auth works.
export const ACCESS_COOKIE  = IS_PROD ? '__Host-access'  : 'mj-access'
export const REFRESH_COOKIE = IS_PROD ? '__Host-refresh' : 'mj-refresh'

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await cookies()
  jar.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure:   IS_PROD,           // __Host- prefix requires secure:true; dev sets false
    sameSite: 'strict',
    path:     '/',               // __Host- requires path:/ even in dev for parity
    maxAge:   15 * 60,
    // Note: NO `domain` attribute — required by __Host- prefix and harmless in dev (Pitfall 3)
  })
  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'strict',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60,
  })
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies()
  // Use maxAge:0 to clear — delete() has known issues with __Host- prefixed cookies (vercel/next.js #56632)
  const opts = { maxAge: 0 as const, path: '/' as const, secure: IS_PROD, httpOnly: true as const, sameSite: 'strict' as const }
  jar.set(ACCESS_COOKIE, '', opts)
  jar.set(REFRESH_COOKIE, '', opts)
  // Also clear legacy names so a prod→dev or dev→prod toggle does not leave stale cookies
  jar.set('__Host-access',  '', opts)
  jar.set('__Host-refresh', '', opts)
  jar.set('mj-access',      '', opts)
  jar.set('mj-refresh',     '', opts)
}

export async function readAccessCookie(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(ACCESS_COOKIE)?.value ?? jar.get('__Host-access')?.value ?? jar.get('mj-access')?.value
}

export async function readRefreshCookie(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(REFRESH_COOKIE)?.value ?? jar.get('__Host-refresh')?.value ?? jar.get('mj-refresh')?.value
}
