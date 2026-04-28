/**
 * packages/compliance/src/erasure/erasure-form-client.tsx
 * Plan 11-05 / REQ-144 / UI-SPEC Surface 3:
 *
 * Public CCPA erasure form. Phase 9 PUBLIC-FORM pattern:
 *   'use client' + fetch to /api/privacy/erasure-request — NOT a server action.
 *   (CLAUDE.md rule 3 server-action auth doesn't apply because this endpoint is
 *    intentionally anonymous; CCPA D-04 requires no login.)
 *
 * Two-step UX (Surface 3):
 *   Step 1 — Email entry → "Send Verification Email" → success banner mounts
 *   Step 2 — User clicks emailed link → /privacy/erasure/confirm?token=... (separate page)
 *
 * Copy contract (UI-SPEC §Surface 3 — verbatim):
 *   H1:                 "Request Deletion of Your Personal Data"
 *   Lead:               "California residents have the right to request deletion ..."
 *   Process steps:      (3 steps — exact phrasing)
 *   Scope/exclusion:    (exact phrasing)
 *   Email label:        "Email address"
 *   Email help:         "We'll send a verification link to this address."
 *   Primary CTA:        "Send Verification Email"
 *   Back link:          "Return to {agencyName}"
 *   Help footer:        "Need help? Contact privacy@{agency-domain}.com"
 *   Success heading:    "Verification Email Sent"
 *   Empty error:        "Please enter the email address you'd like data deleted for."
 *   Format error:       "Please enter a valid email address (e.g., you@example.com)."
 *   Server error:       "We could not process your request right now. Please try again, or email privacy@{domain}."
 */
'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'

