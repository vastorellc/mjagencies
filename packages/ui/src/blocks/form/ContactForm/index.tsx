'use client';

import React, { useState } from 'react';
import type { ContactFormProps } from './types.js';

export function ContactForm({
  formId,
  headline,
  description,
  submitText = 'Send Message',
  className,
}: ContactFormProps): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);

  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-10) 0',
  };

  const wrapStyle: React.CSSProperties = {
    maxWidth: '560px',
    marginInline: 'auto',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-2xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-2) 0',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-base)',
    color: 'var(--mj-color-text-secondary)',
    margin: '0 0 var(--mj-space-6) 0',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mj-space-1)',
    marginBottom: 'var(--mj-space-4)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-sm)',
    fontWeight: 'var(--mj-font-medium)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
  };

  const inputStyle: React.CSSProperties = {
    padding: 'var(--mj-space-3) var(--mj-space-4)',
    border: '1px solid var(--mj-color-border)',
    borderRadius: 'var(--mj-radius-sm)',
    fontSize: 'var(--mj-text-base)',
    color: 'var(--mj-color-text-primary)',
    background: 'var(--mj-color-surface)',
    width: '100%',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '120px',
    resize: 'vertical',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    background: 'var(--mj-color-brand-primary)',
    color: 'var(--mj-color-brand-primary-contrast)',
    borderRadius: 'var(--mj-radius-md)',
    fontSize: 'var(--mj-text-base)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    border: 'none',
    cursor: 'pointer',
  };

  const successStyle: React.CSSProperties = {
    padding: 'var(--mj-space-6)',
    background: 'var(--mj-color-surface-subtle)',
    borderRadius: 'var(--mj-radius-md)',
    border: '1px solid var(--mj-color-border)',
    textAlign: 'center',
    color: 'var(--mj-color-text-primary)',
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // Server action wired in Phase 9
    console.log('Contact form submitted', { formId });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className={className} style={sectionStyle}>
        <div style={wrapStyle}>
          <div style={successStyle}>
            <p style={{ margin: 0, fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'] }}>
              Thank you for reaching out!
            </p>
            <p style={{ margin: 'var(--mj-space-2) 0 0', fontSize: 'var(--mj-text-sm)', color: 'var(--mj-color-text-secondary)' }}>
              We will be in touch within one business day.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={className} style={sectionStyle}>
      <div style={wrapStyle}>
        {headline && <h2 style={headlineStyle}>{headline}</h2>}
        {description && <p style={descriptionStyle}>{description}</p>}
        <form onSubmit={handleSubmit} data-form-id={formId} noValidate>
          <div style={fieldStyle}>
            <label htmlFor={`${formId}-name`} style={labelStyle}>
              Full Name <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              autoComplete="name"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor={`${formId}-email`} style={labelStyle}>
              Email Address <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              name="email"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label htmlFor={`${formId}-message`} style={labelStyle}>
              Message <span aria-hidden="true" style={{ color: 'var(--mj-color-error)' }}>*</span>
            </label>
            <textarea
              id={`${formId}-message`}
              name="message"
              required
              style={textareaStyle}
            />
          </div>
          <button type="submit" style={buttonStyle}>
            {submitText}
          </button>
        </form>
      </div>
    </section>
  );
}
