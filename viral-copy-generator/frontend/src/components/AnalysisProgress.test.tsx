import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AnalysisProgress from './AnalysisProgress'

afterEach(cleanup)

describe('AnalysisProgress', () => {
  it('renders Preparing models… when preparingModels=true', () => {
    render(<AnalysisProgress step={null} preparingModels onCancel={() => {}} />)
    expect(screen.getByTestId('step-label').textContent).toBe('Preparing models…')
  })

  it.each([
    ['metadata', 'Extracting metadata…'],
    ['frames', 'Extracting frames…'],
    ['scenes', 'Detecting scene cuts…'],
    ['faces', 'Detecting faces…'],
    ['objects', 'Recognising objects…'],
    ['audio', 'Computing audio energy…'],
    ['brightness', 'Computing brightness…'],
    ['done', 'Finishing up…'],
  ] as const)('renders %s → %s', (step, label) => {
    render(<AnalysisProgress step={step} onCancel={() => {}} />)
    expect(screen.getByTestId('step-label').textContent).toBe(label)
  })

  it('Cancel button calls onCancel', () => {
    const spy = vi.fn()
    render(<AnalysisProgress step="metadata" onCancel={spy} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(spy).toHaveBeenCalledOnce()
  })
})
