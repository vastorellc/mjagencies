import React, { useState, useEffect } from 'react'

export type AnalysisStepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface AnalysisStep {
  id: string
  name: string
  description: string
  status: AnalysisStepStatus
  progress: number // 0-100
  output?: string
  error?: string
}

interface Props {
  steps: AnalysisStep[]
  isVisible: boolean
  totalProgress: number // 0-100
}

const STEP_ORDER = [
  { id: '01', name: 'Reading video file', description: 'Loading and validating file' },
  { id: '02', name: 'Extracting metadata', description: 'Duration, resolution, fps, bitrate' },
  { id: '03', name: 'Detecting scene changes', description: 'Analyzing shot boundaries' },
  { id: '04', name: 'Analysing first 3 seconds', description: 'Hook detection' },
  { id: '05', name: 'Measuring motion score', description: 'Frame-to-frame movement' },
  { id: '06', name: 'Detecting faces', description: 'Face recognition' },
  { id: '07', name: 'Identifying scene labels', description: 'Objects and scenes' },
  { id: '08', name: 'Analysing audio presence', description: 'Audio stream detection' },
  { id: '09', name: 'Measuring audio energy', description: 'RMS energy calculation' },
  { id: '10', name: 'Detecting beat and rhythm', description: 'Frequency analysis' },
  { id: '11', name: 'Scanning silence gaps', description: 'Identifying quiet regions' },
  { id: '12', name: 'Measuring brightness', description: 'Luma score calculation' },
  { id: '13', name: 'Calculating virality score', description: 'Combining all signals' },
  { id: '14', name: 'Running checklist', description: 'Validation rules' },
  { id: '15', name: 'Detecting niche', description: 'Content classification' },
  { id: '16', name: 'Loading top hooks', description: 'From history database' },
  { id: '17', name: 'Loading top hashtags', description: 'From history database' },
  { id: '18', name: 'Building AI prompt', description: 'Combining all signals' },
  { id: '19', name: 'Calling AI', description: 'Generating platform copy' },
  { id: '20', name: 'Validating output', description: 'Final metadata check' },
]

export default function AnalysisProgressPanel({ steps, isVisible, totalProgress }: Props) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  if (!isVisible) return null

  const getStatusIcon = (status: AnalysisStepStatus) => {
    switch (status) {
      case 'running':
        return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
      case 'done':
        return <span className="text-lg text-green-400">✅</span>
      case 'failed':
        return <span className="text-lg text-red-400">❌</span>
      case 'pending':
      default:
        return <span className="text-lg text-zinc-600">⊘</span>
    }
  }

  const getStatusColor = (status: AnalysisStepStatus) => {
    switch (status) {
      case 'running':
        return 'bg-purple-900/30 border-purple-800/50'
      case 'done':
        return 'bg-green-900/20 border-green-800/50'
      case 'failed':
        return 'bg-red-900/20 border-red-800/50'
      case 'pending':
      default:
        return 'bg-zinc-900/30 border-zinc-800/50'
    }
  }

  const stepMap = new Map(steps.map(s => [s.id, s]))

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">📊 Video Analysis</h3>
        <div className="text-xs text-zinc-400">{totalProgress}%</div>
      </div>

      {/* Overall Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
        <div className="text-xs text-zinc-500">
          {totalProgress < 100
            ? `${totalProgress}% complete`
            : 'Analysis complete!'}
        </div>
      </div>

      {/* Steps List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {STEP_ORDER.map((stepDef) => {
          const step = stepMap.get(stepDef.id) || { ...stepDef, status: 'pending' as const, progress: 0 }
          const isExpanded = expandedStep === step.id

          return (
            <div key={step.id}>
              {/* Step Card */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                className={`w-full text-left p-3 rounded border transition ${getStatusColor(step.status)} hover:border-zinc-700`}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="pt-0.5 shrink-0">
                    {getStatusIcon(step.status)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-300">{step.id}.</span>
                      <span className="text-xs font-medium text-white">{step.name}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>

                    {/* Step Progress Bar */}
                    {step.status !== 'pending' && (
                      <div className="mt-2 h-1 rounded-full bg-zinc-800/50 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            step.status === 'running'
                              ? 'bg-purple-400 animate-pulse'
                              : step.status === 'done'
                                ? 'bg-green-400'
                                : 'bg-red-400'
                          }`}
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Expand Arrow */}
                  {(step.output || step.error) && (
                    <div className="text-xs text-zinc-600 shrink-0 pt-0.5">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded Output */}
              {isExpanded && (step.output || step.error) && (
                <div className="mt-1 ml-8 p-2 rounded bg-zinc-800/50 border border-zinc-700/50">
                  {step.output && (
                    <div className="text-xs font-mono text-zinc-300 break-all">
                      {step.output}
                    </div>
                  )}
                  {step.error && (
                    <div className="text-xs font-mono text-red-400 break-all">
                      Error: {step.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Footer */}
      {totalProgress === 100 && (
        <div className="mt-2 pt-2 border-t border-zinc-800 text-xs text-zinc-400">
          <p>✅ All analysis steps completed. Ready for AI generation.</p>
        </div>
      )}
    </div>
  )
}
