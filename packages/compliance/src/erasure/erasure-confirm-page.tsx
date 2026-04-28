/**
 * packages/compliance/src/erasure/erasure-confirm-page.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3 Step 2:
 *
 * Server component that reads ?token= searchParam from the email link, calls
 * verifyErasureToken() (jose), and renders one of three states:
 *   - Token valid:   "Confirm Your Deletion Request" + "Confirm and Delete My Data"
 *   - Token expired: "This Verification Link Has Expired" + "Start a New Request"
 *   - Token invalid: "Verification Link Not Recognized" + "Start a New Request"
 *
 * The confirm CTA submits to /api/privacy/erasure-confirm via the small client
 * component <ConfirmCta>. POST verifies token + Redis SETNX (Pitfall 6.4) +
 * enqueues the 'ccpa-erasure' job.
 */
import { errors as joseErrors } from 'jose'
import { verifyErasureToken } from './token.js'
import { ErasureConfirmCta } from './erasure-confirm-cta.js'

interface ErasureConfirmPageProps {
  searchParams: Promise<{ token?: string }>
  /** Display name for the back link ("Return to ${agencyName}") */
  agencyName: string
}

const STYLES = {
  main: {
    maxWidth: 'var(--mj-container-sm)',
    margin: '0 auto',
    padding: 'var(--mj-space-12) var(--mj-space-6)',
    color: 'var(--mj-color-text-primary)',
  },
  h1: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1.2,
    margin: 0,
    marginBottom: 'var(--mj-space-4)',
  },
  body: {
    fontSize: '16px',
    lineHeight: 1.5,
    margin: 0,
    marginBottom: 'var(--mj-space-6)',
  },
  ctaRow: {
    display: 'flex',
    gap: 'var(--mj-space-4)',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    marginTop: 'var(--mj-space-6)',
  },
  backLink: {
    color: 'var(--mj-color-text-secondary)',
    textDecoration: 'underline',
    padding: 'var(--mj-space-3) var(--mj-space-2)',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  startNewBtn: {
    background: 'var(--mj-color-brand-500)',
    color: 'var(--mj-color-text-on-brand)',
    border: 'none',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    minHeight: '44px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
} as const

export async function ErasureConfirmPage({
  searchParams,
  agencyName,
}: ErasureConfirmPageProps): Promise<React.JSX.Element> {
  const { token } = await searchParams

  if (!token) {
    return (
      <main style={STYLES.main}>
        <h1 style={STYLES.h1}>Verification Link Not Recognized</h1>
        <p style={STYLES.body}>
          This link is no longer valid. It may have already been used, or the link in your email
          may be incomplete. Please return to the deletion request form to try again.
        </p>
        <div style={STYLES.ctaRow}>
          <a href="/privacy/erasure" style={STYLES.startNewBtn}>
            Start a New Request
          </a>
          <a href="/" style={STYLES.backLink}>
            Return to {agencyName}
          </a>
        </div>
      </main>
    )
  }

  let verified: { email: string; agencyId: string; requestId: string } | null = null
  let isExpired = false
  let isInvalid = false

  try {
    verified = await verifyErasureToken(token)
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      isExpired = true
    } else {
      isInvalid = true
    }
  }

  if (isExpired) {
    return (
      <main style={STYLES.main}>
        <h1 style={STYLES.h1}>This Verification Link Has Expired</h1>
        <p style={STYLES.body}>
          Verification links expire after 24 hours for security. Please return to the deletion
          request form to start a new request.
        </p>
        <div style={STYLES.ctaRow}>
          <a href="/privacy/erasure" style={STYLES.startNewBtn}>
            Start a New Request
          </a>
        </div>
      </main>
    )
  }

  if (isInvalid || !verified) {
    return (
      <main style={STYLES.main}>
        <h1 style={STYLES.h1}>Verification Link Not Recognized</h1>
        <p style={STYLES.body}>
          This link is no longer valid. It may have already been used, or the link in your email
          may be incomplete. Please return to the deletion request form to try again.
        </p>
        <div style={STYLES.ctaRow}>
          <a href="/privacy/erasure" style={STYLES.startNewBtn}>
            Start a New Request
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={STYLES.main}>
      <h1 style={STYLES.h1}>Confirm Your Deletion Request</h1>
      <p style={STYLES.body}>
        You&apos;re about to request permanent deletion of all data we hold about{' '}
        <strong>{verified.email}</strong>. This action cannot be undone.
      </p>
      <ErasureConfirmCta token={token} agencyName={agencyName} />
    </main>
  )
}
