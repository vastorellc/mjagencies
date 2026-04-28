# CCPA Erasure Manual Trigger Runbook

**Audience:** Privacy officer, compliance team, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `packages/compliance/src/erasure/`, `docs/runbooks/ga4-data-deletion.md`, `docs/runbooks/bullmq-queue-drain.md`

---

## Overview

This runbook covers manual triggering of the CCPA erasure 7-system fan-out implemented in `packages/compliance/src/erasure/`. Use this runbook when the automated erasure flow at `/privacy/erasure` fails, when a regulator explicitly requests a manual verification of erasure completion, or when a BullMQ worker was down during the scheduled erasure processing.

**The 7 erasure system modules** (from `packages/compliance/src/erasure/`):

| Module file | System | What is deleted |
|-------------|--------|-----------------|
| `delete-from-postgres.ts` | Postgres (per-agency DB) | User rows, session rows, consent_log, audit_log entries, CRM contact/lead/deal records |
| `delete-from-redis.ts` | Redis | Session keys, cache keys, BullMQ job results scoped to this user |
| `delete-from-r2.ts` | Cloudflare R2 | User-uploaded media objects, profile photos, signed documents |
| `ga4-delete.ts` | Google Analytics 4 | GA4 user deletion request via GA4 Admin API (see `docs/runbooks/ga4-data-deletion.md`) |
| `litellm-delete.ts` | LiteLLM / AI provider | Conversation history, prompt logs associated with the user's email |
| (via `packages/analytics`) | Microsoft Clarity | User session recordings deletion via Clarity Delete API |
| (via `packages/meta-capi`) | Meta Conversions API | User event data deletion request via Meta Business API |

**Identity verification is mandatory (STRIDE T-12-05-01):** Manual erasure bypasses the automated email confirmation flow. You must confirm that identity verification was completed in the database before triggering manual erasure.

> **WARNING (T-12-05-04 Repudiation):** All manual erasure triggers must be logged. The procedure below includes a step to document the manual trigger in `ccpa_erasure_records`. Do not skip the audit step.

---

## Prerequisites

### Required access
- `super_admin` session on Payload admin (for compliance team access)
- `DATABASE_URL_DIRECT` from Doppler (Postgres direct connection — bypasses PgBouncer for admin queries)
- `REDIS_URL` from Doppler (for BullMQ manual enqueue and monitoring)
- Node.js + pnpm available (for `npx tsx` commands)

```bash
# Verify direct DB access
psql "$DATABASE_URL_DIRECT" -c "SELECT current_database(), NOW();"

# Verify Redis access
redis-cli -u "$REDIS_URL" PING
# Expected: PONG
```

### Required information

Before starting, gather:
- User email address: `user@example.com`
- Erasure request ID: `REQ-<uuid>` (from `ccpa_erasure_records.request_id`)
- Agency slug: `web-ecommerce` (the agency whose data is to be erased)

---

## Procedure

### Step 1 — Identify the erasure request

```bash
# Find the erasure request record
psql "$DATABASE_URL_DIRECT" -c "
  SELECT request_id, email, status, created_at, completed_at, audit_rows
  FROM ccpa_erasure_records
  WHERE email = 'user@example.com'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

Note the `request_id` (format: `REQ-<uuid>`) and current `status`.

### Step 2 — Confirm identity verification was completed

> **This step is mandatory.** Do not proceed to Step 3 without confirming identity verification.

```bash
# Confirm identity verification status
psql "$DATABASE_URL_DIRECT" -c "
  SELECT request_id, email, status, identity_verified_at, identity_verification_method
  FROM ccpa_erasure_records
  WHERE request_id = 'REQ-123'
  AND status = 'confirmed';
"
```

Expected: one row returned with `status = 'confirmed'` and a non-null `identity_verified_at` timestamp.

If `status` is `pending` or `identity_verified_at` is null, identity verification has not been completed. Contact the privacy officer to complete the verification via the standard email confirmation flow before proceeding.

### Step 3 — Manual BullMQ queue enqueue

```bash
# Enqueue the erasure job manually
# Replace email and requestId with the values from Step 1
doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const q = new Queue('ccpa-erasure', {
  connection: { url: process.env.REDIS_URL }
})
const job = await q.add('erasure', {
  email: 'user@example.com',
  requestId: 'REQ-123',
  agencySlug: 'web-ecommerce',
  triggeredBy: 'manual-runbook',
  triggeredAt: new Date().toISOString()
})
console.log('Job enqueued:', job.id)
await q.close()
"
```

Record the job ID from the output for monitoring in Step 4.

### Step 4 — Monitor the 7-system fan-out

```bash
# Subscribe to BullMQ completion events for the ccpa-erasure queue
redis-cli -u "$REDIS_URL" SUBSCRIBE bullmq:ccpa-erasure:completed
# Leave this running in a separate terminal

# In another terminal — monitor job progress
doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue, QueueEvents } from 'bullmq'
const qe = new QueueEvents('ccpa-erasure', {
  connection: { url: process.env.REDIS_URL }
})
qe.on('completed', ({ jobId, returnvalue }) => {
  console.log('Job completed:', jobId, returnvalue)
})
qe.on('failed', ({ jobId, failedReason }) => {
  console.error('Job failed:', jobId, failedReason)
})
// Wait for 10 minutes max
setTimeout(() => { qe.close(); process.exit(0) }, 600000)
"
```

Expected: job completes within 2-5 minutes if all 7 systems are responsive. The worker in `packages/compliance/src/erasure/worker.ts` fans out to all 7 modules concurrently.

### Step 5 — Verify all 7 systems deleted

```bash
# Check audit_rows count in ccpa_erasure_records (should be 7 for completed erasure)
psql "$DATABASE_URL_DIRECT" -c "
  SELECT request_id, email, status, completed_at, audit_rows,
         jsonb_pretty(deletion_results) AS deletion_results
  FROM ccpa_erasure_records
  WHERE request_id = 'REQ-123';
