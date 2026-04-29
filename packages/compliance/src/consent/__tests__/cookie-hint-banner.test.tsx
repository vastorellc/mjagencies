// @vitest-environment jsdom
/**
 * packages/compliance/src/consent/__tests__/cookie-hint-banner.test.tsx
 *
 * Tier 2 unit tests for CookieHintBanner (Plan 11-05 / REQ-144 / UI-SPEC §Surface 6).
 *
 * Layout.tsx server-renders this banner only on first visit (when the
 * mj_consent_hint_dismissed cookie is absent). The banner itself is a
 * non-blocking informational hint — NOT a GDPR consent gate. Two contracts
 * matter:
 *
 *   1. Click "Got It" → set mj_consent_hint_dismissed=1 (1 year, SameSite=Lax,
 *      Secure, NOT httpOnly so SPA renders pick it up) AND remove the banner
 *      from the DOM.
 *
 *   2. "Manage Preferences" anchor goes to /privacy#opt-out (the page-level
 *      CCPA surface; with JS, the OptOutFooterLink there will open the modal).
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { CookieHintBanner } from '../cookie-hint-banner.js'

afterEach(() => {
  cleanup()
  // Reset cookie state between tests
  document.cookie = 'mj_consent_hint_dismissed=; path=/; max-age=0'
})

describe('CookieHintBanner — verbatim copy contract', () => {
  it('Test 1: renders the canonical body text', () => {
    const { getByText } = render(<CookieHintBanner />)
    expect(getByText('We use analytics to improve this site.')).toBeTruthy()
  })

  it('Test 2: "Manage Preferences" anchor links to /privacy#opt-out', () => {
    const { getByText } = render(<CookieHintBanner />)
    const link = getByText('Manage Preferences') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/privacy#opt-out')
    expect(link.getAttribute('aria-label')).toBe(
      'Manage tracking preferences — opens privacy page',
    )
  })

  it('Test 3: "Got It" dismiss button has the canonical label and aria-label', () => {
    const { getByText } = render(<CookieHintBanner />)
    const dismiss = getByText('Got It') as HTMLButtonElement
    expect(dismiss.tagName).toBe('BUTTON')
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss this notice')
    expect(dismiss.type).toBe('button')
  })
})

describe('CookieHintBanner — landmark accessibility', () => {
  it('Test 4: top-level container is role="region" with aria-label="Cookie notice"', () => {
    const { getByRole } = render(<CookieHintBanner />)
    const region = getByRole('region', { name: 'Cookie notice' })
    expect(region).toBeTruthy()
  })
})

describe('CookieHintBanner — dismiss flow', () => {
  beforeEach(() => {
    // Confirm we start clean
    expect(document.cookie).not.toContain('mj_consent_hint_dismissed')
  })

  it('Test 5: clicking "Got It" hides the banner from the DOM', () => {
    const { getByText, queryByRole } = render(<CookieHintBanner />)
    expect(queryByRole('region', { name: 'Cookie notice' })).toBeTruthy()

    fireEvent.click(getByText('Got It'))

    expect(queryByRole('region', { name: 'Cookie notice' })).toBeNull()
  })

  it('Test 6: clicking "Got It" writes mj_consent_hint_dismissed=1 with the right flags', () => {
    // jsdom defaults to http://localhost, which silently drops cookies with the
    // `Secure` flag. Spy on the cookie setter so we can verify the write itself,
    // independent of jsdom's strict HTTPS persistence.
    const cookieWrites: string[] = []
    const docProto = Object.getPrototypeOf(document) as Document
    const original = Object.getOwnPropertyDescriptor(docProto, 'cookie')
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookieWrites.join('; '),
      set: (value: string) => {
        cookieWrites.push(value)
      },
    })
    try {
      const { getByText } = render(<CookieHintBanner />)
      fireEvent.click(getByText('Got It'))
      const write = cookieWrites.find(c => c.includes('mj_consent_hint_dismissed=1'))
      expect(write).toBeDefined()
      // Required flags per UI-SPEC §Surface 6 / Plan 11-05:
      expect(write).toMatch(/path=\//)
      expect(write).toMatch(/SameSite=Lax/)
      expect(write).toMatch(/Secure/)
      // 1-year expiry (60 * 60 * 24 * 365 = 31536000)
      expect(write).toMatch(/max-age=31536000/)
    } finally {
      if (original) Object.defineProperty(document, 'cookie', original)
    }
  })
})
