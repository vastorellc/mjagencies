/**
 * packages/tools/src/pages/EmailGateModal.tsx
 * UI-SPEC Surface 2 — email gate modal dialog.
 * role="dialog", aria-modal="true", focus-trap, ESC closes.
 * Public form — fetch to /api/tools/email-gate (NOT server action).
 */
'use client'
import { useState, useRef, useEffect, type FormEvent } from 'react'
import type { ToolResult } from '../engine/types.js'

interface EmailGateModalProps {
  isOpen: boolean
  onClose: () => void
  toolSlug: string
  toolResult: ToolResult
  agencySlug: string
}

export function EmailGateModal({
  isOpen,
  onClose,
  toolSlug,
  toolResult,
  agencySlug,
}: EmailGateModalProps): React.JSX.Element | null {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const emailRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus email input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => emailRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // ESC closes modal
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    try {
      const res = await fetch('/api/tools/email-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          toolSlug,
          toolResultJson: JSON.stringify(toolResult),
          agencySlug,
          _hp: honeypot,
        }),
      })
      const data = (await res.json()) as { ok: boolean }
      if (data.ok) {
        setState('success')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-gate-heading"
      ref={dialogRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'var(--mj-color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mj-space-4)',
      }}
      onClick={(e): void => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--mj-color-bg-primary)',
          borderRadius: '8px',
          padding: 'var(--mj-space-8)',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        {state === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                color: 'var(--mj-color-success)',
                fontSize: 'var(--mj-text-size-base)',
                fontWeight: 'var(--mj-weight-bold)',
              }}
            >
              Your report is on its way. Check your inbox within 2 minutes.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{ marginTop: 'var(--mj-space-4)', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <h2
              id="email-gate-heading"
              style={{
                fontSize: 'var(--mj-text-size-2xl)',
                fontWeight: 'var(--mj-weight-bold)',
                lineHeight: 'var(--mj-leading-tight)',
                marginBottom: 'var(--mj-space-4)',
              }}
            >
              Get Your Full PDF Report
            </h2>
            <p style={{ fontSize: 'var(--mj-text-size-base)', marginBottom: 'var(--mj-space-6)' }}>
              Enter your email to receive the complete analysis with benchmarks, methodology, and
              next steps.
            </p>
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
                htmlFor="email-gate-email"
                style={{
                  fontSize: 'var(--mj-text-size-sm)',
                  display: 'block',
                  marginBottom: 'var(--mj-space-2)',
                }}
              >
                Email Address
              </label>
              <input
                ref={emailRef}
                id="email-gate-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: 'var(--mj-space-2) var(--mj-space-4)',
                  fontSize: 'var(--mj-text-size-base)',
                  border: '1px solid var(--mj-color-border)',
                  borderRadius: '4px',
                  outline: 'none',
                }}
                aria-describedby={state === 'error' ? 'email-gate-error' : undefined}
              />
            </div>
            {state === 'error' && (
              <p
                id="email-gate-error"
                role="alert"
                style={{
                  color: 'var(--mj-color-error)',
                  fontSize: 'var(--mj-text-size-sm)',
                  marginBottom: 'var(--mj-space-4)',
                }}
              >
                We could not send the report right now. Please try again or contact us directly.
              </p>
            )}
            <button
              type="submit"
              disabled={state === 'submitting'}
              style={{
                width: '100%',
                padding: 'var(--mj-space-4)',
                background: 'var(--mj-color-brand-500)',
                color: 'var(--mj-color-text-on-brand)',
                fontSize: 'var(--mj-text-size-base)',
                fontWeight: 'var(--mj-weight-bold)',
                border: 'none',
                borderRadius: '4px',
                cursor: state === 'submitting' ? 'not-allowed' : 'pointer',
                minHeight: '44px',
              }}
            >
              {state === 'submitting' ? 'Sending...' : 'Send Me the PDF'}
            </button>
            <p
              style={{
                fontSize: 'var(--mj-text-size-sm)',
                color: 'var(--mj-color-text-secondary)',
                marginTop: 'var(--mj-space-4)',
                textAlign: 'center',
              }}
            >
              {"We'll send your report and may follow up with relevant resources. Unsubscribe anytime."}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
