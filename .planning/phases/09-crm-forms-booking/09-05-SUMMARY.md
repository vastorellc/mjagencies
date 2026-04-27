---
phase: 09-crm-forms-booking
plan: "09-05"
subsystem: booking
tags: [cal-com, webhook, hmac, bullmq, redis, idempotency, payload-cms, booking-page, csp-nonce]

# Dependency graph
requires:
  - phase: 09-01
    provides: crmCollections, collectionAccess, deleteAccess, fieldImmutable, Drizzle CRM schema

provides:
  - packages/booking/package.json — @mjagency/booking package with payload:3.82.1, @calcom/embed-react, ioredis
  - packages/booking/src/access/collection-access.ts — access helpers (copied from crm, no circular dep)
  - packages/booking/src/collections/booking-configs.ts — bookingConfigsCollection Payload config
  - packages/booking/src/workers/booking-worker.ts — createBookingWorker BullMQ worker
  - packages/booking/src/index.ts — barrel export (bookingConfigsCollection, createBookingWorker, bookingCollections)
  - apps/web-*/src/app/api/booking/webhook/route.ts — Cal.com webhook receiver (13 apps)
  - apps/web-*/src/app/(frontend)/booking/page.tsx — /booking page with Cal.com inline embed (13 apps)
  - apps/web-*/payload.config.ts — bookingCollections wired into all 12 Payload configs

affects:
  - 09-06 (forms plan may reference booking_configs for form-to-booking flow)
  - 09-07 (seeding may add booking_configs preseed data)

# Tech tracking
tech-stack:
  added:
    - "@mjagency/booking package with Cal.com webhook + BullMQ worker + Payload collection"
    - "@calcom/embed-react ^1.3.0 dependency for Cal.com inline embed"
    - "Cal.com webhook HMAC-SHA256 verification with Node.js timingSafeEqual"
    - "Redis idempotency pattern: agency:<id>:cal:<uid> with 24h TTL"
    - "CSP nonce via crypto.randomUUID() per-render (Phase 11 will wire x-nonce from middleware)"
  patterns:
    - "Cal.com webhook: req.text() raw body BEFORE any JSON parsing (CLAUDE.md §7)"
    - "Booking worker: BOOKING_CREATED creates CRM activity (type:meeting) + task (follow-up, 24h due)"
    - "Booking page: next/script strategy=lazyOnload for Cal.com embed (does not count toward 150KB LCP budget)"
    - "Cal namespace: cal-{agencySlug} per-agency isolation (09-UI-SPEC.md)"
    - "bookingCollections access helpers copied verbatim into packages/booking/src/access/ (same pattern as crm)"

key-files:
  created:
    - packages/booking/package.json
    - packages/booking/src/access/collection-access.ts
    - packages/booking/src/collections/booking-configs.ts
    - packages/booking/src/workers/booking-worker.ts
    - packages/booking/src/index.ts
    - apps/web-ecommerce/src/app/api/booking/webhook/route.ts
    - apps/web-main/src/app/api/booking/webhook/route.ts
    - apps/web-growth/src/app/api/booking/webhook/route.ts
    - apps/web-webdev/src/app/api/booking/webhook/route.ts
    - apps/web-ai/src/app/api/booking/webhook/route.ts
    - apps/web-branding/src/app/api/booking/webhook/route.ts
    - apps/web-strategy/src/app/api/booking/webhook/route.ts
    - apps/web-finance/src/app/api/booking/webhook/route.ts
    - apps/web-engineering/src/app/api/booking/webhook/route.ts
    - apps/web-product/src/app/api/booking/webhook/route.ts
    - apps/web-video/src/app/api/booking/webhook/route.ts
    - apps/web-graphic/src/app/api/booking/webhook/route.ts
    - apps/web-brand/src/app/api/booking/webhook/route.ts
    - apps/web-ecommerce/src/app/(frontend)/booking/page.tsx
    - apps/web-main/src/app/(frontend)/booking/page.tsx
    - apps/web-growth/src/app/(frontend)/booking/page.tsx
    - apps/web-webdev/src/app/(frontend)/booking/page.tsx
    - apps/web-ai/src/app/(frontend)/booking/page.tsx
    - apps/web-branding/src/app/(frontend)/booking/page.tsx
    - apps/web-strategy/src/app/(frontend)/booking/page.tsx
    - apps/web-finance/src/app/(frontend)/booking/page.tsx
    - apps/web-engineering/src/app/(frontend)/booking/page.tsx
    - apps/web-product/src/app/(frontend)/booking/page.tsx
    - apps/web-video/src/app/(frontend)/booking/page.tsx
    - apps/web-graphic/src/app/(frontend)/booking/page.tsx
    - apps/web-brand/src/app/(frontend)/booking/page.tsx
  modified:
    - apps/web-ecommerce/payload.config.ts
    - apps/web-main/payload.config.ts
    - apps/web-growth/payload.config.ts
    - apps/web-webdev/payload.config.ts
    - apps/web-ai/payload.config.ts
    - apps/web-branding/payload.config.ts
    - apps/web-strategy/payload.config.ts
    - apps/web-finance/payload.config.ts
    - apps/web-engineering/payload.config.ts
    - apps/web-product/payload.config.ts
    - apps/web-video/payload.config.ts
    - apps/web-graphic/payload.config.ts

