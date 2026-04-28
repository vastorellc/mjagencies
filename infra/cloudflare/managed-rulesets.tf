# infra/cloudflare/managed-rulesets.tf
# Attaches Cloudflare's Managed OWASP Core Rule Set to all 13 zones.
# REQ-145 / REQ-146 — Plan 11-06 §Item 8 baseline coverage for OWASP top 10
# (SQLi, XSS, RCE, LFI, RFI, etc.).
#
# In log-only mode (Phase 1), rule action is "log" — Cloudflare records hits
# to the Security Events stream but does not block. In enforcing mode (Phase
# 2), the action becomes "execute" — the managed ruleset runs at full strength.
#
# OWASP CRS managed_id: efb7b8c949ac4650a09736fc376e9aee
# (Cloudflare-published; stable across the 4.x provider series.)

resource "cloudflare_ruleset" "owasp_managed" {
  for_each    = var.zone_ids
  zone_id     = each.value
  name        = "OWASP Core Rule Set — managed (${each.key})"
  description = "Plan 11-06 (REQ-145/146) — Cloudflare-managed OWASP CRS for ${each.key}"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action      = var.enable_enforcing ? "execute" : "log"
    expression  = "true"
    description = "Execute Cloudflare Managed OWASP Core Rule Set (Plan 11-06)"
    enabled     = true

    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Rules — OWASP CRS

      overrides {
        action = var.enable_enforcing ? "block" : "log"
      }
    }
  }
}
