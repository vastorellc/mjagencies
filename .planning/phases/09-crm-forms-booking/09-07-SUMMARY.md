---
phase: 09-crm-forms-booking
plan: "09-07"
subsystem: database/seed
tags: [seed, crm, drizzle-orm, vitest, agency-isolation, idempotency]

# Dependency graph
requires:
  - phase: 09-01
    provides: crmContacts, crmDeals, crmActivities Drizzle schema, packages/db/src/schema/crm.ts
  - phase: 09-02
    provides: tagsCollection (Payload slug: tags)
  - phase: 02-04
    provides: SeedStep interface, runSeed, agencyUuid, allSteps pattern

provides:
  - packages/db/src/seed/steps/crm-contacts.ts — crmContactsPreSeedStep (15 contacts per agency)
  - packages/db/src/seed/steps/crm-pipelines.ts — crmPipelinesPreSeedStep (3 deals per agency)
  - packages/db/src/seed/steps/crm-tags.ts — crmTagsPreSeedStep (30 tags per agency)
  - packages/db/src/seed/steps/crm-email-templates.ts — crmEmailTemplatesPreSeedStep (5 templates per agency)
  - packages/db/src/seed/steps/crm-sequences.ts — crmSequencesPreSeedStep (8 sequences, 5 steps each per agency)
  - packages/db/src/seed/steps/crm-attribution.ts — crmAttributionPreSeedStep (3 touch-point activities per agency)
  - packages/db/src/seed/steps/crm-preseed.test.ts — Vitest unit tests for crmContactsPreSeedStep
  - packages/db/src/seed/index.ts — updated allSteps array with all 6 new steps
  - packages/db/src/schema/crm.ts — added uniqueIndex on external_id for crmContacts, crmDeals, crmActivities

affects:
  - Phase 12 launch seed run — allSteps now includes CRM pre-seed steps
  - Any future seed step that assumes CRM tables have data

# Tech tracking
tech-stack:
  added:
    - "6 idempotent SeedStep implementations for CRM pre-seeding (contacts/pipelines/tags/templates/sequences/attribution)"
    - "Vitest unit test for crmContactsPreSeedStep with mock tx pattern"
  patterns:
    - "Niche-specific data for ecommerce/finance/ai; getFallbackContacts() for remaining 9 agencies"
    - "Raw SQL (tx.execute(sql`...`)) for Payload-managed tables (tags, email_templates, email_sequences)"
    - "Drizzle .onConflictDoNothing({ target }) for native Drizzle schema tables (crmContacts/crmDeals/crmActivities)"
    - "ON CONFLICT (agency_id, name) DO NOTHING for tags and email_templates"
    - "INSERT + UPDATE pattern for email_sequences JSONB steps (idempotent convergence)"

key-files:
  created:
    - packages/db/src/seed/steps/crm-contacts.ts
    - packages/db/src/seed/steps/crm-pipelines.ts
    - packages/db/src/seed/steps/crm-tags.ts
    - packages/db/src/seed/steps/crm-email-templates.ts
    - packages/db/src/seed/steps/crm-sequences.ts
    - packages/db/src/seed/steps/crm-attribution.ts
    - packages/db/src/seed/steps/crm-preseed.test.ts
  modified:
    - packages/db/src/seed/index.ts
    - packages/db/src/schema/crm.ts

key-decisions:
  - "uniqueIndex on external_id required for Drizzle .onConflictDoNothing({ target }) to work at runtime"
  - "Raw SQL used for Payload-managed tables (tags/email_templates/email_sequences) — no Drizzle binding available"
  - "email_sequences uses INSERT + unconditional UPDATE pattern (not DO NOTHING) so re-runs always converge JSONB steps to spec"
  - "getFallbackContacts() generates 15 real named contacts with niche-appropriate domains — no placeholders"

# Metrics
duration: 15min
completed: 2026-04-27
---

# Phase 09 Plan 07: Pre-Seeded CRM Data — All 12 Agencies Summary

**6 idempotent SeedStep implementations pre-populating all 12 agencies with niche-appropriate CRM data: 15 contacts, 3 deal pipelines, 30 tags, 5 email templates, 8 email sequences (5 steps each), and 3 attribution records per agency**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-04-27
- **Tasks:** 8
- **Files modified:** 9

## Accomplishments

