import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlatformCardGrid from './PlatformCardGrid'
import type { PerPlatformScores } from '../lib/types'

const mockScores: PerPlatformScores = {
  youtube: 65,
  instagram: 78,
  tiktok: 85,
  facebook: 30,
  x: 50,
}

describe('PlatformCardGrid', () => {
  it('renders exactly 5 cards in YT/IG/TT/FB/X order', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    const grid = screen.getByTestId('platform-card-grid')
    const cards = grid.querySelectorAll('[data-testid^="platform-card-"]')
    expect(cards.length).toBe(5)
    const order = Array.from(cards).map((c) => c.getAttribute('data-platform'))
    expect(order).toEqual(['youtube', 'instagram', 'tiktok', 'facebook', 'x'])
  })

  it('shows 1-letter circles Y, I, T, F, X', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    expect(screen.getByLabelText('YouTube').textContent).toBe('Y')
    expect(screen.getByLabelText('Instagram').textContent).toBe('I')
    expect(screen.getByLabelText('TikTok').textContent).toBe('T')
    expect(screen.getByLabelText('Facebook').textContent).toBe('F')
    expect(screen.getByLabelText('X').textContent).toBe('X')
  })

  it('renders per-platform scores', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    expect(screen.getByTestId('platform-score-youtube').textContent).toBe('65')
    expect(screen.getByTestId('platform-score-instagram').textContent).toBe('78')
    expect(screen.getByTestId('platform-score-tiktok').textContent).toBe('85')
    expect(screen.getByTestId('platform-score-facebook').textContent).toBe('30')
    expect(screen.getByTestId('platform-score-x').textContent).toBe('50')
  })

  it('looks up view range using each platform OWN score (SCORE-04)', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    // tiktok score 85 -> bright-green -> '250k-5M+'
    expect(screen.getByTestId('platform-range-tiktok').textContent).toBe('250k-5M+')
    // facebook score 30 -> red -> '< 500'
    expect(screen.getByTestId('platform-range-facebook').textContent).toBe('< 500')
    // youtube score 65 -> green -> '10k-100k'
    expect(screen.getByTestId('platform-range-youtube').textContent).toBe('10k-100k')
    // x score 50 -> amber -> '500-5k'
    expect(screen.getByTestId('platform-range-x').textContent).toBe('500-5k')
  })

  it('applies band-specific score text color (D-23)', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    const ttScore = screen.getByTestId('platform-score-tiktok') // 85 -> bright-green
    expect(ttScore.className).toContain('text-emerald-400')
    const fbScore = screen.getByTestId('platform-score-facebook') // 30 -> red
    expect(fbScore.className).toContain('text-red-500')
    const ytScore = screen.getByTestId('platform-score-youtube') // 65 -> green
    expect(ytScore.className).toContain('text-green-500')
    const xScore = screen.getByTestId('platform-score-x') // 50 -> amber
    expect(xScore.className).toContain('text-amber-500')
  })

  it('uses platform-specific circle backgrounds (UI-03)', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    expect(screen.getByLabelText('YouTube').className).toContain('bg-red-600')
    expect(screen.getByLabelText('Instagram').className).toContain('bg-pink-500')
    expect(screen.getByLabelText('TikTok').className).toContain('bg-black')
    expect(screen.getByLabelText('Facebook').className).toContain('bg-blue-600')
    expect(screen.getByLabelText('X').className).toContain('bg-black')
  })

  it('grid uses sm:grid-cols-5 layout', () => {
    render(<PlatformCardGrid perPlatform={mockScores} />)
    const grid = screen.getByTestId('platform-card-grid')
    expect(grid.className).toContain('grid')
    expect(grid.className).toContain('sm:grid-cols-5')
  })
})
