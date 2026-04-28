---
phase: 11-analytics-security
plan: 11-02
subsystem: analytics
tags: [microsoft-clarity, heatmaps, session-recording, ccpa-opt-out, pii-redaction, csp-allowlist, jose, edge-runtime, server-component, react-client-component]

# Dependency graph
requires:
  - phase: 07-ai-assistant
    provides: redactPii() — strips email/phone/SSN/CC/IP via deterministic token map (REQ-084)
  - phase: 11-analytics-security (Plan 11-07)
    provides: per-request CSP nonce middleware, clarity.ms allowlist in script-src + connect-src, NonceProvider/useNonce context
  - phase: 11-analytics-security (Plan 11-01 — parallel wave-2 sibling)
    provides: scaffolded @mjagency/analytics package, getAgencySecret + normalizeSlug per-agency env helpers, GA4InjectScript SSR pattern reused symmetrically by ClarityInjectScript
provides:
  - ClarityInit ('use client') — Clarity.init() gated on consent prop, identifies via SHA-256 customId
  - ClarityInjectScript (server component) — reads mj_consent cookie SSR, hands consent boolean to ClarityInit
  - emitClarityEvent helper — Phase 7 redactPii() applied to each setTag value before Clarity.event()
  - clarityDeleteUser(agencyId, clarityUserId) — POSTs to clarity.ms/api/v3/delete with bearer token
  - docs/runbooks/clarity-project-setup.md — per-agency dashboard config (Mask Mode = Strict + network capture OFF)
  - 12 (frontend)/layout.tsx files wired with consent-gated ClarityInjectScript
affects:
  - 11-05 (CCPA opt-out + erasure workers — imports clarityDeleteUser, calls Clarity.identify(sha256(email)) at consent log)
  - 11-04 (analytics dashboard — Clarity dashboard is external, but session counts/ engagement metrics referenced)
  - 11-03 (Meta CAPI — independent surface; both wired in same layout via parallel Plan 11-01 GA4 pattern)

# Tech tracking
tech-stack:
  added:
    - "@microsoft/clarity@1.0.2 (verified npm version pin — exact, no caret)"
  patterns:
    - "Server-component wrapper around 'use client' analytics component — symmetric with GA4InjectScript (Plan 11-01)"
    - "Per-agency env split: NEXT_PUBLIC_CLARITY_PROJECT_ID (browser) vs CLARITY_API_TOKEN_${SLUG_UPPER} (server-only)"
    - "Consent gate computed SSR via cookies().get('mj_consent') — no client hydration race; pre-consent flash impossible"
    - "Custom event metadata pre-redacted via Phase 7 redactPii() before Clarity.setTag — defense-in-depth on top of dashboard Mask Mode = Strict"
    - "Mask Mode + network-capture-OFF = project-side defaults (NOT in code) — runbook is the source of truth"

key-files:
  created:
    - packages/analytics/src/clarity-init.tsx
    - packages/analytics/src/clarity-script.tsx
    - packages/analytics/src/clarity-delete.ts
    - packages/analytics/src/__tests__/clarity-delete.test.ts
    - packages/analytics/vitest.config.ts
    - docs/runbooks/clarity-project-setup.md
  modified:
    - packages/analytics/package.json (add @microsoft/clarity@1.0.2 + @mjagency/ai workspace dep + 2 subpath exports)
    - packages/analytics/src/index.ts (barrel re-exports for ClarityInit, ClarityInjectScript, emitClarityEvent, clarityDeleteUser)
    - apps/web-main/src/app/(frontend)/layout.tsx
    - apps/web-ecommerce/src/app/(frontend)/layout.tsx
    - apps/web-ai/src/app/(frontend)/layout.tsx
    - apps/web-branding/src/app/(frontend)/layout.tsx
    - apps/web-engineering/src/app/(frontend)/layout.tsx
    - apps/web-finance/src/app/(frontend)/layout.tsx
    - apps/web-graphic/src/app/(frontend)/layout.tsx
    - apps/web-growth/src/app/(frontend)/layout.tsx
    - apps/web-product/src/app/(frontend)/layout.tsx
    - apps/web-strategy/src/app/(frontend)/layout.tsx
    - apps/web-video/src/app/(frontend)/layout.tsx
    - apps/web-webdev/src/app/(frontend)/layout.tsx

