import { bandForScore } from '../lib/score'
import { viewRangeFor } from '../lib/viewRange'
import type { Platform, PerPlatformScores, ColorBand } from '../lib/types'

interface Props {
  perPlatform: PerPlatformScores
}

interface PlatformMeta {
  letter: string  // 1-letter circle (Y/I/T/F/X)
  label: string
  // Tailwind background for the circle (UI-03 mapping)
  circleBg: string
  circleText: string
}

const PLATFORM_META: Record<Platform, PlatformMeta> = {
  youtube:   { letter: 'Y', label: 'YouTube',   circleBg: 'bg-red-600',  circleText: 'text-white' },
  instagram: { letter: 'I', label: 'Instagram', circleBg: 'bg-pink-500', circleText: 'text-white' },
  tiktok:    { letter: 'T', label: 'TikTok',    circleBg: 'bg-black',    circleText: 'text-white' },
  facebook:  { letter: 'F', label: 'Facebook',  circleBg: 'bg-blue-600', circleText: 'text-white' },
  x:         { letter: 'X', label: 'X',         circleBg: 'bg-black',    circleText: 'text-white' },
}

// D-23 score-text palette per band
const BAND_TEXT: Record<ColorBand, string> = {
  'red':          'text-red-500',
  'amber':        'text-amber-500',
  'green':        'text-green-500',
  'bright-green': 'text-emerald-400',
}

const PLATFORM_ORDER: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

export default function PlatformCardGrid({ perPlatform }: Props) {
  return (
    <div
      data-testid="platform-card-grid"
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {PLATFORM_ORDER.map((p) => {
        const score = perPlatform[p]
        const band = bandForScore(score)
        const meta = PLATFORM_META[p]
        const range = viewRangeFor(p, score)
        return (
          <div
            key={p}
            data-testid={`platform-card-${p}`}
            data-platform={p}
            data-band={band}
            className="flex flex-col items-center gap-1 rounded bg-zinc-900 px-2 py-3"
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${meta.circleBg} ${meta.circleText}`}
              aria-label={meta.label}
            >
              {meta.letter}
            </div>
            <div
              data-testid={`platform-score-${p}`}
              className={`text-2xl font-bold ${BAND_TEXT[band]}`}
            >
              {score}
            </div>
            <div
              data-testid={`platform-range-${p}`}
              className="text-[10px] text-zinc-400"
            >
              {range}
            </div>
          </div>
        )
      })}
    </div>
  )
}
