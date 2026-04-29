// @vitest-environment jsdom
/**
 * packages/compliance/src/opt-out/__tests__/opt-out-modal.test.tsx
 *
 * Tier 2 unit tests for OptOutModal (Plan 11-05 / REQ-144 / UI-SPEC §Surface 4).
 *
 * The modal is the front-end half of the CCPA opt-out flow:
 *
 *   OptOutFooterLink ── dispatches OPT_OUT_OPEN_EVENT ──▶ OptOutModal opens
 *                                                                    │
 *   POST /api/ccpa/opt-out  ◀── confirm click ──────────────────────┘
 *                                                                    │
 *   server: writes mj_consent cookie + audit row + fan-out queue ────┘
 *                                                                    │
 *   window.location.reload() ◀── modal awaits res.ok ────────────────┘
 *
 * If any of those wires drift, the privacy regression is silent and severe.
 *
 * jsdom does not implement HTMLDialogElement.showModal/close natively, so we
 * stub them at the prototype level for these tests (this matches the official
 * jsdom workaround documented in the project's README).
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { OptOutModal } from '../opt-out-modal.js'
import { OPT_OUT_OPEN_EVENT } from '../events.js'

// ── jsdom shims for <dialog>.showModal / .close ────────────────────────────
beforeEach(() => {
  // jsdom 25 still ships without dialog support — wire minimal stubs
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', 'true')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.cookie = 'mj_consent=; path=/; max-age=0'
})

// Helper: dispatch the open event and wait a tick for the effect to apply
function openModal(): void {
  act(() => {
    window.dispatchEvent(new CustomEvent(OPT_OUT_OPEN_EVENT))
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OptOutModal — open / close wiring', () => {
  it('Test 1: opens the dialog when OPT_OUT_OPEN_EVENT fires', () => {
    const showSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    render(<OptOutModal />)
    openModal()
    expect(showSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 2: removes the listener on unmount (no leak across remounts)', () => {
    const showSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const { unmount } = render(<OptOutModal />)
    unmount()
    // Dispatching after unmount must NOT call showModal — the effect cleaned up.
    act(() => {
      window.dispatchEvent(new CustomEvent(OPT_OUT_OPEN_EVENT))
    })
    expect(showSpy).not.toHaveBeenCalled()
  })

  it('Test 3: "Keep Current Settings" closes the dialog', () => {
    const closeSpy = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const { getByText } = render(<OptOutModal />)
    openModal()
    fireEvent.click(getByText('Keep Current Settings'))
    expect(closeSpy).toHaveBeenCalled()
  })
})

describe('OptOutModal — opt-out flow (CCPA verbatim copy)', () => {
  it('Test 4: renders the verbatim §1798.135 heading', () => {
    const { getByRole } = render(<OptOutModal />)
    openModal()
    const heading = getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Stop Sale and Sharing of My Personal Information')
  })

  it('Test 5: renders all 4 fan-out promises verbatim from BODY_LIST', () => {
    const { getByText } = render(<OptOutModal />)
    openModal()
    expect(getByText('Stop Google Analytics from tracking your visit')).toBeTruthy()
    expect(getByText('Stop Microsoft Clarity from recording your session')).toBeTruthy()
    expect(getByText('Stop sharing data with Meta (Facebook/Instagram)')).toBeTruthy()
    expect(
      getByText('Request deletion of any data already collected from these systems within 45 days'),
    ).toBeTruthy()
  })

  it('Test 6: confirm click POSTs to /api/ccpa/opt-out with {action:"opt_out"}', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    // Reload triggers a navigation in real browsers; stub it so vitest doesn't crash.
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })

    const { getByText } = render(<OptOutModal />)
    openModal()
    await act(async () => {
      fireEvent.click(getByText('Stop Tracking and Clear My Data'))
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ccpa/opt-out',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opt_out' }),
      }),
    )
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 7: failed POST surfaces the error message and DOES NOT reload', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })

    const { getByText, getByRole } = render(<OptOutModal />)
    openModal()
    await act(async () => {
      fireEvent.click(getByText('Stop Tracking and Clear My Data'))
    })

    const alert = getByRole('alert')
    expect(alert.textContent).toMatch(/could not save your preference/i)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('Test 8: network rejection surfaces the same error path (try/catch)', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new Error('network down'))

    const { getByText, getByRole } = render(<OptOutModal />)
    openModal()
    await act(async () => {
      fireEvent.click(getByText('Stop Tracking and Clear My Data'))
    })

    expect(getByRole('alert').textContent).toMatch(/could not save your preference/i)
  })
})

describe('OptOutModal — already-blocked variant', () => {
  beforeEach(() => {
    // Set the cookie BEFORE the open handler runs so readConsentCookie sees it.
    document.cookie = 'mj_consent=tracking_blocked; path=/'
  })

  it('Test 9: detects tracking_blocked cookie and renders "Tracking Already Stopped"', () => {
    const { getByRole } = render(<OptOutModal />)
    openModal()
    expect(getByRole('heading', { level: 2 }).textContent).toBe('Tracking Already Stopped')
  })

  it('Test 10: re-enable click POSTs with {action:"opt_in"}', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    })

    const { getByText } = render(<OptOutModal />)
    openModal()
    await act(async () => {
      fireEvent.click(getByText('Re-enable Tracking'))
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ccpa/opt-out',
      expect.objectContaining({
        body: JSON.stringify({ action: 'opt_in' }),
      }),
    )
  })
})
