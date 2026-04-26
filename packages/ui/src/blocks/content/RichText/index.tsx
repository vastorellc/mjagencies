import React from 'react'
import type { RichTextProps } from './types.js'

export const RichText: React.FC<RichTextProps> = ({
  content,
  className = '',
}): React.ReactElement => (
  <div
    className={`mj-block mj-block--rich-text ${className}`}
    style={{
      fontFamily: 'var(--mj-font-body)',
      fontSize: 'var(--mj-text-base)',
      color: 'var(--mj-color-text-primary)',
      lineHeight: '1.7',
      padding: 'var(--mj-space-8) 0',
    }}
  >
    {content}
  </div>
)

export default RichText
