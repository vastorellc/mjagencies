---
phase: 11-analytics-security
plan: 03
subsystem: analytics
tags: [meta-capi, conversions-api, server-side-tracking, sha256, bullmq, encrypted-queue, fetch, next15, nodejs]

# Dependency graph
requires:
  - phase: 02-multi-tenant-db
    provides: agency-isolated Postgres + Redis keyPrefix conventions
  - phase: 03-auth-sso-edge
    provides: jose + auth middleware (no Meta domain in CSP)
  - phase: 07-ai-assistant
    provides: redactPii() PII tokenization (defense in depth on custom_data)
  - phase: 09-crm-forms-booking
    provides: form-worker.ts + 13 /api/contact routes (Lead emission point)
  - phase: 10-tools-pitch-builder
    provides: invoice-worker.ts checkout.session.completed handler (Purchase emission point)
  - phase: 11-07
    provides: per-request CSP nonce + ZAP CI gate confirming no Meta domain in policy

provides:
  - "@mjagency/meta-capi server-only Conversions API client (sendCapiEvent, enqueueCapiEvent, startCapiWorker)"
  - "SHA-256 hashed user_data per Meta spec (em lowercase+trim, ph normalized to 1XXXXXXXXXX, external_id)"
  - "BullMQ encrypted queue 'meta-capi-events' with sensitiveData: true and jobId = event_id idempotency"
  - "Lead event emission from packages/forms/src/workers/form-worker.ts after Payload CRM contact created"
  - "Purchase event emission from packages/invoices/src/workers/invoice-worker.ts when invoice flips to 'paid'"
  - "Client IP + User-Agent capture across 13 /api/contact endpoints (Pitfall 3.5 ip+ua fallback identifier)"
  - "Per-agency env helper (META_PIXEL_ID_${SLUG}, META_ACCESS_TOKEN_${SLUG}, optional META_TEST_EVENT_CODE_${SLUG})"

affects: [phase-12-deployment, doppler-secret-management, meta-business-manager-runbooks]

# Tech tracking
tech-stack:
  added:
    - "@mjagency/meta-capi (new workspace package)"
    - "Direct fetch to graph.facebook.com/v22.0/{pixel}/events (NOT facebook-nodejs-business-sdk)"
    - "node:crypto SHA-256 hashing for em / ph / external_id"
  patterns:
    - "Server-side-only third-party tracking — NO browser pixel (D-10 enforced via CSP omission)"
    - "BullMQ jobId = Meta event_id for retry idempotency (server-side dedup belt + Meta dedup suspenders)"
    - "Per-agency hyphen-normalized env vars: web-ecommerce → process.env.META_PIXEL_ID_WEB_ECOMMERCE"
    - "Try/catch non-fatal pattern around CAPI enqueue: form/invoice flow MUST NOT break if Meta enqueue fails"

key-files:
  created:
    - "packages/meta-capi/package.json"
    - "packages/meta-capi/tsconfig.json"
    - "packages/meta-capi/vitest.config.ts"
    - "packages/meta-capi/src/index.ts"
    - "packages/meta-capi/src/meta-capi.ts"
    - "packages/meta-capi/src/meta-capi-queue.ts"
    - "packages/meta-capi/src/per-agency-env.ts"
    - "packages/meta-capi/src/__tests__/meta-capi.test.ts"
    - "packages/meta-capi/src/__tests__/meta-capi-queue.test.ts"
  modified:
    - "packages/forms/package.json (add @mjagency/meta-capi)"
    - "packages/forms/src/workers/form-worker.ts (add Lead emission + clientIp/clientUserAgent fields)"
    - "packages/invoices/package.json (add @mjagency/meta-capi)"
    - "packages/invoices/src/workers/invoice-worker.ts (add Purchase emission on paid)"
    - "apps/web-{main,ecommerce,growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic,brand}/src/app/api/contact/route.ts (capture clientIp + clientUserAgent from request headers)"

