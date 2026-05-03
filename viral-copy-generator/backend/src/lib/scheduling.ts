// backend/src/lib/scheduling.ts
// AUTOUP-05 + AUTOUP-06: PKT peak-time scheduling utility
// All times stored/returned as UTC ISO-8601 strings.
// PKT = UTC+5 (no daylight saving — Pakistan does not observe DST).

export type SchedulablePlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'x'

interface PeakDaySpec {
  days: number[]  // UTC day-of-week values
  hours: number[] // UTC hours (PKT hour minus 5)
}

// AUTOUP-06: PKT peak times converted to UTC (PKT - 5h)
// JS Date.getUTCDay(): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
export const PKT_PEAK_TIMES: Record<SchedulablePlatform, PeakDaySpec | null> = {
  youtube:   { days: [5, 6, 0], hours: [13, 15] }, // Fri Sat Sun · 18:00+20:00 PKT
  instagram: { days: [1, 3, 5], hours: [14, 16] }, // Mon Wed Fri · 19:00+21:00 PKT
  tiktok:    { days: [2, 4, 5], hours: [15, 17] }, // Tue Thu Fri · 20:00+22:00 PKT
  facebook:  { days: [3, 4],    hours: [15, 17] }, // Wed Thu     · 20:00+22:00 PKT
  x:         null,                                  // X: copy only, no upload
}

const FIVE_MIN_MS = 5 * 60 * 1000
const MAX_SCAN_DAYS = 14

/**
 * Return up to 2 upcoming peak-time slots for the given platform.
 * @param platform - must be one of SchedulablePlatform
 * @param fromDate - scan start (default: now); useful for deterministic tests
 * @returns ISO-8601 UTC strings, length 0-2
 */
export function getPeakTimes(platform: SchedulablePlatform, fromDate: Date = new Date()): string[] {
  const spec = PKT_PEAK_TIMES[platform]
  if (!spec) return [] // X has no scheduled slots

  const slots: string[] = []
  const threshold = fromDate.getTime() + FIVE_MIN_MS

  for (let dayOffset = 0; dayOffset < MAX_SCAN_DAYS && slots.length < 2; dayOffset++) {
    for (const hour of spec.hours) {
      if (slots.length >= 2) break

      // Build a candidate UTC datetime: fromDate's calendar day + dayOffset, at `hour`:00:00Z
      const candidate = new Date(fromDate)
      candidate.setUTCDate(candidate.getUTCDate() + dayOffset)
      candidate.setUTCHours(hour, 0, 0, 0)

      // Only keep if day-of-week matches and slot is > 5min in the future
      const dow = candidate.getUTCDay()
      if (spec.days.includes(dow) && candidate.getTime() > threshold) {
        slots.push(candidate.toISOString())
      }
    }
  }

  return slots
}
