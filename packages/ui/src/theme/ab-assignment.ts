// packages/ui/src/theme/ab-assignment.ts
// M004: random assignment. M009+: GA4 experiment cookie hash (deterministic per visitor).
import type { AbVariant } from './ab-types.js';

/**
 * Random A/B assignment with optional deterministic seed.
 * trafficSplit is the percentage routed to variant B (0-100).
 * If seed provided, hash it deterministically (M009 swap point).
 *
 * REQ-044 (12 niche themes are the variant A pool); REQ-048 (Storybook proves both variants).
 */
export function assignVariant(
  _agencyId: string,
  trafficSplit: number,
  seed?: string,
): AbVariant {
  if (typeof seed === 'string' && seed.length > 0) {
    // Deterministic hash for testing or analytics-cookie-based assignment (M009)
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) | 0;
    }
    const bucket = Math.abs(h) % 100;
    return bucket < trafficSplit ? 'b' : 'a';
  }
  return Math.random() * 100 < trafficSplit ? 'b' : 'a';
}

/** Read variant from cookie (Phase 9+ pattern) */
export function resolveVariantFromCookie(cookieValue: string | undefined): AbVariant {
  return cookieValue === 'b' ? 'b' : 'a';
}
