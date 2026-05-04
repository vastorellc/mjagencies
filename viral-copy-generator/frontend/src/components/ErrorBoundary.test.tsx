import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

// Suppress expected React error boundary console.error noise in tests
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})
afterEach(() => {
  console.error = originalConsoleError
})

// Component that always throws during render — for SC-05
function AlwaysThrows(): never {
  throw new Error('Test render error')
}

describe('ErrorBoundary — SC-05 fallback render', () => {
  it('SC-05: renders fallback when child throws', () => {
    render(
      <ErrorBoundary screenName="test">
        <AlwaysThrows />
      </ErrorBoundary>
    )
    expect(screen.getByText(/something went wrong/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
  })
})

describe('ErrorBoundary — SC-06 normal render', () => {
  it('SC-06: renders children when no error', () => {
    render(
      <ErrorBoundary screenName="test">
        <div data-testid="child-content">Working fine</div>
      </ErrorBoundary>
    )
    expect(screen.getByTestId('child-content')).toBeTruthy()
    expect(screen.queryByText(/something went wrong/i)).toBeNull()
  })
})
