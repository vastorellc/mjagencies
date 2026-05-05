/**
 * Example: How to integrate AnalysisProgressPanel with GeneratorPage
 *
 * This shows the integration pattern for displaying real-time analysis progress
 * when a user uploads a video.
 */

import { useState } from 'react'
import AnalysisProgressPanel from './AnalysisProgressPanel'
import { useAnalysisProgress } from '../hooks/useAnalysisProgress'
import { analyzeVideoWithProgressTracking } from '../lib/engineWithProgress'

export default function AnalysisProgressExample() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { steps, startStep, updateProgress, completeStep, failStep, totalProgress, reset } =
    useAnalysisProgress()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setIsAnalyzing(true)
    reset()

    try {
      // Run analysis with progress tracking
      const signals = await analyzeVideoWithProgressTracking(file, {
        onStepStart: startStep,
        onProgress: updateProgress,
        onStepComplete: completeStep,
        onStepError: failStep,
      })

      if (signals) {
        console.log('✅ Analysis complete:', signals)
        // Use signals for AI generation, scoring, etc.
      }
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-950 text-white rounded-lg">
      {/* Left: File Upload */}
      <div className="flex flex-col gap-4">
        <h2 className="font-bold">Upload Video</h2>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={isAnalyzing}
          className="p-2 rounded bg-zinc-800 cursor-pointer disabled:opacity-50"
        />
        {selectedFile && <p className="text-sm text-zinc-400">{selectedFile.name}</p>}
      </div>

      {/* Right: Analysis Progress Panel */}
      <AnalysisProgressPanel
        steps={steps}
        isVisible={isAnalyzing || totalProgress > 0}
        totalProgress={totalProgress}
      />
    </div>
  )
}

/**
 * Integration into GeneratorPage:
 *
 * In GeneratorPage.tsx, add this hook and component:
 *
 * ```tsx
 * const { steps, startStep, updateProgress, completeStep, failStep, totalProgress, reset } =
 *   useAnalysisProgress()
 *
 * // When user selects file:
 * async function handleFileSelected(file: File) {
 *   setSelectedFile(file)
 *   reset()
 *
 *   try {
 *     const signals = await analyzeVideoWithProgressTracking(file, {
 *       onStepStart: startStep,
 *       onProgress: updateProgress,
 *       onStepComplete: completeStep,
 *       onStepError: failStep,
 *     })
 *
 *     if (signals) {
 *       setSignals(signals)
 *       // Continue with AI generation...
 *     }
 *   } catch (err) {
 *     console.error('Analysis failed', err)
 *   }
 * }
 *
 * // In JSX, add the panel to the right side:
 * <div className="grid grid-cols-3 gap-6">
 *   <div>Upload area</div>
 *   <div>Generator content</div>
 *   <AnalysisProgressPanel
 *     steps={steps}
 *     isVisible={totalProgress > 0}
 *     totalProgress={totalProgress}
 *   />
 * </div>
 * ```
 */
