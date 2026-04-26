import { startNodeSdk } from '@mjagency/config'
startNodeSdk({ agencyId: process.env['AGENCY'] ?? 'main' })

// Plan 05-04: BullMQ scheduled-publish worker (REQ-057)
// Registers after OTel SDK so all BullMQ job traces are captured.
// Worker processes cms-scheduled-publish jobs enqueued by schedulePublishHook.
// T-05-04-02: uses payload.update() with overrideAccess:false — access control still enforced.
import { createEncryptedWorker } from '@mjagency/queue'
import type { ScheduledPublishJobData } from '@mjagency/cms'

const REDIS_HOST = process.env['REDIS_HOST'] ?? 'localhost'
const REDIS_PORT = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

// Single worker handles all agencies — job payload contains agencyId for isolation.
// Each agency's queue has its own key prefix: 'agency:<id>:bull' (set in schedulePublishHook).
createEncryptedWorker<ScheduledPublishJobData>(
  'cms-scheduled-publish',
  async (job) => {
    const { collection, docId, agencyId, publishAt } = job.data
    if (new Date(publishAt) > new Date()) {
      // Re-enqueue guard: BullMQ delay should prevent early execution,
      // but we double-check to avoid premature publishing.
      return
    }
    // Use Payload local API to set status = published
    // T-05-04-02: overrideAccess:false ensures agency field-level access control still applies
    const { getPayload } = await import('payload')
    const config = await import('./payload.config.js')
    const payload = await getPayload({ config: config.default })

    // agencyId available for OTel span enrichment in Phase 7
    console.info('[cms-scheduled-publish] published', { collection, docId, agencyId })

    await payload.update({
      collection: collection as 'pages' | 'posts' | 'tools',
      id: docId,
      data: { status: 'published' },
      overrideAccess: false,
    })
  },
  { host: REDIS_HOST, port: REDIS_PORT },
)
