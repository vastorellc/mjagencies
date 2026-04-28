import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Ecommerce Agency',
  description: 'Answers to the most common questions about working with MJ Ecommerce Agency — services, pricing, timelines, and process.',
}

const FAQ_ITEMS = [
  {
    question: 'What types of ecommerce projects do you specialize in?',
    answer: 'We specialize in Shopify development (custom themes, Shopify Plus, headless storefronts), conversion rate optimization (CRO), and performance paid acquisition for ecommerce brands doing between $500K and $50M in annual revenue.',
  },
  {
    question: 'How long does a typical Shopify build take?',
    answer: 'A standard Shopify theme takes 6–10 weeks from kickoff to launch. A headless/Next.js storefront takes 10–16 weeks. Shopify Plus enterprise migrations typically run 12–20 weeks depending on complexity.',
  },
  {
    question: 'Do you offer CRO audits without a full engagement?',
    answer: 'Yes. Our standalone CRO audit (heatmaps, session recordings, funnel analysis, UX review) takes 2 weeks and produces a prioritized 30-item improvement backlog with estimated revenue impact per fix.',
  },
  {
    question: 'What is your typical retainer structure?',
    answer: 'Retainers start at $8,000/month for ongoing growth support (paid acquisition management + CRO testing). Full-service retainers including development sprint work start at $15,000/month.',
  },
  {
    question: 'Do you work with brands outside the US?',
    answer: 'Our primary focus is US-based ecommerce brands. We can support international brands with US-targeted campaigns and storefront builds, but regulatory compliance for non-US markets is the client\'s responsibility.',
  },
]

export default function FaqPage(): React.ReactElement {
  const faqJsonLd = buildFaqJsonLd(FAQ_ITEMS)

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeFaqJsonLd(faqJsonLd) }}
        />
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        style={{ padding: 'var(--mj-space-2) var(--mj-space-4)', backgroundColor: 'var(--mj-color-bg)', outline: '2px solid var(--mj-color-border-focus)', color: 'var(--mj-color-text-primary)' }}
      >
        Skip to main content
      </a>
      <main id="main-content" style={{ padding: 'var(--mj-space-16) var(--mj-space-6)', maxWidth: '800px' }}>
        <h1 style={{ fontSize: 'var(--mj-text-size-4xl)', fontWeight: 'var(--mj-weight-bold)', color: 'var(--mj-color-text-primary)', fontFamily: 'var(--mj-font-heading)' }}>
          Frequently Asked Questions
        </h1>
        <p style={{ fontSize: 'var(--mj-text-size-lg)', color: 'var(--mj-color-text-secondary)', marginTop: 'var(--mj-space-4)' }}>
          Everything you need to know about working with MJ Ecommerce Agency.
        </p>
        <dl style={{ marginTop: 'var(--mj-space-12)' }}>
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={i}
              style={{ padding: 'var(--mj-space-6) 0', borderBottom: '1px solid var(--mj-color-border)' }}
            >
              <dt style={{ fontSize: 'var(--mj-text-size-lg)', fontWeight: 'var(--mj-weight-semibold)', color: 'var(--mj-color-text-primary)' }}>
                {item.question}
              </dt>
              <dd style={{ marginTop: 'var(--mj-space-3)', color: 'var(--mj-color-text-secondary)', lineHeight: 'var(--mj-leading-relaxed)' }}>
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
        <p style={{ marginTop: 'var(--mj-space-12)', color: 'var(--mj-color-text-secondary)' }}>
          Still have questions?{' '}
          <a href="/contact" style={{ color: 'var(--mj-color-brand-500)', fontWeight: 'var(--mj-weight-medium)' }}>
            Contact us
          </a>
          {' '}and we will get back to you within one business day.
        </p>
      </main>
    </>
  )
}
