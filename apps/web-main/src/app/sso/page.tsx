/**
 * apps/web-main/src/app/sso/page.tsx
 *
 * Server component — login form for accounts.brand.com/sso.
 *
 * This is the ONE login surface for all 12 agencies (REQ-026).
 * Agency subdomain apps redirect here with:
 *   ?agency=<slug>&state=<signed-hmac-state>&returnTo=<encoded-url>
 *
 * After the user submits credentials, the form POSTs to /api/auth/login which:
 *   - Validates credentials (dev: env vars; production: 501 until Phase 5)
 *   - If `state` present (SSO flow): creates opaque code → 302 to agency /auth/callback
 *   - If no `state` (direct login): sets cookies → redirect to returnTo
 *
 * Open redirect defense: returnTo is validated server-side inside /api/auth/login
 * (inline same-origin check; Plan 03-06 replaces with validateReturnTo).
 *
 * Node runtime only — server component, no client-side JS required for the login form.
 */

import { notFound } from 'next/navigation'
import { AGENCIES } from '@mjagency/config'

interface SsoPageProps {
  searchParams: Promise<{ agency?: string; state?: string; returnTo?: string }>
}

export default async function SsoPage({ searchParams }: SsoPageProps): Promise<React.ReactElement> {
  const params = await searchParams
  const agency = params.agency
  const state  = params.state
  const returnTo = params.returnTo

  // Validate agency slug — reject unknown slugs with 404
  if (!agency || !(AGENCIES as readonly string[]).includes(agency)) {
    notFound()
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '440px',
        margin: '80px auto',
        padding: '0 24px',
      }}
    >
      <header style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Sign in</h1>
        <p style={{ color: '#666', marginTop: '8px', fontSize: '0.9rem' }}>
          accounts.brand.com &mdash; {agency}
        </p>
      </header>

      <form
        action="/api/auth/login"
        method="POST"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Hidden fields — carry SSO context through form submission */}
        <input type="hidden" name="agency" value={agency} />
        {state    && <input type="hidden" name="state"    value={state} />}
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            style={{
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '1rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '1rem',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '10px 20px',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          Sign in
        </button>
      </form>

      <footer
        style={{
          marginTop: '40px',
          borderTop: '1px solid #e5e7eb',
          paddingTop: '20px',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#9ca3af',
        }}
      >
        <strong>accounts.brand.com</strong>
        <br />
        Secure sign-in for all brand.com agency portals.
      </footer>
    </main>
  )
}
