import React from 'react';
import type { ToolCtaProps } from './types.js';

export function ToolCta({
  toolSlug,
  toolTitle,
  description,
  ctaText,
  className,
}: ToolCtaProps): React.ReactElement {
  const cardStyle: React.CSSProperties = {
    padding: 'var(--mj-space-8)',
    background: 'var(--mj-color-surface-subtle)',
    borderRadius: 'var(--mj-radius-lg)',
    border: '1px solid var(--mj-color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mj-space-4)',
    alignItems: 'flex-start',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: 0,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-base)',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: 'var(--mj-space-3) var(--mj-space-6)',
    background: 'var(--mj-color-brand-primary)',
    color: 'var(--mj-color-brand-primary-contrast)',
    borderRadius: 'var(--mj-radius-md)',
    fontSize: 'var(--mj-text-sm)',
    fontWeight: 'var(--mj-font-semibold)' as React.CSSProperties['fontWeight'],
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div className={className} style={cardStyle} data-tool-slug={toolSlug}>
      <h3 style={titleStyle}>{toolTitle}</h3>
      <p style={descriptionStyle}>{description}</p>
      <a href={`/tools/${toolSlug}`} style={buttonStyle}>
        {ctaText}
      </a>
    </div>
  );
}