const STYLES: Record<string, CSSProperties> = {
  main: {
    maxWidth: 'var(--mj-container-sm)',
    margin: '0 auto',
    padding: 'var(--mj-space-12) var(--mj-space-6)',
    color: 'var(--mj-color-text-primary)',
  },
  h1: { fontSize: '36px', fontWeight: 700, lineHeight: 1.2, margin: 0, marginBottom: 'var(--mj-space-4)' },
  lead: { fontSize: '16px', lineHeight: 1.5, margin: 0, marginBottom: 'var(--mj-space-6)' },
  sectionH: { fontSize: '24px', fontWeight: 700, margin: 0, marginTop: 'var(--mj-space-6)', marginBottom: 'var(--mj-space-3)' },
  body: { fontSize: '16px', lineHeight: 1.5, margin: 0, marginBottom: 'var(--mj-space-3)' },
  list: { paddingLeft: 'var(--mj-space-6)', margin: 0, marginBottom: 'var(--mj-space-4)' },
  formContainer: {
    background: 'var(--mj-color-bg-secondary)',
    borderRadius: 'var(--mj-radius-lg)',
    padding: 'var(--mj-space-6)',
    marginTop: 'var(--mj-space-6)',
  },
  label: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: 'var(--mj-space-2)',
  },
  input: {
    width: '100%',
    fontSize: '16px',
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    border: '1px solid var(--mj-color-border-default)',
    borderRadius: 'var(--mj-radius-md)',
    background: 'var(--mj-color-bg-primary)',
    color: 'var(--mj-color-text-primary)',
    minHeight: '44px',
  },
  inputError: {
    border: '1px solid var(--mj-color-error)',
  },
  helpText: {
    fontSize: '14px',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    marginTop: 'var(--mj-space-2)',
  },
  errorText: {
    fontSize: '14px',
    color: 'var(--mj-color-error)',
    margin: 0,
    marginTop: 'var(--mj-space-2)',
  },
  actionsRow: {
    display: 'flex',
    gap: 'var(--mj-space-4)',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 'var(--mj-space-6)',
  },
  primaryBtn: {
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
  backLink: {
    color: 'var(--mj-color-text-secondary)',
    textDecoration: 'underline',
    padding: 'var(--mj-space-3) var(--mj-space-2)',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  helpFooter: {
    marginTop: 'var(--mj-space-8)',
    fontSize: '14px',
    color: 'var(--mj-color-text-secondary)',
  },
  successBanner: {
    background: 'var(--mj-color-bg-secondary)',
    border: '1px solid var(--mj-color-info)',
    borderRadius: 'var(--mj-radius-lg)',
    padding: 'var(--mj-space-6)',
    marginTop: 'var(--mj-space-6)',
  },
  serverErrorBanner: {
    background: 'var(--mj-color-bg-secondary)',
    border: '1px solid var(--mj-color-error)',
    borderRadius: 'var(--mj-radius-md)',
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    color: 'var(--mj-color-error)',
    marginBottom: 'var(--mj-space-4)',
  },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ErasureFormClientProps {
  agencyName: string
  agencyDomain: string
  /** Override the default API path — useful for tests. */
  apiPath?: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ErasureFormClient({
  agencyName,
  agencyDomain,
  apiPath = '/api/privacy/erasure-request',
}: ErasureFormClientProps): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setFieldError(null)
    setServerError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setFieldError("Please enter the email address you'd like data deleted for.")
      return
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldError('Please enter a valid email address (e.g., you@example.com).')
      return
    }

    setStatus('submitting')
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after') ?? ''
        setServerError(
          `Too many requests from this network. Please try again${retryAfter ? ` in ${retryAfter} seconds` : ' later'}.`,
        )
        setStatus('error')
        return
      }
      if (!res.ok) {
        setServerError(
          `We could not process your request right now. Please try again, or email privacy@${agencyDomain}.`,
        )
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setServerError(
        `We could not process your request right now. Please try again, or email privacy@${agencyDomain}.`,
      )
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <main style={STYLES.main}>
        <div role="status" aria-live="polite" style={STYLES.successBanner}>
          <h1 style={{ ...STYLES.h1, fontSize: '24px' }}>Verification Email Sent</h1>
          <p style={STYLES.body}>
            We&apos;ve sent a verification link to <strong>{email}</strong>. Click the link within
            24 hours to confirm your deletion request. If you don&apos;t see it, check your spam folder.
          </p>
          <a href="/" style={STYLES.backLink}>
            Return to {agencyName}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={STYLES.main}>
      <h1 style={STYLES.h1}>Request Deletion of Your Personal Data</h1>
      <p style={STYLES.lead}>
        California residents have the right to request deletion of their personal information under
        the CCPA.
      </p>

      <h2 style={STYLES.sectionH}>What happens after you submit</h2>
      <ol style={STYLES.list}>
        <li>We&apos;ll email you a verification link.</li>
        <li>Click the link to confirm the deletion request.</li>
        <li>
          Your data is removed from all our systems within 30 days (typically faster — most
          requests complete same day).
        </li>
      </ol>

      <h2 style={STYLES.sectionH}>What we delete</h2>
      <p style={STYLES.body}>
        Contacts, deals, form submissions, support conversations, analytics records, e-signed
        documents older than legal retention, and uploaded media.
      </p>

      <h2 style={STYLES.sectionH}>What we cannot delete</h2>
      <p style={STYLES.body}>
        Records under legal hold — for example, tax records and active e-signed contracts within
        ESIGN Act retention windows.
      </p>

      <form onSubmit={handleSubmit} style={STYLES.formContainer} noValidate>
        {serverError && (
          <div role="alert" aria-live="polite" style={STYLES.serverErrorBanner}>
            {serverError}
          </div>
        )}
        <label htmlFor="erasure-email" style={STYLES.label}>
          Email address
        </label>
        <input
          id="erasure-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-required="true"
          aria-invalid={fieldError ? 'true' : 'false'}
          aria-describedby="erasure-email-help erasure-email-error"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          style={fieldError ? { ...STYLES.input, ...STYLES.inputError } : STYLES.input}
        />
        <p id="erasure-email-help" style={STYLES.helpText}>
          We&apos;ll send a verification link to this address.
        </p>
        <p id="erasure-email-error" role="alert" aria-live="polite" style={STYLES.errorText}>
          {fieldError ?? ''}
        </p>

        <div style={STYLES.actionsRow}>
          <button
            type="submit"
            disabled={status === 'submitting'}
            aria-busy={status === 'submitting'}
            style={STYLES.primaryBtn}
          >
            {status === 'submitting' ? 'Sending...' : 'Send Verification Email'}
          </button>
          <a href="/" style={STYLES.backLink}>
            Return to {agencyName}
          </a>
        </div>
      </form>

      <p style={STYLES.helpFooter}>Need help? Contact privacy@{agencyDomain}</p>
    </main>
  )
}
