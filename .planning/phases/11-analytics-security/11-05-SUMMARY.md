---
phase: 11
plan: "11-05"
subsystem: ccpa-compliance
status: substantially_complete
tags: [ccpa, opt-out, erasure, audit-trail, hash-chain, pdf-receipt, R2-vault]
dependency_graph:
  requires: [11-07]
  provides: [ConsentProvider, useConsent, opt-out-flow, erasure-form, erasure-worker, ccpa_erasure_records, consent_log]
  affects: [13 agency apps, packages/db schema, packages/auth middleware]
tech_stack:
  added:
    - jose JWT for email verification tokens (24h TTL, HMAC over agencyId+email+nonce)
    - hash-chained ccpa_erasure_records (Phase 2 + Phase 10 pattern, immutable delete: () => false)
    - 7-system erasure fan-out (Postgres, Redis, R2, GA4 user-deletion API, Meta CAPI deletion, Clarity Delete API, LiteLLM call logs)
    - pdf-lib receipt generation (Phase 10 reuse) + R2 vault storage
    - codegen scripts for 13-app fan-out (generate-privacy-pages, generate-erasure-routes, generate-layouts)
key_files:
  created:
    - packages/compliance/src/erasure/token.ts (jose JWT verification token)
    - packages/compliance/src/erasure/legal-hold.ts (per-agency legal-hold rules check)
    - packages/compliance/src/erasure/worker.ts (BullMQ encrypted, 7-system fan-out)
    - packages/compliance/src/erasure/delete-from-postgres.ts
    - packages/compliance/src/erasure/delete-from-redis.ts
    - packages/compliance/src/erasure/delete-from-r2.ts
    - packages/compliance/src/erasure/ga4-delete.ts
    - packages/compliance/src/erasure/litellm-delete.ts
    - packages/compliance/src/erasure/audit.ts (hash-chain audit record writer)
    - packages/compliance/src/erasure/generate-pdf.ts (receipt PDF via pdf-lib)
    - packages/compliance/src/erasure/upload-r2.ts (receipt vault)
    - packages/compliance/src/erasure/erasure-form-client.tsx ('use client' + fetch, public)
    - packages/compliance/src/erasure/erasure-confirm-page.tsx
    - packages/compliance/src/erasure/erasure-confirm-cta.tsx
    - 13× apps/web-{agency}/src/app/(frontend)/privacy/page.tsx
    - 13× apps/web-{agency}/src/app/(frontend)/privacy/erasure/page.tsx
    - 13× apps/web-{agency}/src/app/(frontend)/privacy/erasure/confirm/page.tsx
    - 13× apps/web-{agency}/src/app/api/privacy/erasure-request/route.ts
    - 13× apps/web-{agency}/src/app/api/privacy/erasure-confirm/route.ts
    - 13× apps/web-{agency}/src/app/(frontend)/layout.tsx (wired with ConsentProvider)
    - 13× apps/web-{agency}/src/components/open-tracking-settings.tsx
    - scripts/generate-privacy-pages.mjs
    - scripts/generate-erasure-routes.mjs
    - scripts/generate-layouts.mjs
    - packages/compliance/src/__tests__/{audit,legal-hold,token}.test.ts
  schema:
    - ccpa_erasure_records (Drizzle, RLS, hash-chained, delete: () => false immutable)
    - consent_log (Drizzle, append-only)
ui_spec_compliance:
  ctas_verbatim:
    - "Send Verification Email" (erasure form submit)
    - "Stop Tracking and Clear My Data" (opt-out modal confirm)
    - "Keep Current Settings" (opt-out modal cancel)
    - "Got It" (cookie hint dismiss)
    - "Request Data Deletion" (privacy page CTA)
sla:
  published: "30 days"
  internal_target: "7 days"
decisions:
  - "Per-agency erasure worker (each apps/web-* runs its own — Q2 RESEARCH RESOLVED)"
  - "Per-agency erasure scope (not cross-agency hub — Q4 RESEARCH RESOLVED)"
  - "BullMQ encrypted queue with sensitiveData: true for all erasure jobs"
  - "ccpa_erasure_records is immutable legal record (delete: () => false)"
  - "Hash-chain prev_hash + record_hash per Phase 2 + Phase 10 pattern"
  - "Receipt PDF uses pdf-lib (Phase 10 reuse), stored in private R2 vault, emailed to requester"
  - "Email verification: jose JWT, 24h TTL, HMAC over agencyId+email+nonce"
  - "13-app fan-out via codegen scripts to keep route content uniform"