key-decisions:
  - "Created @mjagency/meta-capi as a NEW standalone package (not inside @mjagency/analytics) to decouple from Plan 11-01 GA4 work and avoid blocking on its in-flight scaffolding"
  - "Direct fetch over facebook-nodejs-business-sdk — sdk is ~3MB, Edge-incompatible, and a single REST endpoint does not justify it (RESEARCH §3)"
  - "jobId = event_id pairs BullMQ once-only processing with Meta server-side dedup. Retries cannot produce duplicate Lead/Purchase events even if BullMQ disk corruption forces a re-queue"
  - "redactPii() applied only to custom_data string fields, NOT to user_data — em/ph are SHA-256 hashed inside sendCapiEvent so tokenizing them would break Meta normalization"
  - "Lead emission moved to form-worker.ts (after createContact succeeds) instead of /api/contact route — this matches the actual Phase 9 architecture where /api/contact only enqueues the form-submissions job; CRM write happens in worker. CAPI Lead must follow CRM write to use Payload contact id as external_id"
  - "Purchase emission ONLY when newStatus === 'paid'. Partial payments do NOT fire Purchase — they fire when fully paid"
  - "Stripe amount_total / 100 (cents → dollars) before sending to Meta — Meta value field is dollars, not cents"
  - "client_ip captured from cf-connecting-ip with x-forwarded-for fallback per Cloudflare convention"
  - "Server-fired Purchase has no req context for ip+ua — relies on em/ph from session.customer_details + external_id (invoice id) for the Pitfall 3.5 identifier requirement"

patterns-established:
  - "Pattern: getAgencySecret('META_PIXEL_ID', agencyId) reads process.env.META_PIXEL_ID_{HYPHENS_TO_UNDERSCORES_UPPER}"
  - "Pattern: try { await enqueueCapiEvent(...) } catch (err) { log.warn(...) } — analytics MUST be non-fatal to business flow"
  - "Pattern: createEncryptedQueue with keyPrefix = REDIS_KEY.bullPrefix(agencyId) for per-agency queue isolation"
  - "Pattern: event_id generated via crypto.randomUUID() per call, propagated as jobId for idempotency"

requirements-completed: [REQ-142]

# Metrics
duration: ~30 min
completed: 2026-04-28
---

# Phase 11 Plan 03: Meta CAPI Server-Side Summary

**Server-only Meta Conversions API via direct fetch to graph.facebook.com/v22.0, SHA-256 hashed user_data, BullMQ encrypted queue with event_id idempotency, Lead+Purchase emission wired to forms + invoices.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-28T04:39:00Z
- **Completed:** 2026-04-28T04:54:00Z
- **Tasks:** 2
- **Files created:** 9 (new package)
- **Files modified:** 16 (forms worker + invoice worker + 13 contact routes + 2 package.json)

## Accomplishments

- New `@mjagency/meta-capi` workspace package with `sendCapiEvent` (direct fetch) and `enqueueCapiEvent` / `startCapiWorker` (BullMQ).
- Direct POST to `https://graph.facebook.com/v22.0/{pixel_id}/events` — no SDK dependency.
- SHA-256 hashed `user_data.em` (lowercase + trim) and `user_data.ph` (normalized to `1XXXXXXXXXX`) per Meta spec.
- BullMQ encrypted queue `meta-capi-events` with `sensitiveData: true` and `jobId = event_id` for retry-safe once-only delivery.
- Phase 9 form worker emits `Lead` event after Payload CRM contact creation (with external_id = contact id).
- Phase 10 invoice worker emits `Purchase` event with `value` (cents → dollars) and `currency` when status flips to `paid`.
- 13 `/api/contact` routes capture `cf-connecting-ip` + `user-agent` for the ip+ua fallback identifier.
- 26 unit tests pass covering all 5 RESEARCH pitfalls and threat register mitigations.
- D-10 verified — no `facebook.com` / `connect.facebook.net` / `fbevents.js` in CSP allowlist.

## Task Commits

1. **Task T-01: Implement meta-capi.ts + meta-capi-queue.ts + tests** — `e8e244c` (feat)
   *Note:* My T-01 files were swept into a parallel agent's commit `e8e244c feat(11-02): add Microsoft Clarity init...` due to overlapping `git add` window. The meta-capi files (`packages/meta-capi/**`) are present in that commit alongside the 11-02 Clarity work. This is documented as Deviation/Issue below.

2. **Task T-02: Wire Lead + Purchase emission across forms / invoices / 13 apps** — `ed23ed4` (feat)

## Files Created/Modified

