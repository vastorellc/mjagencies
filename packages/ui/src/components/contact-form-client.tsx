'use client'

/**
 * packages/ui/src/components/contact-form-client.tsx
 *
 * Public contact form with WCAG 2.2 AA accessibility, honeypot spam protection,
 * and full inline validation. Posts to /api/contact — public endpoint by design.
 *
 * All styles use var(--mj-*) CSS variable tokens — zero hex literals (CLAUDE.md §4).
 * All copy strings are canonical per plan 09-03.
 */

import { useState, useRef, useId } from 'react'

export interface ContactFormClientProps {
  /** Agency identifier sent as agencyId in the POST body */
  agencyId: string
  /** Displayed in the error fallback mailto link */
  contactEmail: string
  /** Optional override for /api/contact endpoint URL */
  apiEndpoint?: string
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface FormErrors {
  name?: string
  email?: string
  message?: string
}

function validateEmail(value: string): boolean {
  // Simple RFC-5322 surface check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validate(name: string, email: string, message: string): FormErrors {
  const errors: FormErrors = {}

  if (!name.trim()) {
    errors.name = 'Please enter your full name.'
  }

  if (!email.trim()) {
    errors.email = 'Please enter your email address.'
  } else if (!validateEmail(email.trim())) {
    errors.email = 'Please enter a valid email address (e.g. you@example.com).'
  }

  if (!message.trim()) {
    errors.message = 'Please enter a message.'
  } else if (message.trim().length < 20) {
    errors.message = 'Your message must be at least 20 characters.'
  }

  return errors
}

export function ContactFormClient({
  agencyId,
  contactEmail,
  apiEndpoint = '/api/contact',
}: ContactFormClientProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot field — must stay empty
  const [honeypot, setHoneypot] = useState('')

  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<FormStatus>('idle')

  const formRef = useRef<HTMLFormElement>(null)

  // Generate stable IDs for aria-describedby associations
  const uid = useId()
  const nameId = `${uid}-name`
  const nameErrId = `${uid}-name-err`
  const emailId = `${uid}-email`
  const emailErrId = `${uid}-email-err`
  const messageId = `${uid}-message`
  const messageErrId = `${uid}-message-err`
  const statusRegionId = `${uid}-status`

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()

    const newErrors = validate(name, email, message)
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setStatus('submitting')

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          _hp: honeypot,
        }),
      })

      if (!res.ok) {
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        aria-live="polite"
        id={statusRegionId}
        style={{
          padding: 'var(--mj-space-8)',
          borderRadius: 'var(--mj-radius-lg)',
          backgroundColor: 'var(--mj-color-bg-success)',
          border: '1px solid var(--mj-color-border-success)',
          color: 'var(--mj-color-text-success)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--mj-text-size-xl)',
            fontWeight: 'var(--mj-weight-semibold)',
            marginBottom: 'var(--mj-space-2)',
          }}
        >
          Message sent
        </h2>
        <p style={{ fontSize: 'var(--mj-text-size-base)', lineHeight: 'var(--mj-leading-normal)' }}>
          Thank you &mdash; we received your message and will respond within one business day.
        </p>
      </div>
    )
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--mj-text-size-sm)',
    fontWeight: 'var(--mj-weight-medium)',
    color: 'var(--mj-color-text-primary)',
    marginBottom: 'var(--mj-space-1)',
  }

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    fontSize: 'var(--mj-text-size-base)',
    lineHeight: 'var(--mj-leading-normal)',
    color: 'var(--mj-color-text-primary)',
    backgroundColor: 'var(--mj-color-bg-input)',
    border: `1px solid ${hasError ? 'var(--mj-color-border-error)' : 'var(--mj-color-border-default)'}`,
    borderRadius: 'var(--mj-radius-md)',
    outline: 'none',
    boxSizing: 'border-box',
  })

  const errorStyle: React.CSSProperties = {
    display: 'block',
    marginTop: 'var(--mj-space-1)',
    fontSize: 'var(--mj-text-size-sm)',
    color: 'var(--mj-color-text-error)',
  }

  const fieldWrapStyle: React.CSSProperties = {
    marginBottom: 'var(--mj-space-5)',
  }

  return (
    <div>
      {status === 'error' && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            marginBottom: 'var(--mj-space-5)',
            padding: 'var(--mj-space-4)',
            borderRadius: 'var(--mj-radius-md)',
            backgroundColor: 'var(--mj-color-bg-error)',
            border: '1px solid var(--mj-color-border-error)',
            color: 'var(--mj-color-text-error)',
            fontSize: 'var(--mj-text-size-sm)',
          }}
        >
          Your message could not be sent. Please try again, or{' '}
          <a
            href={`mailto:${contactEmail}`}
            style={{ color: 'var(--mj-color-link)', textDecoration: 'underline' }}
          >
            email us directly
          </a>
          .
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => { void handleSubmit(e) }}
        noValidate
        aria-label="Contact form"
      >
        {/* Honeypot field — hidden from real users, filled only by bots */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
        >
          <label htmlFor={`${uid}-hp`}>Leave this field empty</label>
          <input
            id={`${uid}-hp`}
            name="_hp"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => { setHoneypot(e.target.value) }}
          />
        </div>

        {/* Name field */}
        <div style={fieldWrapStyle}>
          <label htmlFor={nameId} style={labelStyle}>
            Full name <span aria-hidden="true" style={{ color: 'var(--mj-color-text-error)' }}>*</span>
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-required="true"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? nameErrId : undefined}
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            style={inputStyle(Boolean(errors.name))}
          />
          {errors.name && (
            <span id={nameErrId} role="alert" style={errorStyle}>
              {errors.name}
            </span>
          )}
        </div>

        {/* Email field */}
        <div style={fieldWrapStyle}>
          <label htmlFor={emailId} style={labelStyle}>
            Email address <span aria-hidden="true" style={{ color: 'var(--mj-color-text-error)' }}>*</span>
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? emailErrId : undefined}
            value={email}
            onChange={(e) => { setEmail(e.target.value) }}
            style={inputStyle(Boolean(errors.email))}
          />
          {errors.email && (
            <span id={emailErrId} role="alert" style={errorStyle}>
              {errors.email}
            </span>
          )}
        </div>

        {/* Message field */}
        <div style={fieldWrapStyle}>
          <label htmlFor={messageId} style={labelStyle}>
            Message <span aria-hidden="true" style={{ color: 'var(--mj-color-text-error)' }}>*</span>
          </label>
          <textarea
            id={messageId}
            name="message"
            rows={6}
            required
            aria-required="true"
            aria-invalid={errors.message ? 'true' : 'false'}
            aria-describedby={errors.message ? messageErrId : undefined}
            value={message}
            onChange={(e) => { setMessage(e.target.value) }}
            style={{
              ...inputStyle(Boolean(errors.message)),
              resize: 'vertical',
              minHeight: '120px',
            }}
          />
          {errors.message && (
            <span id={messageErrId} role="alert" style={errorStyle}>
              {errors.message}
            </span>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'submitting'}
          aria-busy={status === 'submitting' ? 'true' : 'false'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--mj-space-3) var(--mj-space-8)',
            fontSize: 'var(--mj-text-size-base)',
            fontWeight: 'var(--mj-weight-semibold)',
            color: 'var(--mj-color-btn-primary-text)',
            backgroundColor: status === 'submitting'
              ? 'var(--mj-color-btn-primary-bg-disabled)'
              : 'var(--mj-color-btn-primary-bg)',
            border: 'none',
            borderRadius: 'var(--mj-radius-md)',
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
            opacity: status === 'submitting' ? 0.7 : 1,
          }}
        >
          {status === 'submitting' ? 'Sending...' : 'Send message'}
        </button>
      </form>
    </div>
  )
}
