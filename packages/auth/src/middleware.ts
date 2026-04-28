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
 *   ✅ globalThis.crypto.randomUUID()     — Edge-compatible (Web Crypto API, Plan 11-07)
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
 *   REQ-145 / Plan 11-07: per-request nonce CSP injection.
 *            crypto.randomUUID() generates a fresh nonce per request, propagated to layout via
 *            x-nonce request header (Next.js 15 App Router pattern — RESEARCH §11 Pitfall 7.6).
 *            Stage 1 emits Content-Security-Policy-Report-Only by default; flips to enforcing
 *            when CSP_ENFORCING=true env var is set (D-08 two-stage rollout).
 *            CSP allowlist matches D-10: googletagmanager, clarity.ms, js.stripe.com, api.stripe.com,
 *            cloudflareinsights.com, imagedelivery.net — NO Meta domain (server-side CAPI only).
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
 * Public paths that must NEVER redirect to /login — these are the public-facing marketing
 * pages accessible to all visitors without authentication.
 *
 * Plan 08-01 requirement: P0 public frontend pages are excluded from auth redirect so that
 * agency landing pages, blog, services, FAQ, and legal pages are fully accessible.
 */
const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/404',
  '/_not-found',
])

/**
 * Returns true if the given pathname should bypass authentication.
 * Handles exact matches (PUBLIC_PATHS) and prefix matches for /blog/* and /services/*.
 */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/blog')) return true
  if (pathname.startsWith('/services')) return true
  return false
}

/**
 * Builds the per-request CSP directives string with the supplied nonce.
 *
 * D-09 — `'nonce-X' 'strict-dynamic'` (CSP3) plus explicit allowlist (CSP2 fallback for older browsers).
 * D-10 — allowlist permits ONLY the four trusted domains; no Meta/Facebook (server-side CAPI only).
 *
 * Note: report-uri is the legacy CSP2 directive supported by all current browsers; report-to
 * (CSP3) requires the Reporting-Endpoints HTTP header which is added later in Plan 11-04.
 */
function buildCspDirectives(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://www.clarity.ms`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https://imagedelivery.net https://www.google-analytics.com",
    "connect-src 'self' https://api.cloudflare.com https://www.google-analytics.com https://*.clarity.ms https://cloudflareinsights.com https://api.stripe.com",
    "frame-src 'self' https://js.stripe.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
  ].join('; ')
}

/** Stage-aware CSP header name. D-08: Report-Only at launch; flip via env. */
function cspHeaderName(): 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only' {
  return process.env.CSP_ENFORCING === 'true'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only'
}

/**
 * Returns a Next.js-compatible middleware function that:
 *   1. Extracts the agency slug from the Host header (404 on unknown subdomain — T-03-017).
 *   2. Generates a per-request CSP nonce via crypto.randomUUID() (Web Crypto, Edge-safe).
 *   3. Bypasses auth for public P0 marketing paths (isPublicPath — Plan 08-01).
 *   4. Bypasses auth for /login, /sso, /auth/callback (SSO handshake paths).
 *   5. Reads the access cookie; redirects to /login if absent.
 *   6. Verifies the JWT via jose jwtVerify with explicit alg/iss/aud (REQ-310).
 *   7. Compares payload.agencyId against the subdomain slug (anti-cross-tenant, T-03-016).
 *   8. Injects x-agency-id, x-user-id, x-user-role, x-nonce request-context headers.
 *   9. Applies security headers + per-request CSP on every response.
 */
export function createAuthMiddleware() {
  return async function middleware(req: NextRequest): Promise<NextResponse> {
    const url = req.nextUrl.clone()
    const agency = extractAgencyFromHost(req.headers.get('host'))

    // Unknown subdomain → 404 (subdomain takeover probing defense — T-03-017)
    if (!agency) {
      return new NextResponse(null, { status: 404 })
    }

    // Per-request nonce. Generated once and reused across response paths so the
    // x-nonce request header value matches the script-src 'nonce-X' value the browser sees.
    // crypto.randomUUID() is Web Crypto (Edge-safe, CLAUDE.md §4 compliant).
    const nonce = crypto.randomUUID()
    const csp = buildCspDirectives(nonce)
    const cspHeader = cspHeaderName()

    // Forward updated request headers (with x-nonce) to downstream Server Components.
    // Pattern: NextResponse.next({ request: { headers } }) — Next.js 15 App Router.
    const buildResponseWithNonce = (): NextResponse => {
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-nonce', nonce)
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    const path = url.pathname

    // Public P0 paths — skip auth entirely (Plan 08-01: REQ-090 public frontend)
    if (isPublicPath(path)) {
      const passthrough = buildResponseWithNonce()
      passthrough.headers.set('x-agency-id', agency)
      passthrough.headers.set('x-nonce', nonce)
      passthrough.headers.set(cspHeader, csp)
      applySecurityHeaders(passthrough)
      return passthrough
    }

    // Bypass auth for the login route itself + /sso entry + /auth/callback so the SSO flow can complete
    if (path === '/login' || path === '/sso' || path.startsWith('/auth/callback')) {
      const passthrough = buildResponseWithNonce()
      passthrough.headers.set('x-agency-id', agency)
      passthrough.headers.set('x-nonce', nonce)
      passthrough.headers.set(cspHeader, csp)
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
      const redirect = NextResponse.redirect(url)
      // CSP must apply to redirect responses too — the destination /login page has scripts.
      redirect.headers.set(cspHeader, csp)
      applySecurityHeaders(redirect)
      return redirect
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
        const redirect = NextResponse.redirect(url)
        redirect.headers.set(cspHeader, csp)
        applySecurityHeaders(redirect)
        return redirect
      }

      // Inject request-context headers for downstream server components
      const response = buildResponseWithNonce()
      response.headers.set('x-agency-id', agency)
      response.headers.set('x-user-id', payload.sub ?? '')
      response.headers.set('x-user-role', payload.role ?? '')
      response.headers.set('x-nonce', nonce)
      response.headers.set(cspHeader, csp)

      applySecurityHeaders(response)
      return response
    } catch {
      // Verify failed (expired/invalid). Redirect to login with returnTo preserved.
      url.pathname = '/login'
      url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search)
      const redirect = NextResponse.redirect(url)
      redirect.headers.set(cspHeader, csp)
      applySecurityHeaders(redirect)
      return redirect
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
 *   api/                       — API routes need Node runtime (Payload CMS, tRPC, webhooks).
 *                                Plan 11-07 verified: /api/csp-report and /api/rum bypass auth here.
 *   (payload)/admin            — Payload CMS admin panel needs Node runtime
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/|\\(payload\\)/admin).*)',
  ],
}