### Created (T-01 — packaged in commit `e8e244c`)
- `packages/meta-capi/package.json` — workspace package definition; deps: @mjagency/{ai,config,queue}, bullmq 5.76.2, ioredis 5.10.1
- `packages/meta-capi/tsconfig.json` — extends base; includes vitest.config.ts
- `packages/meta-capi/vitest.config.ts` — node env, src/**/*.test.ts pattern
- `packages/meta-capi/src/index.ts` — barrel exports (sendCapiEvent, enqueueCapiEvent, startCapiWorker, getAgencySecret)
- `packages/meta-capi/src/meta-capi.ts` — sendCapiEvent: direct fetch, SHA-256 hashing, redactPii on custom_data
- `packages/meta-capi/src/meta-capi-queue.ts` — enqueueCapiEvent + startCapiWorker (BullMQ encrypted)
- `packages/meta-capi/src/per-agency-env.ts` — getAgencySecret / getAgencySecretOptional with hyphen normalization
- `packages/meta-capi/src/__tests__/meta-capi.test.ts` — 19 tests (all 5 pitfalls + threat mitigations)
- `packages/meta-capi/src/__tests__/meta-capi-queue.test.ts` — 7 tests (sensitiveData, jobId, queue name, keyPrefix)

### Modified (T-02 — commit `ed23ed4`)
- `packages/forms/package.json` — add `@mjagency/meta-capi` dep
- `packages/forms/src/workers/form-worker.ts` — import enqueueCapiEvent, add `clientIp`/`clientUserAgent` to FormSubmissionJobData, emit Lead after createContact
- `packages/invoices/package.json` — add `@mjagency/meta-capi` dep
- `packages/invoices/src/workers/invoice-worker.ts` — import enqueueCapiEvent, emit Purchase when newStatus === 'paid' with cents→dollars conversion
- `apps/web-main/src/app/api/contact/route.ts` — capture cf-connecting-ip + user-agent, forward to worker
- `apps/web-{ecommerce,growth,webdev,ai,branding,strategy,finance,engineering,product,video,graphic,brand}/src/app/api/contact/route.ts` — same as web-main (12 additional apps)

## Decisions Made

See `key-decisions` in frontmatter for the full list with rationale. Highlights:

- **Standalone `@mjagency/meta-capi` package** instead of folding into `@mjagency/analytics` — Plan 11-01 (GA4) was still in flight scaffolding analytics; creating a separate package decoupled execution and matched the agent prompt's directive ("New package: packages/meta-capi/").
- **No `facebook-nodejs-business-sdk`** — bundle weight + Edge incompatibility unjustified for a single REST endpoint.
- **`jobId = event_id`** — BullMQ once-only processing dovetails with Meta's server-side event_id dedup. Retries cannot produce duplicate Lead/Purchase events.
- **Lead emits in form-worker, not /api/contact** — the route enqueues a job; CRM write happens in the worker. CAPI Lead must run AFTER createContact() so the Payload contact id can serve as `external_id`.
- **Purchase only on `'paid'`**, not on `'partial'` — analytics intent is the conversion event, not every payment chunk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created `@mjagency/meta-capi` package instead of placing files in `packages/analytics/`**

- **Found during:** Task T-01 (package scaffolding)
- **Issue:** Plan 11-03 instructs files into `packages/analytics/` and assumes Plan 11-01 (`getAgencySecret` from `@mjagency/config`, scaffolded analytics package) is complete. At execution time, Plan 11-01 was in-flight — `analytics/src/` was empty and `getAgencySecret` did not exist in `@mjagency/config`. The agent execution prompt also explicitly directed `New package: packages/meta-capi/`.
- **Fix:** Created standalone `@mjagency/meta-capi` workspace package with a local `per-agency-env.ts` providing `getAgencySecret` / `getAgencySecretOptional` using the project-wide hyphen-normalization convention (`agencyId.replaceAll('-','_').toUpperCase()`). When Plan 11-01's helper lands in `@mjagency/config`, both implementations agree on the env-var contract — no migration needed.
- **Files modified:** `packages/meta-capi/src/per-agency-env.ts` (new), `packages/meta-capi/package.json` (new — depends on @mjagency/{ai,config,queue})
- **Verification:** `pnpm install --filter=@mjagency/meta-capi` succeeded; 26 unit tests pass.
- **Committed in:** `e8e244c` (T-01 files swept into parallel commit)

**2. [Rule 3 - Blocking] Wired Lead emission into `form-worker.ts` instead of nonexistent `submit-form.ts`**

