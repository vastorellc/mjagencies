import { useState, useCallback } from 'react'
import type { AnalysisStep, AnalysisStepStatus } from '../components/AnalysisProgressPanel'

const INITIAL_STEPS: AnalysisStep[] = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1).padStart(2, '0'),
  name: '',
  description: '',
  status: 'pending' as const,
  progress: 0,
}))

interface UseAnalysisProgressReturn {
  steps: AnalysisStep[]
  startStep: (stepId: string, name: string, description: string) => void
  updateProgress: (stepId: string, progress: number) => void
  completeStep: (stepId: string, output?: string) => void
  failStep: (stepId: string, error: string) => void
  totalProgress: number
  reset: () => void
}

export function useAnalysisProgress(): UseAnalysisProgressReturn {
  const [steps, setSteps] = useState<AnalysisStep[]>(INITIAL_STEPS)

  const startStep = useCallback((stepId: string, name: string, description: string) => {
    setSteps(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, name, description, status: 'running' as const, progress: 0 }
          : s
      )
    )
  }, [])

  const updateProgress = useCallback((stepId: string, progress: number) => {
    setSteps(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, progress: Math.min(progress, 100) }
          : s
      )
    )
  }, [])

  const completeStep = useCallback((stepId: string, output?: string) => {
    setSteps(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, status: 'done' as const, progress: 100, output }
          : s
      )
    )
  }, [])

  const failStep = useCallback((stepId: string, error: string) => {
    setSteps(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, status: 'failed' as const, progress: 0, error }
          : s
      )
    )
  }, [])

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS)
  }, [])

  // Calculate total progress
  const totalProgress = Math.round(
    steps.reduce((sum, s) => {
      if (s.status === 'done') return sum + 100
      if (s.status === 'failed') return sum + 0
      if (s.status === 'running') return sum + s.progress
      return sum
    }, 0) / steps.length
  )

  return {
    steps,
    startStep,
    updateProgress,
    completeStep,
    failStep,
    totalProgress,
    reset,
  }
}