"
```

Expected: `status = 'completed'`, `audit_rows = 7`, and all 7 system entries in `deletion_results` showing `deleted: true`.

If `audit_rows < 7`, identify which system failed from `deletion_results` and re-run that specific module directly (see Failure Diagnostics).

### Step 6 — Confirm receipt PDF uploaded to R2

The worker in `packages/compliance/src/erasure/generate-pdf.ts` generates a compliance receipt PDF and uploads it to R2 via `packages/compliance/src/erasure/upload-r2.ts`.

```bash
# Verify receipt PDF exists in R2 erasure-receipts bucket
wrangler r2 object list "mjagency-media" \
  --prefix="erasure-receipts/REQ-123" \
  --remote
# Expected: one or more objects listed (the PDF receipt)
```

If the PDF is missing, re-run the PDF generation and upload step:
```bash
doppler run --project mjagency-shared --config prd -- npx tsx \
  packages/compliance/src/erasure/generate-pdf.ts \
  --requestId=REQ-123 --email=user@example.com
```

### Step 7 — Log the manual trigger (mandatory audit step)

Update `ccpa_erasure_records` to document the manual trigger:

```bash
psql "$DATABASE_URL_DIRECT" -c "
  UPDATE ccpa_erasure_records
  SET manual_trigger_at = NOW(),
      manual_trigger_by = 'privacy-officer@mjagency.com',
      manual_trigger_reason = 'Automated flow failed; manual runbook executed'
  WHERE request_id = 'REQ-123';
"
```

After this update, the audit chain trigger will record the UPDATE in `audit_log`. This satisfies T-12-05-04 (Repudiation mitigation).

---

## Verification

1. **Erasure record shows completed status:**
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "
     SELECT * FROM ccpa_erasure_records WHERE request_id = 'REQ-123';
   "
   # Expected: status='completed', completed_at is set, audit_rows=7
   ```

2. **User no longer exists in Postgres:**
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "
     SELECT id, email FROM users WHERE email = 'user@example.com';
   "
   # Expected: 0 rows
   ```

3. **No Redis keys for this user:**
   ```bash
   redis-cli -u "$REDIS_URL" KEYS "*user@example.com*"
   redis-cli -u "$REDIS_URL" KEYS "*user-id-from-db*"
   # Expected: 0 keys
   ```

4. **GA4 deletion request filed** (check `docs/runbooks/ga4-data-deletion.md` for follow-up):
   ```bash
   psql "$DATABASE_URL_DIRECT" -c "
     SELECT ga4_deletion_request_id, ga4_deletion_status
     FROM ccpa_erasure_records WHERE request_id = 'REQ-123';
   "
   ```

---

## Failure Diagnostics

**Symptom:** BullMQ job fails with "REDIS_URL not set" or connection refused.
**Check:** Confirm `REDIS_URL` is set: `doppler secrets get REDIS_URL --project mjagency-shared --config prd`.
**Fix:** Ensure the `doppler run` prefix is included in the `npx tsx` command. If Redis is down, follow `docs/runbooks/redis-flush.md` prerequisites to restore Redis connectivity first.

**Symptom:** Fan-out partial — `audit_rows < 7` after job completes.
**Check:** Inspect `deletion_results` in `ccpa_erasure_records` to identify which system failed. Look for worker logs: `pm2 logs ccpa-worker --lines 100`.
**Fix:** Re-run the specific failed module directly:
```bash
# Example: re-run GA4 deletion
doppler run --project mjagency-shared --config prd -- npx tsx \
  packages/compliance/src/erasure/ga4-delete.ts \
  --email=user@example.com --requestId=REQ-123
```

**Symptom:** Step 2 confirmation shows `status = 'pending'` (identity not verified).
**Check:** The user did not complete the email confirmation link. The link expires after 48 hours per `packages/compliance/src/erasure/token.ts`.
**Fix:** Do NOT proceed with manual erasure without completed identity verification — this is a legal requirement. Contact the user or privacy officer to re-initiate the erasure request with a fresh email confirmation.

**Symptom:** Receipt PDF generation fails with "R2 upload error".
**Check:** R2 credentials may be expired or the `mjagency-media` bucket may be at capacity.
**Fix:** Verify R2 credentials: `doppler secrets get R2_ACCESS_KEY --project mjagency-shared --config prd`. Re-run `packages/compliance/src/erasure/upload-r2.ts` with fresh credentials.

**Symptom:** `psql` cannot connect via `DATABASE_URL_DIRECT`.
**Check:** The `DATABASE_URL_DIRECT` bypasses PgBouncer — it requires direct VPS connectivity. Confirm VPS SSH tunnel or direct network access.
**Fix:** Set up an SSH tunnel if operating remotely: `ssh -L 5432:localhost:5432 <vps-user>@<vps-host>`, then set `DATABASE_URL_DIRECT=postgresql://app_user:<pass>@localhost:5432/<db>`.
