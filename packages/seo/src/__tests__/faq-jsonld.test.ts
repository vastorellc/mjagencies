/**
 * packages/seo/src/__tests__/faq-jsonld.test.ts
 *
 * Unit tests for the FAQPage JSON-LD builder utility (REQ-076).
 * Tests structure correctness and XSS safety.
 */
import { describe, it, expect } from 'vitest'
import { buildFaqJsonLd, serializeFaqJsonLd } from '../plugins/faq-jsonld.js'
import type { FaqItem } from '../plugins/faq-jsonld.js'

// ---------------------------------------------------------------------------
// buildFaqJsonLd
// ---------------------------------------------------------------------------

describe('buildFaqJsonLd', () => {
  it('returns null when passed an empty array', () => {
    expect(buildFaqJsonLd([])).toBeNull()
  })

  it('returns an object with @type: FAQPage for a single FAQ item', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    expect(result).not.toBeNull()
    expect(result?.['@type']).toBe('FAQPage')
  })

  it('includes the correct @context', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    expect(result?.['@context']).toBe('https://schema.org')
  })

  it('mainEntity[0]["@type"] === "Question"', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    const mainEntity = result?.mainEntity as Array<Record<string, unknown>> | undefined
    expect(Array.isArray(mainEntity)).toBe(true)
    expect(mainEntity?.[0]?.['@type']).toBe('Question')
  })

  it('mainEntity[0].acceptedAnswer["@type"] === "Answer"', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    const mainEntity = result?.mainEntity as Array<Record<string, unknown>> | undefined
    const acceptedAnswer = mainEntity?.[0]?.acceptedAnswer as Record<string, unknown> | undefined
    expect(acceptedAnswer?.['@type']).toBe('Answer')
  })

  it('name field on Question matches the input question', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    const mainEntity = result?.mainEntity as Array<Record<string, unknown>> | undefined
    expect(mainEntity?.[0]?.name).toBe('What is X?')
  })

  it('text field on Answer matches the input answer', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const result = buildFaqJsonLd(faqs)
    const mainEntity = result?.mainEntity as Array<Record<string, unknown>> | undefined
    const acceptedAnswer = mainEntity?.[0]?.acceptedAnswer as Record<string, unknown> | undefined
    expect(acceptedAnswer?.text).toBe('X is Y.')
  })

  it('handles multiple FAQ items — mainEntity has correct length', () => {
    const faqs: FaqItem[] = [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
      { question: 'Q3?', answer: 'A3.' },
    ]
    const result = buildFaqJsonLd(faqs)
    const mainEntity = result?.mainEntity as unknown[]
    expect(mainEntity?.length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// serializeFaqJsonLd (XSS safety)
// ---------------------------------------------------------------------------

describe('serializeFaqJsonLd', () => {
  it('serialized output does NOT contain raw < characters', () => {
    const faqs: FaqItem[] = [
      { question: 'What is <script>?', answer: 'It is <dangerous>.' },
    ]
    const jsonLd = buildFaqJsonLd(faqs)!
    const serialized = serializeFaqJsonLd(jsonLd)
    expect(serialized).not.toContain('<')
  })

  it('replaces < with \\u003c for XSS prevention', () => {
    const faqs: FaqItem[] = [
      { question: 'What is <script>?', answer: 'Answer.' },
    ]
    const jsonLd = buildFaqJsonLd(faqs)!
    const serialized = serializeFaqJsonLd(jsonLd)
    expect(serialized).toContain('\\u003c')
  })

  it('produces valid JSON after XSS escape (parseable back to object)', () => {
    const faqs: FaqItem[] = [
      { question: 'What is X?', answer: 'X is Y.' },
    ]
    const jsonLd = buildFaqJsonLd(faqs)!
    const serialized = serializeFaqJsonLd(jsonLd)
    // Should parse without errors and preserve structure
    const parsed = JSON.parse(serialized) as Record<string, unknown>
    expect(parsed['@type']).toBe('FAQPage')
  })

  it('serialized output for clean content is valid JSON with FAQPage type', () => {
    const faqs: FaqItem[] = [{ question: 'What is X?', answer: 'X is Y.' }]
    const jsonLd = buildFaqJsonLd(faqs)!
    const serialized = serializeFaqJsonLd(jsonLd)
    expect(typeof serialized).toBe('string')
    const obj = JSON.parse(serialized) as Record<string, unknown>
    expect(obj['@type']).toBe('FAQPage')
    expect(obj['@context']).toBe('https://schema.org')
  })
})
