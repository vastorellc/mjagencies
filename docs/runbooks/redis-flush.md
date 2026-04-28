# Redis Cache Flush Runbook

**Audience:** Platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/bullmq-queue-drain.md`, `docs/runbooks/incident-response.md`

---

## Overview

This runbook covers flushing the Redis cache for a single agency or all 12 agencies. Use when cache corruption is detected, stale data is being served, or analytics dashboards show stale GA4/Clarity data.

**Key principle:** Never use `FLUSHALL` or `FLUSHDB` on the shared Redis instance. The Redis instance is shared across all agencies and also stores BullMQ queues (including the `ccpa-erasure` queue). Targeted key deletion by prefix is the only safe approach.

**Redis key naming conventions (CLAUDE.md §STACK QUICK REFERENCE):**
- Cache keys: `agency:<id>:cache:<key>`
- BullMQ queue keys: `agency:<id>:<queue-name>` (managed by BullMQ — do not delete manually)
- Session / auth keys: `agency:<id>:session:<token>` (do not flush during active sessions)
- Stripe idempotency: `stripe:event:<evt_id>` (do not flush unless explicitly re-processing)

---

## Prerequisites

### Required access
- Redis CLI installed locally or accessible on the VPS
- `REDIS_URL` from Doppler (includes auth credentials)

```bash
# Get REDIS_URL from Doppler
doppler secrets get REDIS_URL --project mjagency-shared --config prd
```

### Verify Redis connectivity

```bash
redis-cli -u "$REDIS_URL" PING
# Expected: PONG
```

### Agency slug to ID mapping

All 12 agency slugs (used in cache key prefixes):

```
web-ecommerce, web-realestate, web-healthcare, web-legal,
web-homeservices, web-fitness, web-dental, web-automotive,
web-restaurant, web-education, web-financial, web-petcare
```

---

## Procedure

### Step 1 — Identify stale cache keys

Before flushing, confirm which keys are stale:

```bash
# List all cache keys for a single agency
redis-cli -u "$REDIS_URL" KEYS "agency:web-ecommerce:cache:*"

# Check TTL on a specific key
redis-cli -u "$REDIS_URL" TTL "agency:web-ecommerce:cache:dashboard:ga4:today"

# Count cache keys per agency
redis-cli -u "$REDIS_URL" KEYS "agency:web-ecommerce:cache:*" | wc -l
```

### Step 2 — Flush cache for a single agency

```bash
# Delete all cache keys for a specific agency (safe — cache prefix only)
AGENCY_SLUG="web-ecommerce"

# List keys first to confirm scope
redis-cli -u "$REDIS_URL" KEYS "agency:${AGENCY_SLUG}:cache:*"

# Delete matching keys
redis-cli -u "$REDIS_URL" --scan --pattern "agency:${AGENCY_SLUG}:cache:*" \
  | xargs -r redis-cli -u "$REDIS_URL" DEL
```

**Note:** `--scan` is safe for production — it uses cursor-based iteration and does not block Redis. Avoid `KEYS` in production for large keyspaces (it blocks); the pattern above uses `--scan` for the actual deletion.

### Step 3 — Flush cache for all 12 agencies

Run only when stale data is confirmed across all agencies (e.g., after a GA4 tracking ID update):

```bash
for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare; do
  echo "Flushing cache for ${slug}..."
  redis-cli -u "$REDIS_URL" --scan --pattern "agency:${slug}:cache:*" \
    | xargs -r redis-cli -u "$REDIS_URL" DEL
  echo "Done: ${slug}"
done
```

### Step 4 — Targeted flush for specific cache types

**GA4 analytics cache only** (stale dashboard data):
```bash
redis-cli -u "$REDIS_URL" --scan --pattern "agency:*:cache:dashboard:ga4:*" \
  | xargs -r redis-cli -u "$REDIS_URL" DEL
