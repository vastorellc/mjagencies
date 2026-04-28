# SSL Certificate Renewal Runbook

**Audience:** Platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/dns-cutover.md`, `docs/runbooks/cloudflare-waf-toggle.md`

---

## Overview

SSL certificates for all MJAgency platform zones are managed and auto-renewed by Cloudflare via Let's Encrypt and Cloudflare's own Universal SSL. Under normal operation, certificates are renewed automatically 30 days before expiry without any manual intervention.

This runbook covers manual renewal procedures when auto-renewal fails, certificates expire unexpectedly, or a custom certificate needs to be installed.

**Certificate types in use:**

| Type | Scope | Auto-renewal | Notes |
|------|-------|-------------|-------|
| Cloudflare Universal SSL | All 13 `*.mjagency.com` subdomains | Yes (automatic) | Free, issued by Let's Encrypt via Cloudflare |
| Custom hostname certificates | Agency custom domains (e.g., `acmeplumbing.com`) | Yes (automatic, if domain is on Cloudflare) | Requires domain proxied through Cloudflare |
| Advanced Certificate Manager | Optional — wildcard or multi-SAN | Manual order | $10/zone/month if needed |

---

## Prerequisites

### Required access
- Cloudflare API token with `Zone:SSL/TLS:Edit` scope
  - Stored in Doppler: `CLOUDFLARE_API_TOKEN` (shared project → prd config)
- Zone IDs for each MJAgency zone (Doppler: `CLOUDFLARE_ZONE_IDS_JSON`)

```bash
# Get Zone IDs
doppler secrets get CLOUDFLARE_ZONE_IDS_JSON --project mjagency-shared --config prd \
  | jq '.'
```

### Check current certificate status

```bash
# Check certificate expiry via openssl (for a specific agency)
echo | openssl s_client -connect web-ecommerce.mjagency.com:443 -servername web-ecommerce.mjagency.com \
  2>/dev/null | openssl x509 -noout -dates
# notAfter should be 30+ days in the future

# Check all 13 agencies
for host in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
            web-fitness web-dental web-automotive web-restaurant web-education \
            web-financial web-petcare web-main; do
  EXPIRY=$(echo | openssl s_client -connect "${host}.mjagency.com:443" \
    -servername "${host}.mjagency.com" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  echo "${host}: ${EXPIRY}"
done
```

---

## Procedure

### Step 1 — Check certificate expiry in Cloudflare dashboard

1. Log in to Cloudflare dashboard
2. Select the affected zone (e.g., `mjagency.com`)
3. Navigate to SSL/TLS → Edge Certificates
4. Review the **Expiration** date for each certificate pack
5. Cloudflare starts auto-renewal at 30 days before expiry; if a certificate is within 30 days and status is not "Active," manual intervention is needed

### Step 2 — Trigger auto-renewal via Cloudflare API

If the certificate is within 30 days of expiry and has not auto-renewed, trigger a manual renewal:

```bash
# Set variables
ZONE_ID=$(doppler secrets get CLOUDFLARE_ZONE_ID_WEB_ECOMMERCE --project mjagency-shared --config prd)
CF_TOKEN=$(doppler secrets get CLOUDFLARE_API_TOKEN --project mjagency-shared --config prd)

# Check existing certificate packs
curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/ssl/certificate_packs" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  | jq '.result[] | {id: .id, status: .status, hosts: .hosts, expires_on: .expires_on}'
```

If the certificate pack status is `pending_validation` or `deleted`, order a new one:

```bash
# Order a new Universal SSL certificate pack
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/ssl/certificate_packs/order" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["*.mjagency.com", "mjagency.com"],
    "type": "universal",
    "validation_method": "http",
    "validity_days": 90,
    "certificate_authority": "lets_encrypt"
  }'
```

Expected response includes a new certificate pack ID with `status: "pending_validation"`.

### Step 3 — Poll until certificate status is active

```bash
PACK_ID="<certificate-pack-id-from-step-2>"

