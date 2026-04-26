/**
 * packages/db/src/seed/uuid.ts
 *
 * Deterministic agency UUID derivation.
 *
 * Produces a stable UUID-shaped string from an agency slug.
 * Used by both the seed framework and other Phase 2 scripts
 * (verify-pgbouncer-rls, etc.) so agency_id values are predictable
 * without requiring a DB lookup.
 *
 * The format is v5-style (version nibble = 5, variant bits = 10xx) but
 * uses SHA-256 as the hash function rather than SHA-1 (real UUIDv5).
 * The result fits PostgreSQL's uuid type.
 */

import { createHash } from 'node:crypto'

/**
 * Derive a deterministic UUID-shaped id for an agency slug.
 *
 * @param slug - agency slug (e.g. 'ecommerce', 'brand')
 * @returns UUID string matching /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
 */
export function agencyUuid(slug: string): string {
  const h = createHash('sha256').update(`mjagency:agency:${slug}`).digest('hex')
  // Format as a v5-style UUID (deterministic; SHA-256 based, not real UUIDv5 SHA-1)
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '5' + h.slice(13, 16), // version nibble = 5
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20), // variant 10xx
    h.slice(20, 32),
  ].join('-')
}
