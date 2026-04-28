/**
 * apps/web-financial/src/components/open-tracking-settings.tsx
 * Plan 11-05 / UI-SPEC Surface 5 — privacy page CTA that opens the Surface 4 modal.
 */
'use client'
import { type CSSProperties } from 'react'

const OPT_OUT_OPEN_EVENT = 'mjagency:open-opt-out-modal'

const style: CSSProperties = {
  background: 'var(--mj-color-brand-500)',
  color: 'var(--mj-color-text-on-brand)',
  border: 'none',
  borderRadius: 'var(--mj-radius-md)',
  padding: 'var(--mj-space-3) var(--mj-space-6)',
  minHeight: '44px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 'var(--mj-space-3)',
}

export function OpenTrackingSettingsButton(): React.JSX.Element {
  function handleClick(): void {
    window.dispatchEvent(new CustomEvent(OPT_OUT_OPEN_EVENT))
  }
  return (
    <button type="button" onClick={handleClick} style={style}>
      Open Tracking Settings
    </button>
  )
}
