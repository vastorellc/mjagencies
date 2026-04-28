# infra/cloudflare/versions.tf
# REQ-145 / REQ-146: Terraform module for Cloudflare WAF + rate limits (Plan 11-06).
#
# This module configures Cloudflare WAF Managed Ruleset (OWASP Core Rule Set),
# Bot Fight Mode, custom firewall rules (CVE-2025-29927 layer 1, US-only geo
# challenge, scraper block), and per-route rate limits across all 13 zones
# (mjagency.com + 12 agency subdomains).
#
# Provider auth: CLOUDFLARE_API_TOKEN env var (Doppler-injected) — never
# hardcoded. Token requires Zone:Edit + Zone WAF:Edit on all 13 zones.

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

provider "cloudflare" {
  # api_token is sourced from CLOUDFLARE_API_TOKEN env var by default.
  # Do NOT hardcode the token here — it is injected at runtime via Doppler
  # (local) or GitHub Secrets (CI). Terraform's cloudflare provider auto-reads
  # the env var when this block is empty.
}
