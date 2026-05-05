import { APIErrorPayload } from '../lib/errors'

interface Props {
  error: APIErrorPayload | string | null
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export default function ApiErrorDisplay({ error, onRetry, onDismiss, className = '' }: Props) {
  if (!error) return null

  const payload = typeof error === 'string' ? null : error
  const message = typeof error === 'string' ? error : error.message

  return (
    <div
      className={`rounded-lg border border-red-800/50 bg-red-900/20 p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      {/* Error message */}
      <p className="text-sm font-medium text-red-200">{message}</p>

      {/* Field indicator (if present) */}
      {payload?.field && (
        <p className="text-xs text-red-300/70 mt-1">Field: {payload.field}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {payload && payload.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded bg-red-800/50 hover:bg-red-800/70 text-red-100 transition"
          >
            Retry
          </button>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800/50 hover:bg-zinc-800/70 text-zinc-300 transition"
          >
            Dismiss
          </button>
        )}

        {/* Request ID (copyable, for debugging) */}
        {payload?.requestId && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(payload.requestId!)
            }}
            className="text-xs px-2 py-1 rounded bg-zinc-800/30 hover:bg-zinc-800/50 text-zinc-400 font-mono transition"
            title="Click to copy request ID"
          >
            {payload.requestId.slice(0, 8)}…
          </button>
        )}
      </div>
    </div>
  )
}
