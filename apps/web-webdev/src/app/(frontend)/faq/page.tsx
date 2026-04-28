import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Web Dev Agency',
  description: 'Common questions about working with MJ Web Dev Agency — services, tech stack, web performance, project scope, and pricing.',
}

const FAQ_ITEMS = [
  {
    question: 'What web development services do you offer?',
    answer: 'Custom marketing sites and landing pages, headless CMS implementations (Payload, Contentful, Sanity), Next.js web applications, e-commerce builds (Shopify, WooCommerce, headless), web performance optimization, and WCAG 2.2 AA accessibility remediation.',
  },
  {
    question: 'What technology stack do you build on?',
    answer: 'Next.js 15 with TypeScript, Payload CMS or other headless CMS, PostgreSQL, Tailwind CSS or custom design tokens, and Cloudflare for CDN and edge functions. We do not use page builders — everything is built to production-code standards.',
  },
  {
    question: 'How do you approach web performance?',
    answer: 'Performance is designed in, not added at the end. We target LCP under 1.8s and CLS of 0, enforced in CI via Lighthouse. Images use AVIF delivery with blur-up placeholders. We instrument Core Web Vitals from day one.',
  },
  {
    question: 'Do you build websites or web applications?',
    answer: 'Both. Marketing sites, documentation portals, and content-heavy headless CMS builds are our bread-and-butter. We also build SaaS front-ends, dashboards, and product web apps requiring authentication, real-time data, and complex state.',
  },
  {
    question: 'What does a typical web project cost?',
    answer: 'A marketing site with CMS integration runs $15K–$40K depending on page count and custom functionality. A full web application starts at $50K. Web performance optimization engagements start at $8K.',
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
          Everything you need to know about working with MJ Web Dev Agency.
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
