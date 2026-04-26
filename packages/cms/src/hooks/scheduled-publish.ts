/**
 * packages/cms/src/hooks/scheduled-publish.ts
 *
 * afterChange hook that enqueues a BullMQ job when a document transitions to
 * status='scheduled' with a publish_at date set (REQ-057).
 *
 * Queue name: 'cms-scheduled-publish'
 * Job name: 'publish-doc'
 * Payload: { collection, docId, agencyId, publishAt }
 * Worker: registered in apps/web-main/instrumentation.node.ts (Plan 05-04)
 *
 * BullMQ delay: publishAt - Date.now() milliseconds
 * If publishAt is in the past: job enqueued with delay=0 (publishes immediately)
 * Sensitive flag: false (no PII in this job payload)
 *
 * Agency BullMQ prefix: REDIS_KEY.bullPrefix(agencyId) = 'agency:<id>:bull'
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'
import type { CollectionAfterChangeHook } from 'payload'

export interface ScheduledPublishJobData {
  collection: string
  docId: string
  agencyId: string
  publishAt: string // ISO 8601
}

export const schedulePublishHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only act when status just became 'scheduled'
  if (doc['status'] !== 'scheduled') return
  if (previousDoc?.['status'] === 'scheduled') return // no re-enqueue on unrelated field change

  const publishAt = doc['publish_at'] as string | undefined
  if (!publishAt) return

  const user = req.user as { agencyId?: string } | null
  const agencyId = (doc['agency_id'] as string | undefined) ?? user?.agencyId ?? ''
  if (!agencyId) {
    console.error('[CMS] schedulePublishHook: missing agencyId on doc', doc['id'])
    return
  }

  const collectionSlug = (req.routeParams?.['collection'] as string | undefined) ?? 'pages'
  const publishMs = new Date(publishAt).getTime()
  const delayMs = Math.max(0, publishMs - Date.now())

  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

  // createEncryptedQueue returns Queue<EncryptedPayload> but the proxy intercepts .add()
  // and accepts raw T data — we cast via unknown to satisfy TypeScript.
  const queue = createEncryptedQueue<ScheduledPublishJobData>('cms-scheduled-publish', {
    host: redisHost,
    port: redisPort,
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })

  const jobData: ScheduledPublishJobData = {
    collection: collectionSlug,
    docId: String(doc['id']),
    agencyId,
    publishAt,
  }

  // The proxy intercepts .add() — cast via unknown to pass ScheduledPublishJobData
  await (queue as unknown as { add: (name: string, data: ScheduledPublishJobData, opts?: Record<string, unknown>) => Promise<void> }).add(
    'publish-doc',
    jobData,
    { delay: delayMs, jobId: `scheduled-publish:${collectionSlug}:${String(doc['id'])}` }
  )
}
