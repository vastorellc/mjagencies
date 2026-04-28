import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Engineering Agency',
  description: 'Common questions about working with MJ Engineering Agency — tech stack, engagement models, process, and project costs.',
}

const FAQ_ITEMS = [
  {
    question: 'What tech stack do you specialize in?',
    answer: 'Our core stack is TypeScript (Next.js + Node.js), Python, PostgreSQL, Redis, and AWS/GCP. We also work with Go for high-throughput services and React Native for mobile. We choose the right tool — not the fashionable one.',
  },
  {
    question: 'Can you augment an existing engineering team rather than own a full project?',
    answer: 'Yes. Staff augmentation is a significant part of our work. We embed engineers at the level your team needs — IC contributor, tech lead, or architecture advisor — on monthly retainer.',
  },
  {
    question: 'What is your software development process?',
    answer: 'We work in 2-week sprints with weekly demos. Every sprint ships something usable. Architecture decisions are documented as ADRs. You have full access to code, CI pipelines, and monitoring dashboards.',
  },
  {
    question: 'How do you handle technical debt and legacy systems?',
    answer: 'We assess technical debt before quoting any new feature work. If the codebase needs structural remediation first, we say so explicitly — we will not build on a foundation that will collapse.',
  },
  {
    question: 'What does a typical engagement cost?',
    answer: 'Project-based work starts at $50K for a production-ready MVP. Retainer-based engineering support starts at $15K/month for a 2-person embedded team. Architecture review engagements start at $8K.',
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
          Everything you need to know about working with MJ Engineering Agency.
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
