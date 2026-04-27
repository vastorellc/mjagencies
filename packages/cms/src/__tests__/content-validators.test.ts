/**
 * packages/cms/src/__tests__/content-validators.test.ts
 *
 * Unit tests for content validators (CLAUDE.md §10).
 * Covers REQ-201 (word count floors), REQ-203 (internal links),
 * REQ-205/REQ-411 (playbook ranges), REQ-207/REQ-410 (FTC composite disclaimer),
 * REQ-421 (FTC testimonial), REQ-412 (is_composite_playbook validation).
 *
 * Each validator is tested in two modes:
 *   draft  — returns warnings (does not throw)
 *   publish — throws on violation (blocks publish)
 *
 * Validators are Payload CollectionBeforeOperationHook — signature:
 *   async ({ args, operation }) => void
 *
 * We call them with a synthetic hook args shape:
 *   { args: { data: { ...fields } }, operation: 'update', req: {} }
 */
import { describe, it, expect } from 'vitest'
import {
  validateWordCount,
  validateInternalLinks,
  validatePlaybookNumbers,
  validateFtcDisclaimer,
  validateFtcTestimonial,
  validateAioTldr,
  FTC_DISCLAIMER_TEXT,
  FTC_TESTIMONIAL_DISCLAIMER,
} from '../hooks/content-validators.js'
import type { CollectionBeforeOperationHook } from 'payload'

/**
 * Minimal hook invocation helper.
 * Payload's CollectionBeforeOperationHook has a deeply-generic arg type tied to collection slugs.
 * We cast via unknown to pass a minimal synthetic arg — the hook implementations only access
 * `args.data` and `operation`, so this is safe for unit testing.
 */
function callHook(
  hook: CollectionBeforeOperationHook,
  data: Record<string, unknown>,
  operation: 'create' | 'update' = 'update'
) {
  const arg = { args: { data }, operation, req: {} }
  return hook(arg as unknown as Parameters<CollectionBeforeOperationHook>[0])
}

/** Repeat a word n times to generate body text */
function words(n: number): string {
  return 'word '.repeat(n).trim()
}

// ---------------------------------------------------------------------------
// validateWordCount (REQ-201)
// ---------------------------------------------------------------------------
describe('validateWordCount (REQ-201)', () => {
  it('blocks publish when blog content is below 1500 words', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'published',
        page_type: 'blog',
        content: words(100),
      })
    ).rejects.toThrow(/word count.*\b100\b.*1500|below.*required.*1500/i)
  })

  it('blocks publish when service page is below 1500 words', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'published',
        page_type: 'service',
        content: words(500),
      })
    ).rejects.toThrow(/1500/i)
  })

  it('blocks publish when tool page is below 2200 words', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'published',
        page_type: 'tool',
        content: words(2000),
      })
    ).rejects.toThrow(/2200/i)
  })

  it('passes publish when blog content meets 1500-word floor', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'published',
        page_type: 'blog',
        content: words(1600),
      })
    ).resolves.toBeUndefined()
  })

  it('passes publish when tool content meets 2200-word floor', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'published',
        page_type: 'tool',
        content: words(2250),
      })
    ).resolves.toBeUndefined()
  })

  it('does not throw on draft status even if below floor', async () => {
    await expect(
      callHook(validateWordCount, {
        status: 'draft',
        page_type: 'blog',
        content: 'short',
      })
    ).resolves.toBeUndefined()
  })

  it('skips non-create/update operations (read)', async () => {
    await expect(
      callHook(validateWordCount, { status: 'published', content: words(10) }, 'create')
    ).rejects.toThrow() // create + published + short → should throw
  })
})

