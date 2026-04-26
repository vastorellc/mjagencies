import React from 'react';
import type { DividerProps } from './types.js';

const SPACE_SIZE: Record<NonNullable<DividerProps['size']>, string> = {
  sm: 'var(--mj-space-6)',
  md: 'var(--mj-space-10)',
  lg: 'var(--mj-space-16)',
};

export function Divider({
  style: dividerStyle = 'line',
  size = 'md',
  className,
}: DividerProps): React.ReactElement {
  if (dividerStyle === 'space') {
    return (
      <div
        className={className}
        style={{ height: SPACE_SIZE[size] }}
        role="separator"
        aria-hidden="true"
      />
    );
  }

  if (dividerStyle === 'ornament') {
    const wrapStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--mj-space-3)',
      marginBlock: SPACE_SIZE[size],
    };

    const lineStyle: React.CSSProperties = {
      flex: 1,
      height: '1px',
      background: 'var(--mj-color-border)',
    };

    const dotStyle: React.CSSProperties = {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'var(--mj-color-brand-primary)',
      flexShrink: 0,
    };

    const diamondStyle: React.CSSProperties = {
      width: '10px',
      height: '10px',
      background: 'var(--mj-color-brand-primary)',
      transform: 'rotate(45deg)',
      flexShrink: 0,
    };

    return (
      <div className={className} style={wrapStyle} role="separator" aria-hidden="true">
        <div style={lineStyle} />
        <div style={dotStyle} />
        <div style={diamondStyle} />
        <div style={dotStyle} />
        <div style={lineStyle} />
      </div>
    );
  }

  // Default: 'line'
  return (
    <hr
      className={className}
      style={{
        border: 'none',
        borderTop: '1px solid var(--mj-color-border)',
        marginBlock: SPACE_SIZE[size],
      }}
    />
  );
}
