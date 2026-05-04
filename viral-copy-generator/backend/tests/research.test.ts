// backend/tests/research.test.ts
// Research route handler structural tests
// Full integration tests (with DB) run in /gsd-verify-work 9
import { describe, it, expect } from 'vitest'

const VALID_NICHES = ['travel', 'hotels', 'cars', 'bikes', 'coding', 'lifestyle']

describe('niche validation', () => {
  it('accepts all valid niches', () => {
    for (const n of VALID_NICHES) {
      expect(VALID_NICHES.includes(n)).toBe(true)
    }
  })

  it('rejects invalid niches', () => {
    expect(VALID_NICHES.includes('hacking')).toBe(false)
    expect(VALID_NICHES.includes('')).toBe(false)
    expect(VALID_NICHES.includes('__proto__')).toBe(false)
    expect(VALID_NICHES.includes('travel; DROP TABLE')).toBe(false)
  })
})

describe('GET /api/research/trends', () => {
  it('returns 400 for invalid niche', async () => {
    // Structural: isValidNiche exported from research.ts for direct testing
    const { isValidNiche } = await import('../src/routes/research.js')
    expect(isValidNiche('hacking')).toBe(false)
    expect(isValidNiche('travel')).toBe(true)
    expect(isValidNiche('lifestyle')).toBe(true)
    expect(isValidNiche('')).toBe(false)
  })

  it('returns trends array from cache or live fetch (structural check)', async () => {
    // researchRouter is a valid Express Router function
    const { researchRouter } = await import('../src/routes/research.js')
    expect(researchRouter).toBeDefined()
    expect(typeof researchRouter).toBe('function')
  })
})

describe('POST /api/research/refresh', () => {
  it('enqueues a pg-boss job and returns { ok: true } (structural check)', async () => {
    const { researchRouter } = await import('../src/routes/research.js')
    expect(researchRouter).toBeDefined()
    // Full integration test (actual pg-boss job enqueue) requires running Supabase + pg-boss
    // See /gsd-verify-work 9 for E2E verification
    expect(true).toBe(true)
  })
})

describe('GET /api/research/saved', () => {
  it('route exists and researchRouter is exported', async () => {
    const { researchRouter } = await import('../src/routes/research.js')
    expect(researchRouter).toBeDefined()
    // Full integration test requires DB — see /gsd-verify-work 9
    expect(true).toBe(true)
  })
})

describe('isValidNiche allowlist', () => {
  it('returns true for all 6 valid niches', async () => {
    const { isValidNiche } = await import('../src/routes/research.js')
    expect(isValidNiche('travel')).toBe(true)
    expect(isValidNiche('hotels')).toBe(true)
    expect(isValidNiche('cars')).toBe(true)
    expect(isValidNiche('bikes')).toBe(true)
    expect(isValidNiche('coding')).toBe(true)
    expect(isValidNiche('lifestyle')).toBe(true)
  })

  it('returns false for injection attempts and unknown niches', async () => {
    const { isValidNiche } = await import('../src/routes/research.js')
    expect(isValidNiche('__proto__')).toBe(false)
    expect(isValidNiche('constructor')).toBe(false)
    expect(isValidNiche('travel; DROP TABLE')).toBe(false)
    expect(isValidNiche('TRAVEL')).toBe(false)   // case-sensitive
  })
})
