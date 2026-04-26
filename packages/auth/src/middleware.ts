/**
 * packages/auth/src/middleware.ts
 *
 * Edge-compatible Next.js middleware factory.
 *
 * ============================================================
 * EDGE RUNTIME SAFETY CONTRACT — DO NOT VIOLATE
 * ============================================================
 * Allowed imports (Pitfall 1 mitigation from RESEARCH §11):
 *   ✅ next/server                         — Edge-compatible
 *   ✅ jose                                — Edge-compatible (Web Crypto API, no Node crypto)
 *   ✅ ./agency-from-host.js              — Edge-safe (only @mjagency/config constants)
 *   ✅ ./security-headers.js              — Edge-safe (type-only next/server import)
 *   ❌ @mjagency/config/logger            — NEVER — Pino is Node-only (startup crash on Edge)
 *   ❌ @mjagency/db                       — NEVER — postgres-js is Node-only
 *   ❌ bcrypt                             — NEVER — native Node bindings
 *   ❌ ioredis                            — NEVER — Node net/tls
 * ============================================================
 *
 * Requirements satisfied:
 *   REQ-029: CVE-2025-29927 three-layer defense:
 *            Layer 1 — Cloudflare WAF strips x-middleware-subrequest (docs/runbooks/cloudflare-edge.md)
 *            Layer 2 — Next.js >= 15.2.3 patch (CI gate added by Plan 03-06)
 *            Layer 3 — requireSession() in server actions (Plan 03-05) — middleware is NEVER sole guard
 *   REQ-030: Matcher excludes /(payload)/admin and /api/* and /_next/*
 *   REQ-310 / SEC-N8: jwtVerify called with explicit algorithms, issuer, audience on every call
 *   T-03-014: CVE bypass defense (see above)
 *   T-03-015: Edge bundle safety (see allowed imports above)
 *   T-03-016: Cross-tenant token reuse — payload.agencyId must equal subdomain slug
 *   T-03-017: Unknown subdomain → 404 (not /login) so probing does not reveal known slugs
 */

import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { extractAgencyFromHost } from './agency-from-host.js'
import { applySecurityHeaders } from './security-headers.js'

const JWT_ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)
const ACCESS_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-access' : 'mj-access'

interface AccessClaims {
  sub: string
  agencyId: string
  role: string
  jti: string
  familyId: string
}

/**
 * Returns a Next.js-compatible middleware function that:
 *   1. Extracts the agency slug from the Host header (404 on unknown subdomain — T-03-017).
 *   2. Bypasses auth for /login, /sso, /auth/callback (SSO handshake paths).
 *   3. Reads the access cookie; redirects to /login if absent.
 *   4. Verifies the JWT via jose jwtVerify with explicit alg/iss/aud (REQ-310).
 *   5. Compares payload.agencyId against the subdomain slug (anti-cross-tenant, T-03-016).
 *   6. Injects x-agency-id, x-user-id, x-user-role request-context headers for server components.
 *   7. Applies security headers on every response (REQ-029 HSTS layer).
 */
export function createAuthMiddleware() {
  return async function middleware(req: NextRequest): Promise<NextResponse> {
    const url = req.nextUrl.clone()
    const agency = extractAgencyFromHost(req.headers.get('host'))

    // Unknown subdomain → 404 (subdomain takeover probing defense — T-03-017)
    if (!agency) {
      return new NextResponse(null, { status: 404 })
    }

    // Bypass auth for the login route itself + /sso entry + /auth/callback so the SSO flow can complete
    const path = url.pathname
    if (path === '/login' || path === '/sso' || path.startsWith('/auth/callback')) {
      const passthrough = NextResponse.next()
      passthrough.headers.set('x-agency-id', agency)
      applySecurityHeaders(passthrough)
      return passthrough
    }

    // Read the access cookie (also accept legacy/dev names for NODE_ENV toggle safety)
    const token =
      req.cookies.get(ACCESS_COOKIE)?.value ??
      req.cookies.get('__Host-access')?.value ??
      req.cookies.get('mj-access')?.value

    if (!token) {
      url.pathname = '/login'
      url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }

    try {
      const { payload } = await jwtVerify<AccessClaims>(token, JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: 'mjagency',
        audience: 'mjagency-api',
      })

      // Anti-cross-tenant: token's agencyId MUST match the subdomain (T-03-016 mitigation)
      if (payload.agencyId !== agency) {
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }

      // Inject request-context headers for downstream server components
      const response = NextResponse.next({
        request: {
          headers: new Headers(req.headers),
        },
      })
      response.headers.set('x-agency-id', agency)
      response.headers.set('x-user-id', payload.sub ?? '')
      response.headers.set('x-user-role', payload.role ?? '')

      applySecurityHeaders(response)
      return response
    } catch {
      // Verify failed (expired/invalid). Redirect to login with returnTo preserved.
      url.pathname = '/login'
      url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
  }
}

/**
 * Shared matcher for all 12 apps. Exported from this sub-path so each app's middleware.ts
 * is a 2-line re-export — no copy-paste drift possible.
 *
 * Exclusions (REQ-030, CLAUDE.md §4):
 *   _next/static, _next/image  — Next.js internal static assets (Edge runtime cannot run over these)
 *   favicon.ico, robots.txt, sitemap.xml, manifest.json  — well-known static files
 *   api/                       — API routes need Node runtime (Payload CMS, tRPC, webhooks)
 *   (payload)/admin            — Payload CMS admin panel needs Node runtime
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/|\\(payload\\)/admin).*)',
  ],
}
