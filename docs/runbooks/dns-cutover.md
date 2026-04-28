# DNS Cutover Runbook

**Audience:** Platform ops, agency account managers
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/ssl-certificate-renewal.md`, `docs/runbooks/brand-setup-wizard.md`, `docs/runbooks/cloudflare-waf-rollout.md`

---

## Overview

This runbook covers the DNS cutover checklist for moving a custom agency domain to the MJAgency platform deployment. Each of the 12 agencies can bring their own custom domain (e.g., `acmeplumbing.com` instead of `web-homeservices.mjagency.com`).

**Cutover prerequisites:** Brand Setup Wizard (Step 5 — DNS + Warmup Checklist) must be completed in Payload admin before starting this runbook. See `docs/runbooks/brand-setup-wizard.md`.

**DNS propagation:** Typical CNAME propagation is 5-15 minutes for TTL ≤ 300. If the domain was previously pointing elsewhere with a high TTL (24h+), plan for up to 48 hours of dual-serving during propagation.

---

## Prerequisites

### Required access
- Cloudflare zone access for the MJAgency zones (`CLOUDFLARE_API_TOKEN` from Doppler)
- Domain registrar credentials (the agency's domain registrar — GoDaddy, Namecheap, Route53, etc.)
- Doppler super_admin for updating `CAL_SUBDOMAIN` and related env vars
- Brand Setup Wizard completed (see `docs/runbooks/brand-setup-wizard.md`)

### Pre-cutover checklist

Before adding DNS records:

```bash
# 1. Confirm the agency app is running and healthy on the platform subdomain
curl -s -o /dev/null -w "%{http_code}" \
  "https://web-{slug}.mjagency.com/api/health"
# Expected: 200

# 2. Confirm SSL is already issued for the platform subdomain
curl -sI "https://web-{slug}.mjagency.com/" | grep -E "HTTP/2|cf-ray"
# Expected: HTTP/2 200 with cf-ray header

# 3. Confirm Brand Setup Wizard is complete
curl -s "https://web-{slug}.mjagency.com/api/health" | jq '.brandSetupComplete'
# Expected: true
```

---

## Procedure

### Step 1 — Add CNAME at domain registrar

Log in to the agency's domain registrar and add a CNAME record:

| Record type | Name | Value | TTL |
|-------------|------|-------|-----|
| CNAME | `@` (root domain) or `www` | `web-{slug}.workers.dev` | 300 |

For root domain (`@`) CNAME, some registrars require ALIAS or ANAME records instead of CNAME. In that case, use:
- Cloudflare (if domain is on Cloudflare): use the CNAME directly with Cloudflare proxy enabled
- Route53: use ALIAS record pointing to `web-{slug}.workers.dev`
- Other registrars: use ANAME/ALIAS if supported, or contact registrar support

**Preferred approach:** Transfer the domain's DNS to Cloudflare for full control:
1. In Cloudflare: Add Site → enter domain → import DNS records
2. At registrar: update nameservers to Cloudflare's ns1/ns2 nameservers
3. After propagation: add CNAME in Cloudflare dashboard

### Step 2 — Wait for DNS propagation

```bash
# Monitor propagation (run every 2 minutes)
dig CNAME {agency-domain} +short
# Expected eventually: web-{slug}.workers.dev.

# Or using a web tool — check multiple DNS resolvers
# https://dnschecker.org — check for CNAME propagation globally
```

Standard propagation time with TTL=300: 5-15 minutes.
If previous TTL was high (1800s or 86400s), propagation can take up to 24-48 hours.

### Step 3 — Confirm Cloudflare SSL certificate is issued

Cloudflare automatically provisions an SSL certificate via Let's Encrypt for any domain proxied through Cloudflare:

1. In Cloudflare dashboard: select the zone → SSL/TLS → Edge Certificates
2. Confirm the certificate status is `Active` for the custom domain
3. SSL mode must be **Full (Strict)** — SSL/TLS → Overview → select "Full (strict)"

```bash
# Verify SSL mode via API
curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/ssl" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | jq '.result.value'
# Expected: "full"  (or "strict" in Cloudflare API terms)
```

If SSL certificate is not issued within 15 minutes, see `docs/runbooks/ssl-certificate-renewal.md`.

### Step 4 — Verify the domain responds correctly

```bash
# Full verification curl
curl -sI "https://{agency-domain}/" \
  --resolve "{agency-domain}:443:<cloudflare-ip>" # optional: bypass local DNS

