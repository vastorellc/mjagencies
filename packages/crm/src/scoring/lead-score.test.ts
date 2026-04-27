import { describe, it, expect } from 'vitest'
import { computeLeadScore, DEFAULT_WEIGHTS, type LeadScoreInput } from './lead-score.js'

const BEHAVIOR_WEIGHT = DEFAULT_WEIGHTS.behavior // 0.35

const daysAgo = (d: number): string => new Date(Date.now() - d * 86_400_000).toISOString()

const baseInput: LeadScoreInput = {
  icp: { industryFit: 'high', companySizeFit: 'ideal', roleSeniority: 'c_suite' },
  behavior: { pageViews: 0, formFills: 0, emailOpens: 0 },
  lastTouchedAt: daysAgo(1),
  source: 'inbound_content',
}

describe('computeLeadScore', () => {
  describe('ICP weight paths', () => {
    it('perfect ICP = 1.0 sub-score', () => {
      const score = computeLeadScore({ ...baseInput, behavior: { pageViews: 0, formFills: 0, emailOpens: 0 } })
      // ICP(1.0)*0.40 + behavior(0)*0.35 + recency(1.0)*0.15 + source(1.0)*0.10 = 0.65
      expect(score).toBeCloseTo(0.65, 2)
    })
    it('none industry fit lowers score', () => {
      const s = computeLeadScore({ ...baseInput, icp: { ...baseInput.icp, industryFit: 'none' } })
      expect(s).toBeLessThan(0.65)
    })
    it('individual seniority lowers icp score', () => {
      const s = computeLeadScore({ ...baseInput, icp: { ...baseInput.icp, roleSeniority: 'individual' } })
      expect(s).toBeLessThan(0.65)
    })
  })

  describe('Behavior weight paths', () => {
    it('10 page views = 1.0 behavior cap', () => {
      const s = computeLeadScore({ ...baseInput, behavior: { pageViews: 10, formFills: 0, emailOpens: 0 } })
      // behavior = clamp(10*0.1) = 1.0; ICP(1.0)*0.40 + 1.0*0.35 + 1.0*0.15 + 1.0*0.10 = 1.0
      expect(s).toBeCloseTo(1.0, 2)
    })
    it('pageViews capped at 10 (20 views same as 10)', () => {
      const s1 = computeLeadScore({ ...baseInput, behavior: { pageViews: 10, formFills: 0, emailOpens: 0 } })
      const s2 = computeLeadScore({ ...baseInput, behavior: { pageViews: 20, formFills: 0, emailOpens: 0 } })
      expect(s1).toBeCloseTo(s2, 4)
    })
    it('formFill adds 0.5 to behavior sub-score', () => {
      const s0 = computeLeadScore({ ...baseInput, behavior: { pageViews: 0, formFills: 0, emailOpens: 0 } })
      const s1 = computeLeadScore({ ...baseInput, behavior: { pageViews: 0, formFills: 1, emailOpens: 0 } })
      expect(s1 - s0).toBeCloseTo(0.5 * BEHAVIOR_WEIGHT, 3)
    })
    it('emailOpens capped at 5', () => {
      const s5 = computeLeadScore({ ...baseInput, behavior: { pageViews: 0, formFills: 0, emailOpens: 5 } })
      const s10 = computeLeadScore({ ...baseInput, behavior: { pageViews: 0, formFills: 0, emailOpens: 10 } })
      expect(s5).toBeCloseTo(s10, 4)
    })
  })

  describe('Recency buckets', () => {
    it('0–7 days ago = recencyScore 1.0', () => {
      const s = computeLeadScore({ ...baseInput, lastTouchedAt: daysAgo(3) })
      expect(s).toBeCloseTo(0.65, 2)
    })
    it('8–30 days ago = recencyScore 0.7', () => {
      const s = computeLeadScore({ ...baseInput, lastTouchedAt: daysAgo(15) })
      // ICP(1)*0.40 + 0*0.35 + 0.7*0.15 + 1.0*0.10 = 0.605
      expect(s).toBeCloseTo(0.605, 2)
    })
    it('31–90 days ago = recencyScore 0.3', () => {
      const s = computeLeadScore({ ...baseInput, lastTouchedAt: daysAgo(60) })
      expect(s).toBeCloseTo(0.545, 2)
    })
    it('>90 days ago = recencyScore 0.0', () => {
      const s = computeLeadScore({ ...baseInput, lastTouchedAt: daysAgo(120) })
      expect(s).toBeCloseTo(0.50, 2)
    })
  })

  describe('Source values', () => {
    it.each([
      ['inbound_content', 1.0],
      ['referral', 0.9],
      ['organic_search', 0.8],
      ['paid_ad', 0.6],
      ['cold_outreach', 0.3],
      ['unknown_source', 0.0],
    ] as const)('source=%s contributes correctly', (source, sourceScore) => {
      const s = computeLeadScore({ ...baseInput, source, behavior: { pageViews: 0, formFills: 0, emailOpens: 0 } })
      // Expected: ICP(1)*0.40 + 0*0.35 + 1.0*0.15 + sourceScore*0.10
      const expected = 0.40 + 0 + 0.15 + sourceScore * 0.10
      expect(s).toBeCloseTo(expected, 2)
    })
  })

  describe('Edge cases', () => {
    it('score is never below 0', () => {
      const s = computeLeadScore({
        icp: { industryFit: 'none', companySizeFit: 'poor', roleSeniority: 'individual' },
        behavior: { pageViews: 0, formFills: 0, emailOpens: 0 },
        lastTouchedAt: daysAgo(200),
        source: 'unknown',
      })
      expect(s).toBeGreaterThanOrEqual(0)
    })
    it('score is never above 1', () => {
      const s = computeLeadScore({
        icp: { industryFit: 'high', companySizeFit: 'ideal', roleSeniority: 'c_suite' },
        behavior: { pageViews: 100, formFills: 10, emailOpens: 100 },
        lastTouchedAt: daysAgo(0),
        source: 'inbound_content',
      })
      expect(s).toBeLessThanOrEqual(1)
    })
  })
})