key-decisions:
  - "booking access helpers copied verbatim into packages/booking/src/access/ (not imported from @mjagency/crm) — prevents circular ESM dependency, same pattern established in 09-01"
  - "CSP nonce uses crypto.randomUUID() per-render fallback (CLAUDE.md §7) — Phase 11 will replace with x-nonce header from middleware"
  - "Cal.com embed uses next/script strategy=lazyOnload (not dangerouslySetInnerHTML) — matches CLAUDE.md Puck rules and 09-UI-SPEC.md security constraints"
  - "BOOKING_CANCELLED worker logs event without full activity update — full cancellation lookup deferred to 09-gap (noted in worker code)"
  - "web-brand has no payload.config.ts (it's the brand.com main app, not an agency subdomain) — webhook route created but payload config not modified"

requirements-completed: [REQ-114, REQ-417, REQ-420]

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 09 Plan 05: Cal.com Self-Hosted + CRM Sync — Webhook + Booking Page Summary

**Cal.com webhook receiver with HMAC-SHA256+timingSafeEqual, Redis idempotency, BullMQ booking worker (CRM activity+task on BOOKING_CREATED), booking_configs Payload collection, and /booking page with Cal.com inline embed via next/script lazyOnload + CSP nonce across all 13 agency apps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T19:54:56Z
- **Completed:** 2026-04-27T19:57:56Z
- **Tasks:** 2
- **Files created:** 31
- **Files modified:** 12

## Accomplishments

- Created `@mjagency/booking` package with `payload:3.82.1` exact pinning and `@calcom/embed-react`
- Implemented Cal.com webhook receiver: `req.text()` before any JSON parse (CLAUDE.md §7), HMAC-SHA256 verified with `timingSafeEqual`, Redis idempotency `agency:<id>:cal:<uid>` 24h TTL, BullMQ dispatch to `cal-booking-sync` queue
- Implemented `createBookingWorker`: BOOKING_CREATED creates CRM activity (type: meeting, status: logged) + follow-up task (due 24h); BOOKING_CANCELLED logged; BOOKING_RESCHEDULED no-op in Phase 9
- Created `bookingConfigsCollection` Payload collection: `cal_link`, `meeting_types[]`, `agency_id` (immutable), `collectionAccess`/`deleteAccess`, group "Booking"
- Barrel export `bookingCollections: CollectionConfig[]` — wired into all 12 Payload configs
- Created `/booking` server page (13 agency apps): h1 "Schedule a Free Consultation", body copy per 09-UI-SPEC.md, Cal.com inline embed div min-height:600px, `next/script strategy="lazyOnload"`, CSP nonce via `randomUUID()`, all `var(--mj-*)` tokens, skip link WCAG 2.4.1

