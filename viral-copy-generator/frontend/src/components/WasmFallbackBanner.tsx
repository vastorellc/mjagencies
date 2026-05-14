import { DESCRIPTION_MAX_CHARS } from '../lib/upload'

interface Props {
  reason: string
  description: string
  onDescriptionChange: (next: string) => void
  onGenerateCopy: () => void
}

export default function WasmFallbackBanner({ reason, description, onDescriptionChange, onGenerateCopy }: Props) {
  return (
    <div className="space-y-3" data-testid="wasm-fallback">
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 p-4 text-sm text-amber-200">
        <p className="font-bold">This browser can't run video analysis. You can still write copy from a description below.</p>
        <p className="mt-1 text-xs text-amber-300/80">{reason}</p>
      </div>
      <textarea
        rows={5}
        maxLength={DESCRIPTION_MAX_CHARS}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Optional: brief description — helps AI when video is ambiguous"
        data-testid="wasm-fallback-textarea"
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={onGenerateCopy}
        disabled={description.trim().length === 0}
        className="rounded bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-900 disabled:opacity-50 hover:bg-zinc-200"
      >
        Generate copy
      </button>
    </div>
  )
}
