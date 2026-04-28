# Cloudflare WAF Terraform — Plan 11-06 (REQ-145 / REQ-146)

Per-zone Cloudflare WAF, Bot Fight Mode, custom firewall rules, and rate limits configured via Terraform across all 13 MJAgency zones (`mjagency.com` + 12 agency subdomains).

## Module structure

| File | Purpose |
|------|---------|
| `versions.tf` | Provider pin (`cloudflare/cloudflare ~> 4.40`), Terraform `>= 1.6.0` |
| `variables.tf` | `account_id`, `zone_ids` map, `enable_enforcing` rollout toggle |
| `zones.tf` | Canonical 13-agency slug list + zone-id validation precondition |
| `main.tf` | Top-level outputs (managed_zones, enforcement_mode) and wiring docs |
| `managed-rulesets.tf` | OWASP Core Rule Set attachment (`phase=http_request_firewall_managed`) |
| `bot-fight-mode.tf` | Bot Fight Mode toggle (free tier) per zone |
| `firewall-rules.tf` | 4 custom rules: scraper block, CVE-2025-29927 header block, US-only geo Challenge, verified-bot skip |
| `rate-limits.tf` | 5 per-route rate limits (auth, public form POST, RUM, CSP report, public reads) |

## Apply order

1. **Set env vars** (Doppler local / GitHub Secrets in CI):
   - `CLOUDFLARE_API_TOKEN` — token with `Zone:Edit` + `Zone WAF:Edit` across all 13 zones (least-privilege).
   - `TF_VAR_account_id` — Cloudflare account ID.
   - `TF_VAR_zone_ids` — JSON map of slug → zone id (or set in `terraform.tfvars`).

2. **Initialize:**
   ```bash
   terraform -chdir=infra/cloudflare init
   ```

3. **Phase 1 — log-only (week 1):**
   ```bash
   terraform -chdir=infra/cloudflare apply -var enable_enforcing=false
   ```
   All rules deployed in log-only mode. Cloudflare dashboard → Security → Events shows hits without blocking. Triage false positives over 7 days per `docs/runbooks/cloudflare-waf-rollout.md`.

4. **Phase 2 — enforcing (week 2):**
   ```bash
   terraform -chdir=infra/cloudflare apply -var enable_enforcing=true
   ```

## CI gate

`.github/workflows/cloudflare-terraform-plan.yml` runs `terraform fmt -check`, `terraform validate`, and `terraform plan -detailed-exitcode` on every PR touching `infra/cloudflare/**`.

Manual `terraform apply` is required on merge — automated apply is deferred to Phase 12 launch QA.

## Rollout runbook

See [`docs/runbooks/cloudflare-waf-rollout.md`](../../docs/runbooks/cloudflare-waf-rollout.md) for:
- Phased rollout (log-only → enforcing)
- False-positive triage workflow
- Rollback procedure
- Pro tier upgrade trigger criteria

## Free tier budget

- **5 custom firewall rules per zone** — we use 4 (1 spare).
- **5 rate limit rules per zone** — we use 5 (at cap; any new endpoint-class rate limit requires Pro tier).
- **Bot Fight Mode** — free tier on/off toggle (no Super Bot Fight Mode).
- **Managed OWASP CRS** — included on free tier.

If the team needs >5 rate limits or per-route Super Bot Fight Mode, upgrade Cloudflare plan to Pro and revisit this module.