- **Found during:** Task T-02 (locating Phase 9 form submit path)
- **Issue:** Plan T-02 references `packages/forms/src/actions/submit-form.ts` and `packages/invoices/src/workers/payment-success.ts`. Neither file exists. Phase 9's actual architecture is: 13 `apps/web-*/src/app/api/contact/route.ts` enqueue a `form-submissions` BullMQ job → `packages/forms/src/workers/form-worker.ts` performs Payload CRM write. The CAPI Lead event must follow CRM write so the contact id can be used as `external_id`.
- **Fix:** Wired `enqueueCapiEvent('Lead', …)` into `form-worker.ts` after `contactRes.ok`. Added `clientIp` + `clientUserAgent` to `FormSubmissionJobData` so the worker has the Pitfall 3.5 ip+ua fallback identifier; populated those fields in all 13 `/api/contact` route handlers from `cf-connecting-ip` + `user-agent` request headers.
- **Files modified:** `packages/forms/src/workers/form-worker.ts`, 13 `apps/web-*/api/contact/route.ts`
- **Verification:** `grep enqueueCapiEvent packages/forms/` returns 2 matches (import + call site).
- **Committed in:** `ed23ed4`

**3. [Rule 3 - Blocking] Wired Purchase emission into `invoice-worker.ts` instead of nonexistent `payment-success.ts`**

- **Found during:** Task T-02 (locating Phase 10 invoice paid handler)
- **Issue:** Plan referenced `packages/invoices/src/workers/payment-success.ts` which doesn't exist. Actual file is `packages/invoices/src/workers/invoice-worker.ts` handling `checkout.session.completed`.
- **Fix:** Added `enqueueCapiEvent('Purchase', …)` after `invoices` PATCH succeeds and `newStatus === 'paid'`. Customer email/phone read from `session.customer_details`; `value` computed from `session.amount_total / 100` (cents → dollars); `currency` from `session.currency`; `external_id = invoice.id`.
- **Files modified:** `packages/invoices/src/workers/invoice-worker.ts`
- **Verification:** `grep enqueueCapiEvent packages/invoices/` returns 2 matches.
- **Committed in:** `ed23ed4`

**4. [Rule 2 - Missing Critical] Defense-in-depth `redactPii()` applied to `custom_data` strings**

- **Found during:** Task T-01 (sendCapiEvent design review)
- **Issue:** Plan 11-03 hashes `em`/`ph` per Meta spec but `custom_data` is free-form. A caller could put a raw email into `custom_data.note` (e.g., for support workflow context). Per Phase 7 PII discipline (REQ-084), all outbound third-party content should be tokenized.
- **Fix:** Apply `redactPii()` (from `@mjagency/ai`) to every string value in `custom_data` before send. Numbers/booleans/objects pass through unchanged. `user_data` is NOT redacted — em/ph SHA-256 hashing inside sendCapiEvent is the spec-correct normalization.
- **Files modified:** `packages/meta-capi/src/meta-capi.ts`
- **Verification:** Test "redacts PII inadvertently placed in custom_data string fields" passes — `john@example.com` in note becomes `[EMAIL_1]`.
- **Committed in:** `e8e244c`

---

