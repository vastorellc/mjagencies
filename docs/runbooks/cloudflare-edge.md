# Cloudflare Edge — WAF Rules, Middleware Matcher, and Security Runbook

**Last updated:** Plan 03-04  
**Relates to:** REQ-029, REQ-030, REQ-310, REQ-408  
**Code source:** `packages/auth/src/middleware.ts` (single source of truth)

---

## Matcher Rationale (REQ-030)

All 12 Next.js apps (`apps/web-*`) share an identical middleware matcher via `@mjagency/auth/middleware`. The matcher is:

```typescript
// packages/auth/src/middleware.ts — exported as `config.matcher`
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/|\\(payload\\)/admin).*)',
  ],
}
```

### Why each exclusion exists

| Pattern | Why excluded |
|---------|-------------|
| `_next/static` | Next.js compiled static assets — no auth needed, Edge overhead wasteful |
| `_next/image` | Next.js image optimization route — stateless, public |
| `favicon.ico` | Well-known static file — no auth |
| `robots.txt` | Well-known static file — public crawlers need unauthenticated access |
| `sitemap.xml` | Well-known static file — SEO bots need unauthenticated access |
| `manifest.json` | PWA manifest — must be public |
| `api/` | **Critical**: API routes run in Node runtime (Payload CMS, tRPC, webhooks, auth routes). Edge middleware cannot co-run with Node routes. `/api/auth/refresh`, `/api/sso/exchange` need Node for Redis + DB access. |
| `(payload)/admin` | **Critical**: Payload CMS admin panel requires Node runtime. Excluding it here prevents Edge middleware from conflicting with Payload's own auth flow (Phase 5 dependency). |

**CLAUDE.md §4 enforcement:** "Exclude Payload routes from middleware matcher." Violating this will break Payload CMS admin access at runtime with cryptic 500 errors.

---

## Edge Runtime Constraint (Pitfall 1)

The middleware factory in `packages/auth/src/middleware.ts` runs exclusively on Cloudflare's Edge runtime (Next.js Edge). The following import rules are absolute:

### Allowed in middleware.ts

| Import | Why safe |
|--------|---------|
| `next/server` | Next.js provides Edge-compatible types |
| `jose` v6.2.2 | Uses Web Crypto API (`crypto.subtle`) — no Node `crypto` module dependency at import time |
| `./agency-from-host.js` | Pure function — imports only `@mjagency/config` constant arrays |
| `./security-headers.js` | Type-only import from `next/server` — zero Node dependencies |

### NEVER in middleware.ts

| Import | Why it crashes Edge |
|--------|-------------------|
| `@mjagency/config/logger` | Pino uses Node `fs`/`stream` — crashes at Edge startup |
| `@mjagency/db` | postgres-js uses Node `net`/`tls` |
| `bcrypt` | Native Node binding — not available in Edge V8 |
| `ioredis` | Node `net`/`tls` |
| `server-only` | Not needed (no `cookies()` in Edge) |

**Single source of truth:** `@mjagency/auth/middleware` is the ONLY sub-export that should be imported from app-level `middleware.ts` files. The main `@mjagency/auth` barrel includes `ioredis`, `server-only`, and other Node-only modules via transitive imports — importing from it in middleware.ts will trigger Edge startup crashes.

---

## CVE-2025-29927 Three-Layer Defense (REQ-029)

CVE-2025-29927 allows an attacker to bypass Next.js middleware entirely by forging the internal `x-middleware-subrequest` header. This was patched in Next.js 15.2.3. This platform's defense is layered so that no single layer is a SPOF:

### Layer 1: Cloudflare WAF Header Strip

**Rule name:** `Next.js x-middleware-subrequest`  
**Action:** Block (HTTP 403)  
**When applied:** On every inbound request before it reaches the Next.js origin  
**Deployment date:** 2025-03-22 (Managed Rules update)

To verify in Cloudflare Dashboard:
1. Security → WAF → Managed Rules
2. Search: `x-middleware-subrequest`
3. Confirm rule is **Enabled** and action is **Block**

