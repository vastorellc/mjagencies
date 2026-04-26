'use client'
import React, { useState } from 'react'
import type { NewsletterCtaProps } from './types.js'

export const NewsletterCta: React.FC<NewsletterCtaProps> = ({
  headline,
  description,
  placeholder,
  submitText,
  disclaimer,
  className = '',
}): React.ReactElement => {
  const [email, setEmail] = useState<string>('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    // Server action wired in Phase 9 — form submission logged for now
    console.log('Newsletter subscription submitted:', email)
  }

  return (
    <section
      className={`mj-block mj-block--newsletter-cta ${className}`}
      style={{
        padding: 'var(--mj-space-12)',
        backgroundColor: 'var(--mj-color-surface)',
        borderRadius: 'var(--mj-radius-lg)',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-2xl)',
          color: 'var(--mj-color-text-primary)',
          margin: '0 0 var(--mj-space-3)',
        }}
      >
        {headline}
      </h2>
      <p
        style={{
          fontFamily: 'var(--mj-font-body)',
          fontSize: 'var(--mj-text-base)',
          color: 'var(--mj-color-text-secondary)',
          margin: '0 auto var(--mj-space-6)',
          maxWidth: '480px',
          lineHeight: '1.6',
        }}
      >
        {description}
      </p>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 'var(--mj-space-3)',
          justifyContent: 'center',
          flexWrap: 'wrap',
          maxWidth: '480px',
          margin: '0 auto',
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value) }}
          placeholder={placeholder}
          required
          style={{
            flex: 1,
            minWidth: '200px',
            padding: 'var(--mj-space-3) var(--mj-space-4)',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-base)',
            color: 'var(--mj-color-text-primary)',
            backgroundColor: 'var(--mj-color-bg)',
            border: '1px solid var(--mj-color-border)',
            borderRadius: 'var(--mj-radius-md)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: 'var(--mj-space-3) var(--mj-space-6)',
            backgroundColor: 'var(--mj-color-brand-primary)',
            color: 'var(--mj-color-bg)',
            borderRadius: 'var(--mj-radius-md)',
            border: 'none',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-base)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {submitText}
        </button>
      </form>
      {disclaimer !== undefined && (
        <small
          style={{
            display: 'block',
            marginTop: 'var(--mj-space-4)',
            fontFamily: 'var(--mj-font-body)',
            fontSize: 'var(--mj-text-xs)',
            color: 'var(--mj-color-text-secondary)',
          }}
        >
          {disclaimer}
        </small>
      )}
    </section>
  )
}

export default NewsletterCta
