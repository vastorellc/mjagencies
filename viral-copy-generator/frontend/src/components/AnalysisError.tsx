import { useState } from 'react'

interface Props {
  cause: string
  detail?: string
  onRetry: () => void
  onSkip: () => void
}

export default function AnalysisError({ cause, detail, onRetry, onSkip }: Props) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm"
      data-testid="analysis-error"
    >
      <p className="font-bold text-red-200">{cause}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-900 hover:bg-zinc-200"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-zinc-300 underline hover:text-zinc-100"
          data-testid="analysis-error-skip"
        >
          Skip analysis and write copy from description
        </button>
      </div>
      {detail && (
        <details
          className="mt-3 text-xs text-zinc-400"
          open={expanded}
          onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer">Tell me more</summary>
          <pre
            data-testid="analysis-error-detail"
            className="mt-2 whitespace-pre-wrap break-all rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-300"
          >
            {detail}
          </pre>
        </details>
      )}
    </div>
  )
}