This rule strips/blocks any request containing `x-middleware-subrequest: middleware` before it reaches the Next.js Edge runtime.

### Layer 2: Next.js >= 15.2.3 Patch

All 12 apps have `"next": "15.5.15"` in their `package.json`. The minimum required version for CVE-2025-29927 patch is 15.2.3.

CI gate: Plan 03-06 adds a `check-next-version` script that fails CI if `next` drops below `15.2.3`.

### Layer 3: requireSession() in Server Actions

`requireSession()` (Plan 03-05) re-verifies the JWT in every server action and tRPC procedure. Middleware is NEVER the sole auth check. Even if both layers 1 and 2 fail, an attacker cannot call server actions without a valid JWT.

**Pattern from CLAUDE.md §3:**
```typescript
'use server'
export async function updatePage(data: PageData) {
  const session = await requireSession()  // Layer 3 — always present
  if (!session) throw new Error('Unauthorized')
  // ... proceed
}
```

---

## Rate-Limit Rules (Cloudflare WAF Dashboard)

Configure the following rate-limit rules in Cloudflare Dashboard under Security → WAF → Rate Limiting Rules. These are dashboard configuration — NOT Next.js code.

### Rule 1: Login brute-force protection

| Field | Value |
|-------|-------|
| Rule name | `Auth — Login brute force` |
| Match | URI path equals `/api/auth/login` |
| Rate limit | > 50 requests/minute from same IP |
| Action | Block for 5 minutes (HTTP 429) |
| Mitigation expression | `http.request.uri.path eq "/api/auth/login"` |

### Rule 2: Refresh token abuse

| Field | Value |
|-------|-------|
| Rule name | `Auth — Refresh token rate limit` |
| Match | URI path equals `/api/auth/refresh` |
| Rate limit | > 10 requests/minute from same IP |
| Action | Block (HTTP 429) |
| Mitigation expression | `http.request.uri.path eq "/api/auth/refresh"` |

### Rule 3: SSO exchange abuse (server-to-server defense)

| Field | Value |
|-------|-------|
| Rule name | `Auth — SSO exchange rate limit` |
| Match | URI path equals `/api/sso/exchange` |
| Rate limit | > 5 requests/minute from same IP |
| Action | Block (HTTP 429) |
| Notes | This endpoint is internal-only (x-mjagency-internal header). Rate limit defends against header-forging attempts. |

---

## REQ-408 Subdomain Rename

When an agency renames its slug (e.g. `oldslug` → `newslug`), configure the following in Cloudflare:

### Cloudflare Page Rule

| Field | Value |
|-------|-------|
| URL pattern | `oldslug.brand.com/*` |
| Setting | Forwarding URL (301 Permanent Redirect) |
| Destination URL | `https://newslug.brand.com/$1` |

**Apply this BEFORE updating the AGENCIES constant in `packages/config/src/agency-constants.ts`.**

### Sequence for a safe rename

1. **Add the Cloudflare Page Rule** (above) pointing old → new subdomain.
2. **Update DNS:** Add CNAME `newslug.brand.com` pointing to the same Cloudflare Worker/origin. Keep `oldslug.brand.com` DNS active for the redirect duration.
3. **Update `AGENCIES` array** in `packages/config/src/agency-constants.ts` to add `newslug` (keep `oldslug` commented out until Page Rule traffic drops to zero).
4. **Update Cal.com white-label config** to reflect the new subdomain (Phase 9 — document which Cal.com API endpoint to update).
5. **Remove `oldslug` from AGENCIES** after 30-day redirect grace period. Remove Cloudflare Page Rule after 90 days.

### Middleware behavior note

`extractAgencyFromHost` returns `null` (→ 404) for subdomains not in the `AGENCIES` set. Cloudflare Page Rule handles the 301 redirect for KNOWN-renamed slugs **before** the request reaches Next.js middleware. This is intentional:

- Known-renamed slug → Cloudflare 301 (Page Rule)
- Typo / truly unknown slug → middleware 404

