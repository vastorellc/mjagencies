/**
 * packages/auth/src/agency-from-host.ts
 *
 * Edge-safe Host-header → agency slug extractor.
 *
 * RESEARCH §6.2: The Host header pattern for this platform is:
 *   Production:  <slug>.brand.com          (e.g. ecommerce.brand.com)
 *   Local dev:   <slug>.localhost:<port>   (e.g. ecommerce.localhost:3001)
 *
 * Algorithm:
 *   1. Strip port suffix (split on ':')[0].
 *   2. Split on '.', take the first label as the candidate subdomain.
 *   3. Check against the compile-time AGENCIES whitelist (Set for O(1) lookup).
 *   4. Return the slug if known, null otherwise (unknown → 404; T-03-017 mitigation).
 *
 * Edge runtime safe: imports ONLY from '@mjagency/config' (constant values, no Node APIs).
 */

import { AGENCIES, type AgencySlug } from '@mjagency/config'

/**
 * Compile-time immutable set of all known agency slugs.
 * O(1) lookup used on every request to prevent subdomain probing enumeration.
 */
const KNOWN: ReadonlySet<string> = new Set<string>(AGENCIES)

/**
 * Extracts the agency slug from the HTTP Host header.
 *
 * Returns:
 *   - The `AgencySlug` if the first subdomain label is a known agency.
 *   - `null` if the host is null, empty, has no recognisable subdomain, or the subdomain
 *     is not in the AGENCIES whitelist (e.g. `notreal.brand.com` → null).
 *
 * Subdomain takeover defense (T-03-017): returning null for unknowns causes the middleware
 * to return a 404, not a redirect to /login — this avoids revealing which slugs exist.
 *
 * @param hostHeader - The raw value of the `host` request header.
 */
export function extractAgencyFromHost(hostHeader: string | null): AgencySlug | null {
  if (!hostHeader) return null
  // Strip port (e.g. ecommerce.localhost:3001 → ecommerce.localhost)
  const host = hostHeader.split(':')[0] ?? ''
  // First label is the subdomain
  const parts = host.split('.')
  const subdomain = parts.length >= 2 ? (parts[0] ?? '') : ''
  return KNOWN.has(subdomain) ? (subdomain as AgencySlug) : null
}
