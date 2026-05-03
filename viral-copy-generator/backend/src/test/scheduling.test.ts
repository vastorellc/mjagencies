import { describe, it, expect } from 'vitest'
import { getPeakTimes } from '../lib/scheduling.js'

// 2026-05-08 is a Friday (UTC day 5)
const FRI_START = new Date('2026-05-08T00:00:00Z')
// 2026-05-04 is a Monday (UTC day 1)
const MON_START = new Date('2026-05-04T00:00:00Z')
// 2026-05-06 is a Wednesday (UTC day 3)
const WED_START = new Date('2026-05-06T00:00:00Z')

describe('getPeakTimes', () => {
  it('youtube: returns 13:00Z and 15:00Z slots on a Friday', () => {
    const slots = getPeakTimes('youtube', FRI_START)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toBe('2026-05-08T13:00:00.000Z')
    expect(slots[1]).toBe('2026-05-08T15:00:00.000Z')
  })

  it('youtube: skips past 13:00Z slot when fromDate is after it', () => {
    const afterFirst = new Date('2026-05-08T14:00:00Z')  // past the 13:00 slot
    const slots = getPeakTimes('youtube', afterFirst)
    expect(slots.length).toBeGreaterThanOrEqual(1)
    expect(slots[0]).toBe('2026-05-08T15:00:00.000Z')
  })

  it('instagram: returns 14:00Z and 16:00Z slots on a Monday', () => {
    const slots = getPeakTimes('instagram', MON_START)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toBe('2026-05-04T14:00:00.000Z')
    expect(slots[1]).toBe('2026-05-04T16:00:00.000Z')
  })

  it('facebook: returns 15:00Z and 17:00Z slots on a Wednesday', () => {
    const slots = getPeakTimes('facebook', WED_START)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toBe('2026-05-06T15:00:00.000Z')
    expect(slots[1]).toBe('2026-05-06T17:00:00.000Z')
  })

  it('tiktok: returns slots on Tue/Thu/Fri at 15:00Z and 17:00Z', () => {
    // 2026-05-05 is a Tuesday (UTC day 2)
    const tueStart = new Date('2026-05-05T00:00:00Z')
    const slots = getPeakTimes('tiktok', tueStart)
    expect(slots).toHaveLength(2)
    expect(slots[0]).toBe('2026-05-05T15:00:00.000Z')
    expect(slots[1]).toBe('2026-05-05T17:00:00.000Z')
  })

  it('x: returns empty array (X has no scheduled slots)', () => {
    expect(getPeakTimes('x', FRI_START)).toEqual([])
  })

  it('returns at most 2 slots', () => {
    const slots = getPeakTimes('youtube', FRI_START)
    expect(slots.length).toBeLessThanOrEqual(2)
  })

  it('all returned slots are valid ISO-8601 UTC strings parseable by new Date()', () => {
    const slots = getPeakTimes('instagram', MON_START)
    for (const slot of slots) {
      expect(() => new Date(slot)).not.toThrow()
      expect(new Date(slot).toISOString()).toBe(slot)
    }
  })
})
