import { describe, it, expect } from 'vitest'
import { agencyAssetCacheTag } from '../cache-tags'

// The 12 agencies (excluding brand) per packages/config/src/agency-constants.ts
const AGENCY_SLUGS = [
  'ecommerce',
  'growth',
  'webdev',
  'ai',
  'branding',
  'strategy',
  'finance',
  'engineering',
  'product',
  'video',
  'graphic',
] as const

describe('agencyAssetCacheTag', () => {
  it('returns the correct cache tag format for a known input', () => {
    expect(agencyAssetCacheTag('ecommerce', 'abc-123')).toBe('agency:ecommerce:asset:abc-123')
  })

  it('returns cache tags matching the expected pattern for all 11 agency slugs', () => {
    for (const agency of AGENCY_SLUGS) {
      const tag = agencyAssetCacheTag(agency, 'some-asset-id')
      expect(tag).toMatch(/^agency:[a-z]+:asset:[\w-]+$/)
      expect(tag.startsWith('agency:')).toBe(true)
    }
  })

  it('returns agency:ecommerce:asset:abc-123 exactly', () => {
    const result = agencyAssetCacheTag('ecommerce', 'abc-123')
    expect(result).toBe('agency:ecommerce:asset:abc-123')
  })
})
