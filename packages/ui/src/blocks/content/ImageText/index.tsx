import React from 'react'
import type { ImageTextProps } from './types.js'

export const ImageText: React.FC<ImageTextProps> = ({
  imageUrl,
  imageAlt,
  headline,
  body,
  imagePosition = 'left',
  className = '',
}): React.ReactElement => (
  <section
    className={`mj-block mj-block--image-text ${className}`}
    style={{
      display: 'flex',
      flexDirection: imagePosition === 'left' ? 'row' : 'row-reverse',
      gap: 'var(--mj-space-10)',
      padding: 'var(--mj-space-10) 0',
      alignItems: 'center',
      backgroundColor: 'var(--mj-color-bg)',
    }}
  >
    <div style={{ flex: 1, overflow: 'hidden', borderRadius: 'var(--mj-radius-lg)' }}>
      <img
        src={imageUrl}
        alt={imageAlt}
        style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
        loading="lazy"
        decoding="async"
      />
    </div>
    <div style={{ flex: 1 }}>
      <h2
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-3xl)',
          color: 'var(--mj-color-text-primary)',
          marginTop: 0,
          marginBottom: 'var(--mj-space-4)',
        }}
      >
        {headline}
      </h2>
      <div
        style={{
          fontFamily: 'var(--mj-font-body)',
          fontSize: 'var(--mj-text-base)',
          color: 'var(--mj-color-text-secondary)',
          lineHeight: '1.7',
        }}
      >
        {body}
      </div>
    </div>
  </section>
)

export default ImageText
