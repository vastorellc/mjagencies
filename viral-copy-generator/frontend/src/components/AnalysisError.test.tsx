import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AnalysisError from './AnalysisError'

afterEach(cleanup)

describe('AnalysisError', () => {
  it('renders cause + Retry + Skip', () => {
    render(<AnalysisError cause="Couldn't decode video — codec may not be supported." onRetry={() => {}} onSkip={() => {}} />)
    expect(screen.getByText("Couldn't decode video — codec may not be supported.")).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    expect(screen.getByText('Skip analysis and write copy from description')).toBeInTheDocument()
  })

  it('Tell me more is collapsed initially', () => {
    render(<AnalysisError cause="x" detail="raw" onRetry={() => {}} onSkip={() => {}} />)
    const details = screen.getByText('Tell me more').closest('details')!
    expect(details.open).toBe(false)
  })

  it('Tell me more expands on click and reveals detail', () => {
    render(<AnalysisError cause="x" detail="boom" onRetry={() => {}} onSkip={() => {}} />)
    fireEvent.click(screen.getByText('Tell me more'))
    expect(screen.getByTestId('analysis-error-detail').textContent).toContain('boom')
  })

  it('Retry / Skip handlers fire', () => {
    const onRetry = vi.fn()
    const onSkip = vi.fn()
    render(<AnalysisError cause="x" onRetry={onRetry} onSkip={onSkip} />)
    fireEvent.click(screen.getByText('Retry'))
    fireEvent.click(screen.getByTestId('analysis-error-skip'))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('omits Tell me more when no detail provided', () => {
    render(<AnalysisError cause="x" onRetry={() => {}} onSkip={() => {}} />)
    expect(screen.queryByText('Tell me more')).toBeNull()
  })
})
