import React from 'react';
import type { ToolEmbedProps } from './types.js';

export function ToolEmbed({
  toolSlug,
  toolTitle,
  headline,
  description,
  className,
}: ToolEmbedProps): React.ReactElement {
  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-10) 0',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: 'var(--mj-space-6)',
    textAlign: 'center',
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-2xl)',
    fontWeight: 'var(--mj-font-bold)' as React.CSSProperties['fontWeight'],
    color: 'var(--mj-color-text-primary)',
    margin: '0 0 var(--mj-space-3) 0',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: 'var(--mj-text-base)',
    color: 'var(--mj-color-text-secondary)',
    margin: 0,
    maxWidth: '600px',
    marginInline: 'auto',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const toolContainerStyle: React.CSSProperties = {
    border: '1px solid var(--mj-color-border)',
    borderRadius: 'var(--mj-radius-lg)',
    background: 'var(--mj-color-surface)',
    padding: 'var(--mj-space-6)',
    minHeight: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const placeholderStyle: React.CSSProperties = {
    textAlign: 'center',
    color: 'var(--mj-color-text-muted)',
  };

  return (
    <section className={className} style={sectionStyle} data-tool-slug={toolSlug}>
      {(headline ?? description) && (
        <div style={headerStyle}>
          {headline && <h2 style={headlineStyle}>{headline}</h2>}
          {description && <p style={descriptionStyle}>{description}</p>}
        </div>
      )}
      {/* Tool UI container — Phase 9 wires the actual tool component for slug: {toolSlug} */}
      <div style={toolContainerStyle} role="region" aria-label={toolTitle}>
        <div style={placeholderStyle}>
          <p style={{ fontSize: 'var(--mj-text-sm)', margin: 0 }}>{toolTitle}</p>
        </div>
      </div>
    </section>
  );
}
