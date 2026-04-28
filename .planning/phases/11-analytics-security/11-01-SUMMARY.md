---
phase: 11
plan: 11-01
subsystem: analytics
tags: [ga4, measurement-protocol, data-api, sgtm, cloudflare-workers, csp-nonce, consent-gating]
dependency_graph:
  requires:
    - "@mjagency/config (per-agency-env helper relies on existing exports)"
    - "Plan 11-07 (CSP nonce middleware + googletagmanager allowlist in script-src)"
  provides:
    - "@mjagency/analytics workspace package — GA4 server + Data API + Script tag"
    - "@mjagency/config:getAgencySecret(prefix, agencyId) — slug normalization helper"
    - "infra/sgtm-worker — Cloudflare Workers reverse proxy for analytics.{slug}"
    - "GA4InjectScript wired into 12 frontend layouts (consent-gated)"
  affects:
    - "Plan 11-04 dashboard (imports runReport from @mjagency/analytics/ga4-data-api)"
    - "Plan 11-05 CCPA opt-out (imports sendServerEvent for GA4 User Deletion event)"
    - "Plan 11-02 Clarity (shares @mjagency/analytics package; both files committed in this phase)"
    - "Plan 11-03 Meta CAPI (re-uses getAgencySecret helper for META_ACCESS_TOKEN_<SLUG>)"
tech_stack:
  added:
    - "@google-analytics/data 5.2.1 (server-only Data API client)"
    - "ioredis 5.10.1 (already in monorepo; added as analytics dep for cache layer)"
  patterns:
    - "Per-agency env var convention: PREFIX_${agencyId.replaceAll('-','_').toUpperCase()}"
    - "Server-component consent gating via cookies().get('mj_consent') BEFORE Script render"
    - "CSP nonce propagation: middleware sets x-nonce → server component reads → <Script nonce>"
    - "5-minute Redis cache for GA4 Data API (Pitfall 1.3 — 25K tokens/day quota mitigation)"
key_files:
  created:
    - "packages/analytics/package.json"
    - "packages/analytics/tsconfig.json"
    - "packages/analytics/src/index.ts"
    - "packages/analytics/src/ga4-server.ts"
    - "packages/analytics/src/ga4-data-api.ts"
    - "packages/analytics/src/ga4-script.tsx"
    - "packages/analytics/src/__tests__/ga4-server.test.ts"
    - "packages/analytics/src/__tests__/ga4-data-api.test.ts"
    - "packages/config/src/per-agency-env.ts"
    - "packages/config/src/__tests__/per-agency-env.test.ts"
    - "infra/sgtm-worker/wrangler.toml"
    - "infra/sgtm-worker/src/index.ts"
  modified:
    - "packages/config/src/index.ts (export getAgencySecret/normalizeSlug)"
    - "apps/web-{ai,branding,ecommerce,engineering,finance,graphic,growth,main,product,strategy,video,webdev}/package.json (add @mjagency/analytics dep)"
    - "apps/web-{ai,branding,ecommerce,engineering,finance,graphic,growth,main,product,strategy,video,webdev}/src/app/(frontend)/layout.tsx (render GA4InjectScript)"
decisions:
  - "Slug normalization helper getAgencySecret() lives in @mjagency/config — generalizes Phase 7 LiteLLM convention so Phase 11-02 (Clarity), 11-03 (Meta CAPI), 11-04 (dashboard) can reuse"
  - "Plan listed 13 niche apps (web-realestate, web-healthcare, etc.) but actual codebase has 12 vertical apps (web-ai, web-branding, web-engineering, web-finance, etc.) — wired GA4 into all 12 existing frontend layouts. The niche app shells (web-petcare, web-restaurant, etc.) are partial route groups without (frontend)/layout.tsx; they will inherit GA4 wiring when Plan 08-X scaffolds full apps for them."
  - "GA4_PROPERTY_ID + GOOGLE_APPLICATION_CREDENTIALS_PATH stay strictly server-only (no NEXT_PUBLIC_ prefix) — only NEXT_PUBLIC_GA4_MEASUREMENT_ID is browser-exposed (Measurement IDs are public by design)"
  - "GA4InjectScript reads mj_consent cookie directly inside the server component — no ConsentProvider context dependency. This means it works correctly even before Plan 11-05 wraps the layouts with <ConsentProvider>"
  - "Cache key strips agencyId from the hashed payload (already in the namespace prefix) so identical query shapes across agencies don't collide on the 16-char hash"
  - "Test-only injection helpers (__setRedisForTest, __setClientForTest) added to ga4-data-api.ts so unit tests can mock without spinning up Redis or BetaAnalyticsDataClient"
  - "wrangler.toml routes commented out — Cloudflare zone provisioning happens in Plan 11-06 ops runbook; uncomment after zones exist"
