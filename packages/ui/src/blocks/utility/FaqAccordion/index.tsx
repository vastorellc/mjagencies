import React from 'react';
import type { FaqAccordionProps } from './types.js';

export function FaqAccordion({ headline, items, className }: FaqAccordionProps): React.ReactElement {
  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-10) 0',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-2xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-6) 0',
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mj-space-2)',
  };

  const detailsStyle: React.CSSProperties = {
    border: '1px solid var(--mj-color-border)',
    borderRadius: 'var(--mj-radius-md)',
    background: 'var(--mj-color-surface)',
    overflow: 'hidden',
  };

  const summaryStyle: React.CSSProperties = {
    padding: 'var(--mj-space-4) var(--mj-space-5)',
    fontSize: 'var(--mj-text-base)',
    fontWeight: 'var(--mj-font-medium)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    cursor: 'pointer',
    listStyle: 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--mj-space-3)',
  };

  const answerStyle: React.CSSProperties = {
    padding: '0 var(--mj-space-5) var(--mj-space-4)',
    fontSize: 'var(--mj-text-sm)',
    color: 'var(--mj-color-text-secondary)',
    lineHeight: 'var(--mj-leading-relaxed)',
    borderTop: '1px solid var(--mj-color-border)',
    paddingTop: 'var(--mj-space-3)',
    margin: '0',
  };

  return (
    <section className={className} style={sectionStyle}>
      {headline && <h2 style={headlineStyle}>{headline}</h2>}
      <div style={listStyle}>
        {items.map((item, index) => (
          <details key={index} style={detailsStyle}>
            <summary style={summaryStyle}>
              <span>{item.question}</span>
              <span
                aria-hidden="true"
                style={{
                  fontSize: 'var(--mj-text-lg)',
                  color: 'var(--mj-color-text-muted)',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                +
              </span>
            </summary>
            <p style={answerStyle}>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
