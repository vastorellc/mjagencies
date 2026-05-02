import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScorePanel from './ScorePanel'

describe('ScorePanel', () => {
  it('renders score numeric', () => {
    render(<ScorePanel score={72} dataPoints={0} />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('applies red band classes when score < 40', () => {
    render(<ScorePanel score={20} dataPoints={0} />)
    const ring = screen.getByTestId('score-ring')
    expect(ring).toHaveAttribute('data-band', 'red')
    expect(ring.className).toContain('bg-red-500')
    expect(ring.className).toContain('border-red-600')
  })

  it('applies amber band classes when 40 <= score < 60', () => {
    render(<ScorePanel score={50} dataPoints={0} />)
    const ring = screen.getByTestId('score-ring')
    expect(ring).toHaveAttribute('data-band', 'amber')
    expect(ring.className).toContain('bg-amber-500')
  })

  it('applies green band classes when 60 <= score < 80', () => {
    render(<ScorePanel score={72} dataPoints={0} />)
    const ring = screen.getByTestId('score-ring')
    expect(ring).toHaveAttribute('data-band', 'green')
    expect(ring.className).toContain('bg-green-500')
  })

  it('applies bright-green (emerald-400) band when score >= 80', () => {
    render(<ScorePanel score={88} dataPoints={0} />)
    const ring = screen.getByTestId('score-ring')
    expect(ring).toHaveAttribute('data-band', 'bright-green')
    expect(ring.className).toContain('bg-emerald-400')
    expect(ring.className).toContain('border-emerald-500')
  })

  it('boundary score=39 is red', () => {
    render(<ScorePanel score={39} dataPoints={0} />)
    expect(screen.getByTestId('score-ring')).toHaveAttribute('data-band', 'red')
  })

  it('boundary score=40 is amber', () => {
    render(<ScorePanel score={40} dataPoints={0} />)
    expect(screen.getByTestId('score-ring')).toHaveAttribute('data-band', 'amber')
  })

  it('boundary score=80 is bright-green', () => {
    render(<ScorePanel score={80} dataPoints={0} />)
    expect(screen.getByTestId('score-ring')).toHaveAttribute('data-band', 'bright-green')
  })

  it('uses w-32 h-32 rounded-full border-8 (D-22 spec)', () => {
    render(<ScorePanel score={50} dataPoints={0} />)
    const ring = screen.getByTestId('score-ring')
    expect(ring.className).toContain('w-32')
    expect(ring.className).toContain('h-32')
    expect(ring.className).toContain('rounded-full')
    expect(ring.className).toContain('border-8')
  })

  // D-21: calibration footer
  it('hides calibration footer when dataPoints === 0', () => {
    render(<ScorePanel score={50} dataPoints={0} />)
    expect(screen.queryByTestId('calibration-footer')).toBeNull()
  })

  it('shows progress copy when 0 < dataPoints < 10', () => {
    render(<ScorePanel score={50} dataPoints={5} />)
    const footer = screen.getByTestId('calibration-footer')
    expect(footer.textContent).toBe('Score calibration: 5/10 posts logged')
  })

  it('shows calibrated copy when dataPoints >= 10', () => {
    render(<ScorePanel score={50} dataPoints={25} />)
    const footer = screen.getByTestId('calibration-footer')
    expect(footer.textContent).toBe('Calibrated to your data (25 posts)')
  })

  it('boundary: dataPoints === 10 uses calibrated copy', () => {
    render(<ScorePanel score={50} dataPoints={10} />)
    const footer = screen.getByTestId('calibration-footer')
    expect(footer.textContent).toBe('Calibrated to your data (10 posts)')
  })
})
