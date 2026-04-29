import type React from 'react'
import { OptOutFooterLink } from '@mjagency/compliance'

interface SiteFooterProps {
  agencyName: string
  tagline?: string
}

const FOOTER_NAV = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/blog', label: 'Blog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]

const LEGAL_NAV = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
]

export function SiteFooter({ agencyName, tagline }: SiteFooterProps): React.ReactElement {
  const year = new Date().getFullYear()

  return (
    <footer
      role="contentinfo"
      style={{
        backgroundColor: 'var(--mj-color-bg-secondary)',
        borderTop: '1px solid var(--mj-color-border)',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--mj-container-xl)',
          margin: '0 auto',
          padding: 'var(--mj-space-16) var(--mj-space-6)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--mj-space-12)',
        }}
      >
        {/* Brand column */}
        <div style={{ gridColumn: 'span 1' }}>
          <a
            href="/"
            style={{
              display: 'inline-block',
              fontSize: 'var(--mj-text-size-lg)',
              fontWeight: 'var(--mj-weight-bold)',
              color: 'var(--mj-color-text-primary)',
              textDecoration: 'none',
              fontFamily: 'var(--mj-font-heading)',
              letterSpacing: '-0.02em',
            }}
          >
            {agencyName}
          </a>
          {tagline && (
            <p
              style={{
                marginTop: 'var(--mj-space-3)',
                fontSize: 'var(--mj-text-size-sm)',
                color: 'var(--mj-color-text-secondary)',
                lineHeight: 'var(--mj-leading-relaxed)',
                maxWidth: '26ch',
              }}
            >
              {tagline}
            </p>
          )}
        </div>

        {/* Navigation column */}
        <div>
          <h2
            style={{
              fontSize: 'var(--mj-text-size-xs)',
              fontWeight: 'var(--mj-weight-semibold)',
              color: 'var(--mj-color-text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 'var(--mj-space-4)',
            }}
          >
            Navigation
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-2)' }}>
            {FOOTER_NAV.map(item => (
              <li key={item.href}>
                <a
                  href={item.href}
                  style={{
                    fontSize: 'var(--mj-text-size-sm)',
                    color: 'var(--mj-color-text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal column */}
        <div>
          <h2
            style={{
              fontSize: 'var(--mj-text-size-xs)',
              fontWeight: 'var(--mj-weight-semibold)',
              color: 'var(--mj-color-text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 'var(--mj-space-4)',
            }}
          >
            Legal
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-2)' }}>
            {LEGAL_NAV.map(item => (
              <li key={item.href}>
                <a
                  href={item.href}
                  style={{
                    fontSize: 'var(--mj-text-size-sm)',
                    color: 'var(--mj-color-text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <OptOutFooterLink />
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid var(--mj-color-border)',
          padding: 'var(--mj-space-6)',
          maxWidth: 'var(--mj-container-xl)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--mj-space-4)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--mj-text-size-xs)',
            color: 'var(--mj-color-text-tertiary, var(--mj-color-text-secondary))',
            margin: 0,
          }}
        >
          © {year} MJ Agency. All rights reserved.
        </p>
        <p
          style={{
            fontSize: 'var(--mj-text-size-xs)',
            color: 'var(--mj-color-text-tertiary, var(--mj-color-text-secondary))',
            margin: 0,
          }}
        >
          US-based services · English only
        </p>
      </div>
    </footer>
  )
}
