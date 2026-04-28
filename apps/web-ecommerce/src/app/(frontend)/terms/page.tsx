import type { Metadata } from 'next'
import type React from 'react'

export const metadata: Metadata = {
  title: 'Terms of Service — MJ Ecommerce Agency',
  robots: { index: false },
}

export default function TermsPage(): React.ReactElement {
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
          Terms of Service
        </h1>
        <p style={{ color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-2)' }}>
          Last updated: January 1, 2026
        </p>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>
            Services
          </h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            MJ Ecommerce Agency provides ecommerce consulting, Shopify development, conversion rate optimization, and paid acquisition management services under the terms of a separately executed Statement of Work (SOW). These Terms of Service govern use of our website and general engagement inquiries.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>
            Intellectual Property
          </h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            All content on this website — including text, graphics, logos, and code — is owned by MJ Ecommerce Agency or its content suppliers and is protected by US and international copyright laws. You may not reproduce, distribute, or create derivative works without written permission.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>
            Limitation of Liability
          </h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            MJ Ecommerce Agency shall not be liable for any indirect, incidental, special, or consequential damages arising from use of our website or services. Our total liability for any claim arising from these terms shall not exceed the fees paid for the specific service giving rise to the claim.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>
            Governing Law
          </h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            These terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of Delaware.
          </p>
        </section>
        <section style={{ marginTop: 'var(--mj-space-8)' }}>
          <h2 style={{ fontSize: 'var(--mj-text-size-2xl)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)', marginBottom: 'var(--mj-space-4)' }}>
            Contact
          </h2>
          <p style={{ color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
            Questions about these terms? Email legal@ecommerce.mjagency.com
          </p>
        </section>
      </main>
    </>
  )
}
