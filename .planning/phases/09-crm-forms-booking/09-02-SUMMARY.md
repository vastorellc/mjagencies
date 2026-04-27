---
phase: 09-crm-forms-booking
plan: "09-02"
subsystem: crm
tags: [lead-scoring, bullmq, vitest, payload-cms, agency-isolation, hooks]

# Dependency graph
requires:
  - phase: 09-01
    provides: contactsCollection, collectionAccess, deleteAccess, fieldImmutable, packages/crm package skeleton

provides:
  - packages/crm/src/scoring/lead-score.ts — pure computeLeadScore function
  - packages/crm/src/scoring/lead-score.test.ts — 19 Vitest unit tests
  - packages/crm/src/queues/crm-queue.ts — CrmLeadRoutingJobData + createCrmLeadRoutingQueue
  - packages/crm/src/workers/crm-worker.ts — createCrmWorker + addBusinessHours (4h SLA)
  - packages/crm/src/hooks/lead-routing-hook.ts — Payload CollectionAfterChangeHook
  - packages/crm/src/collections/tags.ts — tagsCollection with agency_id immutable
  - packages/crm/src/collections/contacts.ts — leadRoutingHook wired into afterChange
  - packages/crm/src/index.ts — barrel updated with all new exports

affects:
  - 09-03 (forms — contact creation triggers lead routing)
  - 09-05 (booking — lead scores will evolve)
  - 09-06 (Twilio notification dispatch replaces internal BullMQ notify)
  - 09-07 (seeding — contacts will trigger hook on create)

# Tech tracking
tech-stack:
  added:
    - "computeLeadScore: pure function with ICP/behavior/recency/source weights (19 tests)"
    - "createCrmLeadRoutingQueue: encrypted BullMQ queue using REDIS_KEY.bullPrefix agency prefix"
    - "createCrmWorker: BullMQ worker with 4h business-hours SLA (Mon-Fri 09:00-17:00 UTC)"
    - "addBusinessHours: pure utility exported for unit testing (handles weekend+after-hours)"
    - "tagsCollection: sixth Payload CRM collection with agency_id immutable + name required"
  patterns:
    - "leadRoutingHook fires on operation==='create' only — update operations skip to avoid re-queueing"
    - "CRM worker uses dynamic import for @mjagency/db to avoid circular deps at module load"
    - "Notification queue dispatch (crm-notifications) is internal BullMQ only — Twilio added in 09-06"
    - "BullJob<T> local type alias avoids direct bullmq devDep on @mjagency/crm package"

key-files:
  created:
    - packages/crm/src/scoring/lead-score.ts
    - packages/crm/src/scoring/lead-score.test.ts
    - packages/crm/src/queues/crm-queue.ts
    - packages/crm/src/workers/crm-worker.ts
    - packages/crm/src/hooks/lead-routing-hook.ts
    - packages/crm/src/collections/tags.ts
  modified:
    - packages/crm/src/collections/contacts.ts
    - packages/crm/src/index.ts

key-decisions:
  - "leadRoutingHook fires on create only — avoids re-scoring and re-queueing on every contact update"
  - "Default ICP values in hook (medium/acceptable/manager) as placeholder until per-agency ICP mapping is implemented in a later plan"
  - "addBusinessHours exported as a pure utility to enable future unit testing without worker infrastructure"
  - "crm-worker uses dynamic import for @mjagency/db to prevent circular ESM dependency at module load time"
  - "BullJob<T> local type defined in crm-worker.ts to avoid adding bullmq as direct devDep to @mjagency/crm"

patterns-established:
  - "CRM queue pattern: createCrmLeadRoutingQueue(agencyId) + queue.add(..., { sensitiveData: true })"
  - "Business hours SLA: addBusinessHours(new Date(), 4) — Mon-Fri 09:00-17:00 UTC with weekend/EOD advancement"
  - "Internal notification pattern: crm-notifications BullMQ queue — Twilio dispatch deferred to 09-06"

requirements-completed: [REQ-104, REQ-105, REQ-106, REQ-107, REQ-302]

# Metrics
duration: 7min
completed: 2026-04-27
---

# Phase 09 Plan 02: Lead Scoring + Routing + Tags Summary