metrics:
  duration: "~11 minutes"
  completed_date: "2026-04-28"
  tasks_total: 3
  tasks_completed: 3
  commits: 3
  files_created: 12
  files_modified: 25
  tests_added: 20
  tests_passing: 20
---

# Phase 11 Plan 01: GA4 + GTM Server-Side Container Summary

GA4 client tagging via consent-gated SSR `<Script>` injection (per-request CSP nonce from Plan 11-07), Cloudflare Workers reverse proxy at `analytics.{slug}` for sGTM, Measurement Protocol fallback for server-fired events (CCPA opt-out / refund), and Data API client with 5-minute Redis cache for the Plan 11-04 dashboard.

## Outcome

- **`@mjagency/analytics` package** created with three discrete sub-paths:
  - `./ga4-server` — `sendServerEvent(agencyId, input)` Measurement Protocol POST
  - `./ga4-data-api` — `runReport(request)` GA4 Data API + 5-minute Redis cache
  - `./ga4-script` — `GA4InjectScript({ measurementId })` server component (consent-gated, nonce-aware)
- **`@mjagency/config:getAgencySecret(prefix, agencyId)`** helper exported alongside `normalizeSlug` and `getAgencySecretOptional`. Generalizes Phase 7 LiteLLM convention; Plan 11-02/11-03/11-04 will reuse.
- **Cloudflare Worker `infra/sgtm-worker/`** reverse-proxies `analytics.{slug}.{root}` to per-agency Cloud Run sGTM target. Preserves CF-Connecting-IP via X-Forwarded-For (Pitfall 1.5). Rejects unknown subdomains (T-11-01-06).
- **12 frontend layouts wired**: web-ai, web-branding, web-ecommerce, web-engineering, web-finance, web-graphic, web-growth, web-main, web-product, web-strategy, web-video, web-webdev. Each renders `<GA4InjectScript />` server-side when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set; consent gate inside the component blocks render when `mj_consent === 'tracking_blocked'`.
- **20 unit tests passing**: 10 ga4-server (event_name regex, client_id length, env-var handling, body shape, non-2xx error) + 5 ga4-data-api (cache hit, cache miss, setex 300 TTL, namespace, missing property id) + 5 per-agency-env (slug normalize, secret read, missing throw, optional present/absent).

## Tasks

| Task | Title | Commit | Files |
|------|-------|--------|-------|
| T-01 | Scaffold @mjagency/analytics + getAgencySecret() | `0306d92` | 7 (3 created, 1 modified, lockfile) |
| T-02 | GA4 Measurement Protocol + Data API + Script tag | `afb65e9` | 5 (3 src + 2 test) |
| T-03 | Cloudflare Workers sGTM proxy + 12 layouts wired | `fe2cee0` | 27 (2 infra + 12 layouts + 12 package.json + lockfile) |

## Verification

