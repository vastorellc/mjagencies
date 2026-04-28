---
phase: 09-crm-forms-booking
verified: 2026-04-27T00:00:00Z
status: gaps_found
score: 7/8 success criteria verified
overrides_applied: 0
gaps:
  - truth: "Stripe webhook idempotency check exists (redis.get with stripe:event key)"
    status: failed
    reason: "All Stripe webhook route.ts files across all apps are stubs returning 501. No Redis idempotency check exists anywhere. The stripe:event key pattern is absent from the entire codebase."
    artifacts:
      - path: "apps/web-ecommerce/src/app/api/stripe/webhook/route.ts"
        issue: "Stub — returns 501 with 'M002 will implement webhook handling'. No Redis, no HMAC, no idempotency."
      - path: "apps/web-main/src/app/api/stripe/webhook/route.ts"
        issue: "Stub — identical stub returning 501. No idempotency logic."
    missing:
      - "Redis idempotency check using key pattern stripe:event:{event.id} before processing"
      - "HMAC signature verification using stripe.webhooks.constructEvent"
      - "BullMQ enqueueing with immediate 200 response"
      - "Implementation across all 12 agency Stripe webhook routes"
---

# Phase 9: CRM + Forms + Booking + Lead Routing Verification Report

**Phase Goal:** Per-agency CRM, lead scoring, form builder, email engine (DKIM/SPF/DMARC), Cal.com self-hosted, Twilio SMS, niche pre-seeds.
**Verified:** 2026-04-27T00:00:00Z
**Status:** FAIL — 1 of 8 Success Criteria failing
**Re-verification:** No — initial verification

---

## SC-1: CRM Collections with Agency Isolation

**Verdict: PASS**

`packages/crm/src/index.ts` exports `crmCollections` as a `CollectionConfig[]` array at line 34, containing:
- `contactsCollection` (`packages/crm/src/collections/contacts.ts`)
- `accountsCollection` (`packages/crm/src/collections/accounts.ts`)
- `dealsCollection` (`packages/crm/src/collections/deals.ts`)
- `activitiesCollection` (`packages/crm/src/collections/activities.ts`)
- `tasksCollection` (`packages/crm/src/collections/tasks.ts`)
- `tagsCollection` (`packages/crm/src/collections/tags.ts`)

All five required collections (contacts, accounts, deals, activities, tasks) are present. Each defines:
- `agency_id` field (`name: 'agency_id', type: 'text', required: true`) — confirmed in all five collections
- `access: { update: fieldImmutable }` on the `agency_id` field — confirmed in all five collections
- `fieldImmutable` defined in `packages/crm/src/access/collection-access.ts` line 77 as `export const fieldImmutable: FieldAccess = () => false`

Evidence:
- `packages/crm/src/collections/contacts.ts` lines 9-15: AGENCY_ID_FIELD with fieldImmutable
- `packages/crm/src/collections/accounts.ts` lines 6, 9, 13: same pattern
- `packages/crm/src/collections/deals.ts` lines 6, 9, 13: same pattern
- `packages/crm/src/collections/activities.ts` lines 6, 9, 13: same pattern
- `packages/crm/src/collections/tasks.ts` lines 6, 9, 13: same pattern

---

## SC-2: Lead Score Function with Formula and Tests

**Verdict: PASS**

`packages/crm/src/scoring/lead-score.ts` exports `computeLeadScore` (line 118).

Formula verified at lines 124-128:
```
raw = weights.icp * icpScore       // DEFAULT 0.40
    + weights.behavior * behaviorScore  // DEFAULT 0.35
    + weights.recency * recencyScore    // DEFAULT 0.15
    + weights.source * sourceScore      // DEFAULT 0.10
```

`DEFAULT_WEIGHTS` at lines 53-58 confirms `{ icp: 0.40, behavior: 0.35, recency: 0.15, source: 0.10 }`.

Each sub-score is clamped to [0,1] via `clamp()` before weighting:
- `computeIcpScore` returns `clamp(raw)` (line 83)
- `computeBehaviorScore` returns `clamp(...)` (line 90)
- `computeRecencyScore` returns values from fixed set {0.0, 0.3, 0.7, 1.0} (lines 97-100)
- `computeSourceScore` returns values from fixed map, unknown sources return 0.0 (line 111)

Unit tests exist at `packages/crm/src/scoring/lead-score.test.ts` (112 lines). Tests reference the formula explicitly (e.g., line 19: comment "ICP(1.0)*0.40 + behavior(0)*0.35 + recency(1.0)*0.15 + source(1.0)*0.10 = 0.65") and cover ICP weight paths, behavior weight paths, recency buckets, source values, and edge cases (score clamped to [0,1]).

---

## SC-3: Forms Collections, Contact Route Honeypot, ContactFormClient

**Verdict: PASS**

`packages/forms/src/index.ts` line 10 exports `formsCollections: CollectionConfig[]` containing `formsCollection` and `formSubmissionsCollection`.

Honeypot check: `apps/web-ecommerce/src/app/api/contact/route.ts` line 14: `if (body['_hp']) { return Response.json({ ok: true }) }` — honeypot `_hp` field checked before any processing. Same route file exists across all 13 agency apps.

`packages/ui/src/components/contact-form-client.tsx` line 1: `'use client'` directive present.

`packages/ui/src/index.ts` line 51: `export { ContactFormClient } from './components/contact-form-client.js'`

---

## SC-4: DNS Validation Functions and Email Setup Wizard

**Verdict: PASS**

