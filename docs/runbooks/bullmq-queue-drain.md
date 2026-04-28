# BullMQ Queue Drain Runbook

**Audience:** Platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/ccpa-erasure-manual.md`, `docs/runbooks/redis-flush.md`, `docs/runbooks/incident-response.md`

---

## Overview

This runbook covers draining a BullMQ queue for a specific agency. Use for:
- Queue backlog clearance (too many stuck or delayed jobs)
- Bad job removal (jobs that always fail and cause noise)
- Pre-deploy flush (clear delayed jobs that reference code about to change)
- Incident containment (stop a misbehaving queue from consuming resources)

**Queue naming conventions (CLAUDE.md §STACK QUICK REFERENCE):**
All BullMQ queues are prefixed with the agency slug: `agency:<slug>:<queue-name>`

| Queue name | Purpose |
|------------|---------|
| `agency:<slug>:email` | Transactional email (via BullMQ async — never synchronous) |
| `agency:<slug>:crm` | CRM lead/deal processing |
| `agency:<slug>:analytics` | GA4/Clarity event batching |
| `agency:<slug>:booking` | Cal.com booking sync |
| `agency:<slug>:render` | Puck page render cache invalidation |
| `ccpa-erasure` | CCPA 7-system fan-out (shared — see WARNING below) |
| `stripe-events` | Stripe webhook event processing (shared) |

> **WARNING:** Do NOT drain the `ccpa-erasure` queue. CCPA erasure jobs represent legally-obligated user data deletion requests. Draining this queue would cause compliance failures and potential regulatory penalties. Use `docs/runbooks/ccpa-erasure-manual.md` for controlled processing of individual requests.

> **WARNING:** Do NOT drain the `stripe-events` queue during active payment processing. Draining this queue will cause missed payment confirmations, failed subscription activations, and invoice processing failures. If the Stripe events queue is backing up, investigate the worker first.

---

## Prerequisites

### Required access
- `REDIS_URL` from Doppler (BullMQ uses Redis as its backend)
- Node.js + pnpm available (for `npx tsx` inline scripts)

```bash
# Verify Redis connectivity
redis-cli -u "$REDIS_URL" PING
# Expected: PONG

# Get queue depths overview (all agency queues)
redis-cli -u "$REDIS_URL" KEYS "bull:agency:*" | head -30
```

---

## Procedure

### Step 1 — Inspect queue depths before draining

Always check current job counts before draining to understand the scope:

```bash
# Check queue counts for a specific agency queue
AGENCY_SLUG="web-ecommerce"
QUEUE_NAME="email"

doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const q = new Queue('agency:${AGENCY_SLUG}:${QUEUE_NAME}', {
  connection: { url: process.env.REDIS_URL }
})
const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed')
console.log('Queue: agency:${AGENCY_SLUG}:${QUEUE_NAME}')
console.log('Counts:', JSON.stringify(counts, null, 2))
await q.close()
"
```

### Step 2 — Drain waiting jobs

Draining removes all jobs currently in the `waiting` and `delayed` states. Active jobs (being processed by a worker) are NOT drained — they complete normally.

```bash
doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const QUEUE = 'agency:${AGENCY_SLUG}:${QUEUE_NAME}'
const q = new Queue(QUEUE, {
  connection: { url: process.env.REDIS_URL }
})
console.log('Draining queue:', QUEUE)
await q.drain()
const counts = await q.getJobCounts('waiting', 'active', 'delayed')
console.log('Post-drain counts:', counts)
await q.close()
"
```

### Step 3 — Clean completed and failed jobs

After draining, remove accumulated completed and failed job records (these accumulate and consume Redis memory):

```bash
doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const q = new Queue('agency:${AGENCY_SLUG}:${QUEUE_NAME}', {
  connection: { url: process.env.REDIS_URL }
})
// Clean completed jobs older than 0ms (all), keep max 100 (for recent audit)
const completedCleaned = await q.clean(0, 100, 'completed')
console.log('Completed jobs cleaned:', completedCleaned.length)
// Clean failed jobs older than 0ms (all), keep max 50
const failedCleaned = await q.clean(0, 50, 'failed')
console.log('Failed jobs cleaned:', failedCleaned.length)
await q.close()
"
```

### Step 4 — Drain all agency queues for one agency

For pre-deploy flushes or incident containment across all queues of a single agency:

```bash
AGENCY_SLUG="web-ecommerce"

doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const connection = { url: process.env.REDIS_URL }
const queues = ['email', 'crm', 'analytics', 'booking', 'render']
for (const name of queues) {
  const qName = \`agency:${AGENCY_SLUG}:\${name}\`
  const q = new Queue(qName, { connection })
  await q.drain()
  await q.clean(0, 50, 'completed')
  await q.clean(0, 50, 'failed')
  const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed')
  console.log(\`\${qName}:\`, counts)
  await q.close()
}
"
```

**Do NOT include `ccpa-erasure` or `stripe-events` in this list.**

### Step 5 — Remove specific bad jobs by ID

If only specific jobs are problematic (e.g., a job that causes the worker to crash):

```bash
BAD_JOB_ID="<job-id-from-bull-dashboard-or-logs>"

doppler run --project mjagency-shared --config prd -- npx tsx -e "
import { Queue } from 'bullmq'
const q = new Queue('agency:web-ecommerce:email', {
  connection: { url: process.env.REDIS_URL }
})
const job = await q.getJob('${BAD_JOB_ID}')
if (job) {
  await job.remove()
  console.log('Removed job:', '${BAD_JOB_ID}')
} else {
  console.log('Job not found:', '${BAD_JOB_ID}')
}
await q.close()
"
```

### Step 6 — Restart the BullMQ worker after draining

After draining, the worker process may need to be restarted (especially if it was stuck on a bad job):

```bash
# Restart the queue worker process
pm2 restart queue-worker-{slug}

# Or restart all workers
pm2 restart all --grep="queue-worker"

# Verify worker is running
pm2 status | grep "queue-worker"
# Expected: online status
```

---

## Verification

After draining and restarting the worker:

1. **Queue counts return to zero for drained states:**
   ```bash
   doppler run --project mjagency-shared --config prd -- npx tsx -e "
   import { Queue } from 'bullmq'
   const q = new Queue('agency:web-ecommerce:email', {
     connection: { url: process.env.REDIS_URL }
   })
   const counts = await q.getJobCounts('waiting', 'active', 'delayed')
   console.log('Counts after drain:', counts)
   await q.close()
   "
   # Expected: { waiting: 0, active: 0, delayed: 0 }
   ```

2. **Worker is processing new jobs:**
   ```bash
   # Enqueue a test job and verify it processes
   pm2 logs queue-worker-{slug} --lines 20
   # Expected: log entries showing job processing, no crash restarts
   ```

3. **Email queue test (for email workers):**
   ```bash
   # Verify email worker is healthy by checking BullMQ health endpoint
   curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.queues'
   # Expected: {"email": "healthy", "crm": "healthy"}
   ```

4. **CCPA erasure queue untouched:**
   ```bash
   doppler run --project mjagency-shared --config prd -- npx tsx -e "
   import { Queue } from 'bullmq'
   const q = new Queue('ccpa-erasure', {
     connection: { url: process.env.REDIS_URL }
   })
   const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed')
   console.log('ccpa-erasure queue counts:', counts)
   await q.close()
   "
   # These counts should be unchanged from before the drain operation
   ```

---

## Failure Diagnostics

**Symptom:** Queue drain completes but new jobs immediately back up (counts climb back to thousands within minutes).
**Check:** A worker is stuck in a crash loop and re-enqueuing failed jobs on each crash.
**Fix:** Stop the worker first: `pm2 stop queue-worker-{slug}`. Inspect failed jobs: `await q.getFailed()` — look for jobs with high `attemptsMade`. Remove the bad jobs (Step 5), fix the underlying bug, then restart the worker.

**Symptom:** `npx tsx -e "..."` fails with "Cannot find module 'bullmq'".
**Check:** `node_modules` may not be installed in the expected location.
**Fix:** Run from the repo root after `pnpm install`: `cd /path/to/repo && pnpm install`. Then use `pnpm --filter=@mjagency/queue tsx` instead of bare `npx tsx`.

**Symptom:** Worker process crashes immediately after restart.
**Check:** `pm2 logs queue-worker-{slug} --lines 50` — look for startup errors (missing env vars, Redis connection refused).
**Fix:** Verify Redis is accessible: `redis-cli -u "$REDIS_URL" PING`. Verify env vars are loaded: `doppler run -- node -e "console.log(process.env.REDIS_URL ? 'OK' : 'MISSING')"`. Check for OOM (out of memory) if the queue had millions of jobs before draining.

**Symptom:** `q.drain()` times out (no response for >60 seconds).
**Check:** Redis may have a large keyspace and the drain is scanning slowly. Check Redis memory: `redis-cli -u "$REDIS_URL" INFO memory | grep used_memory_human`.
**Fix:** If Redis memory is exhausted (>80% used), drain using a cursor-based approach or restart Redis with AOF persistence. As a last resort, delete specific BullMQ queue keys directly: `redis-cli -u "$REDIS_URL" DEL bull:agency:web-ecommerce:email:waiting`.
