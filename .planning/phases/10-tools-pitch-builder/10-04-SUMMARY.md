---
phase: 10
plan: "10-04"
subsystem: proposals
tags: [proposals, payload, drizzle, bullmq, view-tracking, expiry-worker, hmac, public-routes]
dependency_graph:
  requires: [10-01]
  provides: [proposals-package, proposal-public-routes, proposal-expiry-worker]
  affects: [10-05-e-sign, 10-06-invoicing]
tech_stack:
  added:
    - "@mjagency/proposals workspace package (Payload 3.82.1)"
    - "packages/db/src/schema/proposals.ts — Drizzle pgTable for proposals + proposal_views"
    - "BullMQ encrypted worker for daily proposal expiry (proposal-expiry queue)"
    - "HMAC-SHA256 form token verification with timingSafeEqual"
  patterns:
    - "randomBytes(32) — 32-byte hex proposal token (256-bit entropy)"
    - "SHA-256 IP hashing — ip_hash stored, raw IP never persisted"
    - "Cloudflare geo headers: cf-ipcity / cf-ipcountry"
    - "Two-step decline via HTML <details>/<summary>"
    - "Email warm-up gate: isEmailWarmupComplete() before proposal notifications"
    - "REQ-134 warm-up: default false — blocks email until 35-day warm-up confirmed"
key_files:
  created:
    - packages/proposals/package.json
    - packages/proposals/tsconfig.json
    - packages/proposals/src/index.ts
    - packages/proposals/src/access/collection-access.ts
    - packages/proposals/src/collections/proposals.ts
    - packages/proposals/src/collections/proposal-views.ts
    - packages/proposals/src/actions/create-proposal.ts
    - packages/proposals/src/actions/update-proposal-status.ts
    - packages/proposals/src/workers/expiry-worker.ts
    - packages/db/src/schema/proposals.ts
    - apps/web-ecommerce/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-realestate/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-healthcare/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-legal/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-homeservices/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-fitness/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-dental/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-automotive/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-restaurant/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-education/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-financial/src/app/(frontend)/proposals/[token]/page.tsx
    - apps/web-petcare/src/app/(frontend)/proposals/[token]/page.tsx
  modified:
    - packages/db/src/schema/index.ts (added proposals/proposalViews/proposalsRlsSql exports)
decisions:
  - "collection-access.ts copied verbatim from packages/cms (not imported) — avoids circular dependency"
  - "Expiry worker also transitions viewed→expired (plan only mentioned active→expired, but viewed status also expires)"
  - "Payload migration skipped in worktree — no payload.config.ts or DB connection in this environment; DDL captured in proposalsRlsSql export"
metrics:
  duration: "541 seconds (~9 minutes)"
  completed_date: "2026-04-27T22:18:21Z"
  tasks_completed: 3
  files_created: 22
  files_modified: 1
---

# Phase 10 Plan 04: Proposal Builder — Hosted Page, View Tracking, 14-Day Expiry Summary

**One-liner:** Payload proposals collection with 7-state machine (active/viewed/signed/declined/expired/grace/nurture), 12 per-agency public hosted proposal pages with SHA-256 IP hashing + geo tracking, HMAC-signed form tokens, daily BullMQ expiry worker, and REQ-134 email warm-up gate.

## What Was Built

### T-01: packages/proposals package + Drizzle schema (commit `7feb45e`)

Created the `@mjagency/proposals` workspace package from scratch:

- `package.json` with `"payload": "3.82.1"` (exact pinning, CLAUDE.md Rule 1 enforced)
- `tsconfig.json` extending `../../tsconfig.base.json`
- `src/access/collection-access.ts` — collectionAccess/deleteAccess/fieldImmutable verbatim copy from packages/cms (avoids circular dependency, matches packages/crm pattern)
- `src/collections/proposals.ts` — 7 status options: active, viewed, signed, declined, expired, grace, nurture. fieldImmutable on agency_id and token
- `src/collections/proposal-views.ts` — ip_hash (required), user_agent, geo_city, geo_state, viewed_at. create: () => true (public view tracking)
- `packages/db/src/schema/proposals.ts` — proposals table with unique token, proposal_views table, RLS SQL policies for both tables
- `packages/db/src/schema/index.ts` appended with proposals/proposalViews/proposalsRlsSql exports

### T-02: Server actions + BullMQ expiry worker (commit `811b87f`)

