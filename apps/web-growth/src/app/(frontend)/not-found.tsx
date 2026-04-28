import type React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page not found — MJ Growth Agency',
}

export default function NotFound(): React.ReactElement {
  return (
    <main id="main-content" style={{ padding: 'var(--mj-space-24) var(--mj-space-6)', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'var(--mj-text-size-5xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)' }}>
        Page not found
      </h1>
      <p style={{
        fontSize: 'var(--mj-text-size-base)',
        color: 'var(--mj-color-text-secondary)',
        marginTop: 'var(--mj-space-4)',
        maxWidth: '40ch',
        margin: 'var(--mj-space-4) auto 0',
      }}>
        We could not find the page you were looking for. Return to the home page or use the navigation above.
      </p>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginTop: 'var(--mj-space-8)',
          padding: 'var(--mj-space-4) var(--mj-space-6)',
          backgroundColor: 'var(--mj-color-brand-500)',
          color: 'var(--mj-color-bg)',
          borderRadius: 'var(--mj-radius-md)',
          textDecoration: 'none',
          fontWeight: 'var(--mj-weight-semibold)',
        }}
      >
        Return home
      </a>
    </main>
  )
}
