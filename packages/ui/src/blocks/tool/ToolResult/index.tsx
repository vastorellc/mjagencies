import React from 'react';
import type { ToolResultProps } from './types.js';

export function ToolResult({ resultHtml, disclaimer, className }: ToolResultProps): React.ReactElement {
  const sectionStyle: React.CSSProperties = {
    padding: 'var(--mj-space-6)',
    background: 'var(--mj-color-surface)',
    borderRadius: 'var(--mj-radius-md)',
    border: '1px solid var(--mj-color-border)',
  };

  const resultStyle: React.CSSProperties = {
    color: 'var(--mj-color-text-primary)',
    fontSize: 'var(--mj-text-base)',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  const disclaimerStyle: React.CSSProperties = {
    marginTop: 'var(--mj-space-4)',
    paddingTop: 'var(--mj-space-4)',
    borderTop: '1px solid var(--mj-color-border)',
    fontSize: 'var(--mj-text-xs)',
    color: 'var(--mj-color-text-muted)',
    lineHeight: 'var(--mj-leading-relaxed)',
  };

  return (
    <div className={className} style={sectionStyle}>
      {/* TODO Phase 10: replace dangerouslySetInnerHTML with sanitized renderer */}
      <div
        style={resultStyle}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: resultHtml }}
      />
      {disclaimer && <p style={disclaimerStyle}>{disclaimer}</p>}
    </div>
  );
}