- `create-proposal.ts` — `'use server'`, `requireSession()` as first non-import line, session.agencyId check, `randomBytes(32).toString('hex')` token, 14d expires_at + 7d grace_ends_at computed on creation
- `update-proposal-status.ts` — `timingSafeEqual` HMAC verification before any state change, `isEmailWarmupComplete()` gates notification email (REQ-134), `createEncryptedQueue` for proposal notifications
- `expiry-worker.ts` — `createEncryptedWorker` daily cron (`0 0 * * *`), transitions active/viewed→expired→grace→nurture in batches of 100, enqueues crm-lead-routing nurture sequence with `sensitiveData: true`

### T-03: 12 per-agency public proposal routes (commit `21eb336`)

All 12 agency apps (ecommerce, realestate, healthcare, legal, homeservices, fitness, dental, automotive, restaurant, education, financial, petcare) have public proposal routes at `src/app/(frontend)/proposals/[token]/page.tsx` with:

- SHA-256 IP hashing: `createHash('sha256').update(rawIp).digest('hex')` — raw IP never stored
- Cloudflare geo headers: `cf-ipcity`, `cf-ipcountry`
- Fire-and-forget view record write (non-fatal `.catch()`)
- HMAC-signed `formToken` via `computeFormToken(token)` passed to both sign and decline forms
- Two-step decline: HTML `<details>`/`<summary>` inline confirmation card — requires explicit second click on "Yes, Decline This Proposal"
- Cross-agency guard: `proposal.agency_id !== AGENCY_SLUG` → `notFound()`
- `cache: 'no-store'` on proposal fetch (always fresh data)
- Active→viewed status transition (fire-and-forget)

## Deviations from Plan

### Auto-fix: Expiry worker transitions viewed→expired (Rule 2 — missing correctness)

The plan only showed active→expired transitions. However, proposals that are in `viewed` state also expire at `expires_at`. The worker was extended to also handle viewed→expired with a separate Payload query.

**Found during:** T-02 implementation
**Fix:** Added `viewedExpiredRes` query in `processExpiryForAgency()` to transition viewed→expired alongside active→expired
**Files modified:** `packages/proposals/src/workers/expiry-worker.ts`

### Deviation: Payload migration skipped (Rule 3 / environment constraint)

`CI=true PAYLOAD_MIGRATING=true npx payload migrate` cannot run in this git worktree. The worktree has no `payload.config.ts` file and no DB connection configured. Running `npx payload migrate` downloads Payload 3.84.1 (not the pinned 3.82.1) and fails to find tsconfig.

**Status:** Migration DDL is captured in `packages/db/src/schema/proposals.ts` as `proposalsRlsSql` constant. The database migration must be run by the pipeline when the branch is merged.

**Impact:** Schema files are complete and correct — only the live DB push is deferred.

## Known Stubs

None. All data flows are wired to Payload REST API with real env var references. No placeholder content per CLAUDE.md Rule 5.

## Threat Flags

No new unplanned security surface. All trust boundary mitigations from the plan's threat model are implemented:

| Threat ID | Mitigation |
|-----------|-----------|
| T-10-04-01 | randomBytes(32) in create-proposal.ts |
| T-10-04-02 | timingSafeEqual in update-proposal-status.ts |
| T-10-04-03 | createHash('sha256') in all 12 route files |
| T-10-04-04 | requireSession() + agencyId check in create-proposal.ts |
| T-10-04-05 | limit=100 batch in expiry-worker.ts |
| T-10-04-06 | Pino log.info with proposalId + action in all state transitions |
| T-10-04-07 | isEmailWarmupComplete() defaults false in update-proposal-status.ts |

## Verification Results

| Check | Result |
|-------|--------|
| `randomBytes(32)` in create-proposal.ts | PASS |
| `timingSafeEqual` in update-proposal-status.ts | PASS |
| `requireSession()` in create-proposal.ts | PASS |
| `ip_hash` in proposal-views collection | PASS |
| `nurture` in expiry-worker.ts | PASS (10 occurrences) |
| `isEmailWarmupComplete` in update-proposal-status.ts | PASS |
| `token unique` in proposals schema | PASS |
| 12 per-agency route files | PASS (12/12) |
| Payload migration | SKIPPED (no DB in worktree) |

## Self-Check: PASSED

Files confirmed present:
- packages/proposals/src/actions/create-proposal.ts — FOUND
- packages/proposals/src/workers/expiry-worker.ts — FOUND
- packages/db/src/schema/proposals.ts — FOUND
- apps/web-ecommerce/src/app/(frontend)/proposals/[token]/page.tsx — FOUND
- (12/12 agency routes) — FOUND

Commits confirmed:
- 7feb45e (T-01 collections + schema)
- 811b87f (T-02 actions + worker)
- 21eb336 (T-03 12 route files)
