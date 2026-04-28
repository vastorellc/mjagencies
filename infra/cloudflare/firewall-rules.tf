# infra/cloudflare/firewall-rules.tf
# Custom firewall rules. Free tier cap = 5 rules per zone; we use 4 (1 spare).
#
# Rule order is significant — Cloudflare evaluates top-to-bottom. The skip
# rule for verified bots is placed first so legitimate crawlers bypass the
# scraper block, geo challenge, and CVE-2025-29927 header check.
#
# Phase: http_request_firewall_custom (zone-level, runs after Managed Ruleset).

resource "cloudflare_ruleset" "custom_firewall" {
  for_each    = var.zone_ids
  zone_id     = each.value
  name        = "Custom Firewall — Plan 11-06 (${each.key})"
  description = "REQ-145/146 — verified-bot skip + scraper block + CVE-2025-29927 layer 1 + US-only geo Challenge"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # ---------------------------------------------------------------------------
  # Rule 1 — Skip security checks for Cloudflare-verified bots (Pitfall 8.4).
  # MUST be evaluated first so GoogleBot / Bingbot / verified uptime monitors
  # are not caught by the scraper block or geo challenge below.
  # ---------------------------------------------------------------------------
  rules {
    action      = "skip"
    expression  = "(cf.client.bot)"
    description = "Skip security checks for Cloudflare-verified bots (Pitfall 8.4 — GoogleBot, Bingbot, etc.)"
    enabled     = true

    action_parameters {
      ruleset = "current"
    }
  }

  # ---------------------------------------------------------------------------
  # Rule 2 — Block CVE-2025-29927 layer 1 (Next.js middleware bypass).
  # Any request carrying the x-middleware-subrequest header is hostile.
  # See docs/runbooks/cloudflare-edge.md and CLAUDE.md rule 4. Layer 2 (Next.js
  # middleware) and Layer 3 (server actions) provide defense in depth.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "block" : "log"
    expression  = "(any(http.request.headers[\"x-middleware-subrequest\"][*] != \"\"))"
    description = "Block requests with x-middleware-subrequest header (CVE-2025-29927 layer 1 — see docs/runbooks/cloudflare-edge.md)"
    enabled     = true
  }

  # ---------------------------------------------------------------------------
  # Rule 3 — Block known content scrapers.
  # AhrefsBot / SemrushBot / MJ12bot consume bandwidth without user benefit.
  # Cloudflare-verified bots already skipped above (rule 1).
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "block" : "log"
    expression  = "(http.user_agent contains \"AhrefsBot\") or (http.user_agent contains \"SemrushBot\") or (http.user_agent contains \"MJ12bot\")"
    description = "Block known content scrapers (AhrefsBot, SemrushBot, MJ12bot) — Plan 11-06"
    enabled     = true
  }

  # ---------------------------------------------------------------------------
  # Rule 4 — US-only geo Challenge (CCPA scope per PROJECT.md v1 US-only).
  # Pitfall 8.1: Use managed_challenge (NOT block) so legitimate VPN users can
  # solve a CAPTCHA. Cloudflare-verified bots already skipped above (rule 1).
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "managed_challenge" : "log"
    expression  = "(ip.geoip.country ne \"US\")"
    description = "Challenge non-US visitors (Pitfall 8.1 — managed_challenge allows VPN users via CAPTCHA; v1 US-only per PROJECT.md)"
    enabled     = true
  }
}
