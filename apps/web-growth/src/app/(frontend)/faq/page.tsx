import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Growth Agency',
  description: 'Common questions about working with MJ Growth Agency — services, performance measurement, SEO timelines, and minimum engagement budgets.',
}

const FAQ_ITEMS = [
  {
    question: 'What growth marketing services do you offer?',
    answer: 'SEO (technical, content, link acquisition), paid acquisition (Google Ads, Meta, LinkedIn), demand generation (email, webinar, lead magnet), and CRO (A/B testing, landing page optimization, funnel analysis).',
  },
  {
    question: 'How do you measure growth marketing performance?',
    answer: 'Every engagement starts with a North Star metric and 3–5 supporting KPIs. We report weekly on spend efficiency, channel-level CAC, pipeline contribution, and conversion rates — not impressions or vanity metrics.',
  },
  {
    question: 'How long before we see results from SEO?',
    answer: 'Meaningful organic traffic lift typically takes 4–6 months for new content, and 2–3 months for technical SEO fixes already indexed. Paid acquisition works from day one. We always recommend a mixed approach to balance short and long-term returns.',
  },
  {
    question: 'Do you manage paid acquisition in-house or outsource it?',
    answer: 'In-house. Our paid media team manages all campaigns directly. We do not white-label or outsource. You have direct access to all ad accounts at all times.',
  },
  {
    question: 'What is the minimum budget to work with you?',
    answer: 'Retainer-based growth programs start at $6,000/month. This covers strategy, execution, and reporting across 2–3 channels. We recommend $5K+/month in ad spend to generate statistically meaningful data in paid channels.',
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
          Everything you need to know about working with MJ Growth Agency.
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
