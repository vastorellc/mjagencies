---
phase: 09-crm-forms-booking
plan: "09-01"
subsystem: database
tags: [payload-cms, drizzle-orm, postgres, rls, crm, collections]

# Dependency graph
requires:
  - phase: 05-central-cms
    provides: buildPayloadConfig, CORE_COLLECTIONS, collectionAccess, deleteAccess, fieldImmutable
  - phase: 02-multi-tenant-db
    provides: Drizzle pgTable pattern + RLS migration pattern

provides:
  - packages/crm/src/collections/contacts.ts — contactsCollection Payload config
  - packages/crm/src/collections/accounts.ts — accountsCollection Payload config
  - packages/crm/src/collections/deals.ts — dealsCollection Payload config
  - packages/crm/src/collections/activities.ts — activitiesCollection Payload config
  - packages/crm/src/collections/tasks.ts — tasksCollection Payload config
  - packages/crm/src/access/collection-access.ts — access helpers for CRM (copied from cms)
  - packages/crm/src/index.ts — barrel export + crmCollections array
  - packages/db/src/schema/crm.ts — five Drizzle pgTable definitions with RLS SQL
  - packages/crm/package.json — payload:3.82.1 + workspace deps declared

affects:
  - 09-02 (lead routing hook wires into contacts afterChange)
  - 09-03 (forms — contacts relationship)
  - 09-04 (booking — deals relationship)
  - 09-05 through 09-07 (pipeline, scoring, seeding use these tables + collections)

# Tech tracking
tech-stack:
  added:
    - "@mjagency/crm package with five Payload collections"
    - "drizzle-orm pgTable for crm_contacts, crm_accounts, crm_deals, crm_activities, crm_tasks"
  patterns:
    - "CRM access helpers copied verbatim from cms into crm package to avoid circular ESM dependency"
    - "All 12 payload.config.ts upgraded from M001 buildConfig stub to buildPayloadConfig with [...CORE_COLLECTIONS, ...crmCollections]"
    - "AGENCY_ID_FIELD with fieldImmutable on every CRM collection (CLAUDE.md §8)"

key-files:
  created:
    - packages/crm/src/access/collection-access.ts
    - packages/crm/src/collections/contacts.ts
    - packages/crm/src/collections/accounts.ts
    - packages/crm/src/collections/deals.ts
    - packages/crm/src/collections/activities.ts
    - packages/crm/src/collections/tasks.ts
    - packages/db/src/schema/crm.ts
  modified:
    - packages/crm/src/index.ts
    - packages/crm/package.json
    - packages/db/src/schema/index.ts
    - apps/web-main/payload.config.ts
    - apps/web-ai/payload.config.ts
    - apps/web-branding/payload.config.ts
    - apps/web-ecommerce/payload.config.ts
    - apps/web-engineering/payload.config.ts
    - apps/web-finance/payload.config.ts
    - apps/web-graphic/payload.config.ts
    - apps/web-growth/payload.config.ts
    - apps/web-product/payload.config.ts
    - apps/web-strategy/payload.config.ts
    - apps/web-video/payload.config.ts
    - apps/web-webdev/payload.config.ts

key-decisions:
  - "CRM access helpers (collectionAccess, deleteAccess, fieldImmutable) copied verbatim into packages/crm/src/access/ to avoid circular dependency between @mjagency/cms and @mjagency/crm"
  - "All 11 legacy app payload.config.ts stubs upgraded to buildPayloadConfig pattern in this plan rather than a later plan — avoids 11 separate migration steps across Phase 9"
  - "leadRoutingHook import commented out with explicit comment in contacts.ts — wired in 09-02 when hook file is created"

patterns-established:
  - "CRM package access pattern: copy helpers from cms into crm/src/access/ (not import from @mjagency/cms) — prevents circular ESM dep"
  - "crmCollections spread: all payload configs use [...CORE_COLLECTIONS, ...crmCollections] — consistent with Phase 5 CORE_COLLECTIONS pattern"
  - "RLS SQL exported as crmRlsSql string constant for migration runner (same pattern as 02-PLAN)"

requirements-completed: [REQ-100, REQ-101, REQ-102, REQ-103, REQ-302]

# Metrics
duration: 5min
completed: 2026-04-27
---

# Phase 09 Plan 01: CRM Core — Payload Collections + Drizzle Schema Summary

