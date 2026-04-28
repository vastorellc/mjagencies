/**
 * packages/meta-capi/src/per-agency-env.ts
 *
 * Per-agency environment variable lookup with hyphen normalization.
 *
 * Convention (project-wide):
 *   process.env[`${KEY}_${agencyId.replaceAll('-','_').toUpperCase()}`]
 *
 * Example:
 *   getAgencySecret('META_PIXEL_ID', 'web-ecommerce')
 *     → reads process.env.META_PIXEL_ID_WEB_ECOMMERCE
 *
 * NOTE: Plan 11-01 will provide a shared `getAgencySecret` in `@mjagency/config`.
 * Until that lands, this local helper preserves the contract used by Plan 11-03.
 * Both helpers MUST agree on hyphen normalization (`-` → `_`) so values are
 * lookup-compatible across packages.
 */

function normalizeAgencyForEnv(agencyId: string): string {
  return agencyId.replaceAll('-', '_').toUpperCase()
}

/**
 * Reads a required per-agency secret from process.env.
 * Throws if the env var is missing — fail-fast for CAPI configuration drift.
 */
export function getAgencySecret(key: string, agencyId: string): string {
  const envKey = `${key}_${normalizeAgencyForEnv(agencyId)}`
  const value = process.env[envKey]
  if (!value) {
    throw new Error(`Missing per-agency env: ${envKey}`)
  }
  return value
}

/**
 * Reads an optional per-agency secret. Returns undefined when absent
 * (e.g. META_TEST_EVENT_CODE_* — only set in dev/staging).
 */
export function getAgencySecretOptional(key: string, agencyId: string): string | undefined {
  const envKey = `${key}_${normalizeAgencyForEnv(agencyId)}`
  return process.env[envKey]
}
