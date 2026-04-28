/**
 * packages/compliance/src/consent/cookie-hint-banner.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 6:
 *
 * One-time informational hint banner shown only on first visit (when the
 * mj_consent_hint_dismissed cookie is absent — the layout.tsx server component
 * gates rendering). Non-blocking, non-modal — CCPA opt-out model, NOT GDPR opt-in.
 *
 * Visual contract (UI-SPEC §Surface 6):
 *   - position: fixed; bottom-floating (16px from viewport bottom)
 *   - max-width: var(--mj-container-md) (768px), centered
 *   - background: var(--mj-color-bg-primary)
 *   - border: 1px solid var(--mj-color-border-default)
 *   - border-left: 4px var(--mj-color-info) (info accent — NOT warning)
 *   - radius: var(--mj-radius-lg)
 *   - shadow: var(--mj-shadow-md)
 *   - z-index: 90 (below modal at 100, above page chrome)
 *   - role="region" aria-label="Cookie notice" — landmark, NOT modal
 *   - tab order at end of natural flow (does not intercept page nav)
 *   - 44×44px tap targets on Manage Preferences + Got It
 *
 * Copy contract (UI-SPEC §Surface 6 — verbatim):
 *   Body:    "We use analytics to improve this site."
 *   Manage:  "Manage Preferences"  (anchor → /privacy#opt-out — opens Surface 4 modal with JS)
 *   Dismiss: "Got It"               (sets mj_consent_hint_dismissed=1, removes banner)
 */
'use client'

import { useState, type CSSProperties } from 'react'

const STYLES: Record<string, CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: 'var(--mj-space-4)',
    left: 'var(--mj-space-4)',
    right: 'var(--mj-space-4)',
    maxWidth: 'var(--mj-container-md)',
    margin: '0 auto',
    background: 'var(--mj-color-bg-primary)',
    border: '1px solid var(--mj-color-border-default)',
    borderLeft: '4px solid var(--mj-color-info)',
    borderRadius: 'var(--mj-radius-lg)',
    boxShadow: 'var(--mj-shadow-md)',
    padding: 'var(--mj-space-2) var(--mj-space-4)',
    color: 'var(--mj-color-text-primary)',
    fontSize: '16px',
    fontWeight: 400,
    zIndex: 90,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--mj-space-3)',
  },
  text: {
    flex: '1 1 auto',
    margin: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--mj-space-2)',
    flex: '0 0 auto',
  },
  manageLink: {
    color: 'var(--mj-color-text-link)',
    textDecoration: 'underline',
    minHeight: '44px',
    minWidth: '44px',
    padding: 'var(--mj-space-2) var(--mj-space-3)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtn: {
    color: 'var(--mj-color-text-secondary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '44px',
    padding: 'var(--mj-space-2) var(--mj-space-3)',
  },
  hidden: {
    display: 'none',
  },
}

/**
 * Sets `mj_consent_hint_dismissed=1` cookie with 1-year expiry.
 *
 * Properties:
 *   - SameSite=Lax (cross-site nav from email is fine; not strict)
 *   - Secure (HTTPS only)
 *   - NOT httpOnly — client must read it to suppress banner re-render after SPA nav
 *   - path=/ — applies site-wide
 */
function dismissCookie(): void {
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `mj_consent_hint_dismissed=1; path=/; max-age=${oneYear}; SameSite=Lax; Secure`
}

export function CookieHintBanner(): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false)

  function handleDismiss(): void {
    dismissCookie()
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={STYLES.banner}
    >
      <p style={STYLES.text}>We use analytics to improve this site.</p>
      <div style={STYLES.actions}>
        <a
          href="/privacy#opt-out"
          aria-label="Manage tracking preferences — opens privacy page"
          style={STYLES.manageLink}
        >
          Manage Preferences
        </a>
        <button
          type="button"
          aria-label="Dismiss this notice"
          onClick={handleDismiss}
          style={STYLES.dismissBtn}
        >
          Got It
        </button>
      </div>
    </div>
  )
}
