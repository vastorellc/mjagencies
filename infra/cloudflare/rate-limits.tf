# infra/cloudflare/rate-limits.tf
# Per-route rate limits. Free tier cap = 5 rate limit rules per zone; we use 5 (at cap).
# Adding any new endpoint-class rate limit requires Pro tier upgrade.
#
# Phase: http_ratelimit (zone-level).
#
# Rate limit thresholds (Plan 11-06 §interfaces / RESEARCH §8):
#   /api/auth/login + /api/auth/refresh + /api/sso/*           10/min/IP  Challenge
#   /api/contact + /api/privacy/* + /api/ccpa/opt-out (POST)    5/min/IP  Block
#   /api/rum                            (POST, Plan 11-07)    100/min/IP  Block
#   /api/csp-report                     (POST, Plan 11-07)     50/min/IP  Block
#   /, /blog/*, /services/*             (GET public reads)    100/min/IP  Challenge

resource "cloudflare_ruleset" "rate_limits" {
  for_each    = var.zone_ids
  zone_id     = each.value
  name        = "Rate Limits — Plan 11-06 (${each.key})"
  description = "REQ-145/146 — per-route rate limits (auth, public forms, RUM, CSP report, public reads) for ${each.key}"
  kind        = "zone"
  phase       = "http_ratelimit"

  # ---------------------------------------------------------------------------
  # Rule 1 — Auth endpoints: 10/min/IP, Challenge.
  # Covers /api/auth/login, /api/auth/refresh, /api/sso/*.
  # Challenge (not Block) so a legitimate user behind shared NAT (office)
  # can solve a CAPTCHA after burst. Mitigation timeout 10min discourages
  # credential stuffing.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "managed_challenge" : "log"
    expression  = "(http.request.uri.path eq \"/api/auth/login\") or (http.request.uri.path eq \"/api/auth/refresh\") or (starts_with(http.request.uri.path, \"/api/sso/\"))"
    description = "Auth: 10/min/IP managed_challenge (login + refresh + SSO)"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }

  # ---------------------------------------------------------------------------
  # Rule 2 — Public form POSTs: 5/min/IP, Block.
  # Covers /api/contact + /api/privacy/erasure-request + /api/privacy/verify
  # + /api/ccpa/opt-out (Plan 11-05 endpoints). Anti-abuse for form spam +
  # CCPA erasure-request flood. Block (not Challenge) per RESEARCH §8 — these
  # are clearly programmatic abuse signals at >5/min from one IP.
  # Mitigation timeout 1h to dissuade automated retry.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "block" : "log"
    expression  = "(http.request.method eq \"POST\") and ((http.request.uri.path eq \"/api/contact\") or (http.request.uri.path eq \"/api/privacy/erasure-request\") or (http.request.uri.path eq \"/api/privacy/verify\") or (http.request.uri.path eq \"/api/ccpa/opt-out\"))"
    description = "Public form POSTs: 5/min/IP block (contact + privacy + ccpa anti-abuse — Plan 11-05 endpoints)"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 5
      mitigation_timeout  = 3600
    }
  }

  # ---------------------------------------------------------------------------
  # Rule 3 — RUM ingest: 100/min/IP, Block.
  # /api/rum (Plan 11-07). 100/min/IP is generous (single-page-app emits one
  # beacon per page navigation). Block at threshold prevents beacon flood.
  # Mitigation timeout 60s — RUM is high-volume legitimate traffic, no point
  # in long lockout.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "block" : "log"
    expression  = "(http.request.method eq \"POST\") and (http.request.uri.path eq \"/api/rum\")"
    description = "RUM ingest: 100/min/IP block (Plan 11-07 /api/rum endpoint)"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 60
    }
  }

  # ---------------------------------------------------------------------------
  # Rule 4 — CSP report ingest: 50/min/IP, Block.
  # /api/csp-report (Plan 11-07). 50/min/IP — a misconfigured page can spam
  # reports during user session. Block at threshold prevents log flooding.
  # Mitigation timeout 60s.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "block" : "log"
    expression  = "(http.request.method eq \"POST\") and (http.request.uri.path eq \"/api/csp-report\")"
    description = "CSP report: 50/min/IP block (Plan 11-07 /api/csp-report endpoint)"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 50
      mitigation_timeout  = 60
    }
  }

  # ---------------------------------------------------------------------------
  # Rule 5 — Public reads: 100/min/IP, Challenge.
  # /, /blog/*, /services/* GET. Pitfall 8.2: Challenge (NOT Block) so office
  # NAT (50-person company sharing one IP) isn't fully locked out — they get
  # a CAPTCHA instead. Mitigation timeout 60s — minimal user friction.
  # ---------------------------------------------------------------------------
  rules {
    action      = var.enable_enforcing ? "managed_challenge" : "log"
    expression  = "(http.request.method eq \"GET\") and ((http.request.uri.path eq \"/\") or starts_with(http.request.uri.path, \"/blog/\") or starts_with(http.request.uri.path, \"/services/\"))"
    description = "Public reads: 100/min/IP managed_challenge (Pitfall 8.2 — Challenge not Block for office NAT)"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 60
    }
  }
}