```

**Session cache only** (force re-auth for an agency — use with caution during business hours):
```bash
# WARNING: This logs out all active users for this agency
redis-cli -u "$REDIS_URL" --scan --pattern "agency:web-{slug}:session:*" \
  | xargs -r redis-cli -u "$REDIS_URL" DEL
```

**CRM/analytics aggregation cache:**
```bash
redis-cli -u "$REDIS_URL" --scan --pattern "agency:web-ecommerce:cache:crm:*" \
  | xargs -r redis-cli -u "$REDIS_URL" DEL
```

### Step 5 — What NOT to flush

The following key patterns must never be deleted with cache flush commands:

- `bullmq:*` — BullMQ internal metadata. Use `docs/runbooks/bullmq-queue-drain.md` instead.
- `ccpa-erasure:*` — Active CCPA erasure queue. Use `docs/runbooks/ccpa-erasure-manual.md`.
- `stripe:event:*` — Stripe idempotency keys. Use `docs/runbooks/stripe-webhook-redeliver.md`.

```bash
# Verify no BullMQ keys will be touched (should return empty)
redis-cli -u "$REDIS_URL" --scan --pattern "agency:web-ecommerce:cache:*" \
  | grep -E "bullmq|ccpa-erasure|stripe"
# Expected: no output (empty = safe to proceed)
```

---

## Verification

After flushing, verify that cache keys are repopulated by the next request:

1. **Cache key count after flush (should be 0):**
   ```bash
   redis-cli -u "$REDIS_URL" KEYS "agency:web-ecommerce:cache:*" | wc -l
   # Expected: 0
   ```

2. **Trigger a request to repopulate:**
   ```bash
   curl -s "https://web-ecommerce.mjagency.com/admin/dashboard" \
     -H "Cookie: access_token=<valid_token>" -o /dev/null -w "%{http_code}"
   # Expected: 200
   ```

3. **GA4 cache key repopulates within 5 minutes:**
   ```bash
   # Wait ~5 minutes, then check
   redis-cli -u "$REDIS_URL" KEYS "agency:web-ecommerce:cache:dashboard:ga4:*"
   # Expected: one or more keys present
   ```

4. **Confirm no BullMQ queues were affected:**
   ```bash
   redis-cli -u "$REDIS_URL" KEYS "bullmq:*" | wc -l
   # Should be same count as before flush (no change)
   ```

---

## Failure Diagnostics

**Symptom:** Stale analytics data shown on dashboard despite cache flush.
**Check:** Confirm the correct agency ID is used in the cache key. Run `redis-cli -u "$REDIS_URL" KEYS "agency:*:cache:dashboard:ga4:*"` to see all GA4 cache keys and confirm the slug matches.
**Fix:** If keys are still present after deletion, Redis may be using cluster mode — run the scan/delete on the correct shard. Alternatively, confirm `REDIS_URL` in Doppler is the production Redis, not a staging instance.

**Symptom:** `redis-cli -u "$REDIS_URL" PING` returns `NOAUTH` or `WRONGPASS`.
**Check:** `REDIS_URL` may be malformed or the auth token may have changed.
**Fix:** Re-fetch `REDIS_URL` from Doppler: `doppler secrets get REDIS_URL --project mjagency-shared --config prd`. If using a local `redis-cli`, ensure the URL includes the auth token: `redis://:<password>@<host>:<port>`.

**Symptom:** `xargs redis-cli DEL` reports 0 keys deleted but `KEYS` showed keys present.
**Check:** Redis key pattern syntax — ensure the `*` glob is not being escaped by the shell.
**Fix:** Wrap the pattern in single quotes: `redis-cli -u "$REDIS_URL" --scan --pattern 'agency:web-ecommerce:cache:*'`.

**Symptom:** App performance degrades immediately after cache flush.
**Check:** This is expected — cache cold start. Monitor for 5 minutes. If performance does not recover, the underlying DB query may be slow.
**Fix:** Check slow query log: `psql "$DATABASE_URL_DIRECT" -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"`. If queries are slow, add missing indexes or optimize the query before the next cache flush.
