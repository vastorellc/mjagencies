// Phase 1 placeholder — full implementation in Phase 3
// Contains Sign out button to satisfy AUTH-03 (logout) in Phase 1
import { supabase } from '../lib/supabase'

export default function GeneratorPage() {
  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">Viral Copy Generator</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
        >
          Sign out
        </button>
      </header>
      <main className="flex flex-1 items-center justify-center text-zinc-400 text-sm">
        Generator coming in Phase 3.
      </main>
    </div>
  )
}
