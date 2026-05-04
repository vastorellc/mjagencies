// backend/src/lib/calendar.ts
// RESEARCH-12: 7-day content calendar — assigns content ideas to PKT-optimal posting windows
// Pure function — no DB calls, no async. Called from POST /api/research/generate route.
import type { ContentIdeaData } from '../db/schema.js'

// Backend-side type (frontend re-declares in types.ts per Plan 09-05)
export interface CalendarSlotData {
  platform: string
  hour: number                      // 0-23, PKT (UTC+5)
  idea: ContentIdeaData | null
}

export interface CalendarDayData {
  date: string                      // YYYY-MM-DD
  dow: number                       // 0=Sunday...6=Saturday
  slots: CalendarSlotData[]
}

export interface PostingTimeSlot {
  dow: number
  hour: number
  platform: string
  avg_views: number
  post_count: number
}

export function buildCalendar(
  ideas: ContentIdeaData[],
  postingTimes: PostingTimeSlot[],
): CalendarDayData[] {
  const today = new Date()

  return Array.from({ length: 7 }, (_, dayOffset) => {
    const date = new Date(today)
    // setDate before setHours to avoid month-rollover on last-day-of-month
    date.setDate(today.getDate() + dayOffset)
    date.setUTCHours(0, 0, 0, 0)

    const dow = date.getDay()
    const dateStr = date.toISOString().slice(0, 10)

    // Find posting slots for this day-of-week, sorted by avg_views desc, max 2 per day
    const daySlots = postingTimes
      .filter(t => t.dow === dow)
      .sort((a, b) => b.avg_views - a.avg_views)
      .slice(0, 2)

    return {
      date: dateStr,
      dow,
      slots: daySlots.map((slot, slotIdx) => ({
        platform: slot.platform,
        hour: slot.hour,
        idea: ideas[dayOffset * 2 + slotIdx] ?? null,
      })),
    }
  })
}
