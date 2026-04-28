/**
 * packages/compliance/src/erasure/erasure-confirm-cta.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 Step 2 (confirm CTA):
 *
 * Client-side CTA paired with the server <ErasureConfirmPage>. Sends POST
 * /api/privacy/erasure-confirm with the token. On success, swaps the page in
 * place with the "Deletion Request Received" success copy + reference number.
 *
 * Copy contract (UI-SPEC §Surface 3 Step 2):
 *   Final CTA:           "Confirm and Delete My Data"   (var(--mj-color-error) — destructive)
 *   Cancel CTA:          "Return to {agencyName}"       (NOT "Cancel" / "Go Back")
 *   Success heading:     "Deletion Request Received"
 *   Success body:        "We've recorded your request. Your data will be removed from all our
 *                         systems within 30 days. We'll email you a signed completion receipt
 *                         once finished — most requests complete within 7 days. Reference
 *                         number: [hash chain ID]."
 */
'use client'

import { useState, type CSSProperties } from 'react'

const STYLES: Record<string, CSSProperties> = {
  ctaRow: {
    display: 'flex',
    gap: 'var(--mj-space-4)',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 'var(--mj-space-6)',
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
  backLink: {
    color: 'var(--mj-color-text-secondary)',
    textDecoration: 'underline',
    padding: 'var(--mj-space-3) var(--mj-space-2)',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  successWrapper: {
    background: 'var(--mj-color-bg-secondary)',
    border: '1px solid var(--mj-color-info)',
    borderRadius: 'var(--mj-radius-lg)',
    padding: 'var(--mj-space-6)',
    marginTop: 'var(--mj-space-6)',
  },
  successHeading: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0,
    marginBottom: 'var(--mj-space-3)',
  },
  errorBanner: {
    background: 'var(--mj-color-bg-secondary)',
    border: '1px solid var(--mj-color-error)',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    color: 'var(--mj-color-error)',
    marginBottom: 'var(--mj-space-4)',
  },
}

export interface ErasureConfirmCtaProps {
  token: string
  agencyName: string
  apiPath?: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ErasureConfirmCta({
  token,
  agencyName,
  apiPath = '/api/privacy/erasure-confirm',
}: ErasureConfirmCtaProps): React.JSX.Element {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setStatus('submitting')
    setError(null)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setStatus('error')
        setError('We could not record your request right now. Please try again.')
        return
      }
      const data = (await res.json().catch(() => ({}))) as { requestId?: string }
      setReference(data.requestId ?? '—')
      setStatus('success')
    } catch {
      setStatus('error')
      setError('We could not record your request right now. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div role="status" aria-live="polite" style={STYLES.successWrapper}>
        <h2 style={STYLES.successHeading}>Deletion Request Received</h2>
        <p>
          We&apos;ve recorded your request. Your data will be removed from all our systems within
          30 days. We&apos;ll email you a signed completion receipt once finished — most requests
          complete within 7 days. Reference number: <strong>{reference}</strong>.
        </p>
        <a href="/" style={STYLES.backLink}>
          Return to {agencyName}
        </a>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div role="alert" aria-live="polite" style={STYLES.errorBanner}>
          {error}
        </div>
      )}
      <div style={STYLES.ctaRow}>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={status === 'submitting'}
          aria-busy={status === 'submitting'}
          style={STYLES.confirmBtn}
        >
          {status === 'submitting' ? 'Confirming...' : 'Confirm and Delete My Data'}
        </button>
        <a href="/" style={STYLES.backLink}>
          Return to {agencyName}
        </a>
      </div>
    </>
  )
}
