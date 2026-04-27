/**
 * apps/web-main/src/app/(payload)/admin/email-setup/page.tsx
 *
 * Admin-only email DNS setup wizard.
 * Validates DKIM/SPF/DMARC for a given domain and renders pass/fail.
 *
 * SC-4: DKIM/SPF/DMARC validates in setup wizard.
 * REQ-112 (DKIM/SPF/DMARC validation), REQ-414 (email setup wizard)
 */
import { requireSession } from '@mjagency/auth'
import { validateDkim, validateSpf, validateDmarc } from '@mjagency/email'
import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Email DNS Setup — MJ Agency Admin',
}

interface PageProps {
  searchParams: Promise<{ domain?: string }>
}

export default async function EmailSetupPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  await requireSession()

  const { domain } = await searchParams
  const cleanDomain = domain?.trim().toLowerCase() ?? ''

  let dkim: Awaited<ReturnType<typeof validateDkim>> | null = null
  let spf: Awaited<ReturnType<typeof validateSpf>> | null = null
  let dmarc: Awaited<ReturnType<typeof validateDmarc>> | null = null

  if (cleanDomain) {
    ;[dkim, spf, dmarc] = await Promise.all([
      validateDkim(cleanDomain),
      validateSpf(cleanDomain),
      validateDmarc(cleanDomain),
    ])
  }

  const checks: Array<{ label: string; result: Awaited<ReturnType<typeof validateDkim>> | null }> = [
    { label: 'DKIM', result: dkim },
    { label: 'SPF', result: spf },
    { label: 'DMARC', result: dmarc },
  ]

  return (
    <main style={{ padding: 'var(--mj-space-8)', maxWidth: '640px' }}>
      <h1
        style={{
          fontSize: 'var(--mj-text-size-2xl)',
          fontWeight: 'var(--mj-weight-bold)',
          color: 'var(--mj-color-text-primary)',
        }}
      >
        Email DNS Setup
      </h1>
      <form
        method="get"
        style={{ marginTop: 'var(--mj-space-6)', display: 'flex', gap: 'var(--mj-space-3)' }}
      >
        <input
          name="domain"
          type="text"
          defaultValue={cleanDomain}
          placeholder="yourdomain.com"
          aria-label="Domain to validate"
          style={{
            flex: 1,
            padding: 'var(--mj-space-2) var(--mj-space-3)',
            borderRadius: 'var(--mj-radius-md)',
            border: '1px solid var(--mj-color-border)',
            fontSize: 'var(--mj-text-size-base)',
          }}
        />
        <button
          type="submit"
          style={{
            padding: 'var(--mj-space-2) var(--mj-space-4)',
            backgroundColor: 'var(--mj-color-brand-500)',
            color: '#fff',
            borderRadius: 'var(--mj-radius-md)',
            border: 'none',
            fontWeight: 'var(--mj-weight-medium)',
            cursor: 'pointer',
          }}
        >
          Check
        </button>
      </form>

      {cleanDomain && (
        <ul
          style={{
            marginTop: 'var(--mj-space-8)',
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mj-space-4)',
          }}
        >
          {checks.map(({ label, result }) => (
            <li
              key={label}
              style={{
                padding: 'var(--mj-space-4)',
                borderRadius: 'var(--mj-radius-md)',
                border: `1px solid ${result?.valid ? 'var(--mj-color-success)' : 'var(--mj-color-error)'}`,
                backgroundColor: 'var(--mj-color-bg-secondary)',
              }}
            >
              <strong
                style={{
                  color: result?.valid
                    ? 'var(--mj-color-success)'
                    : 'var(--mj-color-error)',
                }}
              >
                {result?.valid ? '[PASS]' : '[FAIL]'} {label}
              </strong>
              {result?.record && (
                <code
                  style={{
                    display: 'block',
                    marginTop: 'var(--mj-space-2)',
                    fontSize: 'var(--mj-text-size-sm)',
                    wordBreak: 'break-all',
                    color: 'var(--mj-color-text-secondary)',
                  }}
                >
                  {result.record}
                </code>
              )}
              {!result?.valid && result?.error && (
                <p
                  style={{
                    marginTop: 'var(--mj-space-2)',
                    color: 'var(--mj-color-text-secondary)',
                    fontSize: 'var(--mj-text-size-sm)',
                  }}
                >
                  {result.error}
                </p>
              )}
              {!result?.valid && !result?.error && (
                <p
                  style={{
                    marginTop: 'var(--mj-space-2)',
                    color: 'var(--mj-color-text-secondary)',
                    fontSize: 'var(--mj-text-size-sm)',
                  }}
                >
                  No {label} record found for {cleanDomain}.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
