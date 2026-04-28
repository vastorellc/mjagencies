# infra/cloudflare/main.tf
# Top-level wiring — references all submodules per zone.
#
# Cloudflare ruleset and zone-setting resources are attached at the zone level.
# Each of the 13 zones receives, via for_each over var.zone_ids:
#
#   - Managed Ruleset (OWASP Core Rule Set) attachment
#       → managed-rulesets.tf  (cloudflare_ruleset, phase=http_request_firewall_managed)
#
#   - Bot Fight Mode (free tier)
#       → bot-fight-mode.tf    (cloudflare_zone_setting setting_id=bot_fight_mode)
#
#   - Custom firewall rules (4 rules: scraper block, CVE-2025-29927 layer 1
#     header block, US-only geo Challenge, verified-bot skip)
#       → firewall-rules.tf    (cloudflare_ruleset, phase=http_request_firewall_custom)
#
#   - Per-route rate limits (5 rules: auth, public form POST, RUM ingest,
#     CSP report, public reads)
#       → rate-limits.tf       (cloudflare_ruleset, phase=http_ratelimit)
#
# Free tier Cloudflare ruleset budget per zone:
#   - 5 custom firewall rules  (we use 4 — 1 spare)
#   - 5 rate limit rules        (we use 5 — at cap)
#
# If we exceed either cap in the future, upgrade to Pro tier (see
# docs/runbooks/cloudflare-waf-rollout.md §Pro tier upgrade trigger).

# Outputs surfaced for ops / debugging.
output "managed_zones" {
  description = "List of zone slugs covered by this Terraform module."
  value       = sort(keys(var.zone_ids))
}

output "enforcement_mode" {
  description = "Current enforcement mode (false = log-only Phase 1; true = enforcing Phase 2)."
  value       = var.enable_enforcing ? "enforcing" : "log-only"
}