| # | Check | Result |
|---|-------|--------|
| 1 | `grep "EVENT_NAME_RE\|client_id" packages/analytics/src/ga4-server.ts` | PASS — Pitfall 1.4 mitigation present |
| 2 | `grep "tracking_blocked" packages/analytics/src/ga4-script.tsx` | PASS — D-01/D-02 default-on consent gate |
| 3 | `grep "x-nonce" packages/analytics/src/ga4-script.tsx` | PASS — Plan 11-07 nonce reads |
| 4 | `grep "setex\|CACHE_TTL_SEC" packages/analytics/src/ga4-data-api.ts` | PASS — 5-min TTL via `setex(key, 300, ...)` |
| 5 | `find apps -path "*/(frontend)/layout.tsx" -exec grep -l GA4InjectScript {} \;` | 12 paths (all existing frontend layouts) |
| 6 | `grep "X-Forwarded-For" infra/sgtm-worker/src/index.ts` | PASS — Pitfall 1.5 mitigation |
| 7 | `pnpm typecheck --filter=@mjagency/analytics` | exit 0 |
| 8 | `pnpm test --filter=@mjagency/analytics` | 20 tests pass (3 files) |
| 9 | `pnpm test --filter=@mjagency/config` | 27 tests pass (5 new + 22 existing) |
| 10 | `grep -r "private_key" packages/ apps/` | 0 matches — T-11-01-01 mitigation holds |
| 11 | `grep -r "NEXT_PUBLIC_GA4_API_SECRET\|NEXT_PUBLIC_GA4_PROPERTY_ID" packages/ apps/` | 0 matches — T-11-01-02 mitigation holds |
| 12 | `grep "googletagmanager.com" packages/auth/src/middleware.ts` | PASS — D-10 allowlist via Plan 11-07 |
| 13 | `grep "getAgencySecret\|normalizeSlug" packages/config/src/index.ts` | PASS — exports added |

## Deviations from Plan

### Auto-fixed / Resolved

**1. [Rule 2 — Critical functionality] Test-only injection helpers added to ga4-data-api.ts**
- **Found during:** T-02
- **Issue:** The plan's test stub used `it.todo` for cache hit/miss/setex assertions. Without a way to inject mock Redis + BetaAnalyticsDataClient, the tests cannot run.
- **Fix:** Added `__setRedisForTest()` and `__setClientForTest()` exports — minimal, name-prefixed with `__` to signal test-only. Three real assertions now run instead of placeholders.
- **Files:** `packages/analytics/src/ga4-data-api.ts`, `packages/analytics/src/__tests__/ga4-data-api.test.ts`
- **Commit:** `afb65e9`

**2. [Rule 3 — Blocking] Plan 13-app list vs. actual 12-app codebase**
- **Found during:** T-03
- **Issue:** Plan's `files_modified` listed 13 niche-vertical apps (web-realestate, web-healthcare, web-legal, web-homeservices, web-fitness, web-dental, web-automotive, web-restaurant, web-education, web-financial, web-petcare). The actual codebase has those names as **partial route-group shells** (only `proposals/[token]` + `tools/[slug]` pages, no package.json or layout.tsx). The 12 **full** Next.js apps in this monorepo use vertical names: web-ai, web-branding, web-engineering, web-finance, web-graphic, web-growth, web-product, web-strategy, web-video, web-webdev, web-main, web-ecommerce.
- **Fix:** Wired GA4InjectScript into all 12 existing frontend layouts. The partial niche apps will pick up GA4 wiring automatically when a future plan promotes them to full apps with their own (frontend)/layout.tsx — at that point a one-line import + render call is the only addition needed.
- **Impact:** D-10 CSP allowlist still covers analytics globally (set in middleware which all routes traverse via Plan 11-07). REQ-140 is satisfied: GA4 client tag renders on every public-facing page that has a frontend layout.

**3. [Rule 2 — Compatibility] ioredis version pinned to 5.10.1 (not 5.4.1 from plan)**
- **Found during:** T-01
- **Issue:** Plan specified `"ioredis": "5.4.1"` but the rest of the monorepo (e.g., packages/auth, packages/queue) uses `5.10.1`. Mixing versions would create dual ioredis instances in node_modules and waste deduplication.
- **Fix:** Used `5.10.1` to match the monorepo. No API surface change for the methods we use (get/setex/Redis constructor).
- **Files:** `packages/analytics/package.json`