## Task Commits

Each task was committed atomically:

1. **Task 1: Booking package + webhook routes + worker + Payload collection + payload configs** — `eb25b01` (feat)
2. **Task 2: /booking pages with Cal.com inline embed + CSP nonce (all 13 apps)** — `6e0c02e` (feat)

## Files Created/Modified

**Created (package):**
- `packages/booking/package.json` — payload:3.82.1 exact, @calcom/embed-react ^1.3.0, ioredis ^5.3.0
- `packages/booking/src/access/collection-access.ts` — collectionAccess, deleteAccess, fieldImmutable, superAdminOnly
- `packages/booking/src/collections/booking-configs.ts` — bookingConfigsCollection with cal_link, meeting_types, agency_id immutable
- `packages/booking/src/workers/booking-worker.ts` — createBookingWorker (BOOKING_CREATED → CRM activity + follow-up task)
- `packages/booking/src/index.ts` — barrel: bookingConfigsCollection, createBookingWorker, bookingCollections

**Created (webhook routes — 13 apps):**
- `apps/web-*/src/app/api/booking/webhook/route.ts` — Cal.com webhook: raw body HMAC, Redis idempotency, BullMQ dispatch

**Created (booking pages — 13 apps):**
- `apps/web-*/src/app/(frontend)/booking/page.tsx` — server component, Cal.com inline embed, CSP nonce

**Modified (payload configs — 12 apps):**
- `apps/web-*/payload.config.ts` — added `bookingCollections` import + spread into collections array

## Decisions Made

- bookingCollections access helpers copied verbatim into `packages/booking/src/access/` (not imported from `@mjagency/crm`) — same pattern as 09-01 CRM access helpers to prevent circular ESM dependency
- CSP nonce uses `crypto.randomUUID()` per-render fallback (CLAUDE.md §7 compliance) — Phase 11 will replace with `x-nonce` header from Next.js middleware
- Cal.com embed via `next/script strategy="lazyOnload"` with `nonce` prop (not `dangerouslySetInnerHTML`) — compliant with CLAUDE.md Puck rules and 09-UI-SPEC.md security constraints
- BOOKING_CANCELLED logs the event without full activity status update — the plan explicitly defers full cancellation handling to 09-gap
- `web-brand` has no `payload.config.ts` — it doesn't follow the agency app pattern (no Payload CMS for brand.com main); webhook route created, config not modified

## Deviations from Plan

### Auto-applied Critical Patterns

**1. [Rule 2 - Security] CSP nonce added to all inline Cal.com Scripts**
- **Found during:** Task 2 — Plan Step N explicitly calls for CSP nonce
- **Issue:** CLAUDE.md §7 mandates "CSP nonce: generate per-request, inject into all inline styles/scripts". The plan's booking page has two inline `<Script>` elements
- **Fix:** Added `import { randomUUID } from 'crypto'` and generated `const nonce = randomUUID()` in BookingPage server component; passed as `nonce` prop to both `<Script>` elements
- **Files modified:** All 13 `apps/web-*/src/app/(frontend)/booking/page.tsx`
- **Commit:** `6e0c02e`

## Known Stubs

- `packages/booking/src/workers/booking-worker.ts` BOOKING_CANCELLED handler: logs event, does not update CRM activity status. This is an **intentional tracked stub** — the plan explicitly states "Full activity cancellation lookup deferred to 09-gap if needed". The BOOKING_CREATED path (the plan's primary requirement) is fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-network-endpoint | apps/web-*/src/app/api/booking/webhook/route.ts | New POST endpoint exposed on all 13 agency apps. HMAC verification + Redis idempotency are mandatory mitigations (both implemented). Endpoint uses `export const runtime = 'nodejs'` (no Edge — Node.js crypto required). |

---
*Phase: 09-crm-forms-booking*
*Completed: 2026-04-27*

## Self-Check: PASSED

All 9 key files verified on disk. Both task commits (eb25b01, 6e0c02e) confirmed in git log.
