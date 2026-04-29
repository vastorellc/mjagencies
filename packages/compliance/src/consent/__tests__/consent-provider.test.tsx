// @vitest-environment jsdom
/**
 * packages/compliance/src/consent/__tests__/consent-provider.test.tsx
 *
 * Tier 2 unit tests for the ConsentProvider context (Plan 11-05 / REQ-144 D-01/D-02).
 *
 * The provider is the single source of truth for consent state in the React
 * tree. Analytics scripts (GA4, Clarity, MetaPixel, RUM) all gate on the
 * value flowing out of useConsent() — so a bug here means tracking either
 * fires when the user has opted out (CCPA violation) or never fires for
 * users who allowed it (revenue impact).
 *
 * Contracts under test:
 *   1. initial state is the value passed in via the `initial` prop (server-computed)
 *   2. setState() switches state and re-renders subscribers
 *   3. useConsent() throws when called outside the provider (catches misuse early)
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { ConsentProvider, useConsent, type ConsentState } from '../consent-provider.js'

// ── Helper consumers used to inspect provider state from inside the tree ───

function StateProbe(): React.ReactElement {
  const { state } = useConsent()
  return <div data-testid="state">{state}</div>
}

function ToggleButton({ to }: { to: ConsentState }): React.ReactElement {
  const { setState } = useConsent()
  return (
    <button data-testid="toggle" onClick={() => setState(to)}>
      switch
    </button>
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConsentProvider — initial value', () => {
  it("Test 1: initial='tracking_allowed' is exposed via useConsent().state", () => {
    const { getByTestId } = render(
      <ConsentProvider initial="tracking_allowed">
        <StateProbe />
      </ConsentProvider>,
    )
    expect(getByTestId('state').textContent).toBe('tracking_allowed')
  })

  it("Test 2: initial='tracking_blocked' is exposed via useConsent().state", () => {
    const { getByTestId } = render(
      <ConsentProvider initial="tracking_blocked">
        <StateProbe />
      </ConsentProvider>,
    )
    expect(getByTestId('state').textContent).toBe('tracking_blocked')
  })
})

describe('ConsentProvider — setState transitions', () => {
  it('Test 3: setState("tracking_blocked") flips state from allowed → blocked', () => {
    const { getByTestId } = render(
      <ConsentProvider initial="tracking_allowed">
        <StateProbe />
        <ToggleButton to="tracking_blocked" />
      </ConsentProvider>,
    )
    expect(getByTestId('state').textContent).toBe('tracking_allowed')

    act(() => {
      getByTestId('toggle').click()
    })

    expect(getByTestId('state').textContent).toBe('tracking_blocked')
  })

  it('Test 4: setState("tracking_allowed") flips state from blocked → allowed', () => {
    const { getByTestId } = render(
      <ConsentProvider initial="tracking_blocked">
        <StateProbe />
        <ToggleButton to="tracking_allowed" />
      </ConsentProvider>,
    )
    expect(getByTestId('state').textContent).toBe('tracking_blocked')

    act(() => {
      getByTestId('toggle').click()
    })

    expect(getByTestId('state').textContent).toBe('tracking_allowed')
  })

  it('Test 5: setState is idempotent — setting the same value preserves state', () => {
    const { getByTestId } = render(
      <ConsentProvider initial="tracking_allowed">
        <StateProbe />
        <ToggleButton to="tracking_allowed" />
      </ConsentProvider>,
    )

    act(() => {
      getByTestId('toggle').click()
      getByTestId('toggle').click()
    })

    expect(getByTestId('state').textContent).toBe('tracking_allowed')
  })
})

describe('ConsentProvider — misuse guard', () => {
  it('Test 6: useConsent() throws a clear error when called outside the provider', () => {
    function Orphan(): React.ReactElement {
      const { state } = useConsent()
      return <span>{state}</span>
    }

    // Suppress the React error-boundary console noise for this expected failure
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Orphan />)).toThrow(/useConsent must be used inside <ConsentProvider>/)
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})