**Total deviations:** 4 auto-fixed (3 Rule 3 blocking, 1 Rule 2 missing critical)
**Impact on plan:** All four were necessary. Rules 3 (#1-3) handled real path/dependency drift between plan-time assumptions and current codebase. Rule 2 (#4) added security hardening already established by Phase 7. No scope creep — all changes serve REQ-142.

## Issues Encountered

- **T-01 files swept into commit `e8e244c` (parallel 11-02 agent).** The 11-02 agent ran `git add` while my T-01 files were untracked-but-on-disk; its commit picked up `packages/meta-capi/**` along with its Clarity files. Net effect: my T-01 atomic commit step did not produce a dedicated commit. Files are correctly tracked and reachable on `main`. T-02 was committed cleanly as `ed23ed4`.
- Pre-existing typecheck failures in `@mjagency/db` (Drizzle PgPolicyToOption typing, Stripe API version mismatch) and `@mjagency/forms` (no tsconfig.json) — these are out-of-scope per scope_boundary; my changes do not introduce new typecheck errors.

## Verification Results

- `grep "graph\.facebook\.com" packages/meta-capi/src/` → matches in `meta-capi.ts:106,147` and `index.ts:8`
- `grep "v22\.0" packages/meta-capi/src/` → matches in `meta-capi.ts:60` (constant) and tests
- `grep "createHash\('sha256'\)" packages/meta-capi/src/` → match in `meta-capi.ts`
- `grep "facebook-nodejs-business-sdk" packages/meta-capi/` → only in comment explaining why we DON'T use it; package.json has 0 matches
- `grep "sensitiveData: true" packages/meta-capi/src/` → match in `meta-capi-queue.ts:67`
- `grep "facebook|fbevents" packages/auth/src/security-headers.ts` → 0 matches (D-10)
- `grep "facebook\.com|connect\.facebook|fbevents" packages/auth/src/middleware.ts` → 0 matches (D-10)
- `grep "enqueueCapiEvent" packages/forms/` → 2 matches (import + call after createContact)
- `grep "enqueueCapiEvent" packages/invoices/` → 2 matches (import + call when paid)
- `pnpm install --filter=@mjagency/meta-capi` → success
- `npx vitest run` (in `packages/meta-capi/`) → 26/26 tests pass
- `pnpm typecheck --filter=@mjagency/meta-capi` → fails ONLY on pre-existing `@mjagency/db` errors transitively pulled in; no errors originate in `packages/meta-capi/src/` itself.

## User Setup Required

For each agency, set the following Doppler secrets (US-only v1, 11 agencies + brand):

```
META_PIXEL_ID_BRAND, META_PIXEL_ID_ECOMMERCE, META_PIXEL_ID_GROWTH, … (12 total)
META_ACCESS_TOKEN_BRAND, META_ACCESS_TOKEN_ECOMMERCE, … (12 total)
# Optional, dev/staging only — production env MUST NOT set:
META_TEST_EVENT_CODE_BRAND, … (per-agency, dev only)

BULLMQ_ENCRYPTION_KEY  # already required by Plan 02 / Phase 9
REDIS_HOST, REDIS_PORT  # already required by Phase 2
```

Each Meta access token should be a long-lived **System User** token (not a regular user token) per Meta CAPI best practice. Document rotation policy (90-day expiry, alert at 7 days remaining) in `docs/runbooks/meta-capi-rotation.md` — deferred to phase 12 runbooks per threat register T-11-03-08 disposition.

## Threat Flags

None. No new threat surface introduced beyond what's tracked in the plan's `<threat_model>` register (T-11-03-01 through T-11-03-10). All 10 threats have implemented mitigations:

- T-11-03-01..03 (Information Disclosure / Phone normalization): SHA-256 hashing + Meta-spec phone normalization, unit tested
- T-11-03-04 (event_time ms): unit tested with `<10s` assertion
- T-11-03-05 (test_event_code in prod): unit tested for absence when env var unset
- T-11-03-06 (untraced retries): jobId = event_id; Pino log per success/failure
- T-11-03-07 (DoS cascade to form): try/catch non-fatal wrapper
- T-11-03-08 (token expiry): runbook deferred to phase 12 (acknowledged in plan)
- T-11-03-09 (Redis dump): sensitiveData: true → AES-GCM-256
- T-11-03-10 (missing identifier): unit tested — throws when no em/ph/ip+ua/external_id

## Next Phase Readiness

- Lead + Purchase paths shipping. Phase 9 form workflow continues to function whether or not Meta secrets are set (try/catch wrapper).
- Plan 11-01 (GA4) and Plan 11-02 (Clarity) shipped in parallel — three-way analytics coverage now complete.
- Plan 11-04 (consent banner) will gate emission of all three (GA4, Clarity, Meta CAPI). Today's CAPI fires unconditionally; Plan 11-04 will add consent gating before sending. The `enqueueCapiEvent` call site is the natural insertion point for the consent check.
- Plan 11-05 (CCPA delete) will fan out to all three providers — Meta CAPI exposes a `DeleteUser` event_name path through `sendCapiEvent` which Plan 11-05 can call directly.
- Doppler secret bootstrap pending operator action (see User Setup Required above).

## Self-Check: PASSED

- Files created: `packages/meta-capi/{package.json,tsconfig.json,vitest.config.ts,src/{index,meta-capi,meta-capi-queue,per-agency-env}.ts,src/__tests__/meta-capi.test.ts,src/__tests__/meta-capi-queue.test.ts}` — all FOUND
- Files modified: `packages/forms/package.json`, `packages/forms/src/workers/form-worker.ts`, `packages/invoices/package.json`, `packages/invoices/src/workers/invoice-worker.ts`, 13 contact routes — all FOUND
- Commits: `e8e244c` (T-01 files, swept by 11-02 parallel agent) — FOUND; `ed23ed4` (T-02) — FOUND

---
*Phase: 11-analytics-security*
*Completed: 2026-04-28*
