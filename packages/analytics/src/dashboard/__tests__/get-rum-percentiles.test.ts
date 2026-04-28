/**
 * packages/analytics/src/dashboard/__tests__/get-rum-percentiles.test.ts
 * REQ-143 + Plan 11-07 — UI-SPEC threshold contract for the RUM KPI cards.
 *
 * Tests the pure rateMetric() helper since it encodes the Surface 1 threshold
 * contract directly. Database-backed paths (getRumOverallP75, getRumPerPagePercentiles)
 * are exercised in integration tests against a seeded web_vitals fixture.
 */
import { describe, it, expect } from 'vitest'
import { rateMetric } from '../get-rum-percentiles.js'

describe('rateMetric (UI-SPEC Surface 1 thresholds)', () => {
  describe('LCP', () => {
    it('returns rating="good" for LCP <= 2500', () => {
      expect(rateMetric('LCP', 0)).toBe('good')
      expect(rateMetric('LCP', 1000)).toBe('good')
      expect(rateMetric('LCP', 2500)).toBe('good')
    })
    it('returns rating="needs-improvement" for LCP 2501-4000', () => {
      expect(rateMetric('LCP', 2501)).toBe('needs-improvement')
      expect(rateMetric('LCP', 3500)).toBe('needs-improvement')
      expect(rateMetric('LCP', 4000)).toBe('needs-improvement')
    })
    it('returns rating="poor" for LCP > 4000', () => {
      expect(rateMetric('LCP', 4001)).toBe('poor')
      expect(rateMetric('LCP', 10000)).toBe('poor')
    })
  })

  describe('INP', () => {
    it('returns rating="good" for INP <= 200', () => {
      expect(rateMetric('INP', 0)).toBe('good')
      expect(rateMetric('INP', 200)).toBe('good')
    })
    it('returns rating="needs-improvement" for INP 201-500', () => {
      expect(rateMetric('INP', 201)).toBe('needs-improvement')
      expect(rateMetric('INP', 500)).toBe('needs-improvement')
    })
    it('returns rating="poor" for INP > 500', () => {
      expect(rateMetric('INP', 501)).toBe('poor')
    })
  })

  describe('CLS', () => {
    it('returns rating="good" for CLS <= 0.1', () => {
      expect(rateMetric('CLS', 0)).toBe('good')
      expect(rateMetric('CLS', 0.1)).toBe('good')
    })
    it('returns rating="needs-improvement" for CLS 0.11-0.25', () => {
      expect(rateMetric('CLS', 0.11)).toBe('needs-improvement')
      expect(rateMetric('CLS', 0.25)).toBe('needs-improvement')
    })
    it('returns rating="poor" for CLS > 0.25', () => {
      expect(rateMetric('CLS', 0.26)).toBe('poor')
    })
  })

  describe('FCP / TTFB', () => {
    it('rates FCP correctly across tiers', () => {
      expect(rateMetric('FCP', 1800)).toBe('good')
      expect(rateMetric('FCP', 2500)).toBe('needs-improvement')
      expect(rateMetric('FCP', 3001)).toBe('poor')
    })
    it('rates TTFB correctly across tiers', () => {
      expect(rateMetric('TTFB', 800)).toBe('good')
      expect(rateMetric('TTFB', 1200)).toBe('needs-improvement')
      expect(rateMetric('TTFB', 1801)).toBe('poor')
    })
  })
})
