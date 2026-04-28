import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Privacy Policy — MJ Growth Agency',
  robots: { index: false },
}

export default function PrivacyPage(): React.ReactElement {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '800px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>Last updated: January 1, 2026</p>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Information We Collect</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            MJ Growth Agency collects information you provide directly, including name, email address, and project details via our contact form. We also collect analytics data to improve our website.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>Your Rights</h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            You may request access, correction, or deletion of your personal data by emailing privacy@growth.mjagency.com. We will respond within 30 days.
          </p>
        </section>
      </main>
    </>
  )
}
