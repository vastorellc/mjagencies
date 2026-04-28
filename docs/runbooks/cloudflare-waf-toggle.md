# Cloudflare WAF Toggle Runbook

**Audience:** Security team, platform ops
**Last updated:** 2026-04-28 (Plan 12-05)
**Related:** `docs/runbooks/cloudflare-waf-rollout.md`, `infra/cloudflare/waf.tf`, `docs/runbooks/incident-response.md`

---

## Overview

This runbook covers toggling the Cloudflare WAF between enforcing mode and log-only mode across all 13 MJAgency zones. This is a companion to `cloudflare-waf-rollout.md` (initial two-phase rollout) and is used for emergency disable/enable during incidents or maintenance.

**When to use this runbook:**
- Emergency: WAF is blocking legitimate traffic during an incident
- Maintenance: toggling to log-only during a canary deploy window to prevent false positives
- Routine: re-enabling enforcing mode after an emergency disable

**WAF modes:**
- **Enforcing mode** (`enable_enforcing=true`): OWASP CRS, geo challenge, rate limits, scraper block all take their final action (block/challenge/managed_challenge).
- **Log-only mode** (`enable_enforcing=false`): All rules record hits to Cloudflare Security Events but do not block or challenge any requests.

> **WARNING:** Do NOT toggle WAF to enforcing mode during an active canary deploy window. The canary deploy workflow (`.github/workflows/canary-deploy.yml`) annotates the deployment window — check for active deployments before toggling to enforcing. Toggling during canary can block the health check probes and cause a false-positive rollback.

---

## Prerequisites

### Required access
- Cloudflare API token with `Zone:Edit` and `Zone WAF:Edit` scope on all 13 zones
  - Stored in Doppler: `CLOUDFLARE_API_TOKEN` (shared project → prd config)
- Terraform >= 1.6.0 installed locally
- `infra/cloudflare/` directory accessible in the local repo clone

### Verify Terraform state is initialized

```bash
cd infra/cloudflare
terraform init
terraform plan -var="enable_enforcing=true" -compact-warnings
```

Expected: plan shows no unexpected changes (current state matches Terraform state file).

### Check for active canary deploy

```bash
# Check GitHub Actions for active canary deploy workflow
gh run list --workflow=canary-deploy.yml --status=in_progress
# Expected: empty (no active canary deploy)
```

If a canary deploy is active, wait for it to complete or be rolled back before toggling WAF to enforcing mode.

---

## Procedure

### Step 1 — Switch WAF to log-only (emergency disable)

Use this when WAF is blocking legitimate traffic and you need to restore service immediately:

```bash
cd infra/cloudflare
terraform apply -var="enable_enforcing=false" -auto-approve
```

Expected output:
```
Apply complete! Resources: 0 added, X changed, 0 destroyed.
```

The `enable_enforcing` variable is defined in `infra/cloudflare/waf.tf`. Setting it to `false` sets all rule actions to `log` — requests pass through, hits are recorded in Cloudflare Security Events.

### Step 2 — Verify log-only mode is active

```bash
# Verify via Cloudflare API (replace ZONE_ID with target zone)
ZONE_ID=$(doppler secrets get CLOUDFLARE_ZONE_ID_WEB_ECOMMERCE --project mjagency-shared --config prd)
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/rules" \
  -H "Authorization: Bearer $(doppler secrets get CLOUDFLARE_API_TOKEN --project mjagency-shared --config prd)" \
  -H "Content-Type: application/json" \
  | jq '.[].action'
```

Expected: all rules show `"log"` action.

Also verify in Cloudflare dashboard: Security → WAF → Custom rules — all rules should show `Log` action.

### Step 3 — Re-enable WAF enforcing mode

After the incident is resolved, or after the canary deploy window closes:

```bash
cd infra/cloudflare

# Confirm no active canary deploy before re-enabling
gh run list --workflow=canary-deploy.yml --status=in_progress
# Must be empty

terraform apply -var="enable_enforcing=true" -auto-approve
```

### Step 4 — Per-zone gradual re-enable (optional)

If WAF was disabled during a widespread incident and you want to re-enable gradually:

