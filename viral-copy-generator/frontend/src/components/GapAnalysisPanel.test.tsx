import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GapAnalysisPanel from './GapAnalysisPanel'

describe('GapAnalysisPanel', () => {
  it('returns null when gaps array is empty', () => {
    const { container } = render(<GapAnalysisPanel gaps={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('gap-analysis-panel')).toBeNull()
  })

  it('renders header "Fix this to boost your score:"', () => {
    render(<GapAnalysisPanel gaps={['Fix one']} />)
    expect(screen.getByText('Fix this to boost your score:')).toBeInTheDocument()
  })

  it('renders each gap as an ordered list item', () => {
    const gaps = ['Length is 5.0s.', 'Brightness is 0.85.', 'No clear beat detected.']
    render(<GapAnalysisPanel gaps={gaps} />)
    expect(screen.getByTestId('gap-item-0').textContent).toBe('Length is 5.0s.')
    expect(screen.getByTestId('gap-item-1').textContent).toBe('Brightness is 0.85.')
    expect(screen.getByTestId('gap-item-2').textContent).toBe('No clear beat detected.')
  })

  it('uses an <ol> with list-decimal styling', () => {
    render(<GapAnalysisPanel gaps={['only one']} />)
    const panel = screen.getByTestId('gap-analysis-panel')
    const ol = panel.querySelector('ol')
    expect(ol).not.toBeNull()
    expect(ol?.className).toContain('list-decimal')
  })

  it('preserves gap order', () => {
    const gaps = ['Z first', 'A second', 'M third']
    render(<GapAnalysisPanel gaps={gaps} />)
    const items = screen.getAllByTestId(/^gap-item-\d+$/)
    expect(items.map((el) => el.textContent)).toEqual(['Z first', 'A second', 'M third'])
  })
})
