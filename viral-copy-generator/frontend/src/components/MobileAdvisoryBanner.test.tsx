import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import MobileAdvisoryBanner from './MobileAdvisoryBanner'

afterEach(cleanup)

describe('MobileAdvisoryBanner', () => {
  it('renders the locked advisory string', () => {
    render(<MobileAdvisoryBanner />)
    expect(screen.getByText('Best on desktop — analysis uses significant memory and CPU.')).toBeInTheDocument()
  })
})
