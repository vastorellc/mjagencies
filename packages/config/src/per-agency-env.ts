/**
 * packages/config/src/per-agency-env.ts
 * Per-agency env var lookup helper. Generalizes Phase 7 LiteLLM convention.
 *
 * Slug normalization: agencyId.replaceAll('-','_').toUpperCase()
 * e.g., 'web-ecommerce' → 'WEB_ECOMMERCE'
 * Used by: GA4 secrets (Plan 11-01), Meta CAPI (Plan 11-03), Clarity (Plan 11-02).
 */
export function normalizeSlug(agencyId: string): string {
  return agencyId.replaceAll('-', '_').toUpperCase()
}

/**
 * Reads a required per-agency secret from env. Throws if missing.
 *
 * @param prefix - Env var prefix (e.g., 'GA4_API_SECRET')
 * @param agencyId - Agency slug (e.g., 'web-ecommerce')
 * @returns The env var value
 * @throws Error if env var missing — fail fast, no silent fallbacks
 */
export function getAgencySecret(prefix: string, agencyId: string): string {
  const key = `${prefix}_${normalizeSlug(agencyId)}`
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

/** Same as getAgencySecret but returns undefined instead of throwing. */
export function getAgencySecretOptional(prefix: string, agencyId: string): string | undefined {
  return process.env[`${prefix}_${normalizeSlug(agencyId)}`]
}
