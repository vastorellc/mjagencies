---
phase: 10
plan: "10-06"
subsystem: invoicing
tags: [invoicing, stripe, paypal, dunning, chargeback, partial-payments, refunds, bullmq]
dependency_graph:
  requires: ["10-01", "10-05"]
  provides: [invoicesCollection, createInvoice, refundInvoice, startDunningWorker, startInvoiceWorker, handleStripeInvoiceWebhook]
  affects: [packages/db/src/schema/index.ts]
tech_stack:
  added: [stripe@17.3.1, ioredis@5.10.1]
  patterns: [7-state-machine, HMAC-webhook-verification, Redis-idempotency, BullMQ-job-encryption, requireSession-first-line, dunning-sequence]
key_files:
  created:
    - packages/invoices/package.json
    - packages/invoices/tsconfig.json
    - packages/invoices/src/index.ts
    - packages/invoices/src/access/collection-access.ts
    - packages/invoices/src/collections/invoices.ts
    - packages/invoices/src/actions/create-invoice.ts
    - packages/invoices/src/actions/refund-invoice.ts
    - packages/invoices/src/workers/dunning-worker.ts
    - packages/invoices/src/workers/invoice-worker.ts
    - packages/invoices/src/webhooks/stripe-webhook.ts
    - packages/db/src/schema/invoices.ts
  modified:
    - packages/db/src/schema/index.ts
decisions:
  - "Use ioredis (not the redis npm package) for webhook idempotency — consistent with existing Stripe webhook pattern in apps/web-webdev"
  - "chargebackEvidence compiled in both createInvoice (initial stub) and invoice-worker charge.dispute.created (full compilation with real esign + proposal data)"
  - "Dunning worker moves invoice back to 'draft' at day 30 rather than a new 'closed' state — keeps the 7-state machine exactly as specified"
  - "Dynamic import of 'stripe' inside dispute handler loop avoids circular dep issues with top-level import when used inside BullMQ worker"
metrics:
  duration: "12 minutes"
  completed: "2026-04-27"
  tasks: 2
  files_created: 11
  files_modified: 1
---

# Phase 10 Plan 06: Stripe + PayPal Invoicing — Dunning, Partial Payments, Refunds, Chargeback Summary

**One-liner:** Complete invoicing layer with 7-state Payload collection, Stripe Payment Links, BullMQ dunning (day 3/7/14/30), two-step refund flow, and auto-compiled chargeback evidence package from proposal body + esign r2_key + pdf_hash.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T-01 | Invoices Payload collection, Drizzle schema, package.json | a2beff3 | packages/invoices/package.json, tsconfig.json, src/access/collection-access.ts, src/collections/invoices.ts, packages/db/src/schema/invoices.ts (+index.ts) |
| T-02 | Create-invoice action, refund action, dunning worker, Stripe webhook handler | 410b2b7 | src/actions/create-invoice.ts, src/actions/refund-invoice.ts, src/workers/dunning-worker.ts, src/workers/invoice-worker.ts, src/webhooks/stripe-webhook.ts, src/index.ts |
| fix | TypeScript strict fixes | 1abbfd2 | src/workers/dunning-worker.ts, src/workers/invoice-worker.ts |

## What Was Built

### packages/invoices (new package)

**Payload Collection (invoices.ts):**
- 7-state machine: `draft` → `sent` → `viewed` → `paid` → `partial` → `refunded` → `disputed`
- Status labels match UI-SPEC Surface 4 copy exactly (e.g. "Sent — Awaiting Payment", "Partially Paid — Balance Due")
- `amount_paid` + `remaining_balance` + `total_amount` fields (REQ-128)
- `chargeback_evidence` JSON field (REQ-419)
- `proposal_id` relationship + `esign_id` text field for evidence chain
- Agency isolation: `agency_id` field with `fieldImmutable` access guard

**Drizzle Schema (packages/db/src/schema/invoices.ts):**
- REQ-418: full 7-state status column
- REQ-128: `amount_paid` + `remaining_balance` numeric(12,2) columns
- REQ-419: `chargeback_evidence` jsonb column
- 3 indexes: agency, status+agency, proposal
- RLS policy: `agency_id = current_setting('app.agency_id')::uuid`

