// Phase 4: Virality score + checklist visualization wired below the (still
// placeholder) upload area. Phase 3 will replace the placeholder with real upload UI
// and call setSignals() with the analyse() result; the score panel below will
// then auto-render via the useMemo recompute (D-24).
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Screen,
  EngineSignals,
  LearnedWeights,
  Niche,
  Platform,
} from '../lib/types'
import {
  computeScore,
  applyLearnedWeights,
  BASELINE_WEIGHTS,
} from '../lib/score'
import { buildChecklist } from '../lib/checklist'
import { buildGapAnalysis } from '../lib/gaps'
import ScorePanel from '../components/ScorePanel'
import PlatformCardGrid from '../components/PlatformCardGrid'
import ChecklistAccordion from '../components/ChecklistAccordion'
import GapAnalysisPanel from '../components/GapAnalysisPanel'

interface Props {
  onNavigate: (s: Screen) => void
  // __testSignals — temporary Phase 4 test hook; Phase 3 will replace via
  // setSignals from analyse() callback. Not part of any production caller's API.
  __testSignals?: EngineSignals
}

// Phase 5+ will source these from /api/settings (default_niche + enabled_platforms)
const DEFAULT_NICHE: Niche = 'travel'
const DEFAULT_ENABLED: Platform[] = ['youtube', 'instagram', 'tiktok', 'facebook', 'x']

export default function GeneratorPage({ onNavigate, __testSignals }: Props) {
  // Phase 3 will populate signals via analyse() callback after upload+analysis.
  const [signals, _setSignals] = useState<EngineSignals | null>(__testSignals ?? null)
  // Phase 7 will populate these via /api/settings response.
  const [learnedWeights] = useState<LearnedWeights | null>(null)
  const [dataPoints] = useState<number>(0)

  // D-24: useMemo recompute keyed on (signals, learnedWeights, dataPoints).
  // All 5 platform variants always computed (no toggle gating).
  const scoreResult = useMemo(() => {
    if (!signals) return null
    const effectiveWeights = applyLearnedWeights(BASELINE_WEIGHTS, learnedWeights, dataPoints)
    return computeScore(signals, effectiveWeights)
  }, [signals, learnedWeights, dataPoints])

  const checklistItems = useMemo(() => {
    if (!signals) return null
    return buildChecklist(signals, {
      niche: DEFAULT_NICHE,
      enabledPlatforms: DEFAULT_ENABLED,
    })
  }, [signals])

  const gapMessages = useMemo(() => {
    if (!checklistItems) return null
    return buildGapAnalysis(checklistItems)
  }, [checklistItems])

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

      <main className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
        {!signals || !scoreResult || !checklistItems || !gapMessages ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Upload a short-form video to analyse and generate viral copy.
          </div>
        ) : (
          <div data-testid="score-results" className="flex flex-col gap-4 py-4">
            <ScorePanel score={scoreResult.overall} dataPoints={dataPoints} />
            <PlatformCardGrid perPlatform={scoreResult.perPlatform} />
            <ChecklistAccordion items={checklistItems} />
            <GapAnalysisPanel gaps={gapMessages} />
          </div>
        )}
      </main>
    </div>
  )
}
