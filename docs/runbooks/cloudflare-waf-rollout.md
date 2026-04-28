# Cloudflare WAF Rollout — Plan 11-06 Phased Procedure

**Last updated:** Plan 11-06
**Relates to:** REQ-145, REQ-146
**Source of truth:** `infra/cloudflare/` Terraform module

---

## Why phased rollout

REQ-145 / REQ-146 enforce Cloudflare WAF Managed Ruleset (OWASP CRS), Bot Fight Mode, custom firewall rules (CVE-2025-29927 layer 1, US-only geo Challenge, scraper block), and 5 per-route rate limits across all 13 MJAgency zones via Terraform.

Direct enforcement on a fresh deployment risks blocking legitimate launch traffic — Puck CMS saves carrying long JSON bodies can trip OWASP CRS, an office NAT (50-person company sharing one IP) can hit the public-reads rate limit at lunchtime, and a misconfigured client can flood `/api/csp-report`. This runbook documents the two-phase rollout that catches false positives in **log-only** mode before flipping to **enforcing**.

---

## Prerequisites

1. **Cloudflare API token** — scope: `Zone:Edit` + `Zone WAF:Edit` on all 13 zones. Stored in Doppler (`CLOUDFLARE_API_TOKEN`) and GitHub Secrets (`CLOUDFLARE_API_TOKEN` for CI).
2. **Account ID** — `TF_VAR_account_id` env var (Doppler / GitHub Secret `CLOUDFLARE_ACCOUNT_ID`).
3. **Zone IDs map** — `TF_VAR_zone_ids` JSON map (Doppler / GitHub Secret `CLOUDFLARE_ZONE_IDS_JSON`). Must contain exactly the 13 keys listed in `infra/cloudflare/zones.tf` (validated by precondition).
4. **Terraform >= 1.6.0** locally.

---

## Phase 1 — Log-only (week 1)

```bash
cd infra/cloudflare
terraform init
terraform apply -var enable_enforcing=false
```

