import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Video Agency',
  description: 'Common questions about working with MJ Video Agency — production types, what is included, timelines, music licensing, and retainer programs.',
}

const FAQ_ITEMS = [
  {
    question: 'What types of video do you produce?',
    answer: 'Brand films and company stories, product demonstrations and feature walkthroughs, social-first short-form video (Reels, TikTok, YouTube Shorts), event and conference coverage, documentary series, and motion graphics and animated explainers.',
  },
  {
    question: 'What does a brand film engagement include?',
    answer: 'Pre-production (creative brief, scripting, storyboard, location scouting, talent casting), production (full crew, direction, cinematography), and post-production (editing, color grading, sound design, music licensing). Deliverables include platform-optimized cut-downs.',
  },
  {
    question: 'How long does a typical project take?',
    answer: 'A product demo or social video batch (5–10 assets) takes 2–4 weeks. A brand film takes 6–10 weeks. A documentary series or multi-episode campaign takes 12–20 weeks from pre-production to delivery.',
  },
  {
    question: 'Do you own the music or do we need separate licensing?',
    answer: 'We license music through industry-standard libraries with full commercial rights, included in the project quote. Custom music composition is available for brand films requiring a unique sonic identity.',
  },
  {
    question: 'Can you produce content on an ongoing retainer basis?',
    answer: 'Yes. Monthly retainer video programs are designed for brands that need consistent social content or regular product update videos. Retainers start at $5,000/month for a fixed monthly deliverable volume.',
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
          Everything you need to know about working with MJ Video Agency.
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
