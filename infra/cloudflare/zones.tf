# infra/cloudflare/zones.tf
# 13 zones — one per agency app + brand.com.
#
# This file enumerates the agency slugs for documentation purposes. The actual
# zone IDs live in the var.zone_ids map (set via terraform.tfvars or
# TF_VAR_zone_ids env). All resources in this module use `for_each = var.zone_ids`
# to fan out across every zone.
#
# Validation: agency_slugs MUST match the keys in var.zone_ids exactly.

locals {
  agency_slugs = [
    "web-main",         # mjagency.com (brand)
    "web-ecommerce",    # web-ecommerce.mjagency.com
    "web-realestate",   # web-realestate.mjagency.com
    "web-healthcare",   # web-healthcare.mjagency.com
    "web-legal",        # web-legal.mjagency.com
    "web-homeservices", # web-homeservices.mjagency.com
    "web-fitness",      # web-fitness.mjagency.com
    "web-dental",       # web-dental.mjagency.com
    "web-automotive",   # web-automotive.mjagency.com
    "web-restaurant",   # web-restaurant.mjagency.com
    "web-education",    # web-education.mjagency.com
    "web-financial",    # web-financial.mjagency.com
    "web-petcare",      # web-petcare.mjagency.com
  ]

  # Ensure var.zone_ids matches the canonical 13-slug list. Any drift fails plan.
  zone_id_keys_sorted    = sort(keys(var.zone_ids))
  agency_slugs_sorted    = sort(local.agency_slugs)
  zone_keys_match_slugs  = local.zone_id_keys_sorted == local.agency_slugs_sorted
}

# Fail terraform plan / apply if var.zone_ids does not exactly match the
# canonical 13-slug list. Catches misconfiguration (typos, missing zones, extra
# zones) before any Cloudflare API calls.
resource "terraform_data" "zone_ids_validation" {
  lifecycle {
    precondition {
      condition     = local.zone_keys_match_slugs
      error_message = "var.zone_ids keys must exactly match the 13 agency slugs in local.agency_slugs (zones.tf). Got: ${jsonencode(local.zone_id_keys_sorted)}. Expected: ${jsonencode(local.agency_slugs_sorted)}."
    }
  }
}