`packages/email/src/dns-validate.ts` exports:
- `validateDkim` at line 27
- `validateSpf` at line 50
- `validateDmarc` at line 69

All three are substantive implementations using `dns.promises.resolveTxt`.

Admin email setup wizard exists at `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx`:
- Line 10: `import { requireSession } from '@mjagency/auth'`
- Line 24: `await requireSession()` — session guard present

---

## SC-5: Booking Pages and Webhook with HMAC + Redis Idempotency

**Verdict: PASS**

Booking page exists at `apps/web-ecommerce/src/app/(frontend)/booking/page.tsx` (and all 12 other agency apps). Cal.com embed with `strategy="lazyOnload"` confirmed at lines 98 and 104.

Booking webhook route exists at `apps/web-ecommerce/src/app/api/booking/webhook/route.ts` (and all 12 other agency apps):
- Line 16: `import { createHmac, timingSafeEqual } from 'crypto'` — HMAC-SHA256 verification
- Line 52: `timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))` — constant-time comparison
- Lines 77-90: Redis idempotency key `agency:${agencyId}:cal:${event.uid}` with 86400s TTL

---

## SC-6: Stripe Webhook Redis Idempotency

**Verdict: FAIL**

The `stripe:event` key pattern does not exist anywhere in the codebase. All Stripe webhook route files are stubs:

`apps/web-ecommerce/src/app/api/stripe/webhook/route.ts` (representative of all 12):
```
// Stripe webhook stub at M001.
// M002 will implement full webhook handling...
export async function POST(req: Request): Promise<Response> {
  const _rawBody = await req.text()
  return Response.json(
    { error: 'M002 will implement webhook handling' },
    { status: 501 },
  )
}
```

Routes confirmed as stubs across all agency apps:
- `apps/web-ai`, `apps/web-brand`, `apps/web-branding`, `apps/web-ecommerce`, `apps/web-engineering`, `apps/web-finance`, `apps/web-graphic`, `apps/web-growth`, `apps/web-main`, `apps/web-product`, `apps/web-strategy`, `apps/web-video`, `apps/web-webdev`

No Redis import, no `constructEvent`, no idempotency key, no BullMQ enqueue in any of these files. The raw body is read but immediately discarded. Every route returns 501.

---

## SC-7: SMS Worker with TCPA Guard, Opt-In Functions, Status Route

**Verdict: PASS**

`packages/sms/src/workers/sms-worker.ts`:
- Line 22: `export class TcpaConsentError extends Error` — exported
- Lines 39-42: `if (!consentVerified) { ... throw new TcpaConsentError(jobAgencyId) }` — throws when consentVerified is false, before any Twilio call

`packages/sms/src/opt-in.ts`:
- SHA-256 phone hashing: `createHash('sha256').update(phone.trim()).digest('hex')` at line 30
- `verifyOptIn` exported at line 38
- `recordOptIn` exported at line 53
- `recordOptOut` exported at line 68

Twilio status webhook at `apps/web-main/src/app/api/sms/status/route.ts`:
- Line 12: `export const runtime = 'nodejs'`
- Line 18: `const rawBody = await req.text()`

---

## SC-8: CRM Pre-Seed Steps and No Placeholder Content

**Verdict: PASS**

`packages/db/src/seed/steps/crm-contacts.ts` exports `crmContactsPreSeedStep` at line 138.

`packages/db/src/seed/index.ts` includes CRM seed steps in `allSteps` array (lines 51-60):
- `crmContactsPreSeedStep` (line 54)
- `crmPipelinesPreSeedStep` (line 55)
- `crmTagsPreSeedStep` (line 56)
- `crmEmailTemplatesPreSeedStep` (line 57)
- `crmSequencesPreSeedStep` (line 58)
- `crmAttributionPreSeedStep` (line 59)

No placeholder names, Lorem ipsum, or TODO found in any CRM seed step files (`crm-contacts.ts`, `crm-pipelines.ts`, `crm-tags.ts`, `crm-email-templates.ts`, `crm-sequences.ts`, `crm-attribution.ts`). Contact names are niche-appropriate real-style names (e.g., "Marcus Oyelaran", "Priya Venkatesh", "Patricia Goldstein").

Note: `admin-users.ts` contains `TODO_PHASE3` comments but this file was produced in Phase 2, not Phase 9, and the comments refer to a technical debt marker for password hashing — not placeholder content data.

---

## Overall Verdict

**FAIL — 1 of 8 Success Criteria failing**

| SC | Description | Result |
|----|-------------|--------|
| SC-1 | CRM collections with agency_id + fieldImmutable | PASS |
| SC-2 | computeLeadScore with formula + unit tests | PASS |
| SC-3 | Forms collections + honeypot route + ContactFormClient | PASS |
| SC-4 | DNS validation functions + email setup wizard with requireSession | PASS |
| SC-5 | Booking pages with Cal.com + webhook with HMAC + Redis idempotency | PASS |
| SC-6 | Stripe webhook idempotency (stripe:event Redis key) | **FAIL** |
| SC-7 | SMS worker TcpaConsentError + opt-in functions + status route | PASS |
| SC-8 | CRM pre-seed steps in allSteps + no placeholders | PASS |

**Failing SC:** SC-6 — All 12 Stripe webhook routes are stubs returning 501. No Redis idempotency, no HMAC verification, no BullMQ enqueueing exists. The `stripe:event` key pattern referenced in the SC criterion is absent from the entire codebase.

---

_Verified: 2026-04-27T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
