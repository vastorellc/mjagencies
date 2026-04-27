---
phase: 09-crm-forms-booking
plan: "09-04"
subsystem: email
tags: [email, nodemailer, bullmq, dns-validation, warmup, payload-cms, sequences]

# Dependency graph
requires:
  - phase: 09-01
    provides: crmCollections pattern, collection-access helpers, payload config wire pattern
  - packages/queue
    provides: createEncryptedQueue, createEncryptedWorker
  - packages/config
    provides: createLogger, REDIS_KEY.bullPrefix

provides:
  - packages/email/package.json — nodemailer ^6.9.0, ioredis ^5.3.0, payload 3.82.1 exact
  - packages/email/src/sender.ts — sendEmail function using nodemailer SMTP
  - packages/email/src/queue/email-queue.ts — createEmailQueue with REDIS_KEY.bullPrefix
  - packages/email/src/workers/email-worker.ts — createEmailWorker with warmup gate
  - packages/email/src/warmup.ts — rejectSendIfWarmupIncomplete, EmailWarmupIncompleteError
  - packages/email/src/dns-validate.ts — validateDkim/validateSpf/validateDmarc (dns.promises)
  - packages/email/src/sequences/sequence-engine.ts — enrollContact + SequenceStep
  - packages/email/src/access/collection-access.ts — collectionAccess/deleteAccess/fieldImmutable
  - packages/email/src/collections/email-templates.ts — email_templates Payload collection
  - packages/email/src/collections/email-sequences.ts — email_sequences Payload collection
  - packages/email/src/index.ts — barrel + emailCollections: CollectionConfig[]
  - apps/web-main/src/app/(payload)/admin/email-setup/page.tsx — DNS wizard admin page

affects:
  - All 12 agency payload.config.ts — emailCollections now wired
  - apps/web-main/package.json — @mjagency/email workspace dep added

# Tech tracking
tech-stack:
  added:
    - "nodemailer ^6.9.0 — SMTP transport for email sending"
    - "@types/nodemailer ^6.4.0 — TypeScript types"
    - "ioredis ^5.3.0 — Redis client for warmup gate"
    - "Node.js built-in dns.promises — DKIM/SPF/DMARC validation (no external DNS lib)"
  patterns:
    - "createEncryptedQueue/createEncryptedWorker for email jobs (same pattern as crm-queue)"
    - "35-day warmup gate via Redis key agency:<id>:email:warmup-day"
    - "Email access helpers copied into packages/email/src/access/ (same pattern as crm)"
    - "emailCollections spread into all 12 payload.config.ts (same pattern as crmCollections)"

key-files:
  created:
    - packages/email/src/sender.ts
    - packages/email/src/queue/email-queue.ts
    - packages/email/src/workers/email-worker.ts
    - packages/email/src/warmup.ts
    - packages/email/src/dns-validate.ts
    - packages/email/src/sequences/sequence-engine.ts
    - packages/email/src/access/collection-access.ts
    - packages/email/src/collections/email-templates.ts
    - packages/email/src/collections/email-sequences.ts
    - apps/web-main/src/app/(payload)/admin/email-setup/page.tsx
  modified:
    - packages/email/package.json
    - packages/email/src/index.ts
    - apps/web-main/package.json
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
  - "email access helpers copied verbatim from crm package into packages/email/src/access/ — same circular-dep prevention pattern as crm (cms -> crm -> email circular risk)"
  - "DNS wizard uses [PASS]/[FAIL] text indicators instead of emoji checkmarks — per CLAUDE.md no-emoji rule"
  - "@mjagency/email added to apps/web-main/package.json as workspace dep (Rule 2: missing dependency for DNS wizard page)"
  - "enrollContact uses cumulative delay (sum of all prior step delayHours) from enrollment time — each step measured from t=0 not from previous step"

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 09 Plan 04: Email Engine — SMTP Sender + Sequences + DNS Validation + 35-day Warm-up Summary

**Complete email sending infrastructure: nodemailer SMTP sender, encrypted BullMQ queue/worker, 35-day warmup gate (Redis), sequence enrollment engine, DKIM/SPF/DMARC DNS validators, email_templates + email_sequences Payload collections, admin DNS wizard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T19:54:28Z
- **Completed:** 2026-04-27T19:58:18Z
- **Tasks:** 3
- **Files modified:** 25

## Accomplishments