key-decisions:
  - "Added ClarityInjectScript server-component wrapper (NOT in original plan) — mirrors GA4InjectScript pattern from Plan 11-01 so the 12 layouts each have a single import + render line per analytics surface. Avoids spreading async cookie reads across 12 layouts (Rule 2 deviation — missing critical functionality)"
  - "Mask Mode = 'Strict' is configured in the Clarity DASHBOARD, not in code (per @microsoft/clarity@1.0.2 API which has no init() option for it). Runbook is the contract. CI cannot grep for it; verification is dashboard inspection"
  - "@microsoft/clarity@1.0.2 actual API differs from plan's documented interface: Clarity.event(eventName) takes only the event name (no data arg); custom metadata uses Clarity.setTag(key, value). emitClarityEvent helper now: redactPii(value) → setTag(key, redacted) for each pair → event(eventName) (Rule 1 deviation — bug from outdated API doc)"
  - "Custom Clarity events apply redactPii() to TAG VALUES (not the eventName itself, which is a developer-controlled literal) — defense-in-depth on top of project-side Mask Mode = Strict"
  - "Plan listed 13 niche apps (web-realestate, web-healthcare, etc.) but the actual repo has 12 verticals (web-ai, web-branding, ...) — same situation Plan 11-01 documented. ClarityInjectScript wired into the 12 layouts that exist. The 11 niche-named apps in the plan haven't been scaffolded yet (deferred — see STATE.md)"

patterns-established:
  - "Pattern: 'use client' analytics SDK + server-component wrapper that reads consent cookie SSR + passes consent boolean as prop. Pre-consent flash impossible without async layout function."
  - "Pattern: per-agency env split at boundary — NEXT_PUBLIC_* for browser-needed IDs, ${PREFIX}_${SLUG_UPPER} for server-only secrets. getAgencySecret() throws on missing — fail-fast, no silent fallback."
  - "Pattern: third-party tracking + project-side privacy controls (Mask Mode, network OFF) + code-side PII redaction (redactPii on setTag values) — three independent layers, no single point of failure."

requirements-completed: [REQ-141]

# Metrics
duration: 12min
completed: 2026-04-28
---

# Phase 11 Plan 11-02: Microsoft Clarity Heatmaps Summary

**Microsoft Clarity heatmaps + session recordings via @microsoft/clarity@1.0.2 with mask-all-by-default (project-side Strict mode), SSR consent gate, redactPii() reuse on custom events, and Delete API client for Plan 11-05 erasure fan-out.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-28T04:40:33Z
- **Completed:** 2026-04-28T04:52:31Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 14

## Accomplishments

- @microsoft/clarity@1.0.2 wired across 12 public-facing apps with consent-gated SSR injection (zero pre-consent flash)
- Clarity Delete API client (clarityDeleteUser) ready for Plan 11-05 CCPA opt-out + erasure fan-out
- Per-agency Clarity Project IDs in NEXT_PUBLIC_CLARITY_PROJECT_ID; server-only API tokens in CLARITY_API_TOKEN_${SLUG_UPPER}
- Custom Clarity event helper applies Phase 7 redactPii() to all tag values (defense-in-depth)
- Per-agency dashboard runbook documents Mask Mode = 'Strict' + Capture network requests = OFF (Pitfalls 2.2 + 2.4)

## Task Commits

Each task was committed atomically:

1. **T-01: Create ClarityInit component + Delete client + runbook** - `e8e244c` (feat) — added @microsoft/clarity@1.0.2 dep + clarity-init.tsx + clarity-delete.ts + clarity-project-setup.md
2. **T-02: Add clarity-delete unit tests** - `1ff4ba1` (test) — 5 cases covering input validation, POST shape, error propagation, missing-env throw (5/5 PASS via vitest)
3. **T-03: Wire ClarityInjectScript into 12 layouts + add server wrapper** - `92a5513` (feat) — created clarity-script.tsx (server-component wrapper), wired into 9 layouts (web-main + web-ai + web-ecommerce wired earlier in `fe2cee0` due to shared-index race)

_Note: T-02 file landed in `1ff4ba1` because of shared `.git` index across parallel agents in the same worktree. The file content and tests are mine; the commit message belongs to another agent. T-01 and T-03 commits accurately reflect this plan's work._

## Files Created/Modified

### Created
- `packages/analytics/src/clarity-init.tsx` — 'use client' Clarity SDK wrapper; useEffect calls Clarity.init only when consent prop is true
- `packages/analytics/src/clarity-script.tsx` — server component wrapper that reads mj_consent cookie SSR and passes consent boolean to ClarityInit (NEW pattern, not in original plan)
- `packages/analytics/src/clarity-delete.ts` — clarityDeleteUser(agencyId, clarityUserId) — POSTs to clarity.ms/api/v3/delete with per-agency bearer token
- `packages/analytics/src/__tests__/clarity-delete.test.ts` — 5 unit tests (input guard, POST shape, 4xx propagation, missing-env throw)
- `packages/analytics/vitest.config.ts` — vitest config (Node env, src/**/*.test.ts include)
- `docs/runbooks/clarity-project-setup.md` — per-agency dashboard config + Doppler env var summary + verification steps

