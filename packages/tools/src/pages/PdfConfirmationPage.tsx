/**
 * packages/tools/src/pages/PdfConfirmationPage.tsx
 * UI-SPEC Surface 6 — PDF confirmation page.
 * REQ-402: re-sendable via email form on confirmation page.
 */
'use client'
import { useState, type FormEvent } from 'react'

interface PdfConfirmationPageProps {
  toolName: string
  email: string
  toolSlug: string
  toolResultJson: string
  agencySlug: string
}

export function PdfConfirmationPage({
  toolName,
  email,
  toolSlug,
  toolResultJson,
  agencySlug,
}: PdfConfirmationPageProps): React.JSX.Element {
  const [resendEmail, setResendEmail] = useState(email)
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleResend(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/tools/resend-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resendEmail,
          toolSlug,
          toolResultJson,
          agencySlug,
          _hp: honeypot,
        }),
      })
      const data = (await res.json()) as { ok: boolean }
      setState(data.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <main
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: 'var(--mj-space-16) var(--mj-space-6)',
      }}
    >
      <h1
        style={{
          fontSize: 'var(--mj-text-size-2xl)',
          fontWeight: 'var(--mj-weight-bold)',
          lineHeight: 'var(--mj-leading-tight)',
          marginBottom: 'var(--mj-space-4)',
        }}
      >
        Your Report Is Ready
      </h1>
      <p style={{ fontSize: 'var(--mj-text-size-base)', marginBottom: 'var(--mj-space-8)' }}>
        {`We've sent your ${toolName} report to ${email}. It includes your results, benchmarks, and recommended next steps.`}
      </p>

      <form onSubmit={(e) => void handleResend(e)}>
        {/* Honeypot — hidden from humans */}
        <input
          type="text"
          name="_hp"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
        />
        <div style={{ marginBottom: 'var(--mj-space-4)' }}>
          <label
            htmlFor="resend-email"
            style={{
              fontSize: 'var(--mj-text-size-sm)',
              display: 'block',
              marginBottom: 'var(--mj-space-2)',
            }}
          >
            Email Address
          </label>
          <input
            id="resend-email"
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 'var(--mj-space-2) var(--mj-space-4)',
              fontSize: 'var(--mj-text-size-base)',
              border: '1px solid var(--mj-color-border)',
              borderRadius: '4px',
              minHeight: '44px',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={state === 'sending'}
          style={{
            padding: 'var(--mj-space-4) var(--mj-space-8)',
            background: 'var(--mj-color-brand-500)',
            color: 'var(--mj-color-text-on-brand)',
            fontSize: 'var(--mj-text-size-base)',
            fontWeight: 'var(--mj-weight-bold)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {state === 'sending' ? 'Sending...' : 'Re-send to My Email'}
        </button>
        {state === 'sent' && (
          <p
            style={{
              color: 'var(--mj-color-success)',
              fontSize: 'var(--mj-text-size-sm)',
              marginTop: 'var(--mj-space-2)',
            }}
          >
            Report re-sent. Check your inbox within 2 minutes.
          </p>
        )}
        {state === 'error' && (
          <p
            role="alert"
            style={{
              color: 'var(--mj-color-error)',
              fontSize: 'var(--mj-text-size-sm)',
              marginTop: 'var(--mj-space-2)',
            }}
          >
            We could not re-send the report right now. Please try again.
          </p>
        )}
      </form>

      <a
        href=".."
        style={{
          display: 'inline-block',
          marginTop: 'var(--mj-space-8)',
          fontSize: 'var(--mj-text-size-base)',
          color: 'var(--mj-color-brand-500)',
          textDecoration: 'underline',
        }}
      >
        Start a New Calculation
      </a>
    </main>
  )
}
