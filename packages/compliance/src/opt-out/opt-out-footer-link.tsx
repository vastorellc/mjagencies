/**
 * packages/compliance/src/opt-out/opt-out-footer-link.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 4:
 *
 * Footer link with EXACT California Civil Code §1798.135 wording — must NEVER be
 * paraphrased. Click opens the Surface 4 OptOutModal via a custom event the modal
 * listens for; no-JS visitors fall back to the /privacy#opt-out anchor (Surface 5).
 *
 * Copy contract (UI-SPEC §Surface 4 — verbatim, never paraphrase):
 *   Link:       "Do Not Sell or Share My Personal Information"
 *   aria-label: "Do Not Sell or Share My Personal Information — opens dialog"
 *
 * Visual contract:
 *   - color: var(--mj-color-text-secondary); hover → var(--mj-color-text-link)
 *   - underlined on hover/focus
 *   - 14px / 400 weight
 *   - padding for 44×44px touch target
 */
'use client'

import { type CSSProperties } from 'react'
import { OPT_OUT_OPEN_EVENT } from './events.js'

const STYLE: CSSProperties = {
  color: 'var(--mj-color-text-secondary)',
  fontSize: '14px',
  fontWeight: 400,
  padding: 'var(--mj-space-3) var(--mj-space-4)',
  display: 'inline-block',
  minHeight: '44px',
  minWidth: '44px',
  textDecoration: 'none',
}

export function OptOutFooterLink(): React.JSX.Element {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    // No-JS fallback: anchor href stays /privacy#opt-out. With JS we open the modal directly.
    e.preventDefault()
    window.dispatchEvent(new CustomEvent(OPT_OUT_OPEN_EVENT))
  }

  return (
    <a
      href="/privacy#opt-out"
      aria-label="Do Not Sell or Share My Personal Information — opens dialog"
      onClick={handleClick}
      style={STYLE}
    >
      Do Not Sell or Share My Personal Information
    </a>
  )
}
