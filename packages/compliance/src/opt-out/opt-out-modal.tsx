/**
 * packages/compliance/src/opt-out/opt-out-modal.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 4 modal:
 *
 * Native HTML <dialog> element opened via showModal() — built-in focus trap +
 * ESC close + backdrop click without third-party libs. The modal listens for
 * the 'mjagency:open-opt-out-modal' CustomEvent dispatched by OptOutFooterLink
 * and the privacy-page "Open Tracking Settings" CTA.
 *
 * Confirm CTA POSTs to /api/ccpa/opt-out (Phase 9 PUBLIC-FORM pattern: 'use client'
 * + fetch — NEVER server actions per CLAUDE.md rule 3 reasoning, public anonymous
 * users have no session). Server sets mj_consent cookie + writes consent_log audit
 * row + enqueues fan-out (GA4 + Meta CAPI + Clarity Delete) per D-03. Browser
 * reloads after success so SSR re-renders without pixel scripts.
 *
 * Copy contract (UI-SPEC §Surface 4 — verbatim):
 *   Heading:        "Stop Sale and Sharing of My Personal Information"
 *   Body intro:     "When you click \"Stop Tracking and Clear My Data,\" we'll:"
 *   List item 1:    "Stop Google Analytics from tracking your visit"
 *   List item 2:    "Stop Microsoft Clarity from recording your session"
 *   List item 3:    "Stop sharing data with Meta (Facebook/Instagram)"
 *   List item 4:    "Request deletion of any data already collected from these systems within 45 days"
 *   Persistence:    "Your preference is saved for one year. You can change it any time using this link."
 *   Confirm CTA:    "Stop Tracking and Clear My Data"  (NOT "Submit", NOT "OK")
 *   Cancel CTA:     "Keep Current Settings"            (NOT "Cancel")
 *   Submitting:     "Stopping tracking..."
 *
 * Already-opted-out variant (when mj_consent cookie === 'tracking_blocked'):
 *   Heading:        "Tracking Already Stopped"
 *   Body:           "Your tracking preference is already set to stop. To re-enable analytics, click \"Re-enable Tracking\" below."
 *   Re-enable CTA:  "Re-enable Tracking"
 */
'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { OPT_OUT_OPEN_EVENT } from './events.js'

type Status = 'idle' | 'submitting' | 'error'

const BODY_LIST = [
  'Stop Google Analytics from tracking your visit',
  'Stop Microsoft Clarity from recording your session',
  'Stop sharing data with Meta (Facebook/Instagram)',
  'Request deletion of any data already collected from these systems within 45 days',
]

