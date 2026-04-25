specs/security.md - MJAgency Security Spec

==============================================================
CRITICAL RULES (ENFORCED IN CLAUDE.md)
==============================================================
1. jose ONLY for JWT (never jsonwebtoken)
2. Server action: session check as FIRST LINE
3. Stripe webhook: req.text() for raw body
4. HMAC verification on ALL webhooks before processing
5. Stock API keys: server-side proxy ONLY
6. No dangerouslyAllowSVG on Next.js Image
7. CSP nonce per request
8. Pino redact all sensitive fields

==============================================================
ALL SECURITY DECISIONS AND FIXES
==============================================================

SEC-01 JWT Refresh Token Rotation:
  - Every use: new refresh token issued, old invalidated immediately
  - One-time use enforcement
  - Replay detected: entire token family revoked, force logout
  - Token family tracked by family_id claim in JWT
  - Revocation store: Redis key refresh:<jti>, TTL=7d
  - Storage: httpOnly + SameSite=Strict + Secure cookies always

SEC-02 CSRF Protection:
  - SameSite=Strict on all auth cookies
  - All API endpoints require Authorization: Bearer header
  - Cookie-based auth NOT accepted on API routes
  - X-Requested-With: XMLHttpRequest secondary check on mutations
  - Payload admin: built-in CSRF enabled

SEC-03 Prompt Injection:
  - All user content wrapped in XML tags before LiteLLM
  - System prompts hardened to ignore tags content
  - PII redactor runs before all LiteLLM calls
  - Jailbreak classifier (Flash-Lite) before expensive models
  - Form submissions treated as untrusted text always

SEC-04 Webhook Signature Verification:
  Stripe:  stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
           body = await req.text() (raw, never parsed)
  Cal.com: HMAC-SHA256 on X-Cal-Signature-256 header
  Twilio:  twilio.validateRequest(authToken, sig, url, params)
  Custom:  HMAC-SHA256 on X-MJAgency-Signature header
  All webhooks:
    - Return 200 on signature fail (prevents retry spam)
    - Log failure to audit log
    - Check Redis event ID for idempotency
    - Process via BullMQ, never synchronously

SEC-05 Stock API Keys:
  - All stock photo APIs proxied through server route
  - /api/media/search?source=unsplash&q=... (server-side)
  - API key in Doppler, never in browser
  - NEXT_PUBLIC_ prefix BANNED for any API key
  - Cloudflare Images: signed upload URLs (server-generated)

SEC-06 SVG Sanitization:
  Library: dompurify + jsdom (server-side) + svgo + custom strip
  Steps:
    1. Magic bytes: must start with <svg
    2. MIME type check (even if Content-Type header says SVG)
    3. DOMPurify(window).sanitize(svg, { USE_PROFILES: { svg: true } })
    4. Custom strip: script, foreignObject, use href=external, onload, onerror
    5. Strip data: URIs and external xlink:href
    6. SVGO: strip metadata, optimize paths
    7. Token transformer: hex colors -> CSS variables

SEC-07 + SEC-08 XSS in Puck + Lexical:
  - Puck: saves block JSON (not HTML). Never dangerouslySetInnerHTML from Puck.
  - Lexical: saves editor JSON, serializes to React components on render
  - HTML output from Lexical: sanitized via isomorphic-dompurify before any injection
  - All string block props: sanitized in component before rendering
  - Never eval() on any user content

SEC-09 RLS Bypass Prevention:
  - Migration scripts: SET app.current_agency_id = 'migrations' (special bypass role)
  - Seed scripts: SET app.current_agency_id = targetAgencyId
  - All API code: goes through tRPC middleware (no raw SQL without agency_id)
  - Separate DB service account for migrations (not app credentials)
  - CI check: grep for raw SQL without agency_id filter

SEC-10 Audit Log Key Management:
  - HMAC-SHA256 per row
  - Signing key in Doppler (platform-level, not per-agency)
  - Key rotation: new key signs forward, old key_id stored on each row
  - Verifier checks key_id to use correct key for historical rows