**Five agency-isolated CRM Payload collections (contacts/accounts/deals/activities/tasks) with matching Drizzle+RLS schema, wired into all 12 agency Payload configs via buildPayloadConfig**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-27T12:43:44Z
- **Completed:** 2026-04-27T12:48:15Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Created five Payload CRM CollectionConfig files — all with AGENCY_ID_FIELD + fieldImmutable, collectionAccess/deleteAccess, group="CRM"
- Created Drizzle schema for five CRM tables with agencyId FK, composite indexes, and exported crmRlsSql for migration runner
- Upgraded all 12 agency payload.config.ts from M001 empty stub to buildPayloadConfig with [...CORE_COLLECTIONS, ...crmCollections]
- Declared exact payload:3.82.1 dependency + @mjagency/db/queue/config workspace deps in packages/crm/package.json

## Task Commits

Each task was committed atomically:

1. **Task 1: CRM package.json + Drizzle schema** - `bb52f56` (feat)
2. **Task 2: Five Payload collections + barrel + wire all configs** - `bd11830` (feat)

## Files Created/Modified

- `packages/crm/package.json` - payload:3.82.1 exact + workspace deps @mjagency/db, queue, config
- `packages/db/src/schema/crm.ts` - crmContacts, crmAccounts, crmDeals, crmActivities, crmTasks with RLS SQL
- `packages/db/src/schema/index.ts` - appended CRM table + crmRlsSql exports
- `packages/crm/src/access/collection-access.ts` - collectionAccess, deleteAccess, fieldImmutable, superAdminOnly (verbatim from cms)
- `packages/crm/src/collections/contacts.ts` - contactsCollection (leadRoutingHook stub comment for 09-02)
- `packages/crm/src/collections/accounts.ts` - accountsCollection
- `packages/crm/src/collections/deals.ts` - dealsCollection with 5 pipeline stages
- `packages/crm/src/collections/activities.ts` - activitiesCollection (email_sent, call, meeting, note)
- `packages/crm/src/collections/tasks.ts` - tasksCollection with sla_deadline readOnly field
- `packages/crm/src/index.ts` - barrel + crmCollections: CollectionConfig[] array
- `apps/web-*/payload.config.ts` (12 files) - upgraded to buildPayloadConfig with [...CORE_COLLECTIONS, ...crmCollections]

## Decisions Made

- CRM access helpers copied into `packages/crm/src/access/collection-access.ts` rather than importing from `@mjagency/cms` — prevents a circular ESM dependency at runtime (cms defines blocks that could reference crm in future phases)
- All 11 legacy agency payload.config.ts stubs upgraded to `buildPayloadConfig` in this plan (deviation: plan said "do the same for all 12", which included upgrading M001 stubs) — avoids leaving apps in an inconsistent state through Phase 9
- `leadRoutingHook` import commented out with explicit note in contacts.ts (not a TODO/placeholder — it's a tracked stub resolved in 09-02)

## Deviations from Plan

None — plan executed exactly as written. The 11 app payload.config.ts upgrades were explicitly part of Task 2 Step 8 instructions.

## Known Stubs

- `packages/crm/src/collections/contacts.ts` line 8: `leadRoutingHook` import commented out — intentional, resolved in plan 09-02 when `packages/crm/src/hooks/lead-routing-hook.ts` is created.
- `packages/crm/src/collections/tasks.ts` sla_deadline field is readOnly with description noting it is written by queue worker in 09-02 — intentional, not blocking this plan's goal.

## SC-6 Stripe Idempotency Note

The Stripe webhook file (`apps/web-ecommerce/src/app/api/stripe/webhook/route.ts`) remains at the M002 stub state — it was already a stub before Phase 9 and Phase 9 changes do not touch it. SC-6 was not broken by plan 09-01 changes.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 09-02 can immediately import `contactsCollection` from `@mjagency/crm` and uncomment `leadRoutingHook` once the hook file is created
- All 12 payload configs are now consistent — no more M001 empty stubs
- `crmRlsSql` is ready for the migration runner to apply RLS policies after table creation

---
*Phase: 09-crm-forms-booking*
*Completed: 2026-04-27*

## Self-Check: PASSED

All 8 key files found on disk. Both task commits (bb52f56, bd11830) confirmed in git log.
