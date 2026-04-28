import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Agency',
  description: 'Common questions about working with MJ Agency — how the multi-practice model works, engagement structure, industry focus, and pricing.',
}

const FAQ_ITEMS = [
  {
    question: 'What does MJ Agency do differently from a traditional agency?',
    answer: 'We run 11 specialist practices under one roof — AI, branding, ecommerce, engineering, finance, graphic design, growth, product management, strategy, video, and web development. Clients access any combination without managing multiple vendor relationships.',
  },
  {
    question: 'Can I engage one practice without committing to the full agency?',
    answer: 'Yes. You can work with a single vertical (e.g., just branding or just engineering) and add practices over time. There is no bundling requirement.',
  },
  {
    question: 'How do you keep work coordinated across multiple practices?',
    answer: 'Each multi-practice engagement has a dedicated account lead who owns coordination and ensures deliverables across practices are aligned to a single strategy and timeline.',
  },
  {
    question: 'What industries do you serve?',
    answer: 'We work across B2B SaaS, consumer brands, fintech, professional services, and growth-stage startups. Our cross-practice model is most valuable for companies scaling through a major transition — rebrand, product launch, fundraise, or market expansion.',
  },
  {
    question: 'What is the typical size of an MJ Agency engagement?',
    answer: 'Single-practice retainers start at $5,000/month. Full multi-practice programs typically run $20,000–$60,000/month depending on scope and headcount allocation.',
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
          Everything you need to know about working with MJ Agency.
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
