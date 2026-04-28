# infra/cloudflare/variables.tf
# Inputs to the Cloudflare WAF Terraform module.

variable "account_id" {
  description = "Cloudflare account ID — required for managed ruleset attachments and account-scoped resources."
  type        = string
  sensitive   = false
}

variable "zone_ids" {
  description = <<-EOT
    Map of agency slug → Cloudflare zone ID. Must contain all 13 agency slugs
    declared in zones.tf (web-main + 12 agency subdomains).

    Example (set via terraform.tfvars or TF_VAR_zone_ids JSON):
    {
      "web-main"          = "abc123..."
      "web-ecommerce"     = "def456..."
      "web-realestate"    = "ghi789..."
      "web-healthcare"    = "..."
      "web-legal"         = "..."
      "web-homeservices"  = "..."
      "web-fitness"       = "..."
      "web-dental"        = "..."
      "web-automotive"    = "..."
      "web-restaurant"    = "..."
      "web-education"     = "..."
      "web-financial"     = "..."
      "web-petcare"       = "..."
    }
  EOT
  type        = map(string)
}

variable "enable_enforcing" {
  description = <<-EOT
    Phased rollout toggle (see docs/runbooks/cloudflare-waf-rollout.md).

    false (default) = Phase 1 / log-only — all rules deployed with action=log.
                      Cloudflare logs the hit; does NOT block/challenge. Used
                      for the first 7 days post-deployment to triage false
                      positives without disrupting legitimate traffic.

    true            = Phase 2 / enforcing — rules execute their final action
                      (block / managed_challenge / execute managed ruleset).

    Plan 11-06 §Rollout requires log-only week 1, enforcing week 2.
  EOT
  type        = bool
  default     = false
}
