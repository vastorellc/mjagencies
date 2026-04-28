import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ AI Agency',
  description: 'Common questions about working with MJ AI Agency — services, process, timelines, data privacy, and AI project scoping.',
}

const FAQ_ITEMS = [
  {
    question: 'What types of AI projects do you build?',
    answer: 'We design and deliver LLM-powered products (chatbots, document processing, knowledge retrieval), agentic automation workflows, and custom ML models. Most clients are B2B companies embedding AI into their core product or internal operations.',
  },
  {
    question: 'Do you work with OpenAI, Anthropic, or open-source models?',
    answer: 'All three. Model selection depends on cost, latency, privacy requirements, and capability. We benchmark alternatives and recommend the best-fit model — not the most popular one.',
  },
  {
    question: 'What is your typical AI project timeline?',
    answer: 'A proof-of-concept agent or LLM integration runs 3–6 weeks. A production-grade AI feature with evals, guardrails, and monitoring typically takes 8–16 weeks.',
  },
  {
    question: 'How do you handle data privacy for AI systems?',
    answer: 'We implement PII redaction before model calls, use enterprise-tier API access with DPA agreements, and can run models locally or on-premises when client data policies require it.',
  },
  {
    question: 'Do you offer AI strategy advisory without a build engagement?',
    answer: 'Yes. Our 2-week AI readiness audit covers your data assets, viable use-cases, build-vs-buy options, and cost projections — delivered as a decision-ready strategy brief.',
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
          Everything you need to know about working with MJ AI Agency.
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