**Create Invoice Action (create-invoice.ts):**
- `requireSession()` as first call (CLAUDE.md Rule 3)
- `session.agencyId !== input.agencyId` guard
- Server-side `totalAmount` computation from lineItems (never from client)
- Stripe Payment Link creation with `agencyId`, `proposalId`, `esignId` in metadata
- `remaining_balance = totalAmount` (full balance at creation)
- Initial chargeback evidence stub compiled at creation time

**Refund Action (refund-invoice.ts):**
- `requireSession()` first, double agencyId check on fetched invoice
- Only `paid` or `partial` invoices can be refunded
- Stripe refund via checkout session lookup → payment intent → `stripe.refunds.create()`
- Status → `refunded`, `refunded_at` timestamp set, `amount_paid` zeroed

**Dunning Worker (dunning-worker.ts):**
- BullMQ daily cron `0 8 * * *` (8am UTC)
- Day 3, 7, 14: email reminders to `contact_id.email`
- `sensitiveData: true` on email queue jobs (PII encryption at rest)
- Day 30: invoice moved back to `draft` status (closes unpaid sent invoice)

**Invoice Worker (invoice-worker.ts):**
- `checkout.session.completed`: updates `amount_paid`, `remaining_balance`, status → `paid` or `partial`
- `charge.dispute.created`: matches invoice via Stripe session lookup, then:
  - Fetches `api/proposals/{id}` → extracts `body_json.text` excerpt (500 chars, HTML stripped)
  - Fetches `api/esign_records/{id}` → extracts `r2_key` and `pdf_hash`
  - Compiles `chargebackEvidence` with all real data (not placeholders)
  - Updates invoice status → `disputed` with compiled evidence

**Stripe Webhook Handler (stripe-webhook.ts):**
- `runtime = 'nodejs'`
- `req.text()` raw body (CLAUDE.md §7 — NEVER req.json() first)
- `stripe.webhooks.constructEvent()` HMAC-SHA256 verification
- ioredis idempotency key `stripe:invoice-event:${event.id}` TTL 86400
- BullMQ dispatch → `stripe-invoice-event` queue

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DunningSentInvoice type missing `status` field**
- **Found during:** TypeScript typecheck after T-02
- **Issue:** `invoice.status` referenced in day-30 close check but `DunningSentInvoice` type didn't include `status`
- **Fix:** Added `status: string` to the type definition
- **Files modified:** packages/invoices/src/workers/dunning-worker.ts
- **Commit:** 1abbfd2

**2. [Rule 1 - Bug] Implicit any on BullMQ worker processor params**
- **Found during:** TypeScript typecheck after T-02
- **Issue:** Strict mode required explicit `Job<T>` type annotation on worker callback params
- **Fix:** Added `import('bullmq').Job<T>` inline type to both workers
- **Files modified:** packages/invoices/src/workers/dunning-worker.ts, packages/invoices/src/workers/invoice-worker.ts
- **Commit:** 1abbfd2

**3. [Rule 2 - Missing dependency] ioredis not in package.json**
- **Found during:** Reviewing webhook handler code (uses `import Redis from 'ioredis'`)
- **Issue:** Webhook handler imported ioredis directly; initial package.json only had stripe
- **Fix:** Added `"ioredis": "5.10.1"` to dependencies (matching version used by @mjagency/queue)
- **Files modified:** packages/invoices/package.json
- **Commit:** 410b2b7

## Known Stubs

None — all invoice data fields are wired to real sources:
- Payment amounts: computed server-side from Stripe API responses
- Chargeback evidence: fetched from real Payload API endpoints (proposals + esign_records)
- Contact emails: fetched from Payload contact_id population

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: webhook-endpoint | packages/invoices/src/webhooks/stripe-webhook.ts | New inbound webhook surface for Stripe payment events — HMAC verified, idempotent, BullMQ-dispatched (all T-10-06-01 mitigations applied) |

## Self-Check: PASSED

Files verified:
- packages/invoices/src/collections/invoices.ts: FOUND
- packages/invoices/src/actions/create-invoice.ts: FOUND
- packages/invoices/src/actions/refund-invoice.ts: FOUND
- packages/invoices/src/workers/dunning-worker.ts: FOUND
- packages/invoices/src/workers/invoice-worker.ts: FOUND
- packages/invoices/src/webhooks/stripe-webhook.ts: FOUND
- packages/db/src/schema/invoices.ts: FOUND

Commits verified:
- a2beff3: FOUND (T-01)
- 410b2b7: FOUND (T-02)
- 1abbfd2: FOUND (TS fix)
