import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GeneratorPage from './GeneratorPage'
import * as engine from '../lib/engine'
import type { EngineSignals, ProgressStep } from '../lib/types'

// Mock supabase — GeneratorPage uses auth + Realtime
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut:            vi.fn().mockResolvedValue({ error: null }),
      getSession:         vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange:  vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel:       vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  },
}))

// Mock API calls — prevent real network requests
vi.mock('../lib/api', () => ({
  fetchSettings:        vi.fn().mockResolvedValue({ ai_provider: 'gemini', api_key_masked: null, default_niche: 'travel', enabled_platforms: ['youtube', 'instagram', 'tiktok', 'facebook', 'x'], available_niches: ['travel'], connected: { youtube: false, instagram: false, facebook: false }, timezone: 'Asia/Karachi' }),
  fetchLearningWeights: vi.fn().mockResolvedValue({ learned_weights: null, data_points: 0, is_calibrated: false }),
  fetchApiKey:          vi.fn().mockResolvedValue({ api_key: null }),
  fetchTopHooks:        vi.fn().mockResolvedValue([]),
  fetchTopHashtags:     vi.fn().mockResolvedValue([]),
  createPost:           vi.fn().mockResolvedValue({ postId: 'test-post-id' }),
  uploadFile:           vi.fn().mockResolvedValue({ fileId: 'test-file-id', publicUrl: '' }),
  scheduleUpload:       vi.fn().mockResolvedValue({ ok: true, platformPostId: 'test-pp-id' }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function fakeFile(size: number, name = 'v.mp4', type = 'video/mp4'): File {
  const f = new File([new Uint8Array(0)], name, { type })
  Object.defineProperty(f, 'size', { value: size, configurable: true })
  return f
}

function fullSignals(over: Partial<EngineSignals> = {}): EngineSignals {
  return {
    durationSec: 12, width: 1080, height: 1920, aspectRatio: 0.5625,
    fps: 30, bitrate: 5800000, hasAudio: true,
    sceneCount: 2, sceneTimestamps: [3.2, 7.4],
    framesBase64: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
    faceCount: 1, faceConfidence: 0.9, objectLabels: ['person'], motionScore: 0.4,
    audioEnergy: 0.5, beatPresent: true, silenceGapsSec: [],
    brightnessScore: 0.6,
    ...over,
  }
}

beforeEach(() => {
  vi.spyOn(engine, 'canRunEngine').mockReturnValue({ ok: true })
  vi.spyOn(engine, 'warmup').mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
})

describe('GeneratorPage', () => {
  it('renders dropzone in idle state', () => {
    render(<GeneratorPage onNavigate={() => {}} />)
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
  })

  it('moves to picked state and shows Analyse button after file pick', async () => {
    vi.spyOn(engine, 'analyse').mockResolvedValue(fullSignals())
    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(50 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
  })

  it('shows the 200 MB advisory when picked file >= 200 MB (D-03)', async () => {
    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(210 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByTestId('advisory-200mb')).toBeInTheDocument())
  })

  it('shows the upload-error banner for oversize files', async () => {
    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(260 * 1024 * 1024)] } })
    await waitFor(() => {
      expect(screen.getByTestId('upload-error').textContent).toMatch(/over 250 MB/)
    })
  })

  it('runs through analysing → done with rotating step labels', async () => {
    let progressCb: ((step: ProgressStep) => void) | undefined
    vi.spyOn(engine, 'analyse').mockImplementation(async (_file, opts) => {
      progressCb = opts?.onProgress
      progressCb?.('metadata')
      await Promise.resolve()
      progressCb?.('frames')
      await Promise.resolve()
      progressCb?.('done')
      return fullSignals()
    })

    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(20 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('analyse-button'))

    await waitFor(() => expect(screen.getByTestId('analysis-done')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('shows AnalysisError with codec-derived cause on engine reject', async () => {
    vi.spyOn(engine, 'analyse').mockRejectedValue(new Error('decoder failed: invalid data'))

    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(20 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('analyse-button'))

    await waitFor(() => {
      expect(screen.getByTestId('analysis-error')).toBeInTheDocument()
      expect(screen.getByText(/Couldn't decode video/)).toBeInTheDocument()
    })
  })

  it('Cancel during analysing returns to picked state', async () => {
    vi.spyOn(engine, 'analyse').mockImplementation(() => new Promise(() => {}))
    render(<GeneratorPage onNavigate={() => {}} />)
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [fakeFile(20 * 1024 * 1024)] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('analyse-button'))
    await waitFor(() => expect(screen.getByTestId('analysis-progress')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
  })

  it('renders WasmFallbackBanner when canRunEngine is not ok (D-11)', async () => {
    vi.spyOn(engine, 'canRunEngine').mockReturnValue({ ok: false, reason: 'no SAB' })
    render(<GeneratorPage onNavigate={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('wasm-fallback')).toBeInTheDocument())
    expect(screen.queryByTestId('dropzone')).toBeNull()
  })

  it('re-pick after done state wipes signals back to picked', async () => {
    vi.spyOn(engine, 'analyse').mockResolvedValue(fullSignals())
    render(<GeneratorPage onNavigate={() => {}} />)
    const input1 = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input1, { target: { files: [fakeFile(20 * 1024 * 1024, 'a.mp4')] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('analyse-button'))
    await waitFor(() => expect(screen.getByTestId('analysis-done')).toBeInTheDocument(), { timeout: 5000 })

    const inputs = screen.getAllByTestId('upload-input') as HTMLInputElement[]
    const repickInput = inputs[inputs.length - 1]
    fireEvent.change(repickInput, { target: { files: [fakeFile(15 * 1024 * 1024, 'b.mp4')] } })
    await waitFor(() => expect(screen.getByTestId('analyse-button')).toBeInTheDocument())
    expect(screen.queryByTestId('analysis-done')).toBeNull()
  })
})
