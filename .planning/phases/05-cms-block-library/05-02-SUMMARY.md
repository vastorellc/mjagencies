---
phase: 05-cms-block-library
plan: "02"
subsystem: cms-collections
tags:
  - payload-cms
  - collections
  - content-validators
  - bullmq
  - agency-isolation
dependency_graph:
  requires:
    - "05-01 (buildPayloadConfig, collection-access.ts)"
    - "packages/queue (createEncryptedQueue)"
    - "packages/config (REDIS_KEY.bullPrefix)"
  provides:
    - "CORE_COLLECTIONS array (11 Payload CollectionConfig objects)"
    - "content validator hooks (5 beforeOperation hooks)"
    - "schedulePublishHook (afterChange BullMQ enqueue)"
    - "collection-access.ts helpers (collectionAccess, deleteAccess, fieldImmutable, superAdminOnly)"
    - "buildPayloadConfig factory"
  affects:
    - "apps/web-main/payload.config.ts (uses CORE_COLLECTIONS)"
    - "05-03 block library (needs pages/posts collections to reference)"
    - "05-04 Lexical editor (adds richText config to pages/posts)"
    - "05-06 content sprint (writes to these collections via Payload local API)"
tech_stack:
  added:
    - "payload@3.82.1 (peer dep on @mjagency/cms)"
    - "@mjagency/cms now has dependencies on @mjagency/queue and @mjagency/config"
  patterns:
    - "Payload CollectionBeforeOperationHook for publish-gate validators"
    - "Payload CollectionAfterChangeHook for BullMQ scheduled publish"
    - "fieldImmutable pattern for agency_id access.update = () => false"
    - "Where clause return from Access functions for agency-scoped list filtering"
key_files:
  created:
    - packages/cms/src/hooks/content-validators.ts
    - packages/cms/src/hooks/scheduled-publish.ts
    - packages/cms/src/access/collection-access.ts
    - packages/cms/src/config/build-payload-config.ts
    - packages/cms/src/collections/pages.ts
    - packages/cms/src/collections/posts.ts
    - packages/cms/src/collections/authors.ts
    - packages/cms/src/collections/categories.ts
    - packages/cms/src/collections/media-assets.ts
    - packages/cms/src/collections/tools.ts
    - packages/cms/src/collections/forms.ts
    - packages/cms/src/collections/redirects.ts
    - packages/cms/src/collections/settings.ts
    - packages/cms/src/collections/templates.ts
    - packages/cms/src/collections/global-blocks.ts
    - packages/cms/src/collections/index.ts
    - packages/cms/src/__tests__/content-validators.test.ts
  modified:
    - packages/cms/src/index.ts
    - packages/cms/package.json
    - apps/web-main/payload.config.ts
    - apps/web-main/package.json
decisions:
  - "buildPayloadConfig requires db and editor as explicit parameters — keeps @mjagency/cms free of @payloadcms/* deps; apps supply adapters"
  - "staticURL removed from media_assets upload config — not in Payload 3.82.1 UploadConfig type"
  - "hasExactFigures regex uses negative lookbehind (?<!\\d[-–]) to not flag trailing number in ranges like 30-45%"
  - "Test helper casts via unknown as Parameters<CollectionBeforeOperationHook>[0] to avoid deeply-generic Payload arg type mismatch"
metrics:
  duration: "21m"
  completed: "2026-04-26"
  tasks: 4
  files_created: 17
  files_modified: 4
  tests: 27
---

# Phase 05 Plan 02: Core CMS Collections + Content Validators Summary

**One-liner:** 11 Payload 3.82.1 CollectionConfig files + 5 publish-gate validators + BullMQ scheduled-publish hook + 27 Vitest unit tests covering all FTC/REQ compliance rules.

## What Was Built

### Task 1: Content Validator Hooks + Scheduled Publish Hook

**packages/cms/src/hooks/content-validators.ts** — 5 `CollectionBeforeOperationHook` exports:

| Hook | Requirement | Behavior |
|------|-------------|----------|
| `validateWordCount` | REQ-201 | Throws on publish if word count < floor (blog 1500, service 1500, tool 2200, cornerstone 3000); warns on draft |
| `validateInternalLinks` | REQ-203 | Throws on publish if internal link count < 3; warns on draft |
| `validatePlaybookNumbers` | REQ-205, REQ-411 | Throws on publish if composite playbook has exact percentages (e.g. "47%"); ranges ("30-45%") allowed |
| `validateFtcDisclaimer` | REQ-207, REQ-410, REQ-412 | Throws on publish if `is_composite_playbook=true` and FTC disclaimer text absent |
| `validateFtcTestimonial` | REQ-421 | Throws on publish if testimonial block present without FTC testimonial disclaimer |

