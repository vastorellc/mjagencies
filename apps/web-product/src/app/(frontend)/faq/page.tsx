import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Product Agency',
  description: 'Common questions about working with MJ Product Agency — fractional CPO services, discovery, roadmap prioritization, and engagement structure.',
}

const FAQ_ITEMS = [
  {
    question: 'What does a fractional CPO engagement look like?',
    answer: 'A fractional CPO leads your product function at 25–50% of full-time capacity. That includes owning the product roadmap, running discovery with customers, managing engineering-design-product alignment, and reporting to leadership on product strategy.',
  },
  {
    question: 'At what stage does fractional product leadership make sense?',
    answer: 'Most commonly between Seed and Series B — when a founding team has built an initial product but lacks the dedicated product leadership to scale it. Also common post-Series B when a company wants to upgrade product capability before a Series C.',
  },
  {
    question: 'Can you run user research and discovery for our team?',
    answer: 'Yes. We conduct user interviews, usability studies, Jobs-to-be-Done analysis, and competitive audits — then synthesize findings into prioritized opportunity maps your team can act on.',
  },
  {
    question: 'How do you approach roadmap prioritization?',
    answer: 'We use an impact-effort-confidence scoring framework calibrated to your business model and constraints. We present tradeoffs explicitly — no magic quadrant theater. Priority calls are yours; our job is to surface the right information.',
  },
  {
    question: 'Do you embed within our existing team or operate independently?',
    answer: 'We embed. Your engineering, design, and data teams report to or collaborate directly with our product lead. We avoid shadow roadmaps — alignment is the product.',
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
          Everything you need to know about working with MJ Product Agency.
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