**4. [Rule 2 — Critical functionality] tsconfig.json added to packages/analytics/**
- **Found during:** T-01
- **Issue:** Plan listed package.json + src files but no tsconfig.json. `pnpm typecheck --filter=@mjagency/analytics` fails without one.
- **Fix:** Created tsconfig.json extending `../../tsconfig.base.json` with `jsx: "preserve"` (required for ga4-script.tsx).
- **Files:** `packages/analytics/tsconfig.json`

### Out of Scope (Deferred)

These were observed but NOT fixed because they are not caused by Plan 11-01:

- Pre-existing typecheck errors in `apps/web-*/src/app/api/contact/route.ts` (missing `@mjagency/queue` / `@mjagency/forms` resolutions) and Stripe webhook routes (missing `stripe`, `ioredis` types). Tracked in `.planning/phases/11-analytics-security/deferred-items.md` (created if not already).
- Pre-existing `packages/db/src/schema/{mfa-config,permissions-vault,sessions,users}.ts` policy type errors. Drizzle schema change unrelated to GA4.
- Pre-existing `packages/db/src/seed/steps/crm-{contacts,pipelines}.ts` strict-undefined errors.
- Pre-existing `packages/media/src/color-extraction.ts` missing `@types/color-thief-node`.

None of these were touched by Plan 11-01 commits.

## Cross-Plan Coordination

Plan 11-02 (Clarity) executed in parallel and added `clarity-init.tsx`, `clarity-delete.ts`, `@microsoft/clarity` dep, and `@mjagency/ai` workspace dep to `packages/analytics/package.json` while Plan 11-01 was scaffolding the same package. Plan 11-02's additions were preserved in commits — the package now exposes both GA4 and Clarity sub-paths from the same workspace package, which is the intended end state.

Plan 11-02 also wired `<ClarityInjectScript />` into 12 layouts in parallel with my `<GA4InjectScript />`. Layout files end up with both injectors side-by-side, both consent-gated, both nonce-aware.

## Threat Model Outcome

All 9 threats from the plan's STRIDE register were mitigated in code:

| Threat | Mitigation Implementation |
|--------|---------------------------|
| T-11-01-01 (SA JSON in repo) | `GOOGLE_APPLICATION_CREDENTIALS_PATH_<SLUG>` server env only; `grep -r "private_key" packages/ apps/` returns 0 |
| T-11-01-02 (api_secret in NEXT_PUBLIC_*) | `getAgencySecret('GA4_API_SECRET', ...)` requires non-NEXT_PUBLIC_ env; `grep` for NEXT_PUBLIC_GA4_API_SECRET returns 0 |
| T-11-01-03 (MP silent drop) | `EVENT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/` + `clientId.length < 8` checks throw before fetch |
| T-11-01-04 (cross-agency mis-attribution) | `NEXT_PUBLIC_GA4_MEASUREMENT_ID_<SLUG_UPPER>` per-agency env with global fallback; never read from CMS |
| T-11-01-05 (Data API quota) | `setex(key, 300, ...)` 5-min Redis cache per (agency, request hash) |
| T-11-01-06 (sGTM IP spoofing) | Worker overwrites X-Forwarded-For from CF-Connecting-IP; rejects unknown subdomains 400 |
| T-11-01-07 (consent bypass) | `if (consent === 'tracking_blocked') return null` BEFORE any `<Script>` element, server-side |
| T-11-01-08 (CSP violation) | `<Script nonce={nonce}>` on both gtag.js and inline init; Plan 11-07 allowlist covers googletagmanager.com |
| T-11-01-09 (untraceable server events) | `sendServerEvent` throws Error on validation/network failure — caller logs via Pino with redaction |

## Self-Check: PASSED

All claimed files verified to exist:

- `packages/analytics/package.json` — FOUND
- `packages/analytics/src/ga4-server.ts` — FOUND
- `packages/analytics/src/ga4-data-api.ts` — FOUND
- `packages/analytics/src/ga4-script.tsx` — FOUND
- `packages/analytics/src/__tests__/ga4-server.test.ts` — FOUND
- `packages/analytics/src/__tests__/ga4-data-api.test.ts` — FOUND
- `packages/config/src/per-agency-env.ts` — FOUND
- `packages/config/src/__tests__/per-agency-env.test.ts` — FOUND
- `infra/sgtm-worker/wrangler.toml` — FOUND
- `infra/sgtm-worker/src/index.ts` — FOUND

All 3 commits verified in git log:

- `0306d92` — feat(11-01): scaffold @mjagency/analytics package + getAgencySecret() helper
- `afb65e9` — feat(11-01): GA4 Measurement Protocol + Data API + consent-gated Script tag
- `fe2cee0` — feat(11-01): wire GA4InjectScript into 12 layouts + Cloudflare Workers sGTM proxy
