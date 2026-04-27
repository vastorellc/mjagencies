---
phase: "09"
plan: "03"
subsystem: forms
tags: [forms, payload-collections, contact-api, bullmq, wcag, honeypot, typescript]
dependency_graph:
  requires:
    - "09-01"  # CRM contacts collection (form-worker creates CRM contacts)
    - "09-02"  # Email collections (form-worker enqueues email-send)
  provides:
    - "@mjagency/forms package"
    - "forms + form_submissions Payload collections (all 12 agencies)"
    - "public /api/contact POST route (all 13 apps)"
    - "ContactFormClient WCAG 2.2 AA component"
    - "/contact pages (all 13 agency apps)"
  affects:
    - "packages/ui"
    - "all 12 payload.config.ts files"
    - "all 13 agency apps"
tech_stack:
  added:
    - "@mjagency/forms workspace package"
    - "ContactFormClient React component (use client)"
  patterns:
    - "createEncryptedWorker/createEncryptedQueue with sensitiveData:true for PII"
    - "REDIS_KEY.bullPrefix(agencyId) for per-agency queue isolation"
    - "honeypot _hp field (off-screen, tabIndex=-1)"
    - "WCAG 2.2 AA: aria-required, aria-invalid, aria-describedby, role=status/alert, aria-live"
    - "agency_id fieldImmutable access pattern (copied from @mjagency/crm)"
key_files:
  created:
    - packages/forms/package.json
    - packages/forms/src/index.ts
    - packages/forms/src/access/collection-access.ts
    - packages/forms/src/collections/forms.ts
    - packages/forms/src/collections/form-submissions.ts
    - packages/forms/src/workers/form-worker.ts
    - packages/ui/src/components/contact-form-client.tsx
    - apps/web-{13}/src/app/api/contact/route.ts  # 13 files
    - apps/web-{13}/src/app/(frontend)/contact/page.tsx  # 13 files
  modified:
    - packages/ui/src/index.ts  # ContactFormClient export added
    - apps/web-{12}/payload.config.ts  # formsCollections wired in
decisions:
  - "ContactFormClient uses 'use client' + fetch to /api/contact (not server action) — public form by design"
  - "All 13 apps get /api/contact (including web-brand) for consistency with 12 payload.config.ts apps"
  - "Agency slug sourced from NEXT_PUBLIC_AGENCY_SLUG env var per Phase 8 AGENCY_SLUG pattern"
  - "form-worker uses dynamic import for email queue to avoid circular dep at module load"
  - "agencyName var in form-worker voided with void operator to suppress unused-var lint"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-27"
  tasks_completed: 5
  files_created: 38
  files_modified: 13
---

# Phase 09 Plan 03: Form Builder Summary

**One-liner:** forms/form_submissions Payload collections + encrypted BullMQ worker + WCAG 2.2 AA ContactFormClient wired into all 13 agency apps via /api/contact public route.

## What Was Built

### Task 1: @mjagency/forms package (commit f1c972b)

Created a new workspace package with:
- `forms` Payload collection: name, configurable fields array (text/email/phone/textarea/select/checkbox), spam_protection (honeypot/reCAPTCHA/Turnstile), redirect_url, email_notification group. Agency-scoped via `agency_id` field with `fieldImmutable` access guard.
- `form_submissions` collection: stores ip_hash, honeypot_passed, spam_score, utm params, status (pending/processed/spam). Create-only for collectionAccess; update/delete restricted to admin+.
- `createFormWorker`: `createEncryptedWorker` with `sensitiveData: true`. Creates CRM contact via Payload REST API, then enqueues email notification via `createEncryptedQueue`. Pino logger with PII redaction (email logged as `[REDACTED]`).
- `collection-access.ts`: copied from `@mjagency/crm` (avoids circular dependency).
- `formsCollections` export: `[formsCollection, formSubmissionsCollection]`.

### Task 2: Public /api/contact route — 13 apps (commit 3191bc8)

`apps/web-{agency}/src/app/api/contact/route.ts` created for all 13 agency apps. Public endpoint (no auth check — not a server action per CLAUDE.md §3 exception). Honeypot `_hp` field returns 200 immediately. Validates name/email/message, enqueues `FormSubmissionJobData` via `createEncryptedQueue` with `REDIS_KEY.bullPrefix(agencyId)` for per-agency isolation.

### Task 3: ContactFormClient component (commit f1506bc)

`packages/ui/src/components/contact-form-client.tsx`:
- `'use client'` directive
- name/email/message fields + hidden `_hp` honeypot (position: absolute off-screen, tabIndex=-1, aria-hidden)
- `useId()` for stable ARIA IDs
- Inline validation with canonical error strings from plan spec
- Success: `role="status"` + `aria-live="polite"` banner replaces form
- Error: `role="alert"` + `aria-live="assertive"` banner, form stays visible
- Submit: `disabled` + `aria-busy="true"` while submitting
- All styles use `var(--mj-*)` CSS variable tokens — zero hex literals

Exported from `@mjagency/ui` barrel as `ContactFormClient` + `ContactFormClientProps`.

### Task 4: Contact pages — 13 apps (commit 83f4fbb)

New `/contact` route created as server component for all 13 apps. Each renders `ContactFormClient` with `agencyId` from `NEXT_PUBLIC_AGENCY_SLUG` env var and `contactEmail` from `NEXT_PUBLIC_CONTACT_EMAIL`. Skip-link for WCAG 2.4.1. Unique agency-specific `<p>` body copy per app (no placeholder text per CLAUDE.md §5).

### Task 5: Payload config wiring — 12 apps (commit 279b4a3)

All 12 `payload.config.ts` files updated to import `formsCollections` from `@mjagency/forms` and append `...formsCollections` to the collections array.

## Deviations from Plan

None — plan executed exactly as written.

Minor implementation notes (not deviations):
- `agencyName` variable in form-worker is assigned but only used for logging context; voided with `void agencyName` to silence TypeScript unused-var lint.
- Contact pages use `NEXT_PUBLIC_AGENCY_SLUG` (env pattern from Phase 8) rather than a hardcoded constant — consistent with the booking page pattern already established.

## Known Stubs

None. All fields wire to real functionality:
- `ContactFormClient` posts to `/api/contact` which enqueues real BullMQ job
- `createFormWorker` creates real CRM contact + enqueues email notification
- All form fields have real validation and ARIA semantics

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public-api | apps/web-*/src/app/api/contact/route.ts | New public unauthenticated POST endpoint on all 13 apps. Honeypot protection only; no rate limiting in this plan. Rate limiting should be added in Phase 11 (analytics-security). |

## Self-Check: PASSED

- packages/forms/package.json: FOUND
- packages/forms/src/index.ts: FOUND
- packages/forms/src/collections/forms.ts: FOUND
- packages/forms/src/workers/form-worker.ts: FOUND
- packages/ui/src/components/contact-form-client.tsx: FOUND
- 13 contact API routes: FOUND (verified via find count = 13)
- 13 contact pages: FOUND (verified via find count = 13)
- 12 payload.config.ts updated with formsCollections: FOUND (verified via grep)
- All 5 commits present: f1c972b, 3191bc8, f1506bc, 83f4fbb, 279b4a3
