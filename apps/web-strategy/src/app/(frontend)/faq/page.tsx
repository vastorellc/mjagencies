import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Strategy Agency',
  description: 'Common questions about working with MJ Strategy Agency — engagement types, process, costs, and what makes strategy work succeed.',
}

const FAQ_ITEMS = [
  {
    question: 'What strategy engagements do you run?',
    answer: 'Market entry and go-to-market strategy, competitive positioning and differentiation, OKR and performance management design, M&A target analysis and strategic due diligence, and board-level strategy presentations.',
  },
  {
    question: 'How do strategy engagements typically run?',
    answer: 'Most engagements begin with a 4-week diagnostic phase (interviews, market data, competitive mapping), followed by a strategy development phase (4–8 weeks) that produces a decision-ready strategy brief and execution roadmap.',
  },
  {
    question: 'What does a strategy engagement cost?',
    answer: 'Project-based strategy engagements range from $25K (focused positioning sprint) to $150K (full market entry strategy with financial model). Advisory retainers start at $8K/month.',
  },
  {
    question: 'Do you only work with large companies?',
    answer: 'No. Most clients are growth-stage companies ($5M–$100M revenue) at a strategic inflection point — entering a new market, repositioning, preparing for a fundraise, or responding to competitive disruption.',
  },
  {
    question: 'What makes a good strategy engagement?',
    answer: 'The client must be willing to challenge existing assumptions. The best engagements start with "we think X is true about our market" and end with either a strengthened conviction or a corrected belief. We are not hired to confirm what you already believe.',
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
          Everything you need to know about working with MJ Strategy Agency.
        </p>
        <dl style={{ marginTop: 'var(--mj-space-12)' }}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ padding: 'var(--mj-space-6) 0', borderBottom: '1px solid var(--mj-color-border)' }}>
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
