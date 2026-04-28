# Secrets Rotation Runbook

**Audience:** Security team, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/vault-audit.md`, `docs/runbooks/incident-response.md`, `docs/runbooks/stripe-webhook-redeliver.md`

---

## Overview

This runbook covers rotating secrets in Doppler for one or all agencies. It covers the four most critical secret categories: JWT signing keys, database passwords, Stripe API keys, and webhook secrets.

**All secrets are stored in Doppler (CLAUDE.md §7 — no secrets in NEXT_PUBLIC_ env vars, no secrets in git).** Never grep secrets from `.env` files or pass them as shell arguments in plain text. Always use `doppler secrets set` and `doppler run`.

> **Security note (STRIDE T-12-05-02):** After rotating `JWT_SECRET`, add the old secret to the Redis revocation list so in-flight tokens signed with the old key are rejected. This prevents a window where both old and new keys are valid simultaneously.

### Secrets scope and purpose

| Secret | Doppler project | Config | Purpose |
|--------|----------------|--------|---------|
| `JWT_SECRET` | `mjagency-shared` | `prd` | Signs all JWT access + refresh tokens (jose library) |
| `DATABASE_URL` | `mjagency-{slug}` | `prd` | Per-agency Postgres connection string (via PgBouncer) |
| `DATABASE_URL_DIRECT` | `mjagency-{slug}` | `prd` | Per-agency direct Postgres connection (bypasses PgBouncer) |
| `STRIPE_SECRET_KEY` | `mjagency-shared` | `prd` | Stripe API key (payment charges, customer management) |
| `STRIPE_WEBHOOK_SECRET` | `mjagency-shared` | `prd` | HMAC key for Stripe webhook signature verification |
| `PGBACKREST_CIPHER_PASS` | `mjagency-shared` | `prd` | pgBackRest AES-256-CBC backup encryption passphrase |
| `VAULT_ENCRYPTION_KEY` | `mjagency-shared` | `prd` | AES-GCM-256 key for permissions vault (`packages/db/src/vault/`) |
| `BULLMQ_ENCRYPTION_KEY` | `mjagency-shared` | `prd` | AES-GCM-256 key for BullMQ payload encryption |
| `CLOUDFLARE_API_TOKEN` | `mjagency-shared` | `prd` | Cloudflare Zone/WAF/R2 management |
| `R2_ACCESS_KEY` | `mjagency-shared` | `prd` | Cloudflare R2 object storage access key |
| `R2_SECRET_KEY` | `mjagency-shared` | `prd` | Cloudflare R2 object storage secret key |

---

## Prerequisites

### Required access
- Doppler super_admin role
- `doppler login` completed on your workstation

```bash
# Verify Doppler login
doppler whoami
# Expected: your email address

# Verify super_admin access
doppler projects list
# Expected: mjagency-shared and all mjagency-{slug} projects listed
```

---

## Procedure

### Step 1 — Generate a new secret value

```bash
# Generate a cryptographically random 32-byte base64 secret
openssl rand -base64 32

# For 48-byte secrets (pgBackRest cipher pass, vault key):
openssl rand -base64 48

# Example output: 8XkL9mN2pQ7rS4uV1wY5zA3bC6dE0fG+hI/j=
# Store this value securely — you will enter it in Step 2
```

### Step 2 — Rotate JWT_SECRET (shared across all agencies)

JWT tokens are signed with the shared `JWT_SECRET`. Rotation invalidates all existing sessions platform-wide. Plan for a brief session disruption (all users are logged out).

```bash
# 1. Generate new JWT_SECRET
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Set in Doppler (shared project)
doppler secrets set JWT_SECRET="${NEW_JWT_SECRET}" \
  --project mjagency-shared --config prd

# 3. Verify it was set
doppler secrets get JWT_SECRET --project mjagency-shared --config prd | head -c 10
# Expected: first 10 chars of new value (do not print full secret to terminal)
```

### Step 3 — Rotate per-agency DATABASE_URL (if DB password changed)

```bash
# Rotate for a single agency
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)

# Update at Postgres level
psql "$DATABASE_URL_DIRECT" -c "
  ALTER USER app_user_web_ecommerce PASSWORD '${NEW_DB_PASSWORD}';
"

# Update in Doppler
doppler secrets set \
  DATABASE_URL="postgresql://app_user_web_ecommerce:${NEW_DB_PASSWORD}@<pgbouncer-host>:5432/ecommerce_db?pgbouncer=true" \
  DATABASE_URL_DIRECT="postgresql://app_user_web_ecommerce:${NEW_DB_PASSWORD}@<vps-host>:5432/ecommerce_db" \
  --project mjagency-web-ecommerce --config prd

# Rotate for all 12 agencies (run in a loop — adapt per-agency user and DB names)
for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare; do
  echo "Rotating DB password for ${slug}..."
  # Generate and apply — follow same pattern as above
done
```

### Step 4 — Rotate Stripe keys

```bash
# 1. In Stripe Dashboard → Developers → API keys → Create restricted key
#    (never roll the primary key; always use restricted keys with minimum permissions)

