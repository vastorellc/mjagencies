/**
 * packages/cms/src/__tests__/anti-fab-validators.test.ts
 *
 * TDD tests for anti-fabrication publish-gate validators (REQ-082).
 * RED phase — these tests must fail until hooks/anti-fab-validators.ts is created.
 *
 * Covers:
 *   validateStatSources   — unsourced stats block publish
 *   validateQuoteSources  — unsourced quotes block publish
 *   validateNoPlaceholders — placeholder text blocks publish
 *
 * Each validator is tested in two modes:
 *   draft   — returns warnings (does not throw)
 *   publish — throws on violation (blocks publish)
 */
import { describe, it, expect } from 'vitest'
import {
  validateStatSources,
  validateQuoteSources,
  validateNoPlaceholders,
} from '../hooks/anti-fab-validators.js'
import type { CollectionBeforeOperationHook } from 'payload'

/**
 * Minimal hook invocation helper.
 * Copies the callHook helper from content-validators.test.ts.
 */
function callHook(
  hook: CollectionBeforeOperationHook,
  data: Record<string, unknown>,
  operation: 'create' | 'update' = 'update'
) {
  const arg = { args: { data }, operation, req: {} }
  return hook(arg as unknown as Parameters<CollectionBeforeOperationHook>[0])
}

// ---------------------------------------------------------------------------
// validateStatSources (REQ-082)
// ---------------------------------------------------------------------------
describe('validateStatSources (REQ-082)', () => {
  it('passes publish when percentage stat has a citation link within 150 chars', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: 'Click-through rates rose [42%](https://gartner.com/report) last quarter.',
      })
    ).resolves.toBeUndefined()
  })

  it('blocks publish when bare percentage stat has no citation', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: 'Click-through rates rose 42% last quarter.',
      })
    ).rejects.toThrow(/unsourced statistic|stat.*citation|citation.*stat/i)
  })

  it('blocks publish when dollar amount stat has no citation', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: '$1,250 was raised for the campaign.',
      })
    ).rejects.toThrow(/unsourced statistic|stat.*citation|citation.*stat/i)
  })

  it('blocks publish when "N percent" stat has no citation', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: '73 percent of users prefer mobile experiences.',
      })
    ).rejects.toThrow(/unsourced statistic|stat.*citation|citation.*stat/i)
  })

  it('passes publish when content contains a range (30-45%) — ranges are allowed', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: 'Typical results: 30-45% of users see improvement.',
      })
    ).resolves.toBeUndefined()
  })

  it('warns on draft but does not throw when unsourced stat present', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'draft',
        content: 'Click-through rates rose 42% last quarter.',
      })
    ).resolves.toBeUndefined()
  })

  it('passes publish when content contains no stats at all', async () => {
    await expect(
      callHook(validateStatSources, {
        status: 'published',
        content: 'Our agency helps brands grow their online presence through strategic marketing.',
      })
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateQuoteSources (REQ-082)
// ---------------------------------------------------------------------------
describe('validateQuoteSources (REQ-082)', () => {
  it('passes publish when quoted text has attribution within 200 chars', async () => {
    await expect(
      callHook(validateQuoteSources, {
        status: 'published',
        content: '"This was a game-changer," said John Doe (Forbes 2024).',
      })
    ).resolves.toBeUndefined()
  })

  it('blocks publish when quoted text has no attribution or citation', async () => {
    await expect(
      callHook(validateQuoteSources, {
        status: 'published',
        content: '"This was a game-changer," he said.',
      })
    ).rejects.toThrow(/unsourced quote|quote.*attribution|attribution.*200/i)
  })

  it('passes publish when lexical blockquote node has a nearby citation link', async () => {
    const lexicalContent = JSON.stringify({
      root: {
        children: [
          {
            type: 'quote',
            children: [{ text: 'This agency transformed our business entirely.' }],
          },
          { type: 'paragraph', children: [{ text: '[Source: Forbes 2024](https://forbes.com)' }] },
        ],
      },
    })
    await expect(
      callHook(validateQuoteSources, {
        status: 'published',
        content: lexicalContent,
      })
    ).resolves.toBeUndefined()
  })

  it('blocks publish when lexical blockquote node has no citation in surrounding context', async () => {
    const lexicalContent = JSON.stringify({
      root: {
        children: [
          {
            type: 'quote',
            children: [{ text: 'This agency is the best in the world.' }],
          },
        ],
      },
    })
    await expect(
      callHook(validateQuoteSources, {
        status: 'published',
        content: lexicalContent,
      })
    ).rejects.toThrow(/unsourced blockquote|blockquote.*attribution|attribution.*200/i)
  })

  it('warns on draft but does not throw when unsourced quote present', async () => {
    await expect(
      callHook(validateQuoteSources, {
        status: 'draft',
        content: '"This was a game-changer," he said.',
      })
    ).resolves.toBeUndefined()
  })

  it('passes publish when content has no quotes at all', async () => {
    await expect(
      callHook(validateQuoteSources, {
        status: 'published',
        content: 'Our agency helps brands grow their online presence.',
      })
    ).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateNoPlaceholders (REQ-082, CLAUDE.md §5)
// ---------------------------------------------------------------------------
describe('validateNoPlaceholders (REQ-082, CLAUDE.md §5 CONTENT-COMPLETE)', () => {
  it('blocks publish on [insert] placeholder', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Our team at [insert] is dedicated to excellence.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [INSERT] uppercase variant', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Contact [INSERT] for more information.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [insert team name] variant', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'The [insert team name] team will help you.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [TBD] placeholder', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Pricing: [TBD]',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [tbd] lowercase variant', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Launch date [tbd].',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [TODO] placeholder', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: '[TODO] Add case studies here.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on [todo] lowercase variant', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Services section [todo].',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on "Coming soon" phrase', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'New features coming soon to our platform.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on "COMING SOON" uppercase variant', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'COMING SOON: Our new service.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('blocks publish on "Lorem ipsum" placeholder text', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      })
    ).rejects.toThrow(/placeholder/i)
  })

  it('passes publish when content is clean with no placeholders', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'published',
        content: 'Our digital marketing agency delivers measurable results for growing brands.',
      })
    ).resolves.toBeUndefined()
  })

  it('warns on draft but does not throw when placeholder present', async () => {
    await expect(
      callHook(validateNoPlaceholders, {
        status: 'draft',
        content: 'Our team at [insert] is working on this.',
      })
    ).resolves.toBeUndefined()
  })

  it('passes when operation is not create or update', async () => {
    const arg = { args: { data: { status: 'published', content: '[TODO] fix this' } }, operation: 'read', req: {} }
    await expect(
      validateNoPlaceholders(arg as unknown as Parameters<CollectionBeforeOperationHook>[0])
    ).resolves.toBeUndefined()
  })
})
