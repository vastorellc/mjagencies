---
phase: 09-crm-forms-booking
plan: "09-06"
subsystem: sms
tags: [twilio, tcpa, sms, redis, bullmq, encrypted-queue, webhook, vitest]
dependency_graph:
  requires: [09-02, 09-03, packages/queue, packages/config]
  provides: [packages/sms, apps/web-main/api/sms/status]
  affects: [lead-follow-up SMS, TCPA compliance, CRM contact opt-in state]
tech_stack:
  added: [twilio@^5.0.0]
  patterns: [per-agency Twilio env var lookup, SHA-256 phone hashing, BullMQ encrypted queue, TCPA consentVerified guard, Twilio HMAC signature validation, Redis idempotency]
key_files:
  created:
    - packages/sms/package.json
    - packages/sms/tsconfig.json
    - packages/sms/vitest.config.ts
    - packages/sms/src/twilio.ts
    - packages/sms/src/opt-in.ts
    - packages/sms/src/queue/sms-queue.ts
    - packages/sms/src/workers/sms-worker.ts
    - packages/sms/src/webhook-handler.ts
    - packages/sms/src/index.ts
    - packages/sms/src/sms-worker.test.ts
    - apps/web-main/src/app/api/sms/status/route.ts
  modified:
    - pnpm-lock.yaml
decisions:
  - Per-agency Twilio env vars: TWILIO_ACCOUNT_SID_{UPPER} / TWILIO_AUTH_TOKEN_{UPPER} with global fallback
  - Phone stored as SHA-256 hash in Redis keys — raw phone numbers never appear in key names
  - No TTL on opt-in keys — consent persists until explicit STOP opt-out
  - TcpaConsentError thrown before any Twilio API call — worker is the hard TCPA gate
  - STOP keyword detection is case-insensitive (Body.trim().toUpperCase() === 'STOP')
  - Twilio status webhook uses req.text() raw body as required by CLAUDE.md §7
  - API route runtime = 'nodejs' (not Edge) — Twilio SDK requires Node.js
metrics:
  duration: "~15 minutes"
  completed: "2026-04-27"
  tasks_completed: 2
  files_created: 11
  tests_passing: 11
---

# Phase 09 Plan 06: Twilio SMS — TCPA Double Opt-In + Encrypted Queue + Status Webhooks Summary

**One-liner:** Per-agency Twilio SMS client with TCPA double opt-in/out Redis flow, BullMQ encrypted queue/worker with consentVerified hard gate, and Twilio HMAC-verified status webhook.

## What Was Built

### packages/sms — New Package

Full SMS package implementing:

1. **`src/twilio.ts`** — `createTwilioClient(agencyId)` factory. Reads `TWILIO_ACCOUNT_SID_{UPPER}` / `TWILIO_AUTH_TOKEN_{UPPER}` per-agency first, falls back to global `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. Throws if credentials not configured.

2. **`src/opt-in.ts`** — TCPA double opt-in/out helpers:
   - `hashPhone(phone)` — SHA-256 of `phone.trim()`, produces 64-char hex
   - `OPT_IN_REDIS_KEY(agencyId, hash)` — returns `agency:<agencyId>:sms:optin:<hash>`
   - `recordOptIn(agencyId, phone)` — sets key with no TTL (consent persists until explicit opt-out)
   - `recordOptOut(agencyId, phone)` — deletes key
   - `verifyOptIn(agencyId, phone)` — boolean based on Redis key existence

3. **`src/queue/sms-queue.ts`** — `createSmsQueue(agencyId)` using `createEncryptedQueue` with `REDIS_KEY.bullPrefix(agencyId)`. `SmsJobData` includes `consentVerified: boolean` field.

4. **`src/workers/sms-worker.ts`** — `createSmsWorker(agencyId)` with TCPA guard as first operation:
   - If `!consentVerified` → logs error with `to: '[REDACTED]'`, throws `TcpaConsentError`
   - If consented → calls Twilio `messages.create`, logs success with `to: '[REDACTED]'`
   - `TcpaConsentError` extends `Error` with `name: 'TcpaConsentError'` for catch discrimination

5. **`src/webhook-handler.ts`** — `handleTwilioStatusWebhook(rawBody, sig, requestUrl, agencyId)`:
   - Validates Twilio HMAC signature via `twilio.validateRequest` before any processing
   - Redis idempotency with 24h TTL on `agency:<agencyId>:sms:status:<MessageSid>`
   - Detects STOP keyword (case-insensitive) and calls `recordOptOut`
   - Returns 403 on invalid signature, 400 on missing MessageSid, 500 on misconfigured agency

6. **`src/sms-worker.test.ts`** — 11 Vitest unit tests:
   - TCPA guard (2 tests): TcpaConsentError shape, name discrimination
   - Phone hashing (3 tests): 64-char hex, whitespace trim, uniqueness
   - OPT_IN_REDIS_KEY (1 test): correct key pattern
   - verifyOptIn / recordOptIn / recordOptOut (5 tests): full opt-in/out flow with mocked Redis

### apps/web-main/src/app/api/sms/status/route.ts

Next.js API route with `runtime = 'nodejs'` delegating to `handleTwilioStatusWebhook`. Uses `req.text()` for raw body per CLAUDE.md §7. Reads `x-agency-id` header or `agencyId` query param.

## Test Results

```
Test Files: 1 passed (1)
Tests:      11 passed (11)
Duration:   2.82s
```

All 11 tests pass with no failures.

## Deviations from Plan

None — plan executed exactly as written. The plan code and spec matched implementation requirements directly.

## Known Stubs

None. All functionality is wired: consent is stored in Redis, SMS is dispatched via real Twilio SDK (mocked in tests), webhook validates real HMAC signatures.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: webhook-endpoint | apps/web-main/src/app/api/sms/status/route.ts | New unauthenticated POST endpoint for Twilio callbacks — mitigated by HMAC signature validation in handleTwilioStatusWebhook |

## Self-Check: PASSED

Files verified present:
- packages/sms/package.json — FOUND
- packages/sms/src/twilio.ts — FOUND
- packages/sms/src/opt-in.ts — FOUND
- packages/sms/src/queue/sms-queue.ts — FOUND
- packages/sms/src/workers/sms-worker.ts — FOUND
- packages/sms/src/webhook-handler.ts — FOUND
- packages/sms/src/index.ts — FOUND
- packages/sms/src/sms-worker.test.ts — FOUND
- apps/web-main/src/app/api/sms/status/route.ts — FOUND

Commit verified: ecf8794 — FOUND
