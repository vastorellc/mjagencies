// Phase 1 placeholder — full implementation in Phase 3
// Contains Settings navigation and Sign out button
import { supabase } from '../lib/supabase'
import type { Screen } from '../lib/types'

interface Props {
  onNavigate: (s: Screen) => void
}

export default function GeneratorPage({ onNavigate }: Props) {
  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">Viral Copy Generator</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('settings')}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Settings
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center text-zinc-400 text-sm">
        Upload a short-form video to analyse and generate viral copy.
      </main>
    </div>
  )
}
