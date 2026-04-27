/**
 * packages/seo/src/plugins/faq-jsonld.ts
 *
 * FAQPage JSON-LD builder utility for use in page SSR components (Phase 8).
 * REQ-076: utility exported for Phase 8 page.tsx SSR consumption.
 *
 * PHASE 8 NOTE: buildFaqJsonLd() is called in Phase 8 public page.tsx SSR
 * components to inject <script type="application/ld+json"> into <head>.
 * Phase 6 delivers this utility + the faqs collection/relationship only.
 *
 * XSS prevention: serializeFaqJsonLd() replaces '<' with '<'
 * per Next.js docs [CITED: nextjs.org/docs/app/guides/json-ld] (RESEARCH.md Pattern 9).
 */
import type { WithContext, FAQPage } from 'schema-dts'

export interface FaqItem {
  question: string
  answer: string // plain text (D-09)
}

export function buildFaqJsonLd(faqs: FaqItem[]): WithContext<FAQPage> | null {
  if (!faqs || faqs.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * Serialize FAQPage JSON-LD for safe use in <script type="application/ld+json">.
 * Replaces '<' with '<' to prevent XSS injection.
 * RESEARCH.md Pattern 9 [CITED: nextjs.org/docs/app/guides/json-ld]
 *
 * Called by Phase 8 page.tsx SSR components when injecting structured data into <head>.
 */
export function serializeFaqJsonLd(jsonLd: WithContext<FAQPage>): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c')
}