### Modified
- `packages/analytics/package.json` — added @microsoft/clarity@1.0.2 + @mjagency/ai workspace dep + 2 subpath exports (./clarity-init, ./clarity-script, ./clarity-delete)
- `packages/analytics/src/index.ts` — barrel re-exports for ClarityInit, emitClarityEvent, ClarityInjectScript, clarityDeleteUser + their type exports
- 12 × `apps/web-*/src/app/(frontend)/layout.tsx` — added `import { ClarityInjectScript } from '@mjagency/analytics/clarity-script'` and `{clarityProjectId ? <ClarityInjectScript projectId={clarityProjectId} /> : null}` next to the existing GA4InjectScript line

## Decisions Made

- **Server-component wrapper added (not in original plan):** Plan suggested an inline async-IIFE inside each layout to read cookies, but that's brittle (12 copy-pasted blocks) and inconsistent with Plan 11-01's GA4InjectScript pattern. Adding `ClarityInjectScript` as a server component that wraps the 'use client' `ClarityInit` keeps each layout to one import + one render line — symmetric with GA4. This matches Plan 11-01's pattern exactly.
- **emitClarityEvent uses setTag + event (not event with data):** The plan documented `Clarity.event(eventName, data)` but @microsoft/clarity@1.0.2 only accepts `Clarity.event(eventName)`. Custom metadata is attached via `Clarity.setTag(key, value)`. Helper now: redact each value → setTag(key, redacted) → event(eventName).
- **NEXT_PUBLIC_CLARITY_PROJECT_ID is shared across apps (not per-agency-suffixed):** Each app already has its own .env.local; the suffixed variant `NEXT_PUBLIC_CLARITY_PROJECT_ID_${SLUG_UPPER}` is unnecessary because Next.js env scoping is per-build. Pattern matches Plan 11-01's NEXT_PUBLIC_GA4_MEASUREMENT_ID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated emitClarityEvent for actual @microsoft/clarity@1.0.2 API**
- **Found during:** Task 1 (creating clarity-init.tsx)
- **Issue:** Plan documented `Clarity.event(eventName, data)` but the installed @microsoft/clarity@1.0.2 only accepts `Clarity.event(eventName)`. Calling with two args would have silently dropped the metadata at runtime.
- **Fix:** Refactored helper to call `Clarity.setTag(key, redactPii(value).redacted)` for each pair, then `Clarity.event(eventName)` once. Documented the actual API in the JSDoc.
- **Files modified:** packages/analytics/src/clarity-init.tsx
- **Verification:** Typecheck passes against the package's index.d.ts (which is the source of truth for the API).
- **Committed in:** `e8e244c` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added ClarityInjectScript server-component wrapper**
- **Found during:** Task 3 (wiring layouts)
- **Issue:** Plan suggested an inline async IIFE in each layout to read mj_consent cookie before mounting ClarityInit. This produces 12 copy-pasted async blocks, doesn't match Plan 11-01's GA4InjectScript pattern (single server-component import), and forces layouts to become async.
- **Fix:** Created `packages/analytics/src/clarity-script.tsx` — a server component that reads `cookies().get('mj_consent')` SSR, returns null if blocked, otherwise renders `<ClarityInit consent={true} ...>`. Each layout now has one import + one conditional render — identical shape to GA4InjectScript. Pre-consent flash still impossible (server gate); architecture is consistent.
- **Files modified:** packages/analytics/src/clarity-script.tsx (new), packages/analytics/src/index.ts (export), packages/analytics/package.json (subpath export), 12 layouts
- **Verification:** `pnpm typecheck --filter=@mjagency/analytics` passes; grep `ClarityInjectScript` returns 12 layout matches.
- **Committed in:** `92a5513` (Task 3 commit) + `fe2cee0` (3 layouts wired by parallel agent due to shared index)