**Pure lead-score function (ICP*0.40+behavior*0.35+recency*0.15+source*0.10), CollectionAfterChangeHook routing to encrypted BullMQ queue, CRM worker with 4-business-hour SLA timer, and tags Payload collection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-27T19:53:00Z
- **Completed:** 2026-04-27T20:00:04Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created `computeLeadScore` pure function with exact weight formula and all sub-score clamping
- 19 Vitest tests covering all weight paths (ICP tiers, behavior caps, recency buckets, source values, edge cases) — all pass
- Created `createCrmLeadRoutingQueue` factory using `REDIS_KEY.bullPrefix(agencyId)` for per-agency isolation
- Created `leadRoutingHook` Payload `CollectionAfterChangeHook` — fires on `create` only, computes score, enqueues with `sensitiveData: true`
- Wired `leadRoutingHook` into `contacts.ts` `afterChange` array (resolving the stub from 09-01)
- Created `createCrmWorker` with `addBusinessHours` — sets `crmTasks.sla_deadline = now + 4 business hours` (Mon-Fri 09:00-17:00 UTC)
- Internal `crm-notifications` BullMQ queue dispatch for `new-lead-assigned` jobs (Twilio in 09-06)
- Created `tagsCollection` with `agency_id` immutable field and `name` required field
- Updated `crmCollections` array and barrel exports in `index.ts` to include all new modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure lead-score function + Vitest tests** - `b715612` (feat)
2. **Task 2: CRM queue + worker + hook + tags** - `8c67e78` (feat — included in 09-05 worktree merge commit due to parallel execution)

## Files Created/Modified

- `packages/crm/src/scoring/lead-score.ts` — pure computeLeadScore, LeadScoreInput/Weights interfaces, DEFAULT_WEIGHTS
- `packages/crm/src/scoring/lead-score.test.ts` — 19 Vitest tests, all green
- `packages/crm/src/queues/crm-queue.ts` — CrmLeadRoutingJobData, createCrmLeadRoutingQueue
- `packages/crm/src/workers/crm-worker.ts` — createCrmWorker, addBusinessHours, BullJob type alias
- `packages/crm/src/hooks/lead-routing-hook.ts` — leadRoutingHook Payload CollectionAfterChangeHook
- `packages/crm/src/collections/tags.ts` — tagsCollection with agency_id immutable + name required
- `packages/crm/src/collections/contacts.ts` — leadRoutingHook wired into afterChange (stub resolved)
- `packages/crm/src/index.ts` — tagsCollection + scoring/queue/worker/hook barrel exports

## Decisions Made

- `leadRoutingHook` fires on `operation === 'create'` only — prevents re-queueing on every contact update, which would cause duplicate SLA timers
- Default ICP values in the hook (`medium/acceptable/manager`) are intentional placeholders until per-agency ICP mapping is available; the plan spec acknowledges this gap
- `addBusinessHours` is exported as a pure function for future unit testing without requiring worker infrastructure to be running
- CRM worker uses dynamic imports for `@mjagency/db` and schema to prevent circular ESM dependency at module load time
- `BullJob<T>` local type defined in crm-worker.ts rather than adding `bullmq` as a direct devDep — consistent with how the existing queue package isolates BullMQ as its own responsibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed implicit `any` type on job processor parameter**
- **Found during:** Task 2 typecheck
- **Issue:** `createEncryptedWorker<CrmLeadRoutingJobData>` processor `job` parameter resolved to implicit `any` when `@mjagency/queue` module couldn't be resolved in CI typecheck
- **Fix:** Added `BullJob<T>` local type alias and explicit `(job: BullJob<CrmLeadRoutingJobData>)` annotation
- **Files modified:** `packages/crm/src/workers/crm-worker.ts`

**2. [Rule 2 - Missing type safety] Fixed implicit `any` on hook destructure**
- **Found during:** Task 2 typecheck
- **Issue:** `CollectionAfterChangeHook = async ({ doc, operation })` — when `payload` module can't be resolved, hook params become implicit any
- **Fix:** Added explicit inline type `{ doc: Record<string, unknown>; operation: string }` on destructure
- **Files modified:** `packages/crm/src/hooks/lead-routing-hook.ts`

**3. [Parallel execution] Task 2 files committed via 09-05 worktree merge**
- **Found during:** Post-commit verification
- **Issue:** The 09-05 parallel executor's docs commit (`8c67e78`) inadvertently included the Task 2 files as untracked files in that worktree
- **Impact:** Files are correctly committed and on main — work is complete and verifiable
- **Commit:** `8c67e78`

## Known Stubs

- `leadRoutingHook` default ICP values (`medium/acceptable/manager`) — intentional stub until per-agency ICP mapping is implemented. The score will improve as ICP data is collected. Does not block plan goal (routing is functional with defaults).

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Queue encryption uses the established `sensitiveData: true` pattern from `@mjagency/queue`.

## Self-Check: PASSED

All key files confirmed present on disk and in git log:
- `packages/crm/src/scoring/lead-score.ts` — FOUND
- `packages/crm/src/scoring/lead-score.test.ts` — FOUND
- `packages/crm/src/queues/crm-queue.ts` — FOUND
- `packages/crm/src/workers/crm-worker.ts` — FOUND
- `packages/crm/src/hooks/lead-routing-hook.ts` — FOUND
- `packages/crm/src/collections/tags.ts` — FOUND
- Commit `b715612` (Task 1) — CONFIRMED in git log
- Commit `8c67e78` (Task 2) — CONFIRMED in git log
- All 19 Vitest tests — PASSED
