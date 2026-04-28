# Incident Response Runbook

**Audience:** On-call engineers, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/dr-drill.md`, `docs/runbooks/cloudflare-waf-toggle.md`, `docs/runbooks/bullmq-queue-drain.md`, `docs/runbooks/db-failover.md`

---

## Overview

This runbook defines the end-to-end incident response procedure for the MJAgency platform — from detection through declaration, isolation, resolution, and post-mortem. Operators follow this runbook for all severity levels.

### Incident Severity Matrix

| Severity | Response SLA | Resolution SLA | Definition | Examples |
|----------|-------------|----------------|------------|---------|
| **P1** | 5 minutes | 1 hour | Complete platform outage or data breach | All 12 agencies down, DB unreachable, auth broken platform-wide |
| **P2** | 15 minutes | 4 hours | Single agency or single critical feature down | One agency 502, Stripe webhooks failing, Payload admin unavailable |
| **P3** | 1 hour | 24 hours | Degraded performance or non-critical feature failure | Slow page loads (LCP > 4s), GA4 not ingesting, BullMQ backlog |
| **P4** | Next business day | 72 hours | Cosmetic or low-impact issues | Broken image, missing meta tag, Clarity not tracking one page |

**SLA source:** PROJECT.md (RPO 1h, RTO 4h) and REQ-156.

---

## Prerequisites

### Required access
- PagerDuty on-call account (receive pages, escalate)
- Cloudflare dashboard (`CLOUDFLARE_API_TOKEN` in Doppler — `Zone:Edit` + `Zone WAF:Edit`)
- Doppler super_admin (`doppler login` on your workstation)
- VPS SSH access (production host for PM2/Postgres restarts)
- Grafana OTel dashboard access (observability stack — see `docs/runbooks/observability.md`)

### Verify on-call rotation

```bash
# Confirm you are the active on-call engineer
doppler secrets get ONCALL_ENGINEER --project mjagency-shared --config prd
```

---

## Procedure

### Step 1 — Detect and Classify

First, confirm the platform health status across all 12 agencies:

```bash
# Health check all 12 agencies (run from local or VPS)
for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${slug}.mjagency.com/api/health")
  echo "${slug}: ${HTTP}"
done
```

Expected: all return `200`. Any non-200 is an incident candidate.

Check OTel Grafana for error rate spikes:

```bash
# Open OTel dashboard — URL stored in Doppler
doppler secrets get GRAFANA_URL --project mjagency-shared --config prd
```

Navigate to the **Error Rate** panel. P1 threshold: >10% error rate on any agency for 2+ minutes.

### Step 2 — Declare Incident Severity

Based on the health check and OTel data, declare a severity level using the matrix above.

Announce in the incident channel immediately:

```
INC-<YYYYMMDD-HHMM> declared
Severity: P{1|2|3|4}
Scope: {agency slug(s) or "platform-wide"}
Symptom: {one-line description}
On-call: {your name}
```

For P1/P2: open a video call immediately and page the secondary on-call via PagerDuty.

### Step 3 — Engage On-Call Rotation

| Severity | Who to page |
|----------|-------------|
| P1 | Primary + secondary on-call + engineering lead |
| P2 | Primary on-call + secondary on-call |
| P3 | Primary on-call only |
| P4 | Assign as ticket, no page required |

```bash
# PagerDuty CLI — trigger manual alert
pd alert trigger --summary "P1 INC-$(date +%Y%m%d-%H%M): {description}" \
  --severity critical --source mjagency-platform
```

### Step 4 — Isolate Fault Domain

Determine where the fault lies and apply the appropriate isolation action:

**Option A — WAF blocking legitimate traffic:**
Follow `docs/runbooks/cloudflare-waf-toggle.md` to switch WAF to log-only mode.

```bash
cd infra/cloudflare
terraform apply -var="enable_enforcing=false"
```

**Option B — Database primary down:**
Follow `docs/runbooks/db-failover.md` to promote replica or restore from pgBackRest.

**Option C — BullMQ queue backlog causing timeouts:**
Follow `docs/runbooks/bullmq-queue-drain.md` to drain the affected queue.

```bash
# Check queue depths across all agency queues
for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare; do
  echo "=== ${slug} ==="
  redis-cli -u "$REDIS_URL" KEYS "agency:${slug}:*" | head -5
