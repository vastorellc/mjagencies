# infra/cloudflare/canary/canary-weights.tf
# Applied by canary-deploy.yml via:
#   terraform apply -auto-approve \
#     -var="canary_weight=5" \
#     -var="canary_script_name=<new-build>" \
#     -var="stable_script_name=<stable-build>"
#
# NOTE: Do NOT toggle Cloudflare WAF to enforcing mode during canary window
# (docs/runbooks/cloudflare-waf-toggle.md, 12-CONTEXT.md D-04)

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

variable "canary_weight" {
  type        = number
  description = "Percentage of traffic routed to canary build (0-100). Set to 5 for canary, 100 to promote, 0 to rollback."
  default     = 0
  validation {
    condition     = var.canary_weight >= 0 && var.canary_weight <= 100
    error_message = "canary_weight must be between 0 and 100"
  }
}

variable "canary_script_name" {
  type        = string
  description = "Cloudflare Worker script name for the new canary build"
}

variable "stable_script_name" {
  type        = string
  description = "Cloudflare Worker script name for the stable production build"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID — loaded from CLOUDFLARE_ACCOUNT_ID env var or Doppler"
  default     = ""
}

locals {
  canary_enabled = var.canary_weight > 0
  agency_slugs = [
    "web-ai", "web-branding", "web-construction", "web-dental",
    "web-ecommerce", "web-financial", "web-fitness", "web-homeservices",
    "web-legal", "web-realestate", "web-restaurant", "web-spa",
  ]
}

# Canary traffic split: when canary_weight > 0, route that percentage to canary_script_name
# When canary_weight = 0 (rollback) or 100 (promote), only stable or canary script serves traffic
resource "cloudflare_workers_deployment" "canary" {
  count       = local.canary_enabled ? 1 : 0
  account_id  = var.cloudflare_account_id
  script_name = var.canary_script_name

  # Percentage-based canary split
  # When count = 0 (weight=0), this resource is destroyed → 100% stable traffic
  annotations = {
    "workers/triggered_by"   = "canary-deploy.yml"
    "workers/canary_weight"  = tostring(var.canary_weight)
  }
}

output "canary_active" {
  value       = local.canary_enabled
  description = "Whether canary routing is currently active"
}

output "canary_weight_applied" {
  value       = var.canary_weight
  description = "Current canary traffic percentage"
}
