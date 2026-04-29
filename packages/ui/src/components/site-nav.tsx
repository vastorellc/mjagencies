'use client'

import { useState, useCallback } from 'react'
import type React from 'react'
import { Menu, X } from 'lucide-react'

interface SiteNavProps {
  agencyName: string
}

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

export function SiteNav({ agencyName }: SiteNavProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleMenu = useCallback(() => setMenuOpen(v => !v), [])

  return (
    <header
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--mj-color-bg)',
        borderBottom: '1px solid var(--mj-color-border)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--mj-container-xl)',
          margin: '0 auto',
          padding: '0 var(--mj-space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        <a
          href="/"
          aria-label={`${agencyName} — home`}
          style={{
            fontSize: 'var(--mj-text-size-lg)',
            fontWeight: 'var(--mj-weight-bold)',
            color: 'var(--mj-color-text-primary)',
            textDecoration: 'none',
            fontFamily: 'var(--mj-font-heading)',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {agencyName}
        </a>

        {/* Desktop navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex"
          style={{ alignItems: 'center', gap: 'var(--mj-space-1)' }}
        >
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontSize: 'var(--mj-text-size-sm)',
                fontWeight: 'var(--mj-weight-medium)',
                color: 'var(--mj-color-text-secondary)',
                textDecoration: 'none',
                padding: 'var(--mj-space-2) var(--mj-space-3)',
                borderRadius: 'var(--mj-radius-md)',
                transition: 'color 0.15s ease',
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/contact"
            style={{
              marginLeft: 'var(--mj-space-3)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--mj-space-2) var(--mj-space-5)',
              backgroundColor: 'var(--mj-color-brand-500)',
              color: 'var(--mj-color-bg)',
              fontWeight: 'var(--mj-weight-semibold)',
              fontSize: 'var(--mj-text-size-sm)',
              borderRadius: 'var(--mj-radius-md)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Work with us
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={toggleMenu}
          className="flex md:hidden"
          style={{
            background: 'none',
            border: 'none',
            padding: 'var(--mj-space-2)',
            cursor: 'pointer',
            color: 'var(--mj-color-text-primary)',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          {menuOpen ? (
            <X size={24} aria-hidden="true" />
          ) : (
            <Menu size={24} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          id="site-mobile-menu"
          className="md:hidden"
          style={{
            backgroundColor: 'var(--mj-color-bg)',
            borderTop: '1px solid var(--mj-color-border)',
            padding: 'var(--mj-space-4) var(--mj-space-6) var(--mj-space-6)',
          }}
        >
          <nav aria-label="Mobile navigation">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--mj-space-1)' }}>
              {NAV_LINKS.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block',
                      fontSize: 'var(--mj-text-size-base)',
                      fontWeight: 'var(--mj-weight-medium)',
                      color: 'var(--mj-color-text-secondary)',
                      textDecoration: 'none',
                      padding: 'var(--mj-space-3) var(--mj-space-2)',
                      borderRadius: 'var(--mj-radius-md)',
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <a
              href="/contact"
              onClick={() => setMenuOpen(false)}
              style={{
                marginTop: 'var(--mj-space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--mj-space-3) var(--mj-space-6)',
                backgroundColor: 'var(--mj-color-brand-500)',
                color: 'var(--mj-color-bg)',
                fontWeight: 'var(--mj-weight-semibold)',
                fontSize: 'var(--mj-text-size-base)',
                borderRadius: 'var(--mj-radius-md)',
                textDecoration: 'none',
              }}
            >
              Work with us
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
