import type { Metadata } from 'next'
import type React from 'react'
import { buildFaqJsonLd, serializeFaqJsonLd } from '@mjagency/seo'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'FAQ — MJ Graphic Agency',
  description: 'Common questions about working with MJ Graphic Agency — services, file formats, print production, timelines, and brand standards.',
}

const FAQ_ITEMS = [
  {
    question: 'What graphic design services do you offer?',
    answer: 'Print design (brochures, direct mail, trade show materials), packaging design (product boxes, labels, retail packaging), digital graphics (display ads, social templates, infographics), and environmental design (wayfinding, signage, interior wall graphics).',
  },
  {
    question: 'What files do we receive at project completion?',
    answer: 'All print-ready PDFs at correct bleed, slug, and color profile (CMYK/PMS where specified), plus source files in AI or InDesign. For digital, we deliver SVG, PNG at all required resolutions, and where applicable, HTML5 banners.',
  },
  {
    question: 'Can you manage print production and vendor coordination?',
    answer: 'Yes. We maintain relationships with specialty printers for offset, large-format, and specialty finishes (foil, emboss, spot UV). We manage proofing and press-check when high-value print runs warrant it.',
  },
  {
    question: 'How do you handle existing brand standards and guidelines?',
    answer: 'We work within your brand guidelines and flag any constraints before starting. If your guidelines are outdated or ambiguous, we can update them as part of the project scope.',
  },
  {
    question: 'What is your turnaround time for design projects?',
    answer: 'Rush digital assets (social graphics, display ads) turn in 3–5 business days. Packaging design runs 3–5 weeks. Trade show booths and environmental design run 6–10 weeks depending on fabrication requirements.',
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
          Everything you need to know about working with MJ Graphic Agency.
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