# 2. Set in Doppler
doppler secrets set \
  STRIPE_SECRET_KEY="sk_live_<new-key>" \
  STRIPE_WEBHOOK_SECRET="whsec_<new-webhook-secret>" \
  --project mjagency-shared --config prd

# 3. For webhook secret — update in Stripe Dashboard → Developers → Webhooks
#    Select the webhook endpoint → Regenerate secret → copy new secret
```

### Step 5 — Redeploy workers to pick up new secrets

```bash
# Option A: Cloudflare Workers (if platform uses Workers for edge deployment)
wrangler deploy --env production

# Option B: PM2 (if platform runs on VPS)
# For a single agency app:
pm2 restart web-{slug}

# For all agency apps (after JWT_SECRET rotation):
pm2 restart all

# Verify new secrets are loaded (check for 401 errors after restart)
curl -s -o /dev/null -w "%{http_code}" "https://web-ecommerce.mjagency.com/api/health"
# Expected: 200
```

### Step 6 — Add old JWT_SECRET to Redis revocation list

After JWT_SECRET rotation, invalidate all tokens signed with the old key:

```bash
# Add old JWT_SECRET hash to Redis revocation set (prevents old-key tokens from being accepted)
# The auth middleware checks this list in packages/auth/src/middleware.ts
OLD_JWT_SECRET_HASH=$(echo -n "<old-jwt-secret>" | openssl dgst -sha256 -hex | awk '{print $2}')

redis-cli -u "$REDIS_URL" \
  SADD "revoked-jwt-secrets" "${OLD_JWT_SECRET_HASH}" \
  EX 604800  # Expire after 7 days (max JWT lifetime)

echo "Old JWT_SECRET added to revocation list: ${OLD_JWT_SECRET_HASH}"
```

### Step 7 — Verify all applications are using the new secret

```bash
# Test authentication with a new session (should succeed)
curl -s -X POST "https://web-ecommerce.mjagency.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"<test-password>"}' \
  | jq '.ok'
# Expected: true

# Confirm old tokens are rejected (use an old access_token cookie if available)
curl -s "https://web-ecommerce.mjagency.com/api/auth/session" \
  -H "Cookie: access_token=<old-token>" \
  | jq '.error'
# Expected: "Unauthorized" or "jwt signature verification failed"
```

---

## Verification

1. **New secret is set in Doppler:**
   ```bash
   doppler secrets get JWT_SECRET --project mjagency-shared --config prd
   # Value should differ from the old value (first few characters changed)
   ```

2. **Application health checks pass after redeployment:**
   ```bash
   for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
               web-fitness web-dental web-automotive web-restaurant web-education \
               web-financial web-petcare; do
     HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
       "https://${slug}.mjagency.com/api/health")
     echo "${slug}: ${HTTP}"
   done
   # All must return 200
   ```

3. **New authentication session works:**
   ```bash
   curl -s -X POST "https://web-ecommerce.mjagency.com/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"<password>"}' \
     | jq '.ok'
   # Expected: true
   ```

4. **Old JWT_SECRET in revocation list:**
   ```bash
   OLD_HASH=$(echo -n "<old-jwt-secret>" | openssl dgst -sha256 -hex | awk '{print $2}')
   redis-cli -u "$REDIS_URL" SISMEMBER "revoked-jwt-secrets" "${OLD_HASH}"
   # Expected: 1 (member exists)
   ```

---

## Failure Diagnostics

**Symptom:** 401 errors on all requests after JWT_SECRET rotation.
**Check:** The new `JWT_SECRET` may not have been deployed to the running app process. Run `pm2 status` — if the app is still running with old env vars, it will reject all tokens (both old and new).
**Fix:** Force reload env vars: `pm2 restart all --update-env`. Then verify: `doppler secrets get JWT_SECRET --project mjagency-shared --config prd` matches what the app has loaded.

**Symptom:** `doppler secrets set` fails with "Insufficient permissions".
**Check:** Your Doppler token may not have write access to the target project/config.
**Fix:** Re-authenticate: `doppler login`. Request super_admin access from the Doppler account owner if needed: `doppler setup` to reconfigure project access.

**Symptom:** Stripe webhooks returning 400 after STRIPE_WEBHOOK_SECRET rotation.
**Check:** The new webhook secret in Doppler may not match what Stripe is sending. The secret must match the one visible in Stripe Dashboard → Webhooks → Endpoint → Signing secret.
**Fix:** Copy the signing secret from Stripe Dashboard directly: navigate to Stripe Dashboard → Developers → Webhooks → select endpoint → show signing secret. Set it in Doppler: `doppler secrets set STRIPE_WEBHOOK_SECRET="whsec_<exact-value>" --project mjagency-shared --config prd`.

**Symptom:** DB connection refused after DATABASE_URL rotation.
**Check:** PgBouncer may not have picked up the new password. PgBouncer caches credentials; a restart is needed after password rotation.
**Fix:** Restart PgBouncer: `sudo systemctl restart pgbouncer`. Verify connection: `psql "$DATABASE_URL" -c "SELECT 1"`.