```bash
cd infra/cloudflare

# Re-enable for one canary zone first
TF_VAR_zone_ids='{"web-ecommerce":"<zone-id>"}' \
  terraform apply -var="enable_enforcing=true"

# Monitor for 15 minutes — watch Security Events for false positives
# Then re-enable for remaining zones
terraform apply -var="enable_enforcing=true"
```

**Note:** The `zones.tf` precondition validates that `var.zone_ids` has exactly 13 keys. To do a partial rollout, temporarily comment out the precondition and restore it before committing.

### Step 5 — Emergency WAF disable via Cloudflare dashboard (fastest path)

If Terraform is not available and you need to disable WAF in under 2 minutes:

1. Log in to Cloudflare dashboard → select the affected zone
2. Navigate to Security → WAF → Custom rules
3. For each rule, click the toggle to disable it
4. Repeat for Security → WAF → Rate limiting rules

After the incident, always follow up with a Terraform apply to sync dashboard state with the `.tf` files:

```bash
cd infra/cloudflare && terraform apply -var="enable_enforcing=false"
```

This prevents Terraform drift that would surface as exit code 2 in the CI plan check (`.github/workflows/cloudflare-terraform-plan.yml`).

---

## Verification

After toggling WAF mode:

1. **Confirm mode via Cloudflare dashboard:**
   - Security → WAF → Custom rules
   - All rules should show `Log` (log-only) or `Block`/`Challenge` (enforcing)

2. **Confirm mode via Terraform plan:**
   ```bash
   cd infra/cloudflare
   terraform plan -var="enable_enforcing=true" -detailed-exitcode
   # Exit code 0 = no drift (Terraform state matches Cloudflare)
   # Exit code 2 = drift detected (dashboard state differs from Terraform)
   ```

3. **Confirm no legitimate traffic is being blocked (after re-enabling enforcing):**
   - Cloudflare Security → Events → filter last 15 minutes
   - Review any `Block` or `Challenge` actions — confirm they are not legitimate admin or agency users

4. **All-agency health check:**
   ```bash
   for slug in web-ecommerce web-realestate web-healthcare web-legal web-homeservices \
               web-dental web-automotive web-restaurant web-education \
               web-financial web-petcare web-fitness; do
     HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${slug}.mjagency.com/api/health")
     echo "${slug}: ${HTTP}"
   done
   # All must return 200
   ```

---

## Failure Diagnostics

**Symptom:** WAF is blocking legitimate admin users or agency clients after enforcing mode is enabled.
**Check:** Cloudflare dashboard → Security → Events → filter by action `Block` or `Managed Challenge`. Identify the triggered rule by its `description` field (each rule references Plan 11-06 + pitfall number).
**Fix:** In `infra/cloudflare/managed-rulesets.tf`, add an override block for the specific OWASP CRS rule ID to set its action to `log`, or add the client IP to a Cloudflare IP allowlist (free tier: 1 spare custom rule slot). Re-run `terraform apply`. Document the override in the rule's `description`.

**Symptom:** `terraform apply` fails with "API token insufficient permissions".
**Check:** The `CLOUDFLARE_API_TOKEN` in Doppler may not have `Zone WAF:Edit` scope.
**Fix:** Re-generate a Cloudflare API token in the Cloudflare dashboard (Account → API Tokens) with `Zone:Edit` and `Zone WAF:Edit` scope. Update in Doppler: `doppler secrets set CLOUDFLARE_API_TOKEN=<new-token> --project mjagency-shared --config prd`.

**Symptom:** Terraform shows drift after an emergency dashboard toggle.
**Check:** `cd infra/cloudflare && terraform plan -detailed-exitcode`. Exit code 2 indicates the dashboard was changed directly (bypassing Terraform).
**Fix:** Run `terraform apply -var="enable_enforcing=<desired-mode>"` to reconcile. The dashboard edit is overwritten by Terraform. Document in the post-incident report that a Terraform drift occurred.

**Symptom:** Per-zone gradual rollout fails with precondition error ("zone_ids keys must match canonical 13-slug list").
**Check:** The `zones.tf` precondition is enforced.
**Fix:** Temporarily comment out the precondition block in `infra/cloudflare/zones.tf` for the gradual rollout, re-enable it before committing to the repo, and open a PR with the final `enable_enforcing=true` state.