# Expected response headers:
# HTTP/2 200
# cf-ray: <ray-id>
# content-type: text/html

# Full health check via custom domain
curl -s "https://{agency-domain}/api/health"
# Expected: {"status":"ok","db":"connected","redis":"connected"}
```

### Step 5 — Update CAL_SUBDOMAIN in Doppler (if Cal.com booking is integrated)

If the agency uses Cal.com booking via a custom domain:

```bash
doppler secrets set CAL_SUBDOMAIN={agency-custom-domain} \
  --project mjagency-{slug} --config prd

# Restart the agency app to pick up the new env var
pm2 restart web-{slug}

# Verify booking page loads at new domain
curl -s -o /dev/null -w "%{http_code}" "https://{agency-domain}/book"
# Expected: 200
```

### Step 6 — Verify DKIM and SPF email records

If the agency sends email via the platform (transactional emails, lead notifications):

```bash
# Check SPF record
dig TXT {agency-domain} | grep "v=spf1"
# Expected: record containing MJAgency's mail server IPs or include: directive

# Check DKIM record
dig TXT dkim._domainkey.{agency-domain} | grep "v=DKIM1"

# Verify via Payload admin email-setup page
curl -s -o /dev/null -w "%{http_code}" \
  "https://web-{slug}.mjagency.com/admin/email-setup" \
  -H "Cookie: access_token=<token>"
# Expected: 200 with DKIM/SPF status indicators
```

If DKIM/SPF records are missing, add them at the domain registrar:

| Record type | Name | Value |
|-------------|------|-------|
| TXT | `@` (SPF) | `v=spf1 include:sendgrid.net ~all` |
| TXT | `dkim._domainkey` | (get from Doppler: `DKIM_PUBLIC_KEY_{SLUG_UPPER}`) |

---

## Verification

After completing all steps:

1. **Custom domain returns HTTP/2 200 with Cloudflare headers:**
   ```bash
   curl -sI "https://{agency-domain}/" | grep -E "HTTP/2 200|cf-ray"
   # Both lines must appear
   ```

2. **Health endpoint accessible via custom domain:**
   ```bash
   curl -s "https://{agency-domain}/api/health"
   # Expected: {"status":"ok","db":"connected","redis":"connected"}
   ```

3. **SSL certificate valid:**
   ```bash
   echo | openssl s_client -connect {agency-domain}:443 2>/dev/null \
     | openssl x509 -noout -dates
   # notAfter must be > 30 days in the future
   ```

4. **No mixed-content warnings** — open the agency homepage in a browser; Chrome DevTools → Console should show no mixed-content errors.

5. **Previous platform subdomain still accessible** (during transition period):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "https://web-{slug}.mjagency.com/"
   # Expected: 200 (or 301 redirect to custom domain if redirect is configured)
   ```

---

## Failure Diagnostics

**Symptom:** `ERR_SSL_PROTOCOL_ERROR` or `SSL_ERROR_RX_RECORD_TOO_LONG` when accessing the custom domain.
**Check:** Cloudflare SSL mode may be set to "Flexible" instead of "Full (Strict)". Run: `curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/ssl" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result.value'`
**Fix:** In Cloudflare dashboard → SSL/TLS → Overview → set to "Full (strict)". Wait 30 seconds and retry.

**Symptom:** DNS still resolving to old IP after adding CNAME.
**Check:** `dig CNAME {agency-domain} +short` — if it returns the old A record or no CNAME, the record has not propagated yet or was added incorrectly.
**Fix:** Confirm the CNAME was added at the registrar (not just locally). Wait for TTL to expire. If the domain is on Cloudflare, the CNAME takes effect immediately — check Cloudflare dashboard DNS records.

**Symptom:** `curl` returns 404 or the wrong site after DNS propagation.
**Check:** The Cloudflare Workers routing may not recognize the custom domain. Verify the worker has a `routes` entry for `{agency-domain}/*` in `wrangler.toml`.
**Fix:** Add the custom domain to the worker routes: `wrangler route list --env production` and `wrangler route add '{agency-domain}/*' --env production`.

**Symptom:** SSL certificate stuck in "Pending" state in Cloudflare Edge Certificates.
**Check:** The domain's CAA (Certification Authority Authorization) records may be blocking Let's Encrypt. Run: `dig CAA {agency-domain}`
**Fix:** Add or update the CAA record to allow Let's Encrypt: `dig CAA {agency-domain}` — add `0 issue "letsencrypt.org"` if missing. Follow `docs/runbooks/ssl-certificate-renewal.md` for manual certificate ordering.