SEC-11 SSRF Protection:
  - Allowlist for server-side URL fetches:
    images.unsplash.com, images.pexels.com, cdn.pixabay.com, img.freepik.com
  - Any other domain: reject with 400
  - User-supplied URLs validated against allowlist before fetch
  - Cloudflare Images API: no user-supplied fetch URLs (only upload)

SEC-12 MFA Recovery:
  - At MFA setup: 8 one-time codes generated (crypto.randomBytes(16).toString('hex'))
  - Shown once, never shown again
  - Stored as bcrypt hashes (cost factor 12)
  - Each code is single-use (invalidated on use)
  - Recovery triggers: logged in + must reset MFA immediately
  - Admin recovery: super_admin can reset via audit-logged action (24h temp access)

SEC-13 Admin Panel Indexing:
  - X-Robots-Tag: noindex on all /(payload)/admin/* routes
  - robots.txt: Disallow: /admin
  - Cloudflare WAF rule: /admin accessible from whitelisted IPs only (configurable)
  - Payload admin not linked from any public page

SEC-14 Secrets in Logs:
  Pino redact config:
    ['req.headers.authorization', 'req.headers.cookie',
     '*.password', '*.token', '*.secret', '*.apiKey',
     '*.email', '*.phone', '*.creditCard']
  No raw JWT or API key ever reaches Loki

SEC-15 Signed URL Expiry:
  - Cloudflare signed URLs: 1 hour default expiry for permission-restricted assets
  - Revocation: delete permission -> asset moves to paused state -> signed URL stops generating
  - Old signed URLs expire naturally

SEC-16 Mass Assignment (Payload field-level):
  - agency_id: access.update = () => false
  - role: access.update = isAdmin
  - All Payload collections: field-level access enforced
  - Test: integration test verifies PATCH agency_id returns 403

SEC-17 Session Fixation:
  - On login: issue brand new JWT + refresh token
  - Pre-login cookies cleared
  - Session regeneration on MFA completion

SEC-18 MIME Bypass:
  - Server reads first 12 bytes (magic bytes) before accepting upload
  - JPEG: FF D8 FF | PNG: 89 50 4E 47 | SVG: 3C 73 76 67
  - AVIF: ftyp | WebP: RIFF...WEBP | MP4: ftyp
  - Reject if magic bytes don't match claimed MIME type

SEC-19 Cal.com Patch Cadence:
  - Self-hosted Cal.com: Dependabot monitors releases
  - Security patches applied within 48h of release
  - Cal.com runs behind Cloudflare WAF

SEC-20 Subdomain Takeover:
  - All 12 subdomains provisioned in Cloudflare DNS at project start
  - Wildcard SSL cert issued immediately
  - No dangling CNAME records ever
  - Unclaimed subdomain: Cloudflare 521 (not takeable)

SEC-N1 Payload 3.83.0 Bug:
  - Pin Payload to EXACTLY 3.82.1
  - package.json: "payload": "3.82.1" (no ^ or ~)
  - CI check: pnpm list payload | grep 3.82.1 || exit 1
  - Dependabot: no auto-merge for Payload packages

SEC-N2 CVE-2025-29927 Next.js Middleware Bypass:
  - Next.js version >= 15.2.3 required
  - Middleware is NOT sole auth check (verified in server components too)
  - Always double-check session in route handlers

SEC-N3 CSP Nonce for Lexical + Puck:
  - Per-request nonce: crypto.randomBytes(16).toString('base64')
  - Injected via Cloudflare Worker before HTML response
  - style-src: 'nonce-{X}' 'self'
  - script-src: 'nonce-{X}' 'self'
  - All inline styles receive nonce prop

SEC-N4 dangerouslyAllowSVG:
  - NEVER set dangerouslyAllowSVG: true on Next.js Image globally
  - SVG illustrations served via <img> tag with sanitized source
  - Next.js Image only for AVIF/WebP/JPEG raster images

SEC-N5 Open Redirect:
  - Validate returnTo param is same-origin
  - const url = new URL(returnTo, origin)
  - if (url.origin !== origin) use default redirect /dashboard

SEC-N7 Stripe Raw Body:
  - Webhook route: const body = await req.text()
  - Never await req.json() before signature check
  - Pass body string directly to stripe.webhooks.constructEvent()

SEC-N8 JWT Claims:
  - iss: 'mjagency' on all tokens
  - aud: 'mjagency-api' on access tokens
  - aud: 'mjagency-refresh' on refresh tokens
  - All jwtVerify calls pass issuer + audience explicitly

SEC-N9 Puck Editor Access Control:
  - Builder admin bar cookie = UI toggle ONLY (not auth)
  - Puck component only renders if:
    1. Server-side session.role === 'admin' || 'super_admin'
    2. session.agencyId === page.agencyId
  - Cookie bypassed by attacker = no Puck rendered (server blocks it)

SEC-N10 BullMQ Payload Encryption:
  - All jobs containing PII: encrypt payload before Redis storage
  - Algorithm: AES-GCM-256
  - Key: from Doppler (platform-level secret)
  - Decrypt in worker before processing
  - Redis: requirepass + TLS enabled

SEC-N11 Cal.com Webhook Auth:
  - Enable HMAC Signature in Cal.com admin
  - Verify X-Cal-Signature-256 on every incoming webhook

==============================================================
SECURITY TESTING PLAN (M011 + M012)
==============================================================
OWASP ZAP Automated Scan (M011):
  Target: all 12 agency public URLs + all /api/* endpoints
  Mode: active scan (authenticated + unauthenticated)
  Auth: ZAP script with valid JWT
  Zero high-severity findings required before M012
  Report: exported as HTML, stored in /docs/security/zap-report-<date>.html

Manual Security Checklist (M012 QA):
  - JWT: replay expired token -> 401 (test)
  - JWT: replay revoked refresh token -> 401 + family revoked (test)
  - RLS: cross-agency query with valid JWT -> empty result (test)
  - Server action: call without session -> Unauthorized thrown (test)
  - Stripe webhook: invalid signature -> 200 returned, not processed (test)
  - SVG upload: malicious SVG with <script> -> sanitized (test)
  - Puck save: call server action from different agency_id -> Forbidden (test)
  - Open redirect: /login?returnTo=https://evil.com -> /dashboard (test)
  - Admin panel: /admin without auth -> redirect /login (test)
  - Admin panel: /admin with editor JWT -> 403 (test)
  - CSP: check response headers contain nonce (curl test)
  - HSTS: check header present (curl test)
  - __NEXT_DATA__: check no secrets in source (Playwright + grep test)

Penetration testing (post-launch, recommended within 60 days):
  External penetration test by CREST-certified firm
  Scope: all public endpoints, auth flows, webhook handlers
  Budget: $3,000-8,000 estimated

==============================================================
SECURITY INCIDENT RESPONSE PLAN
==============================================================
See: scripts/runbooks/data-breach.md (written in M012)

Priority levels:
  P0 - Active breach (data exfiltrated or in progress):
    1. Immediately revoke all JWT tokens (Redis FLUSHDB for sessions namespace)
    2. Force-logout all users
    3. Disable public API endpoints via Cloudflare WAF
    4. Notify super_admin + owner by phone
    5. Preserve logs (do not delete)
    6. Engage incident response firm within 2h

  P1 - Vulnerability discovered (not yet exploited):
    1. Assess exploitability
    2. Deploy patch within 24h
    3. Notify affected agencies if data at risk

  P2 - Security misconfiguration (non-critical):
    1. Document
    2. Fix within 7 days
    3. Add to security checklist

Breach notification requirements:
  CCPA: notify California residents within 72h of discovery
  General: notify affected users within 30 days (good practice)

==============================================================
DEPENDENCY SECURITY
==============================================================
npm audit:
  Run in CI on every PR
  Fail CI on: high or critical vulnerabilities
  Allow: moderate (with justification comment)

Dependabot:
  Enabled for: all packages
  Exception: "payload" package (NEVER auto-merge - pinned at 3.82.1)
  Auto-merge: patch updates for non-critical packages (with tests passing)
  Review required: minor + major updates

Payload exception note in .github/dependabot.yml:
  ignore:
    - dependency-name: "payload"
    - dependency-name: "@payloadcms/*"
  Reason: Pinned at 3.82.1 to avoid 3.83.0 custom view routing bug.
  Update only when: Payload team confirms fix AND human explicitly approves.
