import { useState, useEffect } from 'react'
import type { Platform } from '../lib/types'
import { fetchPeakTimes } from '../lib/api'

interface Props {
  platform: Platform
  onConfirm: (scheduledAt: string | null) => void  // null = immediate
  onCancel: () => void
}

function formatPKT(isoUtc: string): string {
  // Display PKT time (UTC+5) to the user — Pakistan does not observe DST
  const d = new Date(isoUtc)
  const pktMs = d.getTime() + 5 * 60 * 60 * 1000
  const pkt = new Date(pktMs)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${days[pkt.getUTCDay()]} ${pkt.getUTCDate()}/${pkt.getUTCMonth() + 1} ${pad(pkt.getUTCHours())}:${pad(pkt.getUTCMinutes())} PKT`
}

export default function ScheduleModal({ platform, onConfirm, onCancel }: Props) {
  const [peakSlots, setPeakSlots] = useState<string[]>([])
  const [selected, setSelected] = useState<'immediate' | 'custom' | string>('immediate')
  const [customDatetime, setCustomDatetime] = useState<string>('')
  const [loadingSlots, setLoadingSlots] = useState<boolean>(true)

  useEffect(() => {
    setLoadingSlots(true)
    fetchPeakTimes(platform)
      .then(slots => {
        setPeakSlots(slots)
        // Default to first peak slot if available; otherwise immediate
        if (slots.length > 0) setSelected(slots[0])
      })
      .catch(() => { /* show immediate only on error */ })
      .finally(() => setLoadingSlots(false))
  }, [platform])

  function handleConfirm() {
    if (selected === 'immediate') {
      onConfirm(null)
    } else if (selected === 'custom') {
      // customDatetime is local datetime-local input value; convert to UTC ISO
      if (!customDatetime) {
        onConfirm(null)  // fallback to immediate if user didn't fill in
        return
      }
      const utcIso = new Date(customDatetime).toISOString()
      onConfirm(utcIso)
    } else {
      onConfirm(selected)  // ISO-8601 UTC string from peak slots
    }
  }

  const PLATFORM_LABELS: Record<Platform, string> = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    facebook: 'Facebook',
    x: 'X',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Schedule upload to ${PLATFORM_LABELS[platform]}`}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-zinc-900 p-5 pb-[env(safe-area-inset-bottom)] sm:rounded-2xl flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">
          Upload to {PLATFORM_LABELS[platform]}
        </h2>

        {/* Peak time slots */}
        {loadingSlots ? (
          <p className="text-sm text-zinc-400">Loading peak times...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {peakSlots.map(slot => (
              <label key={slot} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value={slot}
                  checked={selected === slot}
                  onChange={() => setSelected(slot)}
                  className="accent-purple-500"
                />
                <span className="text-sm text-zinc-200">
                  {formatPKT(slot)}
                  <span className="ml-1 text-xs text-zinc-500">peak</span>
                </span>
              </label>
            ))}

            {/* Custom datetime option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="schedule"
                value="custom"
                checked={selected === 'custom'}
                onChange={() => setSelected('custom')}
                className="accent-purple-500"
              />
              <span className="text-sm text-zinc-200">Custom time</span>
            </label>
            {selected === 'custom' && (
              <input
                type="datetime-local"
                value={customDatetime}
                onChange={e => setCustomDatetime(e.target.value)}
                className="rounded bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Custom upload datetime"
              />
            )}

            {/* Immediate option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="schedule"
                value="immediate"
                checked={selected === 'immediate'}
                onChange={() => setSelected('immediate')}
                className="accent-purple-500"
              />
              <span className="text-sm text-zinc-200">Upload now</span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-bold text-white hover:bg-purple-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