const STYLES: Record<string, CSSProperties> = {
  dialog: {
    border: 'none',
    padding: 0,
    background: 'transparent',
    maxWidth: 'var(--mj-container-sm)',
    width: '100%',
  },
  panel: {
    background: 'var(--mj-color-bg-primary)',
    borderRadius: 'var(--mj-radius-xl)',
    boxShadow: 'var(--mj-shadow-xl)',
    padding: 'var(--mj-space-8)',
    color: 'var(--mj-color-text-primary)',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    marginBottom: 'var(--mj-space-4)',
  },
  bodyIntro: {
    fontSize: '16px',
    fontWeight: 400,
    margin: 0,
    marginBottom: 'var(--mj-space-3)',
  },
  list: {
    margin: 0,
    paddingLeft: 'var(--mj-space-6)',
    marginBottom: 'var(--mj-space-4)',
  },
  listItem: {
    marginBottom: 'var(--mj-space-2)',
  },
  persistenceNote: {
    fontSize: '16px',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    marginBottom: 'var(--mj-space-6)',
  },
  errorBanner: {
    background: 'var(--mj-color-bg-secondary)',
    border: '1px solid var(--mj-color-error)',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    marginBottom: 'var(--mj-space-4)',
    color: 'var(--mj-color-error)',
  },
  actionsRow: {
    display: 'flex',
    gap: 'var(--mj-space-3)',
    flexWrap: 'wrap',
  },
  confirmBtn: {
    background: 'var(--mj-color-error)',
    color: 'var(--mj-color-text-on-error)',
    border: 'none',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  reenableBtn: {
    background: 'var(--mj-color-brand-500)',
    color: 'var(--mj-color-text-on-brand)',
    border: 'none',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelBtn: {
    background: 'transparent',
    color: 'var(--mj-color-brand-500)',
    border: '1px solid var(--mj-color-brand-500)',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  closeBtn: {
    position: 'absolute',
    top: 'var(--mj-space-3)',
    right: 'var(--mj-space-3)',
    background: 'transparent',
    border: 'none',
    color: 'var(--mj-color-text-secondary)',
    fontSize: '20px',
    cursor: 'pointer',
    minWidth: '44px',
    minHeight: '44px',
  },
}

function readConsentCookie(): 'tracking_blocked' | 'tracking_allowed' {
  if (typeof document === 'undefined') return 'tracking_allowed'
  const match = document.cookie.match(/(?:^|;\s*)mj_consent=(tracking_blocked|tracking_allowed)/)
  return match?.[1] === 'tracking_blocked' ? 'tracking_blocked' : 'tracking_allowed'
}

export function OptOutModal(): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [alreadyBlocked, setAlreadyBlocked] = useState(false)

  // Listen for the open event from OptOutFooterLink / privacy page CTA / cookie banner.
  useEffect(() => {
    function handleOpen(): void {
      setError(null)
      setStatus('idle')
      setAlreadyBlocked(readConsentCookie() === 'tracking_blocked')
      dialogRef.current?.showModal()
    }
    window.addEventListener(OPT_OUT_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(OPT_OUT_OPEN_EVENT, handleOpen)
  }, [])

  function handleClose(): void {
    dialogRef.current?.close()
  }

  async function handleConfirmStop(): Promise<void> {
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/ccpa/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opt_out' }),
      })
      if (!res.ok) {
        setStatus('error')
        setError(
          'We could not save your preference right now. Please try again, or contact privacy@example.com.',
        )
        return
      }
      // Force SSR re-render with pixels suppressed (Surface 4 contract).
      window.location.reload()
    } catch {
      setStatus('error')
      setError(
        'We could not save your preference right now. Please try again, or contact privacy@example.com.',
      )
    }
  }

  async function handleReenable(): Promise<void> {
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch('/api/ccpa/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'opt_in' }),
      })
      if (!res.ok) {
        setStatus('error')
        setError('We could not re-enable tracking right now. Please try again.')
        return
      }
      window.location.reload()
    } catch {
      setStatus('error')
      setError('We could not re-enable tracking right now. Please try again.')
    }
  }

  // Backdrop click: close (matches UI-SPEC §Surface 4).
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>): void {
    if (e.target === dialogRef.current) handleClose()
  }

  return (
    <dialog
      ref={dialogRef}
      style={STYLES.dialog}
      aria-labelledby="opt-out-modal-heading"
      onClick={handleDialogClick}
    >
      <div style={{ ...STYLES.panel, position: 'relative' }}>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={handleClose}
          style={STYLES.closeBtn}
        >
          ×
        </button>

        {alreadyBlocked ? (
          <>
            <h2 id="opt-out-modal-heading" style={STYLES.heading}>
              Tracking Already Stopped
            </h2>
            <p style={STYLES.bodyIntro}>
              Your tracking preference is already set to stop. To re-enable analytics, click
              &quot;Re-enable Tracking&quot; below.
            </p>
            {error && <div role="alert" style={STYLES.errorBanner}>{error}</div>}
            <div style={STYLES.actionsRow}>
              <button
                type="button"
                onClick={handleReenable}
                disabled={status === 'submitting'}
                aria-busy={status === 'submitting'}
                style={STYLES.reenableBtn}
              >
                {status === 'submitting' ? 'Re-enabling tracking...' : 'Re-enable Tracking'}
              </button>
              <button type="button" onClick={handleClose} style={STYLES.cancelBtn}>
                Keep Current Settings
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="opt-out-modal-heading" style={STYLES.heading}>
              Stop Sale and Sharing of My Personal Information
            </h2>
            <p style={STYLES.bodyIntro}>
              When you click &quot;Stop Tracking and Clear My Data,&quot; we&apos;ll:
            </p>
            <ul style={STYLES.list}>
              {BODY_LIST.map((item) => (
                <li key={item} style={STYLES.listItem}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={STYLES.persistenceNote}>
              Your preference is saved for one year. You can change it any time using this link.
            </p>
            {error && <div role="alert" style={STYLES.errorBanner}>{error}</div>}
            <div style={STYLES.actionsRow}>
              <button
                type="button"
                onClick={handleConfirmStop}
                disabled={status === 'submitting'}
                aria-busy={status === 'submitting'}
                style={STYLES.confirmBtn}
              >
                {status === 'submitting' ? 'Stopping tracking...' : 'Stop Tracking and Clear My Data'}
              </button>
              <button type="button" onClick={handleClose} style={STYLES.cancelBtn}>
                Keep Current Settings
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
