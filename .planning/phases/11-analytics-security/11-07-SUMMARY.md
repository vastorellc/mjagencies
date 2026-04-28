---
phase: 11-analytics-security
plan: 11-07
subsystem: security
tags: [csp, nonce, owasp-zap, rum, web-vitals, edge-runtime, jose, drizzle, postgres, rls, github-actions]

# Dependency graph
requires:
  - phase: 03-auth-sso-edge
    provides: createAuthMiddleware factory, applySecurityHeaders, jose-only Edge runtime, matcher excluding /api/*
  - phase: 02-multi-tenant-db
    provides: Drizzle schema patterns, withAgencyContext + RLS via app.agency_id session var, postgres-js client
  - phase: 08-public-frontend
    provides: WebVitalsReporter (gtag-only) — Plan 11-07 extends to dual-emit
provides:
  - per-request CSP nonce middleware (D-08 Report-Only by default; CSP_ENFORCING=true flips to enforcing)
  - csp_reports + web_vitals Postgres tables with migration
  - 13 /api/csp-report endpoints (Pitfall 9.1 scanner UA dropping)
  - 13 /api/rum endpoints (RLS-aware web_vitals inserts)
  - WebVitalsReporter dual-emit (gtag preserved + sendBeacon added)
  - NonceProvider/useNonce React Context
  - OWASP ZAP per-PR baseline + weekly cron + CSP regression CI gate
affects:
  - 11-04 (analytics dashboard reads from web_vitals)
  - 11-05 (privacy/erasure may join csp_reports)
  - 11-06 (Cloudflare WAF rate-limits csp-report + rum endpoints)
  - all future plans introducing inline scripts (must consume useNonce)

# Tech tracking
tech-stack:
  added:
    - OWASP ZAP baseline action (zaproxy/action-baseline@v0.15.0)
    - crypto.randomUUID (Web Crypto, Edge runtime)
    - navigator.sendBeacon (browser RUM transport)
  patterns:
    - per-request CSP nonce via NextResponse.next({ request: { headers } })
    - D-08 two-stage CSP rollout via env var (Report-Only → enforcing)
    - public-anonymous ingestion endpoints with scanner UA filtering + best-effort sink semantics
    - RUM dual-emit (analytics platform + first-party Postgres)
    - CI grep gates as guardrails for security-critical patterns

key-files:
  created:
    - packages/db/src/schema/csp-reports.ts
    - packages/db/src/schema/web-vitals.ts
    - packages/db/src/migrations/0011_csp_reports_and_web_vitals.sql
    - packages/auth/src/__tests__/csp-nonce.test.ts
    - packages/ui/src/nonce/nonce-provider.tsx
    - packages/ui/src/nonce/index.ts
    - apps/web-main/src/app/api/csp-report/route.ts
    - apps/web-main/src/app/api/rum/route.ts
    - (12 more csp-report and rum routes for the 12 agency apps)
    - .github/workflows/zap-pr-scan.yml
    - .github/workflows/zap-weekly.yml
    - .github/workflows/csp-static-grep-gate.yml
    - .zap/rules.tsv
  modified:
    - packages/auth/src/security-headers.ts (DELETED static CSP block)
    - packages/auth/src/middleware.ts (per-request nonce CSP injection)
    - packages/db/src/schema/index.ts (barrel exports for new tables)
    - packages/db/src/index.ts (top-level cspReports/webVitals re-exports)
    - packages/ui/src/index.ts (NonceProvider + useNonce exports)
    - packages/ui/src/rum/web-vitals.tsx (dual-emit gtag + sendBeacon)
    - apps/web-main/package.json (add @mjagency/db dep)
    - apps/web-ecommerce/package.json (add @mjagency/db dep)
    - packages/auth/src/__tests__/middleware.test.ts (CSP-Report-Only assertion)
    - packages/auth/src/__tests__/security-headers.test.ts (CSP no longer set here)

key-decisions:
  - "DELETE static Content-Security-Policy from packages/auth/src/security-headers.ts (Pitfall 7.1 — two CSP headers cause browser intersection that defeats nonce). CI grep gate prevents regression."
  - "D-08 two-stage rollout: Content-Security-Policy-Report-Only by default; CSP_ENFORCING=true env var flips to enforcing. Allows 14-day violation window before strict mode."
  - "D-09 hybrid CSP: 'nonce-X' 'strict-dynamic' (CSP3) PLUS explicit allowlist (CSP2 fallback) — modern browsers honor strict-dynamic and ignore allowlist; older browsers fall back to allowlist."
  - "D-10 allowlist: googletagmanager, clarity.ms, js.stripe.com, api.stripe.com, cloudflareinsights.com, imagedelivery.net. NO Meta/Facebook domain — Meta integration uses server-side Conversions API only."
  - "csp_reports table is platform-wide (no agency_id, no RLS) — violation reports come from anonymous browsers; tenant tagging is best-effort via agency_slug constant."
  - "web_vitals table is per-agency with RLS — agency_id sourced from NEXT_PUBLIC_AGENCY_ID build env (cannot be overridden by client; mitigates T-11-07-06)."
  - "WebVitalsReporter dual-emits to GA4 (preserved) AND /api/rum (new) — Plan 11-04 dashboard reads percentile_cont(0.75) over web_vitals."
  - "All 26 endpoints use runtime = 'nodejs' (postgres-js requires Node, not Edge)."
  - "Middleware matcher exclusion of /api/* preserved — public ingestion endpoints reachable without auth redirect."

patterns-established:
  - "Per-request CSP nonce: crypto.randomUUID() in middleware → x-nonce request header → headers().get('x-nonce') in layout → NonceProvider → useNonce() in client components"
  - "Two-stage rollout via env toggle: ship in Report-Only, monitor violations, flip to enforcing"
  - "Public ingestion endpoint best-effort sink: drop scanner UAs, validate payload shape, silent-fail DB inserts, always return 204"
  - "CI grep gate as security guardrail: encode the architectural decision in a workflow that fails on regression"

requirements-completed: [REQ-145, REQ-147]

# Metrics
duration: 28min
completed: 2026-04-28
---

# Phase 11 Plan 07: Security Hardening Summary

**Per-request CSP nonce middleware (D-08 Report-Only → enforcing) replacing the static CSP, csp_reports + web_vitals Postgres tables with 26 public ingestion endpoints, WebVitalsReporter dual-emit, and OWASP ZAP CI gates with a regression-blocking grep guard.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-28T03:45:00Z
- **Completed:** 2026-04-28T04:00:00Z
- **Tasks:** 4 (T-01 through T-04, all autonomous)
- **Files created:** 33 (29 source + 4 CI/config)
- **Files modified:** 9
- **Auth tests:** 90 passed (9 new csp-nonce + 81 existing)

## Accomplishments

- **Static CSP removed and replaced** with per-request nonce CSP in middleware. `packages/auth/src/security-headers.ts` no longer sets Content-Security-Policy; the CI grep gate (`csp-static-grep-gate.yml`) blocks any regression.
- **D-08 two-stage rollout** wired via `CSP_ENFORCING` env var. Stage 1 (default) emits `Content-Security-Policy-Report-Only`; Stage 2 (post-launch flip) emits enforcing `Content-Security-Policy`.
- **D-10 allowlist enforced**: googletagmanager.com, clarity.ms, js.stripe.com, api.stripe.com, cloudflareinsights.com, imagedelivery.net. No Facebook/Meta domain — server-side CAPI only (no client-side Meta pixel).
- **2 new Postgres tables** with Drizzle schema and migration: `csp_reports` (platform-wide, no RLS) and `web_vitals` (per-agency, RLS via `app.agency_id`). Migration `0011_csp_reports_and_web_vitals.sql` ready for `db:migrate` runner.
- **26 new API routes** (13 `/api/csp-report` + 13 `/api/rum`) across all 13 apps. Each drops scanner UAs (Pitfall 9.1), validates payload shape, and returns 204 with silent-fail DB inserts.
- **WebVitalsReporter dual-emit** preserves the existing `window.gtag()` call and adds `navigator.sendBeacon('/api/rum', ...)` with fetch+keepalive fallback for Postgres persistence.
- **NonceProvider/useNonce** React Context exported from `@mjagency/ui/nonce` for layout-to-client nonce propagation.
- **OWASP ZAP CI integration**: per-PR baseline (`zap-pr-scan.yml`, `fail_action: true`), weekly cron sweep (`zap-weekly.yml`, 13-target matrix, Monday 6am UTC, `fail_action: false`), tuned via `.zap/rules.tsv` (rule 10038 ignored during D-08 Stage 1).

## Task Commits

1. **T-01: csp_reports + web_vitals Drizzle schema + migration** — `1bacbf4` (feat)
2. **T-02: per-request CSP nonce middleware + NonceProvider** — `0acbfd3` (feat)
3. **T-03: 26 API routes + WebVitalsReporter dual-emit** — `877c3f8` (feat)
4. **T-04: OWASP ZAP CI gates + CSP regression guard** — `3afab36` (feat)

**Plan metadata:** _to be added when SUMMARY commit lands_

## Files Created/Modified

### Created (selected; full list above)

- `packages/db/src/schema/csp-reports.ts` — Drizzle table for CSP violations (platform-wide)
- `packages/db/src/schema/web-vitals.ts` — Drizzle table for RUM events (per-agency RLS)
- `packages/db/src/migrations/0011_csp_reports_and_web_vitals.sql` — table create + RLS + CHECK constraint
- `packages/auth/src/__tests__/csp-nonce.test.ts` — 9 tests covering nonce uniqueness, D-08 toggle, D-10 allowlist, no-unsafe-inline, x-nonce sync, matcher exclusion
- `packages/ui/src/nonce/nonce-provider.tsx` — React Context for per-request nonce
- `apps/web-{slug}/src/app/api/csp-report/route.ts` × 13 — Public CSP violation sink
- `apps/web-{slug}/src/app/api/rum/route.ts` × 13 — Public RUM beacon sink with RLS-aware inserts
- `.github/workflows/zap-pr-scan.yml` — per-PR ZAP baseline (fail-fast on high)
- `.github/workflows/zap-weekly.yml` — Monday 6am UTC sweep across 13 staging targets
- `.github/workflows/csp-static-grep-gate.yml` — CSP regression guard + jose-only enforcement
- `.zap/rules.tsv` — ZAP rule overrides (10038 IGNORE during Stage 1)

### Modified

- `packages/auth/src/security-headers.ts` — DELETED static CSP block; now sets 6 headers (HSTS, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). JSDoc updated.
- `packages/auth/src/middleware.ts` — Added per-request nonce generation via `crypto.randomUUID()`, x-nonce request header propagation, D-08 stage-aware CSP header name, CSP applied to all response branches (next, redirect-to-login).
- `packages/ui/src/rum/web-vitals.tsx` — Added sendBeacon dual-emit alongside gtag; safe fallback to fetch+keepalive.
- `packages/db/src/schema/index.ts` — Barrel exports for `cspReports`, `webVitals`, `webVitalsRlsSql`.
- `packages/db/src/index.ts` — Top-level re-exports so API handlers can `import { cspReports, webVitals } from '@mjagency/db'`.
- `packages/ui/src/index.ts` — Exports `NonceProvider`, `useNonce`, `NonceProviderProps`.
- `apps/web-main/package.json`, `apps/web-ecommerce/package.json` — Added `@mjagency/db` workspace dependency (Rule 2: missing critical functionality — these apps now consume DB directly via the new API routes).
- `packages/auth/src/__tests__/middleware.test.ts` — Updated CSP header assertion to accept the new Report-Only path with nonce.
- `packages/auth/src/__tests__/security-headers.test.ts` — Updated to verify CSP is NOT set by `applySecurityHeaders` (it's now set by middleware).

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Why DELETE the static CSP** rather than augment: Pitfall 7.1 — two CSP headers cause browser intersection (only the directives present in BOTH headers apply), which defeats `'nonce-X' 'strict-dynamic'`. The CI grep gate enforces this.
- **Why `'nonce-X' 'strict-dynamic'` PLUS allowlist**: CSP3 (`strict-dynamic`) tells modern browsers to trust scripts dynamically loaded by nonced scripts and ignore the explicit allowlist. CSP2 browsers don't recognize `strict-dynamic` and fall back to the allowlist. The hybrid covers both.
- **Why Report-Only by default**: D-08 — collecting 14 days of real-world violations before enforcement avoids breaking production. The `CSP_ENFORCING=true` flip is a single env var change in Stage 2.
- **Why `runtime = 'nodejs'` on the API routes**: postgres-js (Drizzle's underlying driver) is not Edge-compatible. The middleware nonce path stays on Edge; only the API handlers run on Node.
- **Why `agency_id` from `NEXT_PUBLIC_AGENCY_ID` (not from request)**: T-11-07-06 mitigation — preventing clients from forging RUM beacons for arbitrary agencies. The agency context is baked at app build time, not derived from a header that could be spoofed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Add `@mjagency/db` workspace dep to apps/web-main and apps/web-ecommerce package.json**
- **Found during:** Task 3 (creating /api/csp-report and /api/rum routes that import from @mjagency/db)
- **Issue:** Plan called for these apps to import `cspReports` and `webVitals` from `@mjagency/db`, but neither app's `package.json` listed the workspace dep. The existing `auth/refresh/route.ts` worked via pnpm workspace hoisting, but explicit declaration is correct.
- **Fix:** Added `"@mjagency/db": "workspace:*"` to both apps' `dependencies` block (right after `@mjagency/auth`).
- **Files modified:** `apps/web-main/package.json`, `apps/web-ecommerce/package.json`
- **Verification:** Typecheck on web-main and web-ecommerce shows zero errors in the new route files.
- **Committed in:** `877c3f8`

**2. [Rule 1 - Bug] Existing `middleware.test.ts` and `security-headers.test.ts` asserted static CSP (now removed)**
- **Found during:** Task 2 verification
- **Issue:** Two existing tests asserted `Content-Security-Policy` was set with `default-src 'self'` content, which broke after the static CSP block was deleted (per plan).
- **Fix:** Updated `middleware.test.ts` to read `Content-Security-Policy-Report-Only` (D-08 Stage 1) and assert nonce presence. Updated `security-headers.test.ts` to verify CSP is NOT set by `applySecurityHeaders` (CSP now lives in middleware).
- **Files modified:** `packages/auth/src/__tests__/middleware.test.ts`, `packages/auth/src/__tests__/security-headers.test.ts`
- **Verification:** All 90 auth tests pass.
- **Committed in:** `0acbfd3`

**3. [Rule 2 - Missing Critical] CSP applied to redirect-to-login responses**
- **Found during:** Task 2 implementation
- **Issue:** Plan code sample only applied CSP to the next() path; redirect responses (token missing/invalid/cross-tenant) had no CSP — but the destination `/login` page also has scripts.
- **Fix:** Added explicit `redirect.headers.set(cspHeader, csp)` and `applySecurityHeaders(redirect)` calls on all three redirect branches (no-token, mismatched-agencyId, jwtVerify-failed).
- **Files modified:** `packages/auth/src/middleware.ts`
- **Verification:** csp-nonce test "emits CSP header on redirect-to-login responses" passes (status 307 + nonce in CSP).
- **Committed in:** `0acbfd3`

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 bug)
**Impact on plan:** All deviations were correctness/security improvements that the plan implicitly required. No scope creep. Net result is identical to plan intent.

## Issues Encountered

- **Pre-existing typecheck failures in `@mjagency/db`** (mfa-config.ts, sessions.ts, users.ts, permissions-vault.ts) for `PgPolicyToOption | undefined` — out of scope per scope-boundary rule. New `csp-reports.ts` and `web-vitals.ts` typecheck clean.
- **Pre-existing typecheck failures in `@mjagency/ui`** (storybook stories missing `@storybook/react`, web-vitals package missing) — out of scope. New `nonce-provider.tsx` typechecks clean.
- **11 of 13 plan-named apps lack package.json** (web-realestate, web-healthcare, web-legal, web-homeservices, web-fitness, web-dental, web-automotive, web-restaurant, web-education, web-financial, web-petcare). They are content-only stubs with `src/app/(frontend)/proposals/[token]/page.tsx` and `tools/[slug]/page.tsx` but no Next.js app config. The route.ts files are committed under their `src/app/api/csp-report/` and `src/app/api/rum/` directories so they will be in place when those apps are scaffolded — this is the correct posture per the plan's `find apps -path "*/api/csp-report/route.ts" \| wc -l = 13` acceptance criterion.