# Poll every 60 seconds until status is "active"
while true; do
  STATUS=$(curl -s \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/ssl/certificate_packs/${PACK_ID}" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    | jq -r '.result.status')
  echo "$(date): Certificate status = ${STATUS}"
  [ "$STATUS" = "active" ] && break
  sleep 60
done
echo "Certificate is now active."
```

Typical activation time: 5-15 minutes for HTTP validation. DNS validation can take up to 30 minutes.

### Step 4 — Verify HTTPS is working after renewal

```bash
# Verify the new certificate is being served
echo | openssl s_client -connect web-ecommerce.mjagency.com:443 \
  -servername web-ecommerce.mjagency.com 2>/dev/null \
  | openssl x509 -noout -dates -subject

# Run health check
curl -sI "https://web-ecommerce.mjagency.com/" | grep -E "HTTP/2|strict-transport-security"
```

### Step 5 — Custom domain certificate renewal

For agency custom domains (e.g., `acmeplumbing.com`) proxied through Cloudflare:

```bash
# Get zone ID for the custom domain
CUSTOM_ZONE_ID="<zone-id-for-agency-custom-domain>"

# Check certificate status
curl -s "https://api.cloudflare.com/client/v4/zones/${CUSTOM_ZONE_ID}/ssl/certificate_packs" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  | jq '.result[] | {status: .status, expires_on: .expires_on, hosts: .hosts}'

# If auto-renewal failed, order a new certificate
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CUSTOM_ZONE_ID}/ssl/certificate_packs/order" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": ["{agency-domain}", "www.{agency-domain}"],
    "type": "advanced",
    "validation_method": "http",
    "validity_days": 90,
    "certificate_authority": "lets_encrypt"
  }'
```

---

## Verification

After certificate renewal:

1. **Certificate expiry is > 30 days away:**
   ```bash
   echo | openssl s_client -connect web-ecommerce.mjagency.com:443 2>/dev/null \
     | openssl x509 -noout -enddate
   # notAfter should be ~90 days from now
   ```

2. **All agencies serving valid HTTPS:**
   ```bash
   for host in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
               web-fitness web-dental web-automotive web-restaurant web-education \
               web-financial web-petcare web-main; do
     HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${host}.mjagency.com/")
     echo "${host}: ${HTTP}"
   done
   # All must return 200
   ```

3. **HSTS header present:**
   ```bash
   curl -sI "https://web-ecommerce.mjagency.com/" | grep strict-transport-security
   # Expected: strict-transport-security: max-age=31536000; includeSubDomains; preload
   ```

4. **Certificate pack status via API:**
   ```bash
   curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/ssl/certificate_packs" \
     -H "Authorization: Bearer ${CF_TOKEN}" \
     | jq '.result[] | select(.status != "active") | {hosts: .hosts, status: .status}'
   # Expected: empty array (all packs active)
   ```

---

## Failure Diagnostics

**Symptom:** Certificate stuck in `pending_validation` for more than 30 minutes.
**Check:** HTTP validation requires Cloudflare to be able to reach the domain on port 80. Run: `curl -I http://{domain}/.well-known/acme-challenge/test` — if it returns 403 or is blocked, the HTTP challenge path is inaccessible.
**Fix:** Ensure the domain's DNS is proxied through Cloudflare (orange cloud icon in DNS settings). If using DNS validation instead, confirm the `_acme-challenge` TXT record is present: `dig TXT _acme-challenge.{domain}`.

**Symptom:** Certificate auto-renewal disabled or failing silently.
**Check:** Check Cloudflare dashboard → SSL/TLS → Edge Certificates → look for any error notifications. Also check: `curl -s "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/ssl/analyze" -H "Authorization: Bearer ${CF_TOKEN}"` for SSL analysis errors.
**Fix:** If Universal SSL is disabled, re-enable it: Cloudflare dashboard → SSL/TLS → Edge Certificates → Enable Universal SSL.

**Symptom:** Browser shows "certificate name mismatch" (ERR_CERT_COMMON_NAME_INVALID).
**Check:** The certificate may be issued for `*.mjagency.com` but the custom domain is not covered.
**Fix:** Order a new certificate specifically for the custom domain (Step 5). Ensure the custom domain is included in the `hosts` array of the certificate pack order request.

**Symptom:** `openssl s_client` shows certificate expiry in the past.
**Check:** The certificate has already expired. This is a P1 incident — follow `docs/runbooks/incident-response.md` for P1 declaration and use Step 2-3 of this runbook to order a replacement immediately.
**Fix:** Order a new certificate immediately (Step 2). While waiting for the new certificate to activate, consider temporarily disabling Cloudflare HTTPS-only mode or HSTS so HTTP requests can proceed (last resort only).
