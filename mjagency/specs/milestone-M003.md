MILESTONE M003 - AUTH + SSO + EDGE ROUTING (DETAIL)
Branch: milestone/M003-auth-edge-routing
Model: claude-opus-4-6
Depends on: M002 complete

GOAL: Secure auth, Cloudflare edge routing, audit log. jose JWT only, MFA enforced, open redirect fixed.

CRITICAL: Read specs/security.md fully before starting any slice.
CRITICAL: Use jose ONLY. If you reach for jsonwebtoken, STOP.
CRITICAL: Middleware excludes Payload routes (see CLAUDE.md).

SLICES:

SLICE 1: JWT + Refresh Token System (jose)
  Task 1.1: packages/auth package
    - JWT signing: SignJWT from jose
    - JWT verification: jwtVerify from jose
    - Always pass: algorithms: ['HS256'], issuer: 'mjagency', audience per token type
    - Access token: 15min TTL, aud='mjagency-api'
    - Refresh token: 7d TTL, aud='mjagency-refresh', one-time use
    - Token family tracking: family_id claim
    - family_id revocation on replay detection
  Task 1.2: Refresh token rotation
    - Redis store: refresh:<jti> key (TTL=7d)
    - On use: issue new token, invalidate old immediately
    - On replay: delete all family_id entries, force logout
    - Route: POST /api/auth/refresh
  Task 1.3: Cookie config
    - httpOnly: true
    - sameSite: 'strict'
    - secure: true (production)
    - path: '/'
    - maxAge: 15min (access), 7d (refresh)
    - domain: .brand.com (shared across subdomains)

SLICE 2: MFA + Recovery Codes
  Task 2.1: TOTP setup
    - Use: otpauth library (Edge runtime compatible)
    - QR code generation for authenticator apps
    - TOTP verification on login (6-digit code, 30s window)
  Task 2.2: Recovery codes
    - Generate: 8 codes at MFA setup (crypto.getRandomValues)
    - Format: XXXX-XXXX-XXXX (16 hex chars per code)
    - Store: bcrypt hash (cost 12) in recovery_codes table
    - One-time: code invalidated on use
    - Prompt to reset MFA after recovery code use
  Task 2.3: MFA enforcement
    - Mandatory for role = 'super_admin' or 'admin'
    - Login without MFA: redirect to MFA setup flow
    - Super_admin reset of admin MFA: audit-logged

SLICE 3: SSO (accounts.brand.com)
  Task 3.1: SSO entry point
    - accounts.brand.com/login -> shared auth page
    - Cookie domain: .brand.com (works across all subdomains)
    - Redirect back to originating subdomain after auth
    - OpenID Connect flow (structure ready for IdP integration)

SLICE 4: Next.js Middleware (Edge runtime)
  Task 4.1: middleware.ts
    - Import { jwtVerify } from 'jose' ONLY
    - Read access_token from cookies
    - jwtVerify with iss, aud, algorithms
    - On fail: redirect /login
    - Matcher excludes: /(payload)/admin, /api, /_next, /robots.txt, /sitemap.xml
  Task 4.2: Cloudflare configuration
    - WAF rules: rate limits per agency per IP
    - Security headers on all routes
    - HSTS: max-age=31536000; includeSubDomains; preload
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - Referrer-Policy: strict-origin-when-cross-origin
    - Per-request CSP nonce generation
  Task 4.3: Subdomain routing
    - Read hostname from request
    - Map hostname -> agency_id via Redis (cached lookup)
    - Inject agency_id into request headers
    - Server components read from headers (not re-resolved)

SLICE 5: Auth in Server Components + Server Actions
  Task 5.1: auth() helper function
    - Read JWT from cookie
    - Verify with jose
    - Return session | null
    - Used in ALL server components and server actions
  Task 5.2: Server action pattern (add to packages/auth)
    - requireAuth() helper
    - requireAgencyOwnership(agencyId) helper
    - Throws Unauthorized / Forbidden errors
    - These are imported in every server action
  Task 5.3: tRPC auth middleware
    - ctx.session from JWT
    - ctx.agencyId from JWT claims
    - All resolvers use agencyProcedure (not t.procedure)

SLICE 6: Audit Log
  Task 6.1: Audit log schema + writer
    - Tables: audit_log (see REQUIREMENTS.md)
    - HMAC-SHA256 per row
    - Signing key from Doppler
    - key_id stored on each row
    - Append-only (no UPDATE, no DELETE via API)
  Task 6.2: Audit log middleware
    - Log all auth events: login, logout, refresh, MFA setup, recovery
    - Log all admin actions: role change, agency create, user delete
    - Log all sensitive data access: permissions vault, proposals

SUCCESS CRITERIA:
  Login flow works end-to-end with MFA
  Expired refresh token replay = force logout + family revocation (test)
  Middleware blocks unauthenticated routes
  Middleware does NOT block /admin or /api routes
  Server action without auth() check: Vitest test confirms throws
  Audit log: hash chain verified programmatically
  JWT: iss + aud checks verified in unit tests
  Recovery codes: 8 generated, bcrypt stored, single-use

SLICE 7: Open Redirect + Additional Security Fixes
  Task 7.1: Open redirect prevention (SEC-N5)
    - All returnTo params validated before redirect:
        const redirectTo = searchParams.get('returnTo') || '/dashboard'
        const url = new URL(redirectTo, request.nextUrl.origin)
        const safeRedirect = url.origin === request.nextUrl.origin
          ? redirectTo
          : '/dashboard'
    - Applied to: login, MFA completion, SSO callback, password reset
    - Test: Vitest checks /login?returnTo=https://evil.com redirects to /dashboard

  Task 7.2: Admin panel indexing prevention (SEC-13)
    - Payload admin route handler adds: X-Robots-Tag: noindex
    - next.config.mjs headers rule: /admin/* -> X-Robots-Tag: noindex
    - robots.txt: Disallow: /admin
    - Verified: Google Search Console fetch shows noindex signal

  Task 7.3: Session fixation prevention (SEC-17)
    - On successful login: invalidate any pre-auth cookies
    - Issue brand new access + refresh token pair
    - Old tokens from pre-auth session cleared from Redis
    - On MFA completion: regenerate tokens again (privilege escalation)

  Task 7.4: Security headers in middleware
    All routes get (via Cloudflare or Next.js middleware):
      Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
      X-Content-Type-Options: nosniff
      X-Frame-Options: DENY
      Referrer-Policy: strict-origin-when-cross-origin
      Permissions-Policy: camera=(), microphone=(), geolocation=()
    CSP nonce: generated per request, injected into layout

  Task 7.5: Subdomain takeover prevention (SEC-20)
    - All 12 subdomains + main domain provisioned in Cloudflare DNS at M001
    - Wildcard SSL cert issued at M001
    - All DNS records present before any app is deployed
    - Unclaimed subdomain returns Cloudflare 521, not takeable

SUCCESS CRITERIA (UPDATED):
  Login flow works end-to-end with MFA
  Refresh token replay: family revocation + force logout (Vitest test)
  Middleware: blocks unauthenticated routes (Playwright test)
  Middleware: does NOT block /admin or /api (Playwright test)
  Open redirect: /login?returnTo=https://evil.com -> /dashboard (Vitest test)
  Server action without auth(): throws Unauthorized (Vitest test)
  JWT iss + aud: jwtVerify fails without correct values (Vitest test)
  Recovery codes: 8 generated, bcrypt stored, single-use (Vitest test)
  Security headers: all present on all routes (automated curl check)
  Admin noindex: X-Robots-Tag: noindex on /admin (curl check)
