/**
 * packages/auth/src/__tests__/agency-from-host.test.ts
 *
 * Unit tests for extractAgencyFromHost — Edge-safe Host-header → agency slug extractor.
 * No external dependencies, no mocks needed. Pure function tests.
 */

import { describe, it, expect } from 'vitest'
import { extractAgencyFromHost } from '../agency-from-host.js'
import { AGENCIES } from '@mjagency/config'

describe('extractAgencyFromHost', () => {
  it('Test 1: extracts known agency from production host (ecommerce.brand.com → ecommerce)', () => {
    expect(extractAgencyFromHost('ecommerce.brand.com')).toBe('ecommerce')
  })

  it('Test 2: extracts known agency from local dev host with port (ecommerce.localhost:3001 → ecommerce)', () => {
    expect(extractAgencyFromHost('ecommerce.localhost:3001')).toBe('ecommerce')
  })

  it('Test 3: returns null for unknown subdomain (notreal.brand.com → null)', () => {
    expect(extractAgencyFromHost('notreal.brand.com')).toBeNull()
  })

  it('Test 4: returns null for empty host string', () => {
    expect(extractAgencyFromHost('')).toBeNull()
  })

  it('Test 5: returns null for null host header', () => {
    expect(extractAgencyFromHost(null)).toBeNull()
  })

  it('Test 6: all 12 known agency slugs map correctly when used as subdomain', () => {
    for (const slug of AGENCIES) {
      const host = `${slug}.brand.com`
      expect(extractAgencyFromHost(host)).toBe(slug)
    }
  })

  it('Test 7 (bonus): bare host with no dots returns null (single-label host)', () => {
    // A bare host like 'localhost' has only 1 part after split('.') — subdomain extraction
    // requires at least 2 parts (subdomain + domain), so this returns null.
    expect(extractAgencyFromHost('localhost')).toBeNull()
  })
})
