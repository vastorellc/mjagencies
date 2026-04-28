# Stripe Webhook Re-delivery Runbook

**Audience:** Payments team, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/bullmq-queue-drain.md`, `docs/runbooks/secrets-rotation.md`, `docs/runbooks/incident-response.md`

---

## Overview

This runbook covers re-delivering failed Stripe webhook events to the MJAgency platform. Use when the webhook endpoint was down, returned a non-2xx response, or experienced a processing error during event delivery.

**Webhook endpoint:** Each agency has a webhook endpoint at `https://web-{slug}.mjagency.com/api/webhooks/stripe`

**Retry policy:** Stripe retries failed deliveries for up to 3 days with exponential backoff. After 3 days, events expire and must be re-sent manually.

> **WARNING — Raw body requirement (CLAUDE.md §7):** The Stripe webhook handler uses `req.text()` for raw body reading, not `req.json()`. Never send a parsed JSON body to `stripe.webhooks.constructEvent()`. If you test by posting directly to the endpoint, post the raw Stripe event JSON exactly as Stripe sends it. Any JSON re-serialization will break the HMAC signature and cause a 400 response.

**Idempotency:** The webhook handler stores processed event IDs in Redis: `stripe:event:{evt_id}`. Before re-delivering an event, check whether it was already processed. If it was, either delete the Redis key (to allow re-processing) or verify the processing outcome first.

---

## Prerequisites

### Required access
- Stripe Dashboard with Developer permissions (to view and resend events)
- Stripe CLI installed (for CLI-based re-delivery)
- `STRIPE_WEBHOOK_SECRET` from Doppler (for HMAC signature verification)
- `REDIS_URL` from Doppler (for idempotency key management)

```bash
# Verify Stripe CLI is installed
stripe version
# Expected: stripe version x.x.x

# Verify Stripe CLI is authenticated
stripe config --list
# Expected: device_name and api_key listed
```

---

## Procedure

### Step 1 — Find failed webhook events

**Via Stripe Dashboard:**
1. Log in to Stripe Dashboard → select the live mode environment
2. Navigate to Developers → Webhooks
3. Click on the MJAgency webhook endpoint
4. Click "Recent deliveries" tab
5. Filter by status: "Failed" or "Not delivered"
6. Note the event IDs (format: `evt_...`) that need re-delivery

**Via Stripe CLI:**
```bash
# List recent events (last 50)
stripe events list --limit=50

# Filter for failed deliveries to a specific endpoint
stripe events list --limit=50 \
  --delivery-success=false \
  | jq '.data[] | {id: .id, type: .type, created: .created}'
```

### Step 2 — Check Redis idempotency key before re-delivery

```bash
# Check if the event was already processed
EVENT_ID="evt_1ABC123DEF456"

redis-cli -u "$REDIS_URL" GET "stripe:event:${EVENT_ID}"
# Expected: "1" if already processed, nil if not yet processed
```

If `"1"` is returned, the event was processed. Verify the outcome before re-delivering:

```bash
# Check that the expected side effect occurred (e.g., invoice created, subscription updated)
# Look in the agency DB for the relevant record
psql "$DATABASE_URL_DIRECT" -c "
  SELECT * FROM stripe_events WHERE stripe_event_id = '${EVENT_ID}' LIMIT 1;
"
```

If the outcome is correct, do NOT re-deliver — it would create a duplicate. If the outcome is missing or incorrect, proceed to delete the idempotency key and re-deliver (Step 4).

### Step 3 — Re-deliver via Stripe Dashboard

1. In Stripe Dashboard → Developers → Webhooks → endpoint → Recent deliveries
2. Click on the failed event
3. Click "Resend" button
4. Confirm the event was sent (status changes to "Pending")

### Step 4 — Re-deliver via Stripe CLI

```bash
# Re-deliver a specific event by event ID
stripe events resend evt_1ABC123DEF456

# Re-deliver to a specific webhook endpoint (if multiple endpoints exist)
stripe events resend evt_1ABC123DEF456 \
  --webhook-endpoint=we_1ABC123DEF456
```

If the idempotency key exists and you need to re-process (after confirming the first processing failed):

```bash
# Delete the idempotency key to allow single re-processing
redis-cli -u "$REDIS_URL" DEL "stripe:event:${EVENT_ID}"

# Then re-deliver
stripe events resend evt_1ABC123DEF456
```

> **WARNING (duplicate invoice risk):** Deleting the idempotency key and re-delivering an event that was partially processed can create duplicate records (e.g., two invoices for the same payment). Always verify the processing outcome FIRST before deleting the idempotency key. Only delete the key if you have confirmed the original processing was a no-op (no side effects were applied).