done
```

**Option D — App process crashed:**

```bash
# Check PM2 status
pm2 status

# Restart a specific agency app
pm2 restart web-{slug}

# Restart all agency apps
pm2 restart all
```

**Option E — Canary deploy caused regression:**
Roll back the canary deployment immediately:

```bash
# Cloudflare Workers weighted routing rollback
wrangler rollback --env production
```

Do NOT toggle WAF to enforcing during an active canary deploy window (see `cloudflare-waf-toggle.md`).

### Step 5 — Resolve and Post-Mortem

Once the platform is stable, confirm resolution:

```bash
# Re-run health check
for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${slug}.mjagency.com/api/health")
  echo "${slug}: ${HTTP}"
done
```

Declare resolution in the incident channel:
```
INC-<ID> RESOLVED at <timestamp>
Duration: {start} → {end}
Root cause: {brief description}
Fix applied: {one-line}
Post-mortem: {link to doc or 'TBD within 48h'}
```

**Post-mortem requirements (P1/P2):**
- Complete within 48 hours of resolution
- Cover timeline, root cause, contributing factors, action items
- Archive in `.dr-drill/` or incident management system

---

## Verification

After the incident is resolved, confirm all agencies are healthy:

1. **All-agency health check:**
   ```bash
   for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
               web-fitness web-dental web-automotive web-restaurant web-education \
               web-financial web-petcare; do
     HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${slug}.mjagency.com/api/health")
     [ "$HTTP" -eq 200 ] && echo "OK: ${slug}" || echo "FAIL: ${slug} returned ${HTTP}"
   done
   ```
   All 12 agencies must return `200`.

2. **OTel error rate:** Grafana Error Rate panel must be below 1% for 5+ consecutive minutes.

3. **BullMQ queues:** No stuck jobs — `getJobCounts()` shows `active: 0` and `delayed: 0` on critical queues.

4. **WAF state:** If WAF was toggled to log-only, re-enable enforcing mode after incident is resolved:
   ```bash
   cd infra/cloudflare && terraform apply -var="enable_enforcing=true"
   ```

---

## Failure Diagnostics

**Symptom:** High error rate across all agencies simultaneously.
**Check:** OTel Grafana → Error Rate panel → filter by `service.name`. If all agencies spike at the same time, the fault is in shared infrastructure (Postgres, Redis, PgBouncer, or platform middleware).
**Fix:** Check `pm2 status` for crashed processes. Check `journalctl -u postgresql` for DB errors. Check `redis-cli -u $REDIS_URL PING` — if timeout, Redis is the fault. Follow `db-failover.md` or `redis-flush.md` as appropriate.

**Symptom:** Single agency returns 502/503, others healthy.
**Check:** `pm2 logs web-{slug} --lines 50` — look for startup errors, unhandled exceptions, or missing env vars.
**Fix:** Restart the agency app: `pm2 restart web-{slug}`. If it fails to start, check Doppler env vars for that agency: `doppler secrets get DATABASE_URL --project mjagency-{slug} --config prd`.

**Symptom:** Auth broken — users cannot log in platform-wide.
**Check:** `curl -s https://web-ecommerce.mjagency.com/api/auth/session` — should return JSON with session data. If it returns 401 or an error, JWT_SECRET may have been rotated without redeployment.
**Fix:** Confirm JWT_SECRET in Doppler matches deployed worker. Follow `docs/runbooks/secrets-rotation.md` if rotation was the cause.

**Symptom:** WAF blocking legitimate agency admin users.
**Check:** Cloudflare dashboard → Security → Events → filter last 1 hour. Look for admin routes being blocked.
**Fix:** Toggle WAF to log-only (`cloudflare-waf-toggle.md`), add the admin IP to allowlist, then re-enable enforcing mode.

**Symptom:** P1 declared but /api/health returns 200 on all agencies.
**Check:** Health endpoint may not check all subsystems. Verify Stripe webhooks: `stripe events retrieve evt_latest`. Verify Payload admin: `curl -s https://web-ecommerce.mjagency.com/admin/login` returns non-500.
**Fix:** Identify the specific failing subsystem and follow the relevant runbook (stripe-webhook-redeliver.md, payload-backup-restore.md, etc.).
