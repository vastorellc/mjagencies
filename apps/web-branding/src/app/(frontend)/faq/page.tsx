import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Branding Agency',
  description: 'Common questions about working with MJ Branding Agency — brand identity, timelines, deliverables, and the rebrand process.',
}

const FAQ_ITEMS = [
  {
    question: 'What is included in a full brand identity engagement?',
    answer: 'A full brand system includes brand strategy (positioning, values, voice), visual identity (logo, color palette, typography), brand guidelines document, and key asset production (business cards, letterhead, social templates).',
  },
  {
    question: 'How long does a brand project take?',
    answer: 'Brand strategy and identity for an early-stage company typically takes 6–10 weeks. A full enterprise rebrand including internal rollout runs 12–20 weeks.',
  },
  {
    question: 'Do you handle just logo design?',
    answer: 'We do, but we recommend pairing logo work with at minimum a color system and typography choice. A logo without a coherent system creates inconsistency at scale. Standalone logo projects take 2–4 weeks.',
  },
  {
    question: 'What deliverable formats do we receive?',
    answer: 'All vector files (SVG, AI, EPS), rasterized exports in all standard sizes (PNG at 1×/2×/3×), and where applicable, web fonts or licensed font recommendations. You own all assets outright.',
  },
  {
    question: 'Can you rebrand an established company with existing brand equity?',
    answer: 'Yes — and we approach rebrands differently from ground-up work. We audit what equity is worth preserving before redesigning, and we manage internal alignment to reduce rebrand risk.',
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
          Everything you need to know about working with MJ Branding Agency.
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
