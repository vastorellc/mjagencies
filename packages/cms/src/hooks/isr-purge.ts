/**
 * packages/cms/src/hooks/isr-purge.ts
 *
 * Payload 3.82.1 afterChange hooks for tag-based ISR cache purge.
 *
 * REQ-091: ISR + tag-based cache purge with propagation < 60s after content edit.
 *
 * Tag format convention:
 *   agency:<agencyId>:page:<slug>         — individual page cache
 *   agency:<agencyId>:collection:pages    — entire pages collection list cache
 *   agency:<agencyId>:post:<slug>         — individual post cache
 *   agency:<agencyId>:collection:posts    — entire posts collection list cache
 *
 * Dynamic page routes export `revalidate = 60` to satisfy the 60-second propagation SLA.
 * Guards ensure revalidateTag is never called when agency_id or slug are absent.
 */
import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook } from 'payload'

/**
 * Purges ISR cache after any page document is saved in Payload.
 * Cache tag format: agency:<agencyId>:page:<slug> + agency:<agencyId>:collection:pages
 * REQ-091: purge propagates within 60s (revalidate = 60 on page routes).
 */
export const isrPurgeHook: CollectionAfterChangeHook = async ({ doc }): Promise<void> => {
  const agencyId = doc['agency_id'] as string | undefined
  const slug = doc['slug'] as string | undefined
  if (!agencyId || !slug) return

  revalidateTag(`agency:${agencyId}:page:${slug}`)
  revalidateTag(`agency:${agencyId}:collection:pages`)
}

/**
 * Purges ISR cache after any post document is saved in Payload.
 * Cache tag format: agency:<agencyId>:post:<slug> + agency:<agencyId>:collection:posts
 * REQ-091: purge propagates within 60s (revalidate = 60 on post routes).
 */
export const isrPurgePostHook: CollectionAfterChangeHook = async ({ doc }): Promise<void> => {
  const agencyId = doc['agency_id'] as string | undefined
  const slug = doc['slug'] as string | undefined
  if (!agencyId || !slug) return

  revalidateTag(`agency:${agencyId}:post:${slug}`)
  revalidateTag(`agency:${agencyId}:collection:posts`)
}