**3. [Rule 3 - Blocking] Plan listed 13 apps; only 12 have frontend layouts**
- **Found during:** Task 3 (wiring 13 layouts)
- **Issue:** Plan's `files_modified` listed 13 niche apps (web-ecommerce, web-realestate, web-healthcare, web-legal, web-homeservices, web-fitness, web-dental, web-automotive, web-restaurant, web-education, web-financial, web-petcare, web-main). The actual repo has 12 vertical apps (web-ai, web-branding, web-ecommerce, web-engineering, web-finance, web-graphic, web-growth, web-main, web-product, web-strategy, web-video, web-webdev). The 11 niche-named apps in the plan have only `src/app/(frontend)/proposals/` and `src/app/(frontend)/tools/` — no layout.tsx and no package.json. This matches the deferred item from STATE.md ("11 agency apps need @mjagency/tools dep — Blocked on Bash/write access to parallel worktree files").
- **Fix:** Wired ClarityInjectScript into the 12 frontend layouts that actually exist (matching the GA4 wiring done by Plan 11-01). When the niche apps are scaffolded in a future plan, the same one-line change will apply.
- **Files modified:** All 12 (frontend)/layout.tsx files
- **Verification:** `find apps -path "*/(frontend)/layout.tsx" -exec grep -l ClarityInjectScript {} \;` returns 12 paths — all that exist.
- **Committed in:** `92a5513` + `fe2cee0`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking — all aligned with deviation rules)
**Impact on plan:** No scope creep. Two of three deviations make the implementation BETTER (correct API usage; symmetric server-wrapper pattern). The third is a known repo state issue (12 apps not 13) that mirrors Plan 11-01.

## Issues Encountered

- **Shared `.git` index across parallel agents:** Plans 11-01, 11-03, 11-05, 11-06 are all running in parallel against the same git index. Some of my staged files (T-02 test file, web-main/ai/ecommerce layout edits) were committed by other agents' `git commit` invocations. The work is in git history correctly; commit attribution is mixed. Recorded actual landing commit hashes in Task Commits section.
- **`pnpm-lock.yaml` cross-pollination:** First commit `e8e244c` includes lockfile entries for compliance + meta-capi packages owned by other agents. This is benign — those files exist (other agents created them), the lockfile reflects reality, and the orchestrator will re-run pnpm install on integration.
- **Pre-existing typecheck errors in apps:** `pnpm typecheck --filter=@mjagency/web-ecommerce` fails because of pre-existing errors in `packages/db/src/seed/steps/crm-pipelines.ts`, payload route handlers, and missing modules (drizzle-orm, ioredis) in other packages. None involve clarity/layout files. Per scope boundary rule, these are out of scope and were not touched. The analytics package typechecks clean.

## Authentication Gates

None — Plan 11-02 is wholly code-side. Per-agency Doppler secrets (CLARITY_API_TOKEN_*) are documented in the runbook for the operator; no interactive auth required from Claude.

## Threat Flags

None — all surface introduced by this plan is covered by the plan's STRIDE register (T-11-02-01 through T-11-02-08). The Clarity Delete API surface is opt-in for Plan 11-05 (worker-only); no new browser-facing endpoints created.

## Next Phase Readiness

- **Plan 11-05 unblocked:** clarityDeleteUser() exported and ready to import via `import { clarityDeleteUser } from '@mjagency/analytics'`. Plan 11-05 will capture (email → clarityUserId) at consent log via the customId prop on ClarityInit.
- **Operator runbook ready:** docs/runbooks/clarity-project-setup.md covers per-agency project creation, Mask Mode = Strict, network capture OFF, env var generation. 13 Clarity projects need to be created in clarity.microsoft.com — independent of code deploy.
- **Verification at deploy:** Visit any agency homepage with consent allowed → expect `clarity.ms` requests. Set `mj_consent=tracking_blocked` cookie → expect zero `clarity.ms` requests. PII fields should appear masked in dashboard session replays.

## Self-Check: PASSED

Verified:
- File `packages/analytics/src/clarity-init.tsx`: FOUND
- File `packages/analytics/src/clarity-script.tsx`: FOUND
- File `packages/analytics/src/clarity-delete.ts`: FOUND
- File `packages/analytics/src/__tests__/clarity-delete.test.ts`: FOUND
- File `docs/runbooks/clarity-project-setup.md`: FOUND
- Commit `e8e244c`: FOUND in git log
- Commit `1ff4ba1`: FOUND in git log (carries T-02 test file due to shared-index race)
- Commit `92a5513`: FOUND in git log
- Commit `fe2cee0`: FOUND in git log (carries web-main/ai/ecommerce ClarityInjectScript edits due to shared-index race)
- 12 layouts contain ClarityInjectScript: VERIFIED via Grep
- Analytics typecheck: PASSED
- Clarity-delete tests: 5/5 PASSED
- CSP allowlist `clarity.ms`: ALREADY PRESENT in packages/auth/src/middleware.ts (Plan 11-07)

---
*Phase: 11-analytics-security*
*Completed: 2026-04-28*
