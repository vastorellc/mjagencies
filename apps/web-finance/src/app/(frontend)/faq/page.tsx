import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Finance Agency',
  description: 'Common questions about working with MJ Finance Agency — fractional CFO services, fundraising support, financial modeling, and engagement structure.',
}

const FAQ_ITEMS = [
  {
    question: 'What does a fractional CFO actually do for our company?',
    answer: 'A fractional CFO owns your financial function without the full-time cost. That includes monthly close oversight, board reporting, cash runway modeling, pricing analysis, and preparing you for fund raises or due diligence.',
  },
  {
    question: 'At what stage does a company typically engage a fractional CFO?',
    answer: 'Most clients engage us between Series A and Series C, or at $1M–$20M ARR when the complexity exceeds what a bookkeeper or controller can handle but a full-time CFO is not yet justified.',
  },
  {
    question: 'Can you help us prepare for a fundraise?',
    answer: 'Yes. Fundraise preparation is a core service: investor materials (deck, data room), financial model build-out with 3-year projections, cap table cleanup, and management Q&A coaching.',
  },
  {
    question: 'How long is a typical fractional CFO engagement?',
    answer: 'Most clients retain us for 12–24 months. Initial engagements begin with a 6-week financial audit to establish a baseline before we take on ongoing responsibilities.',
  },
  {
    question: 'Do you work alongside an existing bookkeeper or controller?',
    answer: 'Yes. We layer onto your existing finance team. We set the strategy and own the board and investor relationship; your bookkeeper or controller handles day-to-day transaction processing.',
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
          Everything you need to know about working with MJ Finance Agency.
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