### Step 5 — Bulk re-delivery for events during a downtime window

If the endpoint was down for a period and multiple events need re-delivery:

```bash
# List all events that failed in a specific time window
# (Stripe events are available for 30 days)
SINCE_TIMESTAMP=$(date -d '2026-04-27 14:00:00 UTC' +%s)
UNTIL_TIMESTAMP=$(date -d '2026-04-27 16:00:00 UTC' +%s)

stripe events list \
  --created[gte]="${SINCE_TIMESTAMP}" \
  --created[lte]="${UNTIL_TIMESTAMP}" \
  --limit=100 \
  | jq -r '.data[].id' > /tmp/events-to-resend.txt

echo "Events to re-deliver: $(wc -l < /tmp/events-to-resend.txt)"

# Re-deliver each event with a 1-second delay to avoid rate limiting
while read -r event_id; do
  echo "Re-delivering: ${event_id}"
  # First check idempotency
  PROCESSED=$(redis-cli -u "$REDIS_URL" GET "stripe:event:${event_id}")
  if [ "$PROCESSED" = "1" ]; then
    echo "  Already processed — skipping"
  else
    stripe events resend "${event_id}"
    sleep 1
  fi
done < /tmp/events-to-resend.txt

rm /tmp/events-to-resend.txt
```

### Step 6 — Verify webhook endpoint health

After re-delivery, confirm the endpoint is accepting events:

```bash
# Trigger a test event from Stripe CLI
stripe trigger payment_intent.succeeded

# Watch endpoint logs
pm2 logs web-{slug} --lines 20 | grep "stripe"
```

Expected log line: `stripe webhook received: payment_intent.succeeded` (or similar, per the webhook handler logging in the agency app).

---

## Verification

1. **Events show as "Succeeded" in Stripe Dashboard:**
   - Navigate to Developers → Webhooks → endpoint → Recent deliveries
   - Verify the re-delivered events show status "Succeeded"

2. **Idempotency key is now set in Redis:**
   ```bash
   redis-cli -u "$REDIS_URL" GET "stripe:event:${EVENT_ID}"
   # Expected: "1" (processed)
   ```

3. **BullMQ shows the Stripe event was processed:**
   ```bash
   doppler run --project mjagency-shared --config prd -- npx tsx -e "
   import { Queue } from 'bullmq'
   const q = new Queue('stripe-events', {
     connection: { url: process.env.REDIS_URL }
   })
   const counts = await q.getJobCounts()
   console.log('Queue counts:', counts)
   await q.close()
   "
   # Expected: failed: 0 (or no increase from before re-delivery)
   ```

4. **Business object created/updated in DB:**
   ```bash
   # Verify the expected outcome (e.g., invoice record for payment_intent.succeeded)
   psql "$DATABASE_URL_DIRECT" -c "
     SELECT * FROM invoices WHERE stripe_payment_intent_id = '<pi_id>'
     ORDER BY created_at DESC LIMIT 1;
   "
   ```

---

## Failure Diagnostics

**Symptom:** Stripe endpoint returns 400 with "No signatures found matching the expected signature".
**Check:** The `STRIPE_WEBHOOK_SECRET` in Doppler may not match the signing secret for this endpoint.
**Fix:** Verify: Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret. Compare with `doppler secrets get STRIPE_WEBHOOK_SECRET --project mjagency-shared --config prd`. If they differ, update Doppler: `doppler secrets set STRIPE_WEBHOOK_SECRET="whsec_<exact-value>" --project mjagency-shared --config prd`, then redeploy.

**Symptom:** Webhook handler returns 500 on re-delivery.
**Check:** `pm2 logs web-{slug} --lines 50` — look for errors in the webhook handler. Common cause: the event payload references an object that was deleted.
**Fix:** Investigate the specific error. If the referenced Stripe object (e.g., `Customer`, `Subscription`) was deleted, the re-delivery will always fail — mark the event as acknowledged and document in the incident report.

**Symptom:** Duplicate invoice created after re-delivery.
**Check:** The idempotency key was missing (`DEL` was called before verifying outcome) and the event was processed twice.
**Fix:** Delete the duplicate invoice from the DB and Stripe. Notify the affected agency. Add a process note: always verify processing outcome before deleting idempotency keys.

**Symptom:** `stripe events resend` returns "Event not found" (event_id `evt_...`).
**Check:** Stripe events are only available for 30 days. If the event is older, it cannot be re-delivered via the API.
**Fix:** Reconstruct the expected side effect manually. For example, if a `payment_intent.succeeded` event was missed and an invoice was not created, create the invoice manually in the Stripe Dashboard or via the Stripe API, then update the DB accordingly.
