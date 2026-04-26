'use client';

import React, { useState } from 'react';
import type { NewsletterFormProps } from './types.js';

export function NewsletterForm({
  formId,
  headline,
  description,
  submitText = 'Subscribe',
  disclaimer,
  className,
}: NewsletterFormProps): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);

  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-8)',
    background: 'var(--mj-color-surface-subtle)',
    borderRadius: 'var(--mj-radius-lg)',
    border: '1px solid var(--mj-color-border)',
    textAlign: 'center',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-2) 0',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-secondary)',
    margin: '0 0 var(--mj-space-5) 0',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--mj-space-2)',
    maxWidth: '440px',
    marginInline: 'auto',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    border: '1px solid var(--mj-color-border)',
    borderRadius: 'var(--mj-radius-sm)',
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-primary)',
    background: 'var(--mj-color-surface)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: 'var(--mj-space-3) var(--mj-space-5)',
    background: 'var(--mj-color-brand-primary)',
    color: 'var(--mj-color-brand-primary-contrast)',
    borderRadius: 'var(--mj-radius-sm)',
    fontSize: 'var(--mj-text-sm)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const disclaimerStyle: React.CSSProperties = {
    marginTop: 'var(--mj-space-3)',
    fontSize: 'var(--mj-text-xs)',
    color: 'var(--mj-color-text-muted)',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const successStyle: React.CSSProperties = {
    padding: 'var(--mj-space-4)',
    color: 'var(--mj-color-text-primary)',
    fontSize: 'var(--mj-text-sm)',
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const formEl = e.currentTarget;
    const emailInput = formEl.elements.namedItem('email') as HTMLInputElement;
    // Server action wired in Phase 9
    console.log('Newsletter form submitted', { formId, email: emailInput.value });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className={className} style={sectionStyle}>
        <div style={successStyle}>
          <strong>You are subscribed!</strong>
          <span style={{ display: 'block', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-1)' }}>
            Watch your inbox for our next issue.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={sectionStyle}>
      {headline && <h3 style={headlineStyle}>{headline}</h3>}
      {description && <p style={descriptionStyle}>{description}</p>}
      <form onSubmit={handleSubmit} data-form-id={formId} noValidate>
        <div style={rowStyle}>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            aria-label="Email address"
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>
            {submitText}
          </button>
        </div>
        {disclaimer && <small style={disclaimerStyle}>{disclaimer}</small>}
      </form>
    </div>
  );
}
