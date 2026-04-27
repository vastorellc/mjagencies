/**
 * packages/cms/src/__tests__/ai-disclosure.test.ts
 *
 * TDD tests for AI content ratio compute + disclosure flag (REQ-086, REQ-409).
 * RED phase — these tests must fail until hooks/ai-disclosure.ts is created.
 *
 * Covers:
 *   computeAiContentRatio — calculates ai_content_ratio on data
 *   AI_DISCLOSURE_THRESHOLD constant — must equal 0.70
 *
 * Dynamic denominator: counts only populated tracked fields
 * (title, content, meta_description, aio_tldr) present in data.
 */
import { describe, it, expect } from 'vitest'
import { computeAiContentRatio, AI_DISCLOSURE_THRESHOLD } from '../hooks/ai-disclosure.js'
import type { CollectionBeforeOperationHook } from 'payload'

/**
 * Minimal hook invocation helper — same as content-validators.test.ts callHook.
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
// computeAiContentRatio (REQ-086, REQ-409)
// ---------------------------------------------------------------------------
describe('computeAiContentRatio (REQ-086, REQ-409)', () => {
  it('sets ai_content_ratio = 1.0 and ai_disclosure_required = true when all 3 populated tracked fields are AI-generated', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content here.',
      meta_description: 'A description.',
      // aio_tldr is absent — not populated
      ai_generated_fields: ['title', 'content', 'meta_description'],
    }
    await callHook(computeAiContentRatio, data)
    expect(data['ai_content_ratio']).toBe(1)
    expect(data['ai_disclosure_required']).toBe(true)
  })

  it('sets ai_content_ratio = 0.5 and ai_disclosure_required = false when 2 of 4 populated tracked fields are AI-generated', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content here.',
      meta_description: 'A description.',
      aio_tldr: 'Short summary.',
      ai_generated_fields: ['title', 'content'],
    }
    await callHook(computeAiContentRatio, data)
    expect(data['ai_content_ratio']).toBe(0.5)
    expect(data['ai_disclosure_required']).toBe(false)
  })

  it('sets ai_disclosure_required = false when ratio is below 0.70 threshold (2 of 3 = 0.667)', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content here.',
      meta_description: 'A description.',
      // aio_tldr absent — only 3 populated
      ai_generated_fields: ['title', 'content'],
    }
    await callHook(computeAiContentRatio, data)
    // 2/3 = 0.667 — below 0.70 threshold
    expect(data['ai_content_ratio']).toBeCloseTo(0.667, 2)
    expect(data['ai_disclosure_required']).toBe(false)
  })

  it('sets ai_content_ratio = 0 and ai_disclosure_required = false when ai_generated_fields is empty', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content here.',
      meta_description: 'A description.',
      aio_tldr: 'Short summary.',
      ai_generated_fields: [],
    }
    await callHook(computeAiContentRatio, data)
    expect(data['ai_content_ratio']).toBe(0)
    expect(data['ai_disclosure_required']).toBe(false)
  })

  it('uses denominator of at least 1 when no tracked fields are populated (guards against division by zero)', async () => {
    const data: Record<string, unknown> = {
      // None of the tracked fields: title, content, meta_description, aio_tldr
      slug: 'some-slug',
      status: 'draft',
      ai_generated_fields: [],
    }
    await callHook(computeAiContentRatio, data)
    expect(data['ai_content_ratio']).toBe(0)
    expect(data['ai_disclosure_required']).toBe(false)
  })

  it('sets ai_disclosure_required = true when ratio exactly exceeds 0.70 (3 of 4 = 0.75)', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content here.',
      meta_description: 'A description.',
      aio_tldr: 'Short summary.',
      ai_generated_fields: ['title', 'content', 'meta_description'],
    }
    await callHook(computeAiContentRatio, data)
    // 3/4 = 0.75 > 0.70 threshold
    expect(data['ai_content_ratio']).toBe(0.75)
    expect(data['ai_disclosure_required']).toBe(true)
  })

  it('does not run on non-create/update operations', async () => {
    const data: Record<string, unknown> = {
      title: 'Some Title',
      content: 'Some content.',
      ai_generated_fields: ['title', 'content'],
    }
    const arg = { args: { data }, operation: 'read', req: {} }
    await computeAiContentRatio(arg as unknown as Parameters<CollectionBeforeOperationHook>[0])
    // Should not mutate data
    expect(data['ai_content_ratio']).toBeUndefined()
    expect(data['ai_disclosure_required']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AI_DISCLOSURE_THRESHOLD constant
// ---------------------------------------------------------------------------
describe('AI_DISCLOSURE_THRESHOLD constant', () => {
  it('AI_DISCLOSURE_THRESHOLD equals 0.70 (REQ-086)', () => {
    expect(AI_DISCLOSURE_THRESHOLD).toBe(0.70)
  })
})
