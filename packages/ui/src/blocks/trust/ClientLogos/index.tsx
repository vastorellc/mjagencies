import React from 'react'
import type { ClientLogosProps } from './types.js'

export const ClientLogos: React.FC<ClientLogosProps> = ({
  headline,
  logos,
  className = '',
}): React.ReactElement => (
  <section className={`mj-block mj-block--client-logos ${className}`}>
    {headline !== undefined && (
      <h2
        style={{
          fontFamily: 'var(--mj-font-heading)',
          fontSize: 'var(--mj-text-sm)',
          fontWeight: 600,
          color: 'var(--mj-color-text-secondary)',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: '0 0 var(--mj-space-8)',
        }}
      >
        {headline}
      </h2>
    )}
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--mj-space-8)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {logos.map((logo, index) => {
        const img = (
          <img
            src={logo.imageUrl}
            alt={logo.imageAlt}
            style={{
              height: 'var(--mj-space-10)',
              width: 'auto',
              objectFit: 'contain',
              filter: 'grayscale(100%)',
              opacity: 0.6,
              transition: 'opacity 0.2s, filter 0.2s',
            }}
          />
        )
        return logo.href !== undefined ? (
          <a
            key={index}
            href={logo.href}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {img}
          </a>
        ) : (
          <span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {img}
          </span>
        )
      })}
    </div>
  </section>
)

export default ClientLogos