FTC disclaimer exact text: `"Results not typical. Individual results may vary based on market conditions, industry, and individual effort."`

FTC testimonial exact text: `"Individual results may vary. Testimonials are not necessarily representative of all users."`

**packages/cms/src/hooks/scheduled-publish.ts** — `schedulePublishHook` `CollectionAfterChangeHook`:
- Fires when `status` transitions to `scheduled` (not on re-save with same status)
- Reads `publish_at` date from doc, calculates `delayMs = Math.max(0, publishAt - now)`
- Enqueues BullMQ job `publish-doc` on queue `cms-scheduled-publish` with agency-namespaced prefix
- Job payload: `{ collection, docId, agencyId, publishAt }` — no PII, not encrypted

**Supporting files also created in this plan (05-01 output not yet in this worktree):**
- `packages/cms/src/access/collection-access.ts` — collectionAccess, deleteAccess, fieldImmutable, superAdminOnly
- `packages/cms/src/config/build-payload-config.ts` — shared Payload config factory

### Task 2: 11 Collection Config Files + CORE_COLLECTIONS

All 11 collections include:
- `agency_id` field: `access.update = fieldImmutable` (immutable after creation, CLAUDE.md §8, REQ-014)
- `created_at`, `updated_at`: Payload auto-generates
- Soft-delete via `archived` status (not `deleteDocument`)

| Collection | Slug | Key Features |
|------------|------|--------------|
| pages | `pages` | is_composite_playbook (REQ-412), status workflow, 20 revisions (REQ-058), all 5 validators |
| posts | `posts` | category + author relationships, 20 revisions, all 5 validators |
| authors | `authors` | person_schema JSON-LD field, social_links array |
| categories | `categories` | hierarchical parent relationship |
| media_assets | `media_assets` | blur_hash, dominant_color, swatches (DAM pipeline), SVG sanitize stub (Plan 05-05) |
| tools | `tools` | benchmark_data JSON, 20 revisions, word-count validator |
| forms | `forms` | fields_config JSON, spam_protection (honeypot/recaptcha/turnstile) |
| redirects | `redirects` | 301/302, broken link tracking |
| settings | `settings` | delete: superAdminOnly (T-05-02-03 threat mitigation) |
| templates | `templates` | blocks_json for Puck output (Plan 05-04) |
| global_blocks | `global_blocks` | edit-once/propagate-everywhere (REQ-059), last_propagated_at |

### Task 3: Wire CORE_COLLECTIONS into web-main

`apps/web-main/payload.config.ts` now imports from `@mjagency/cms`:
```typescript
import { buildPayloadConfig, CORE_COLLECTIONS } from '@mjagency/cms'
export default buildPayloadConfig({ ..., collections: CORE_COLLECTIONS, db, editor })
```

### Task 4: 27 Vitest Unit Tests

`packages/cms/src/__tests__/content-validators.test.ts` — 27 tests, all passing:
- validateWordCount: 7 tests (word floors for blog/service/tool, draft vs publish, exact/below/above)
- validateInternalLinks: 5 tests (< 3, = 3, > 3, external not counted, draft mode)
- validatePlaybookNumbers: 4 tests (exact figure, range allowed, non-playbook exempt, draft mode)
- validateFtcDisclaimer: 5 tests (missing disclaimer, exact text, non-playbook, draft mode, FTC_DISCLAIMER_TEXT constant)
- validateFtcTestimonial: 6 tests (hasTestimonials flag, grid block type, with/without disclaimer, FTC_TESTIMONIAL_DISCLAIMER constant)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] collection-access.ts and build-payload-config.ts were missing**
- **Found during:** Task 1 (hooks import from collection-access.ts, index.ts exports buildPayloadConfig)
- **Issue:** Plan 05-01 creates these files, but 05-02 runs in a parallel worktree where 05-01 hasn't been merged yet
- **Fix:** Created `packages/cms/src/access/collection-access.ts` and `packages/cms/src/config/build-payload-config.ts` inline
- **Files modified:** packages/cms/src/access/collection-access.ts, packages/cms/src/config/build-payload-config.ts
- **Commit:** a07dd60

**2. [Rule 1 - Bug] Payload 3.82.1 UploadConfig does not have `staticURL` property**
- **Found during:** Task 2 — typecheck error TS2353 on media-assets.ts
- **Issue:** Plan spec included `staticURL: '/media'` in upload config but this field doesn't exist in Payload 3.82.1's `UploadConfig` type
- **Fix:** Removed `staticURL` from media-assets.ts upload config; `staticDir: 'media'` remains (Payload uses storage adapters for URL generation)
- **Files modified:** packages/cms/src/collections/media-assets.ts
- **Commit:** dc6c8bb

