import type { ProgressStep } from '../lib/types'

interface Props {
  step: ProgressStep | null
  preparingModels?: boolean
  onCancel: () => void
}

const STEP_LABELS: Record<ProgressStep, string> = {
  metadata: 'Extracting metadata…',
  frames: 'Extracting frames…',
  scenes: 'Detecting scene cuts…',
  faces: 'Detecting faces…',
  objects: 'Recognising objects…',
  audio: 'Computing audio energy…',
  brightness: 'Computing brightness…',
  done: 'Finishing up…',
}

export default function AnalysisProgress({ step, preparingModels, onCancel }: Props) {
  const label = preparingModels
    ? 'Preparing models…'
    : step
      ? STEP_LABELS[step]
      : 'Analysing video…'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 flex items-center gap-4"
      data-testid="analysis-progress"
    >
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
      />
      <div className="flex-1">
        <p className="text-sm font-bold text-zinc-100">Analysing video…</p>
        <p className="text-xs text-zinc-400 transition-opacity duration-200" data-testid="step-label">
          {label}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
      >
        Cancel
      </button>
    </div>
  )
}
