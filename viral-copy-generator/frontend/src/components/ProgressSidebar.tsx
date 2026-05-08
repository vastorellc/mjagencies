import type { ReactNode } from 'react'

export type AnalysisStep =
  | 'idle'
  | 'loading'
  | 'extracting-frames'
  | 'detecting-scenes'
  | 'detecting-faces'
  | 'analyzing-audio'
  | 'computing-scores'
  | 'complete'
  | 'error'

interface ProgressSidebarProps {
  currentStep: AnalysisStep
  progress: number // 0-100
}

const STEPS: Array<{ id: AnalysisStep; label: string; icon: string }> = [
  { id: 'loading', label: 'Loading video', icon: '📹' },
  { id: 'extracting-frames', label: 'Extracting frames', icon: '🎬' },
  { id: 'detecting-scenes', label: 'Detecting scenes', icon: '🔍' },
  { id: 'detecting-faces', label: 'Detecting faces', icon: '👤' },
  { id: 'analyzing-audio', label: 'Analyzing audio', icon: '🎵' },
  { id: 'computing-scores', label: 'Computing scores', icon: '📊' },
]

function getStepStatus(step: AnalysisStep, currentStep: AnalysisStep): 'complete' | 'active' | 'pending' | 'hidden' {
  if (currentStep === 'idle' || currentStep === 'error') return 'hidden'

  const stepIndex = STEPS.findIndex(s => s.id === step)
  const currentIndex = STEPS.findIndex(s => s.id === currentStep)

  if (stepIndex < currentIndex) return 'complete'
  if (stepIndex === currentIndex) return 'active'
  return 'pending'
}

export default function ProgressSidebar({ currentStep, progress }: ProgressSidebarProps) {
  if (currentStep === 'idle') return null

  return (
    <aside className="fixed right-0 top-0 h-screen w-80 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto z-50">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-bold text-white mb-2">📊 Analyzing Video</h3>
          <p className="text-xs text-zinc-400">Please wait while we process your video</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400">{Math.round(progress)}% complete</p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step) => {
            const status = getStepStatus(step.id, currentStep)

            if (status === 'hidden') return null

            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {status === 'complete' && (
                    <span className="text-lg">✅</span>
                  )}
                  {status === 'active' && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-r-transparent rounded-full animate-spin" />
                  )}
                  {status === 'pending' && (
                    <span className="text-lg text-zinc-600">⭕</span>
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p className={`text-sm font-medium ${
                    status === 'active'
                      ? 'text-blue-400'
                      : status === 'complete'
                      ? 'text-emerald-400'
                      : 'text-zinc-500'
                  }`}>
                    {step.icon} {step.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Error State */}
        {currentStep === 'error' && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800/50">
            <p className="text-sm text-red-400">Analysis failed. Please try again.</p>
          </div>
        )}

        {/* Complete State */}
        {currentStep === 'complete' && (
          <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-800/50">
            <p className="text-sm text-emerald-400">✅ Analysis complete!</p>
          </div>
        )}
      </div>
    </aside>
  )
}