- Created `crmContactsPreSeedStep` with 15 real contacts per agency — ecommerce (Marcus Oyelaran et al.), finance (Patricia Goldstein et al.), ai (Aisha Okonjo et al.) fully specified; 9 remaining agencies use `getFallbackContacts()` with real names and niche-specific domains
- Created `crmPipelinesPreSeedStep` with 3 niche-specific deal pipeline starters per agency (lead/proposal/negotiation stages)
- Created `crmTagsPreSeedStep` inserting 30 tags per agency via raw SQL — ecommerce/finance/ai/growth fully specified; other 8 agencies use 20 niche-specific tags + 10 standard CRM pipeline tags
- Created `crmEmailTemplatesPreSeedStep` with 5 professional email templates per agency (welcome/follow_up/proposal_sent/won/lost) — ecommerce/finance/ai with bespoke copy; fallback function generates real professional copy for remaining agencies
- Created `crmSequencesPreSeedStep` with 8 drip sequences per agency, each with 5 real-copy steps (240 total steps written) — INSERT + UPDATE JSONB pattern for idempotent convergence
- Created `crmAttributionPreSeedStep` with 3 touch-point activity records per agency (organic/email_sent/meeting)
- Registered all 6 new steps in `allSteps` array in `seed/index.ts`
- Added Vitest unit tests for `crmContactsPreSeedStep` covering 4 slugs (ecommerce/finance/ai/growth) with mock tx

## Task Commits

1. **All tasks committed atomically** — `181affa` (feat)

## Files Created/Modified

- `packages/db/src/seed/steps/crm-contacts.ts` — crmContactsPreSeedStep with 15 contacts per agency
- `packages/db/src/seed/steps/crm-pipelines.ts` — crmPipelinesPreSeedStep with 3 deals per agency
- `packages/db/src/seed/steps/crm-tags.ts` — crmTagsPreSeedStep with 30 tags per agency (raw SQL)
- `packages/db/src/seed/steps/crm-email-templates.ts` — crmEmailTemplatesPreSeedStep with 5 templates per agency (raw SQL)
- `packages/db/src/seed/steps/crm-sequences.ts` — crmSequencesPreSeedStep with 8 sequences x 5 steps (raw SQL)
- `packages/db/src/seed/steps/crm-attribution.ts` — crmAttributionPreSeedStep with 3 touch-point activities
- `packages/db/src/seed/steps/crm-preseed.test.ts` — 5 Vitest unit tests for crmContactsPreSeedStep
- `packages/db/src/seed/index.ts` — allSteps extended with 6 new CRM steps
- `packages/db/src/schema/crm.ts` — uniqueIndex added to external_id on crm_contacts/crm_deals/crm_activities

## Decisions Made

- `uniqueIndex` on `external_id` added to `crmContacts`, `crmDeals`, and `crmActivities` — required for Drizzle `.onConflictDoNothing({ target: col })` to resolve correctly at runtime. Without a unique constraint, PostgreSQL rejects the ON CONFLICT target.
- Raw SQL via `tx.execute(sql`...`)` used for `tags`, `email_templates`, and `email_sequences` — these are Payload-managed collection tables with no Drizzle schema binding in this package
- `email_sequences` uses an INSERT then unconditional UPDATE pattern for the `steps` JSONB column — this ensures re-runs always converge to the same JSON rather than silently skipping the UPDATE when a row already exists
- `getFallbackContacts()` generates names + domains from pre-defined niche domain lists — no placeholder emails, all are realistic company email addresses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added uniqueIndex on external_id columns**
- **Found during:** Task 1 implementation review
- **Issue:** `crmContacts.externalId`, `crmDeals.externalId`, and `crmActivities.externalId` were plain text columns with no unique constraint. Drizzle's `.onConflictDoNothing({ target: col })` requires the target column to have a unique index in PostgreSQL — without it, the `ON CONFLICT` clause would throw a runtime error.
- **Fix:** Added `uniqueIndex('crm_contacts_external_id_idx').on(t.externalId)` (and equivalent for deals/activities) to the pgTable definitions in `packages/db/src/schema/crm.ts`
- **Files modified:** `packages/db/src/schema/crm.ts`
- **Impact:** Schema now correctly declares the unique constraint. `db:generate` will include these indexes in the next migration.

## Known Stubs

None. All seed data is real — no placeholder text, Lorem ipsum, or fabricated statistics.

## Threat Flags

None. Seed files insert read-only test data into CRM tables. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `packages/db/src/seed/steps/crm-contacts.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-pipelines.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-tags.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-email-templates.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-sequences.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-attribution.ts` — FOUND (confirmed by Glob)
- `packages/db/src/seed/steps/crm-preseed.test.ts` — FOUND (confirmed by Glob)
- Commit `181affa` — CONFIRMED in git log
