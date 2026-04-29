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

// Phase 6: SEO self-learning repeatable job (REQ-073)
import { registerSelfLearning } from './src/jobs/self-learning.js'
await registerSelfLearning()

// Phase 6: Algorithm watcher repeatable job (REQ-074)
import { registerAlgoWatcher } from './src/jobs/algo-watcher.js'
await registerAlgoWatcher()

// Phase 7: AI cost-cap monthly reset (REQ-080)
import { registerCostReset } from './src/jobs/cost-reset.js'
await registerCostReset()

// Phase 9 / launch fix: Stripe webhook event router. Drains the `stripe-events`
// queue produced by /api/stripe/webhook and dispatches to downstream handlers
// (invoice-worker for payment / dispute events, log-only stubs for the rest).
// One Worker per agency to mirror the per-agency Redis prefix the webhook uses.
import { registerStripeWebhookWorkers } from './src/jobs/stripe-webhook-worker.js'
registerStripeWebhookWorkers()

// Phase 9 / launch fix: invoice-event consumer. Subscribes to the
// `stripe-invoice-event` queue that the Stripe webhook router re-enqueues
// onto. Handles checkout.session.completed (invoice paid + Meta CAPI Purchase)
// and charge.dispute.created (chargeback evidence compilation).
// Without this, the invoice worker code in packages/invoices is dead.
import { startInvoiceWorker } from '@mjagency/invoices'
startInvoiceWorker()

// Phase 9 / launch fix: dunning worker. Daily-cron BullMQ repeatable job
// that emails reminders on day 3 / 7 / 14 and closes invoices at day 30.
import { startDunningWorker } from '@mjagency/invoices'
startDunningWorker()

// Launch fix: bootstrap every remaining BullMQ worker that was authored but
// never registered (email, forms, booking, crm, sms, meta-capi, opt-out
// fanout, esign, proposal expiry). Without this call, jobs enqueued by
// public forms, contact submissions, esign flows, etc. would pile up in
// Redis without ever being drained. Registration is best-effort —
// individual failures are logged, not fatal.
import { registerAllWorkers } from './src/jobs/register-all-workers.js'
registerAllWorkers()