- Created `packages/email` sending infrastructure: nodemailer SMTP sender, createEmailQueue (encrypted BullMQ), createEmailWorker (warmup gate + send), 35-day warmup gate with Redis key `agency:<id>:email:warmup-day`
- Implemented DNS validators: validateDkim (TXT at `default._domainkey.<domain>`), validateSpf (TXT v=spf1 at root), validateDmarc (TXT at `_dmarc.<domain>`) — all using Node.js built-in `dns.promises`
- Built sequence enrollment engine: `enrollContact(agencyId, contactId, steps[])` enqueues each step as a delayed BullMQ job with cumulative delay (delayHours * 3.6M ms)
- Created two Payload collections: `email_templates` (subject, html_body, text_body, category) and `email_sequences` (name, steps array) — both with AGENCY_ID_FIELD + fieldImmutable
- Wired `emailCollections` into all 12 agency `payload.config.ts` files (same pattern as crmCollections from 09-01)
- Created admin DNS setup wizard page at `/admin/email-setup?domain=yourdomain.com` with `requireSession()` auth gate

## Task Commits

Each task was committed atomically:

1. **Task 1: email package.json + sender + queue + worker + warmup** - `4d05491` (feat)
2. **Task 2: DNS validation + sequences + Payload collections + barrel + wire configs** - `585dbe3` (feat)
3. **Task 3: Email DNS setup wizard admin page** - `a0291d3` (feat)

## Files Created/Modified

**Created:**
- `packages/email/src/sender.ts` — sendEmail(EmailJobData) via nodemailer; logs agencyId only (never PII)
- `packages/email/src/queue/email-queue.ts` — createEmailQueue using createEncryptedQueue + REDIS_KEY.bullPrefix
- `packages/email/src/workers/email-worker.ts` — createEmailWorker; calls rejectSendIfWarmupIncomplete then sendEmail
- `packages/email/src/warmup.ts` — EmailWarmupIncompleteError, rejectSendIfWarmupIncomplete, incrementWarmupDay, getWarmupDay
- `packages/email/src/dns-validate.ts` — validateDkim/validateSpf/validateDmarc/validateEmailDns
- `packages/email/src/sequences/sequence-engine.ts` — enrollContact with SequenceStep type; cumulative BullMQ delay
- `packages/email/src/access/collection-access.ts` — collectionAccess, deleteAccess, fieldImmutable, superAdminOnly
- `packages/email/src/collections/email-templates.ts` — email_templates CollectionConfig
- `packages/email/src/collections/email-sequences.ts` — email_sequences CollectionConfig
- `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx` — DNS validation wizard (SC-4)

**Modified:**
- `packages/email/package.json` — added nodemailer ^6.9.0, ioredis ^5.3.0, payload:3.82.1, @mjagency/queue/config
- `packages/email/src/index.ts` — full barrel export + emailCollections: CollectionConfig[]
- `apps/web-main/package.json` — added @mjagency/email workspace dep
- `apps/web-*/payload.config.ts` (12 files) — spread ...emailCollections into collections array

## Decisions Made

- Email access helpers copied verbatim from `packages/crm/src/access/` into `packages/email/src/access/` — prevents circular ESM dependency (same pattern established in 09-01)
- DNS wizard uses `[PASS]`/`[FAIL]` text indicators instead of emoji — CLAUDE.md explicitly prohibits emojis
- `apps/web-main/package.json` updated with `@mjagency/email: "workspace:*"` — required for DNS wizard page to import from `@mjagency/email`
- `enrollContact` uses cumulative delay (each step delay adds to previous) so step 2 arrives `step1.delayHours + step2.delayHours` after enrollment, not just `step2.delayHours` after step 1
- emailCollections wired into all 12 payload configs in same commit as collections creation — consistent with 09-01 pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Dependency] Added @mjagency/email to apps/web-main/package.json**
- **Found during:** Task 3
- **Issue:** Task 3 creates `apps/web-main/src/app/(payload)/admin/email-setup/page.tsx` which imports from `@mjagency/email`, but web-main package.json had no `@mjagency/email` dependency
- **Fix:** Added `"@mjagency/email": "workspace:*"` to web-main dependencies
- **Files modified:** `apps/web-main/package.json`
- **Commit:** `a0291d3`

## Known Stubs

None — all exports are fully implemented. DNS validation uses live Node.js dns.promises module. SMTP sender uses nodemailer. warmup gate reads from real Redis. No placeholder content.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: server-side-only | packages/email/src/sender.ts | sendEmail must be called from BullMQ worker only — never from request path (documented in JSDoc). No enforcement mechanism beyond convention. |
| threat_flag: pii-in-queue | packages/email/src/queue/email-queue.ts | Email job payloads contain PII (to address, html body). Mitigated: sensitiveData: true ensures AES-GCM-256 encryption via createEncryptedQueue. |

---
*Phase: 09-crm-forms-booking*
*Completed: 2026-04-27*

## Self-Check: PASSED

All 12 key created files found on disk. All 3 task commits (4d05491, 585dbe3, a0291d3) confirmed in git log.