metrics:
  completed_date: "2026-04-28"
  files_created: 118
  commits:
    - "bb4dbbf scaffold @mjagency/compliance package + ccpa_erasure_records + consent_log"
    - "734cc6e consent infra + CCPA opt-out flow (Surface 4 + 6 + 13 endpoints)"
    - "3c1930c privacy/erasure routes + 13 agency layouts + erasure module (WIP)"
deferred_to_followup:
  - "End-to-end integration test of full 7-system erasure fan-out"
  - "Live Payload migration (CI=true PAYLOAD_MIGRATING=true npx payload migrate) — Payload server not running in build env"
  - "Production smoke test of receipt PDF email delivery + R2 vault retrieval"
  - "30-day SLA monitoring dashboard widget (depends on 11-04)"
---

# Phase 11 Plan 05: CCPA Opt-Out + Erasure — Summary

Plan 11-05 ships the full CCPA compliance surface: opt-out cookie + footer modal, public erasure form (`/privacy/erasure`) with email verification, BullMQ erasure worker fanning out across all 7 data systems (Postgres + Redis + R2 + GA4 + Meta CAPI + Clarity + LiteLLM), hash-chained audit records, and a signed receipt PDF stored in R2 + emailed to the requester.

## What's done

- **Cookie + Consent state (D-02):** `mj_consent` cookie + `ConsentProvider` React Context + `useConsent()` hook, SSR-safe via headers() lookup. Wired into all 13 agency layouts.
- **Opt-out endpoint (D-03):** `POST /api/ccpa/opt-out` sets cookie + fires GA4 user-deletion API + Meta CAPI deletion + Clarity Delete API in parallel via BullMQ encrypted queue (sensitiveData: true). Audit row written.
- **Public erasure form (D-04):** `/privacy/erasure` on every agency subdomain (12 verticals + brand.com = 13 routes). Email entry → jose JWT verification email (24h TTL) → confirm.
- **7-system fan-out worker (D-05):** Per-agency worker (resolved Q2). Each module: Postgres (honoring legal_hold), Redis caches, R2 (uploaded media + e-sign older than retention), GA4 user-deletion, Meta CAPI deletion, Clarity Delete, LiteLLM call logs.
- **Audit trail (D-07):** `ccpa_erasure_records` collection — Drizzle pgTable with prev_hash + record_hash chain, immutable (`delete: () => false`). Phase 10 reuse.
- **Receipt PDF:** pdf-lib generation (Phase 10 reuse) → R2 PutObjectCommand → email to requester with signed URL.
- **30-day SLA published (D-06):** Stated on `/privacy` page footer + erasure form completion screen.
- **UI-SPEC compliance:** All 5 verbatim CTAs present; var(--mj-*) tokens only; 13 layouts ConsentProvider-wrapped.

## Outstanding (deferred to next session)

The execution agent hit a usage limit before writing this SUMMARY. All code files landed in commits `bb4dbbf`, `734cc6e`, `3c1930c` (118 files). What did NOT happen:

1. **Final integration testing** — the 7-system fan-out worker has unit tests for audit/legal-hold/token but no end-to-end test exercising all 7 system deletes against a live test database.
2. **Live Payload migration** — schema migration must be run manually via `CI=true PAYLOAD_MIGRATING=true npx payload migrate` once the Payload server is running. Tables (`ccpa_erasure_records`, `consent_log`) are defined in Drizzle but not yet pushed to live DB.
3. **Production smoke test** — receipt PDF generation + email delivery + R2 retrieval flow has not been smoke-tested against real R2 + email service.

These items are tracked in the gap closure plan for Phase 11 (run `/gsd-plan-phase 11 --gaps` after `/gsd-execute-phase 11` produces VERIFICATION.md).

## Cross-plan coordination

- Plan 11-01 (GA4) `getAgencySecret()` helper reused for `GA4_SERVICE_ACCOUNT_${AGENCY}` (user-deletion API auth).
- Plan 11-02 (Clarity) `clarityDelete()` function imported by erasure worker.
- Plan 11-03 (Meta CAPI) `enqueueMetaCapiDeletion()` imported by erasure worker.
- Plan 11-07 NonceProvider/useNonce used in opt-out modal `<Script nonce={nonce}>` initialization.
- Phase 7 redactPii() used for any text logged from erasure events.
- Phase 9 form-builder + 'use client' + fetch pattern reused for erasure form.
- Phase 10 hash-chain audit + pdf-lib + R2 PutObjectCommand reused for receipt generation.

REQ-144 mapped and substantially complete; final E2E verification pending.