This prevents the middleware from accidentally 301-redirecting probe traffic for unknown subdomains.

---

## Per-Agency Callback Route Coverage Gap

**Status:** Only `apps/web-main/src/app/auth/callback/route.ts` ships in Plan 03-04.

The 11 agency apps (`web-ecommerce`, `web-growth`, ..., `web-graphic`) do NOT yet have an `/auth/callback` route handler. This means the SSO flow cannot complete end-to-end for agency apps until Plan 03-05 (or a dedicated follow-up plan) adds the per-agency callback route.

**Impact:** Agency subdomain logins will fail at the `/auth/callback` step (Next.js 404 for that route). This is expected during Phase 3 development. The web-main callback serves as the reference implementation.

**Resolution:** Each of the 11 agency apps needs an identical copy of:
```
apps/web-<slug>/src/app/auth/callback/route.ts
```

This is tracked as a known gap and will be addressed in Plan 03-05 (server-action `requireSession` work) which already touches per-app server-action files and is the natural place to co-locate the callback route.

---

## Smoke Test Commands

Use these curl commands to validate middleware behavior after deployment.

### 1. No-cookie access → redirect to /login

```bash
curl -I https://ecommerce.brand.com/
# Expected: HTTP/2 307
# Location: https://ecommerce.brand.com/login?returnTo=%2F
```

### 2. API route bypassed by matcher

```bash
curl -I https://ecommerce.brand.com/api/health
# Expected: HTTP/2 200 (or whatever the route returns — NOT a 307 redirect to /login)
# This confirms /api/* is excluded from middleware matcher
```

### 3. Next.js image route bypassed

```bash
curl -I "https://ecommerce.brand.com/_next/image?url=...&w=800&q=75"
# Expected: HTTP/2 200 (Next.js image optimization response)
# NOT redirected to /login
```

### 4. Unknown subdomain → 404

```bash
curl -I https://unknown.brand.com/
# Expected: HTTP/2 404
# NOT HTTP 307 to /login — unknown subdomains return 404 (T-03-017 mitigation)
```

### 5. Security headers present on authenticated response

```bash
curl -sI -H "Cookie: mj-access=<valid-jwt>" https://ecommerce.brand.com/dashboard \
  | grep -E "strict-transport-security|x-frame-options|content-security-policy"
# Expected output includes:
#   strict-transport-security: max-age=63072000; includeSubDomains; preload
#   x-frame-options: DENY
#   content-security-policy: default-src 'self'; ...
```

### 6. Payload admin route bypassed

```bash
curl -I "https://ecommerce.brand.com/(payload)/admin"
# Expected: HTTP/2 200 (Payload admin login page, handled by Payload's own auth)
# NOT redirected to /login by Next.js middleware
```

---

## Troubleshooting

### Middleware crashing with "module not found" at Edge startup

**Symptom:** 500 error on all routes immediately after deploy.  
**Cause:** A Node-only import leaked into `packages/auth/src/middleware.ts`.  
**Fix:** Run `grep -n "^import" packages/auth/src/middleware.ts` and verify all imports are in the Edge-safe list above. Check transitive imports via `@mjagency/auth` main barrel — use `@mjagency/auth/middleware` sub-path instead.

### Payload CMS admin showing 307 redirect to /login

**Symptom:** Visiting `ecommerce.brand.com/(payload)/admin` redirects to /login.  
**Cause:** Matcher not excluding `(payload)/admin` correctly.  
**Fix:** Verify the `config.matcher` in `packages/auth/src/middleware.ts` contains `\\(payload\\)/admin` (note the escaped parentheses). The double-backslash is required because the regex character class already requires one escape.

### Agency subdomain shows 404 but slug is correct

**Symptom:** `ecommerce.brand.com` returns 404 from middleware.  
**Cause:** `ecommerce` is missing from the `AGENCIES` array in `packages/config/src/agency-constants.ts`.  
**Fix:** Add the slug to `AGENCIES`. Deploy. Cloudflare will pick up the new Edge bundle.
