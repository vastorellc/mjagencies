// @vitest-environment jsdom
/**
 * packages/compliance/src/opt-out/__tests__/opt-out-footer-link.test.tsx
 *
 * Tier 2 unit tests for OptOutFooterLink (Plan 11-05 / REQ-144 / UI-SPEC §Surface 4).
 *
 * Covers two safety-critical contracts:
 *
 *   1. CCPA verbatim copy (Cal. Civ. Code §1798.135) — must NEVER be paraphrased.
 *      A drift here is a regulatory violation, not a UX bug. The test uses
 *      strict equality so any edit of the displayed text or aria-label fails CI.
 *
 *   2. CustomEvent dispatch wiring — clicking the link must fire
 *      'mjagency:open-opt-out-modal' on window so the OptOutModal opens.
 *      preventDefault must run so the no-JS anchor fallback (/privacy#opt-out)
 *      doesn't navigate when JS is enabled.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { OptOutFooterLink } from '../opt-out-footer-link.js'
import { OPT_OUT_OPEN_EVENT } from '../events.js'

describe('OPT_OUT_OPEN_EVENT constant', () => {
  it('Test 1: matches the contract value the OptOutModal listens for', () => {
    // The modal subscribes to this exact string. If either side drifts,
    // the footer link silently stops working.
    expect(OPT_OUT_OPEN_EVENT).toBe('mjagency:open-opt-out-modal')
  })
})

describe('OptOutFooterLink — CCPA copy contract (§1798.135)', () => {
  it('Test 2: visible link text is the verbatim CCPA-required string', () => {
    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link')
    // Strict equality — paraphrase = compliance violation.
    expect(link.textContent).toBe('Do Not Sell or Share My Personal Information')
  })

  it('Test 3: aria-label is the verbatim CCPA-required string + "opens dialog"', () => {
    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link')
    expect(link.getAttribute('aria-label')).toBe(
      'Do Not Sell or Share My Personal Information — opens dialog',
    )
  })

  it('Test 4: href fallback points at /privacy#opt-out for no-JS visitors', () => {
    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link')
    expect(link.getAttribute('href')).toBe('/privacy#opt-out')
  })
})

describe('OptOutFooterLink — click behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 5: click dispatches CustomEvent with the OPT_OUT_OPEN_EVENT name', () => {
    const dispatched: Event[] = []
    const dispatchSpy = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation((event: Event) => {
        dispatched.push(event)
        return true
      })

    const { getByRole } = render(<OptOutFooterLink />)
    fireEvent.click(getByRole('link'))

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]?.type).toBe(OPT_OUT_OPEN_EVENT)
    expect(dispatched[0]).toBeInstanceOf(CustomEvent)
  })

  it('Test 6: click calls preventDefault so the anchor fallback does not navigate', () => {
    // Spy on dispatchEvent to keep this test focused on preventDefault behaviour
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link')

    // fireEvent.click returns true if the event was NOT cancelled.
    // The handler calls preventDefault, so this should be false.
    const propagated = fireEvent.click(link)
    expect(propagated).toBe(false)
  })

  it('Test 7: every click dispatches a fresh event (no stale closure / debouncing)', () => {
    const dispatchSpy = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation(() => true)

    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link')
    fireEvent.click(link)
    fireEvent.click(link)
    fireEvent.click(link)

    expect(dispatchSpy).toHaveBeenCalledTimes(3)
  })
})

describe('OptOutFooterLink — touch target accessibility (UI-SPEC §Surface 4)', () => {
  it('Test 8: rendered <a> has minHeight and minWidth ≥ 44px (WCAG 2.5.5 target)', () => {
    const { getByRole } = render(<OptOutFooterLink />)
    const link = getByRole('link') as HTMLAnchorElement

    // Inline style attribute (jsdom doesn't compute layout, so we read the source)
    expect(link.style.minHeight).toBe('44px')
    expect(link.style.minWidth).toBe('44px')
  })
})
