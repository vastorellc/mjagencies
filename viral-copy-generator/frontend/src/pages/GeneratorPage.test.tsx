import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GeneratorPage from './GeneratorPage'
import type { EngineSignals } from '../lib/types'

// Mock supabase — GeneratorPage uses auth (signOut, getSession, onAuthStateChange) + Realtime
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

function mockSignals(overrides: Partial<EngineSignals> = {}): EngineSignals {
  return {
    durationSec: 25,
    width: 1080,
    height: 1920,
    aspectRatio: 0.5625,
    fps: 30,
    bitrate: 5_000_000,
    hasAudio: true,
    audioEnergy: 0.7,
    beatPresent: true,
    silenceGapsSec: [0.3],
    sceneCount: 8,
    sceneTimestamps: [0.8, 3.5, 7.0, 11.0, 14.5, 18.0, 21.5, 24.0],
    faceCount: 1,
    faceConfidence: 0.9,
    objectLabels: [],
    motionScore: 0.4,
    brightnessScore: 0.5,
    framesBase64: [],
    ...overrides,
  }
}

describe('GeneratorPage — initial empty state', () => {
  it('renders upload area and generate button when no signals provided', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} />)
    expect(screen.getByRole('button', { name: /generate copy/i })).toBeInTheDocument()
    expect(screen.queryByTestId('score-results')).toBeNull()
  })

  it('preserves header (Settings + Sign out buttons)', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} />)
    expect(screen.getByText('Viral Copy Generator')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it("Settings nav button calls onNavigate('settings')", () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })
})

describe('GeneratorPage — with signals', () => {
  it('renders score-results block when __testSignals provided', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals()} />)
    expect(screen.getByTestId('score-results')).toBeInTheDocument()
  })

  it('renders all 4 phase 4 components', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals()} />)
    expect(screen.getByTestId('score-panel')).toBeInTheDocument()
    expect(screen.getByTestId('platform-card-grid')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-accordion')).toBeInTheDocument()
  })

  it('renders gap-analysis-panel when there are checklist failures', () => {
    const onNavigate = vi.fn()
    // 5s duration → duration_in_band fails; brightness 0.05 → brightness_healthy fails
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals({
      durationSec: 5,
      brightnessScore: 0.05,
    })} />)
    expect(screen.getByTestId('gap-analysis-panel')).toBeInTheDocument()
  })

  it('hides gap-analysis-panel when all evaluable items pass', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals({
      durationSec: 25,
      width: 1080,
      height: 1920,
      aspectRatio: 0.5625,
      hasAudio: true,
      brightnessScore: 0.5,
      sceneCount: 8,
      sceneTimestamps: [0.8, 3, 6, 9, 12, 15, 18, 21],
      motionScore: 0.4,
      beatPresent: true,
      silenceGapsSec: [0.2],
      faceCount: 1,
      faceConfidence: 0.9,
    })} />)
    expect(screen.queryByTestId('gap-analysis-panel')).toBeNull()
  })

  it('platform card grid contains all 5 platform cards', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals()} />)
    expect(screen.getByTestId('platform-card-youtube')).toBeInTheDocument()
    expect(screen.getByTestId('platform-card-instagram')).toBeInTheDocument()
    expect(screen.getByTestId('platform-card-tiktok')).toBeInTheDocument()
    expect(screen.getByTestId('platform-card-facebook')).toBeInTheDocument()
    expect(screen.getByTestId('platform-card-x')).toBeInTheDocument()
  })

  it('D-25 durationSec=0 → score 0 + does not crash', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals({ durationSec: 0 })} />)
    expect(screen.getByTestId('score-panel')).toBeInTheDocument()
    const ring = screen.getByTestId('score-ring')
    expect(ring.textContent).toBe('0')
  })

  it('D-25 hasAudio=false renders without crash', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals({
      hasAudio: false,
      audioEnergy: 0,
      beatPresent: false,
      silenceGapsSec: [],
    })} />)
    expect(screen.getByTestId('score-panel')).toBeInTheDocument()
  })

  it('D-25 NaN aspectRatio renders without crash', () => {
    const onNavigate = vi.fn()
    render(<GeneratorPage onNavigate={onNavigate} __testSignals={mockSignals({ aspectRatio: NaN })} />)
    expect(screen.getByTestId('score-panel')).toBeInTheDocument()
  })
})