## User Setup Required

**Manual steps required at deploy / post-launch:**

1. **Run the migration on all 12 per-agency databases.** The local environment has no Payload server running, so `npx payload migrate` was skipped. Operator must execute:
   ```bash
   pnpm --filter=@mjagency/db run db:migrate
   ```
   or run the SQL in `packages/db/src/migrations/0011_csp_reports_and_web_vitals.sql` directly via psql.

2. **Set `NEXT_PUBLIC_AGENCY_ID` env var** for each of the 13 deployed apps (UUID per agency). Without this, the `/api/rum` endpoint silently drops events.

3. **Set `DB_APP_PASSWORD` env var** for each app (already required by the existing refresh route — just ensure parity for the new endpoints).

4. **D-08 Stage 2 flip** (14 days post-launch, after monitoring violations):
   ```bash
   # In each deployed app's environment:
   CSP_ENFORCING=true
   # Then redeploy. Also update .zap/rules.tsv to remove the IGNORE on rule 10038.
   ```

5. **Configure ZAP weekly workflow secrets** if using GitHub-hosted runners (none required for the public staging targets in the matrix).

## Next Phase Readiness

- **Plan 11-04 (dashboard)** can now read from `web_vitals` for p75 percentile cards.
- **Plan 11-05 (privacy/erasure)** can join `csp_reports` to investigate violations.
- **Plan 11-06 (Cloudflare WAF)** must add rate limits to the 26 new public endpoints (50/min/IP for csp-report, 100/min/IP for rum) per T-11-07-04 / T-11-07-05.
- **Plan 11-04 dashboard nonce integration**: when adding inline `<Script>`/`<style>` tags, consume `useNonce()` from `@mjagency/ui` to set the `nonce` prop. Layout must read `headers().get('x-nonce')` and pass to `<NonceProvider>`.

## Threat Flags

None — this plan establishes new security surface (CSP, public ingestion endpoints) but all surface is documented in the plan's existing `<threat_model>` (T-11-07-01 through T-11-07-10).

## Self-Check: PASSED

All 15 representative files exist on disk and all 4 task commits (`1bacbf4`, `0acbfd3`, `877c3f8`, `3afab36`) are reachable in git log.

---
*Phase: 11-analytics-security*
*Completed: 2026-04-28*
