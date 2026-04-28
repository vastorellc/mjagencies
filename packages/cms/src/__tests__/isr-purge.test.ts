/**
 * packages/cms/src/__tests__/isr-purge.test.ts
 *
 * Unit tests for ISR cache purge hooks (REQ-091).
 * Verifies that revalidateTag is called with the correct tag format
 * and that guards prevent calls when agency_id or slug are absent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache before importing the hook
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { revalidateTag } from 'next/cache'
import { isrPurgeHook, isrPurgePostHook } from '../hooks/isr-purge.js'

const mockRevalidateTag = vi.mocked(revalidateTag)

/** Minimal arg builder — only doc matters for the hooks; rest are cast stubs */
function pageArg(doc: Record<string, unknown>): Parameters<typeof isrPurgeHook>[0] {
  return {
    doc,
    collection: {} as never,
    req: {} as never,
    context: {},
    data: {},
    previousDoc: null,
    operation: 'update',
  }
}

function postArg(doc: Record<string, unknown>, op: 'create' | 'update' = 'update'): Parameters<typeof isrPurgePostHook>[0] {
  return {
    doc,
    collection: {} as never,
    req: {} as never,
    context: {},
    data: {},
    previousDoc: null,
    operation: op,
  }
}

describe('isrPurgeHook', () => {
  beforeEach(() => { mockRevalidateTag.mockClear() })

  it('calls revalidateTag with page and collection tags', async () => {
    await isrPurgeHook(pageArg({ agency_id: 'agency-abc', slug: 'home' }))

    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-abc:page:home')
    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-abc:collection:pages')
    expect(mockRevalidateTag).toHaveBeenCalledTimes(2)
  })

  it('does not call revalidateTag when agency_id is missing', async () => {
    await isrPurgeHook(pageArg({ slug: 'home' }))

    expect(mockRevalidateTag).not.toHaveBeenCalled()
  })

  it('does not call revalidateTag when slug is missing', async () => {
    await isrPurgeHook(pageArg({ agency_id: 'agency-abc' }))

    expect(mockRevalidateTag).not.toHaveBeenCalled()
  })
})

describe('isrPurgePostHook', () => {
  beforeEach(() => { mockRevalidateTag.mockClear() })

  it('calls revalidateTag with post and collection tags', async () => {
    await isrPurgePostHook(postArg({ agency_id: 'agency-xyz', slug: 'my-first-post' }, 'create'))

    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-xyz:post:my-first-post')
    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-xyz:collection:posts')
    expect(mockRevalidateTag).toHaveBeenCalledTimes(2)
  })

  it('both hooks are idempotent — calling twice produces correct tags, no dedup issues', async () => {
    await isrPurgePostHook(postArg({ agency_id: 'agency-xyz', slug: 'my-first-post' }))
    await isrPurgePostHook(postArg({ agency_id: 'agency-xyz', slug: 'my-first-post' }))

    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-xyz:post:my-first-post')
    expect(mockRevalidateTag).toHaveBeenCalledWith('agency:agency-xyz:collection:posts')
    expect(mockRevalidateTag).toHaveBeenCalledTimes(4) // 2 calls × 2 invocations
  })
})