**3. [Rule 1 - Bug] `hasExactFigures` regex incorrectly flagged trailing number in range like "30-45%"**
- **Found during:** Task 4 — test failure: `validatePlaybookNumbers` threw on "Typical results: 30-45% improvement."
- **Issue:** Pattern `/\b(\d{1,3})\s*%(?!\s*[-–]\s*\d)/g` matched `45%` as an exact figure (no lookbehind for the hyphen prefix)
- **Fix:** Added negative lookbehind: `/(?<!\d[-–])\b(\d{1,3}(?:\.\d+)?)\s*%(?!\s*[-–]\s*\d)/g`
- **Files modified:** packages/cms/src/hooks/content-validators.ts
- **Commit:** fc81fda

**4. [Rule 1 - Bug] Test helper type incompatible with Payload's deeply-generic CollectionBeforeOperationHook**
- **Found during:** Task 4 — typecheck error TS2345 on callHook helper
- **Issue:** `Parameters<CollectionBeforeOperationHook>[0]` resolves to a deeply-generic type tied to collection slugs; direct cast was invalid
- **Fix:** Use `as unknown as Parameters<CollectionBeforeOperationHook>[0]` double-cast
- **Files modified:** packages/cms/src/__tests__/content-validators.test.ts
- **Commit:** ad544e1

**5. [Rule 3 - Blocking] @mjagency/cms not installed in worktree node_modules**
- **Found during:** Task 1 setup
- **Issue:** Worktree had no node_modules; pnpm install needed with --no-frozen-lockfile (package.json changes added payload as peer dep + queue/config as deps)
- **Fix:** Added payload as peer/dev dep, @mjagency/queue and @mjagency/config as deps; ran pnpm install
- **Commit:** a07dd60

**6. [Rule 3 - Blocking] buildPayloadConfig design change — requires db + editor as params**
- **Found during:** Task 3
- **Issue:** Original plan template showed buildPayloadConfig as a thin wrapper that auto-creates db/editor adapters, but @payloadcms/db-postgres and @payloadcms/richtext-lexical are not deps of @mjagency/cms (only of app packages)
- **Fix:** buildPayloadConfig accepts `db` and `editor` as required parameters; apps pass their own adapters. This keeps @mjagency/cms free of heavy @payloadcms/* dependencies
- **Files modified:** packages/cms/src/config/build-payload-config.ts, apps/web-main/payload.config.ts

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| SVG sanitization | packages/cms/src/collections/media-assets.ts | `svgSanitizeHook` logs a warning; DOMPurify + SVGO pipeline implemented in Plan 05-05 (REQ-305) |
| Lexical richText config | pages.ts, posts.ts, tools.ts, forms.ts | `type: 'richText'` with no feature config; Plan 05-04 adds full Lexical feature set |
| BlurHash/color-thief pipeline | media-assets.ts | blur_hash/dominant_color/swatches fields exist but are readOnly; upload pipeline in Plan 05-05 |

## Deferred Issues

Pre-existing typecheck errors in dependent packages (NOT caused by this plan, out of scope):
- `packages/config/src/otel-node.ts` — @opentelemetry/semantic-conventions exports changed (ATTR_SERVICE_NAMESPACE missing)
- `packages/db/src/schema/*.ts` — SQL<unknown> not assignable to PgPolicyToOption (Drizzle RLS type mismatch)

These are pre-existing issues tracked separately and should be resolved by the plans that own those packages.

## Threat Mitigations Applied (T-05-02-*)

| Threat | Mitigation |
|--------|-----------|
| T-05-02-01 Spoofing via agency_id | `access.update: fieldImmutable` on every collection; Where clause for list filtering |
| T-05-02-02 Tampering with validators | Validators throw Error — Payload's hook system propagates the error, blocking the operation |
| T-05-02-03 Elevation via settings delete | `delete: superAdminOnly` on settings collection |
| T-05-02-04 PII in scheduled publish queue | Job payload contains only collection slug, docId, agencyId, publishAt — no user data |
| T-05-02-05 DoS via word-count O(n) | Accepted — document saves are infrequent; O(n) on typical document size is <1ms |

## Self-Check: PASSED

All 18 created/modified files verified present on disk.
All 5 task commits verified in git log (a07dd60, dc6c8bb, 9643092, fc81fda, ad544e1).
27/27 Vitest unit tests passing.
0 cms-specific TypeScript errors (pre-existing errors in @mjagency/config and @mjagency/db are out of scope).