// ---------------------------------------------------------------------------
// validateInternalLinks (REQ-203)
// ---------------------------------------------------------------------------
describe('validateInternalLinks (REQ-203)', () => {
  it('blocks publish when fewer than 3 internal links present', async () => {
    await expect(
      callHook(validateInternalLinks, {
        status: 'published',
        content: 'href="/a" href="/b"',
      })
    ).rejects.toThrow(/internal link/i)
  })

  it('passes when exactly 3 internal links are present', async () => {
    await expect(
      callHook(validateInternalLinks, {
        status: 'published',
        content: 'href="/a" href="/b" href="/c"',
      })
    ).resolves.toBeUndefined()
  })

  it('passes when more than 3 internal links are present', async () => {
    await expect(
      callHook(validateInternalLinks, {
        status: 'published',
        content: 'href="/a" href="/b" href="/c" href="/d"',
      })
    ).resolves.toBeUndefined()
  })

  it('does not count external links as internal links', async () => {
    await expect(
      callHook(validateInternalLinks, {
        status: 'published',
        // 2 internal + 2 external = should still fail (< 3 internal)
        content: 'href="/a" href="/b" href="https://example.com" href="https://google.com"',
      })
    ).rejects.toThrow(/internal link/i)
  })

  it('does not throw on draft status', async () => {
    await expect(
      callHook(validateInternalLinks, {
        status: 'draft',
        content: 'only one href="/link"',
      })
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validatePlaybookNumbers (REQ-205, REQ-411)
// ---------------------------------------------------------------------------
describe('validatePlaybookNumbers (REQ-205, REQ-411)', () => {
  it('blocks publish when composite playbook contains exact percentage', async () => {
    await expect(
      callHook(validatePlaybookNumbers, {
        is_composite_playbook: true,
        status: 'published',
        content: 'We achieved 47% growth in Q4.',
      })
    ).rejects.toThrow(/range|exact/i)
  })

  it('passes when numbers are expressed as ranges (e.g. 30-45%)', async () => {
    await expect(
      callHook(validatePlaybookNumbers, {
        is_composite_playbook: true,
        status: 'published',
        content: 'Typical results: 30-45% improvement.',
      })
    ).resolves.toBeUndefined()
  })

  it('does not enforce range rule on non-playbook pages', async () => {
    await expect(
      callHook(validatePlaybookNumbers, {
        is_composite_playbook: false,
        status: 'published',
        content: 'Customer X grew 47%',
      })
    ).resolves.toBeUndefined()
  })

  it('does not enforce rule on draft status', async () => {
    await expect(
      callHook(validatePlaybookNumbers, {
        is_composite_playbook: true,
        status: 'draft',
        content: 'We achieved 47% growth.',
      })
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateFtcDisclaimer (REQ-207, REQ-410, REQ-412)
// ---------------------------------------------------------------------------
describe('validateFtcDisclaimer (REQ-207, REQ-410)', () => {
  it('blocks publish on composite playbook without FTC disclaimer', async () => {
    await expect(
      callHook(validateFtcDisclaimer, {
        is_composite_playbook: true,
        status: 'published',
        content: 'Lots of impressive results without disclaimer.',
      })
    ).rejects.toThrow(/FTC|disclaimer/i)
  })

  it('passes publish when content contains "Results not typical" FTC disclaimer text', async () => {
    await expect(
      callHook(validateFtcDisclaimer, {
        is_composite_playbook: true,
        status: 'published',
        content: `Body content here. ${FTC_DISCLAIMER_TEXT}`,
      })
    ).resolves.toBeUndefined()
  })

  it('does not enforce disclaimer on non-playbook pages', async () => {
    await expect(
      callHook(validateFtcDisclaimer, {
        is_composite_playbook: false,
        status: 'published',
        content: 'no disclaimer needed',
      })
    ).resolves.toBeUndefined()
  })

  it('does not enforce disclaimer on draft status', async () => {
    await expect(
      callHook(validateFtcDisclaimer, {
        is_composite_playbook: true,
        status: 'draft',
        content: 'Lots of results, no disclaimer yet.',
      })
    ).resolves.toBeUndefined()
  })

  it('FTC_DISCLAIMER_TEXT matches spec exactly (REQ-207, REQ-410)', () => {
    expect(FTC_DISCLAIMER_TEXT).toBe(
      'Results not typical. Individual results may vary based on market conditions, industry, and individual effort.'
    )
  })
})

// ---------------------------------------------------------------------------
// validateFtcTestimonial (REQ-421)
// ---------------------------------------------------------------------------
describe('validateFtcTestimonial (REQ-421)', () => {
  it('blocks publish when page has testimonial block flag without FTC testimonial disclaimer', async () => {
    await expect(
      callHook(validateFtcTestimonial, {
        status: 'published',
        hasTestimonials: true,
        content: '"Best agency ever!" — Jane Doe',
      })
    ).rejects.toThrow(/testimonial/i)
  })

  it('passes publish when testimonial block includes the required disclosure', async () => {
    await expect(
      callHook(validateFtcTestimonial, {
        status: 'published',
        hasTestimonials: true,
        content: `"Best agency ever!" — Jane Doe. ${FTC_TESTIMONIAL_DISCLAIMER}`,
      })
    ).resolves.toBeUndefined()
  })

  it('passes when no testimonial block is present', async () => {
    await expect(
      callHook(validateFtcTestimonial, {
        status: 'published',
        hasTestimonials: false,
        content: 'Regular page content',
      })
    ).resolves.toBeUndefined()
  })

  it('blocks when content contains testimonials-grid block type without disclaimer', async () => {
    await expect(
      callHook(validateFtcTestimonial, {
        status: 'published',
        content: JSON.stringify({ type: 'testimonials-grid', items: ['Great!'] }),
      })
    ).rejects.toThrow(/testimonial/i)
  })

  it('passes when testimonials-grid block has the disclaimer in content', async () => {
    await expect(
      callHook(validateFtcTestimonial, {
        status: 'published',
        content: JSON.stringify({
          type: 'testimonials-grid',
          items: ['Great!'],
          disclaimer: 'Individual results may vary.',
        }),
      })
    ).resolves.toBeUndefined()
  })

  it('FTC_TESTIMONIAL_DISCLAIMER matches spec exactly (REQ-421)', () => {
    expect(FTC_TESTIMONIAL_DISCLAIMER).toBe(
      'Individual results may vary. Testimonials are not necessarily representative of all users.'
    )
  })
})

// ---------------------------------------------------------------------------
// validateAioTldr (REQ-075)
// ---------------------------------------------------------------------------
describe('validateAioTldr', () => {
  // Helper: build hook args matching Payload CollectionBeforeOperationHook shape
  const makeArgs = (data: Record<string, unknown>, operation: string) => ({
    args: { data },
    operation,
  })

  it('throws when aio_tldr is blank and status is published', async () => {
    await expect(
      validateAioTldr(makeArgs({ status: 'published', aio_tldr: '' }, 'update') as never)
    ).rejects.toThrow('AIO TL;DR is required')
  })

  it('throws when aio_tldr exceeds 120 characters and status is published', async () => {
    const longTldr = 'a'.repeat(121)
    await expect(
      validateAioTldr(makeArgs({ status: 'published', aio_tldr: longTldr }, 'update') as never)
    ).rejects.toThrow('AIO TL;DR must be ≤120 characters')
  })

  it('does not throw when status is draft (aio_tldr enforcement skipped)', async () => {
    await expect(
      validateAioTldr(makeArgs({ status: 'draft', aio_tldr: '' }, 'update') as never)
    ).resolves.toBeUndefined()
  })

  it('does not throw when aio_tldr is exactly 120 characters and status is published', async () => {
    const exactTldr = 'a'.repeat(120)
    await expect(
      validateAioTldr(makeArgs({ status: 'published', aio_tldr: exactTldr }, 'update') as never)
    ).resolves.toBeUndefined()
  })
})
