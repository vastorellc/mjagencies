import { bandForScore } from '../lib/score'
import type { ColorBand } from '../lib/types'

// D-23 palette: bg / text / border tokens per band, copied verbatim from CONTEXT.md.
// Full Tailwind class strings (not dynamic) so the JIT can detect and ship them.
const BAND_CLASSES: Record<ColorBand, string> = {
  'red':          'bg-red-500 text-white border-red-600',
  'amber':        'bg-amber-500 text-white border-amber-600',
  'green':        'bg-green-500 text-white border-green-600',
  'bright-green': 'bg-emerald-400 text-white border-emerald-500',
}

interface Props {
  score: number          // 0..100, integer
  dataPoints: number     // count of view-logged posts (Phase 7 will populate)
}

export default function ScorePanel({ score, dataPoints }: Props) {
  const band = bandForScore(score)
  const classes = BAND_CLASSES[band]

  // D-21: calibration footer
  let calibrationText: string | null = null
  if (dataPoints >= 10) {
    calibrationText = `Calibrated to your data (${dataPoints} posts)`
  } else if (dataPoints > 0) {
    calibrationText = `Score calibration: ${dataPoints}/10 posts logged`
  }

  return (
    <div
      data-testid="score-panel"
      className="flex flex-col items-center gap-2 py-4"
    >
      <div
        data-testid="score-ring"
        data-band={band}
        className={`flex h-32 w-32 items-center justify-center rounded-full border-8 ${classes}`}
      >
        <span className="text-4xl font-bold leading-none">{score}</span>
      </div>
      <div className="text-xs uppercase tracking-wide text-zinc-400">
        Virality score
      </div>
      {calibrationText !== null && (
        <div data-testid="calibration-footer" className="text-xs text-zinc-500">
          {calibrationText}
        </div>
      )}
    </div>
  )
}