**Effect:**
- All firewall rules, rate limits, and the OWASP managed ruleset are deployed but their action is `log` — Cloudflare records every hit in **Security → Events** without blocking or challenging the request.
- Bot Fight Mode is `on` (it has no log-only setting; it's a binary toggle on free tier). Bot Fight Mode false positives surface as challenges visible in Security Events.

**Verification:**
1. Visit Cloudflare dashboard for any zone → Security → Events.
2. Filter by Ruleset name (e.g., `Custom Firewall — Plan 11-06 (web-ecommerce)` or `Rate Limits — Plan 11-06 (web-ecommerce)`).
3. Confirm hits are appearing with `Action: Log`.
4. Repeat for at least 3 representative zones.

**Duration:** Minimum 7 days. Longer if a major marketing push or product launch is scheduled in that window.

---

## False-positive triage

Common categories and remediation:

### 1. Geo Challenge (`ip.geoip.country ne "US"`)

**Expected:** International users on VPN, US travelers abroad, Cloudflare crawlers from non-US POPs.

**Action:** Acceptable as-is. The Challenge action lets users solve a CAPTCHA and proceed (Pitfall 8.1). Cloudflare-verified bots already bypass via the `cf.client.bot` skip rule.

**When to adjust:** Only if you observe a known partner / vendor IP repeatedly challenged. Add an IP allowlist rule (would consume the 5th custom firewall slot — currently we use 4/5).

### 2. Public form POST rate limit (5/min/IP)

**Likely cause:** Office NAT (one shared IP) — 5 simultaneous contact-form submissions from a 50-person sales team.

**Action:**
- Review Security Events for the offending IP.
- If it's a known office, add to an IP allowlist rule (consumes the 5th custom firewall slot).
- Otherwise the limit is correct — programmatic abuse signal.

### 3. OWASP CRS hits on legitimate Puck CMS saves

**Likely cause:** Long JSON payloads, unusual character sequences in user content (e.g., a blog post quoting a SQL query).

**Action:**
- Identify the specific OWASP CRS rule ID from Security Events.
- In `infra/cloudflare/managed-rulesets.tf`, add an override block disabling that specific rule:
  ```hcl
  overrides {
    rules {
      id      = "rule-id-here"
      action  = "log"  # or "skip"
    }
  }
  ```
- Re-apply Terraform. Document the override + reason in the rule's `description`.

### 4. Bot Fight Mode catching uptime monitors

**Likely cause:** Self-hosted or non-mainstream uptime monitor (e.g., StatusCake, custom Node script) without a `cf.client.bot=true` signature.

**Action:**
- Add the monitor's IP to a Cloudflare IP Access Rule (allowlist) — managed outside this Terraform module.
- Or migrate to Cloudflare Health Checks (no external monitor needed).

### 5. RUM ingest spike (`/api/rum` 100/min/IP)

**Likely cause:** Single-page-app emitting too many beacons, bug in client-side instrumentation.

**Action:**
- Investigate Plan 11-07 `/api/rum` handler — beacons should be batched.
- Tune client-side beacon throttling before raising the rate limit.

### 6. CSP report spike (`/api/csp-report` 50/min/IP)

**Likely cause:** Misconfigured CSP causing many violations per page load.

**Action:**
- Investigate the CSP — Plan 11-07 should already enforce nonce-based inline policy.
- Fix the CSP misconfiguration; the rate limit is correctly catching the symptom.

---

## Phase 2 — Enforcing (week 2)

Once 7+ days of log-only data has been triaged and any necessary overrides / allowlists are merged:

```bash
cd infra/cloudflare
terraform apply -var enable_enforcing=true
```

**Effect:** All rules switch from `log` to their final action mode:
- OWASP CRS managed ruleset: `execute` (block/challenge per CRS rule defaults).
- CVE-2025-29927 header block: `block`.
- Scraper block: `block`.
- US-only geo: `managed_challenge`.
- Auth rate limit: `managed_challenge`.
- Public form POST rate limit: `block`.
- RUM rate limit: `block`.
- CSP report rate limit: `block`.
- Public reads rate limit: `managed_challenge`.

---

## Rollback procedure

If a rule causes a production incident, revert to log-only immediately:

```bash
cd infra/cloudflare
terraform apply -var enable_enforcing=false
```

Or remove a single rule from the `.tf` file and `terraform apply`.

For an emergency Cloudflare-side rollback (faster than Terraform), an operator with dashboard access can disable the offending ruleset in **Security → WAF → Custom rules** — but follow up with a Terraform change so the dashboard state matches the Terraform state.

---

## Per-zone gradual rollout

For initial launch, you can apply to one zone at a time to limit blast radius. Override `zone_ids` via env:

```bash
TF_VAR_zone_ids='{"web-ecommerce":"abc..."}' terraform apply -var enable_enforcing=true
```

After 24 hours of clean Security Events on the canary zone, expand to the full 13.

**Note:** The `zones.tf` precondition validates that `var.zone_ids` keys match the canonical 13-slug list. To gradually roll out, comment out the precondition temporarily, re-enable before merge.

---

## Post-launch monitoring

| Cadence | Source | What to look for |
|---------|--------|------------------|
| Daily (week 1 enforcing) | Cloudflare → Security → Overview | Spike in blocks, drop in legitimate traffic |
| Weekly | Cloudflare → Security → Events (filter by ruleset name) | Top blocked URLs, top user-agents, top countries |
| Per incident | Rule `description` field references Plan 11-06 + Pitfall # | Quickly trace any rule back to its policy reasoning |

Every rule in this module has an explicit `description` that references the plan and pitfall number — the dashboard is queryable for ops.

---

## Pro tier upgrade trigger

The free Cloudflare plan caps:
- **5 custom firewall rules per zone** (we use 4 — 1 spare)
- **5 rate limit rules per zone** (we use 5 — at cap)

Upgrade to Pro tier ($20/zone/mo at the time of writing) when any of these is true:

1. **Need a 6th rate limit rule.** Examples that would push us over: per-route limit on a new admin endpoint, separate limits for authenticated vs anonymous users on the same route, geographic-tiered limits.
2. **Need Super Bot Fight Mode** for finer-grained bot classification (verified vs likely-automated vs definitely-automated).
3. **Need OWASP CRS Anomaly Scoring threshold tuning** — Pro exposes more granular paranoia level controls.
4. **Need WAF rule sets beyond OWASP CRS** — Cloudflare Specials (e.g., WordPress / Drupal protection, though we don't run those).
5. **Need Page Rules > 3** (we have one for cache control on assets, one for redirect, one spare).

Cost: 13 zones × $20/mo = $260/mo. Re-evaluate at month 6 post-launch and again at month 12.

---

## Drift detection

Cloudflare dashboard changes (manual edits in the UI) will appear as drift in `terraform plan`. The CI workflow `.github/workflows/cloudflare-terraform-plan.yml` runs `terraform plan -detailed-exitcode` on every PR — drift surfaces as exit code 2 with a non-empty changeset.

If drift is observed but no PR is open:
1. Run `terraform plan` locally.
2. If changes are intentional (someone fixed a P1 in the dashboard), reflect them in the .tf files and open a PR.
3. If unintentional, run `terraform apply` to revert the dashboard to the .tf state.

---

## Cross-references

- `infra/cloudflare/README.md` — module structure + apply order
- `docs/runbooks/cloudflare-edge.md` — middleware matcher + CVE-2025-29927 layer 1 documentation (Plan 03-04)
- `.planning/phases/11-analytics-security/11-06-PLAN.md` — original plan
- `CLAUDE.md` rule 4 — CVE-2025-29927 three-layer defense
