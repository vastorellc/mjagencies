/**
 * packages/crm/src/hooks/lead-routing-hook.ts
 *
 * Payload CollectionAfterChangeHook on the contacts collection.
 * Fires on create only (operation === 'create'). Computes lead score
 * from available fields, then enqueues to crm-lead-routing.
 *
 * REQ-104 (lead routing), REQ-106 (lead score persistence)
 */
import type { CollectionAfterChangeHook } from 'payload'
import { computeLeadScore } from '../scoring/lead-score.js'
import { createCrmLeadRoutingQueue, type CrmLeadRoutingJobData } from '../queues/crm-queue.js'
import { createLogger } from '@mjagency/config'

const log = createLogger({ service: 'mjagency-crm-hook' })

export const leadRoutingHook: CollectionAfterChangeHook = async ({ doc, operation }: { doc: Record<string, unknown>; operation: string }) => {
  if (operation !== 'create') return doc

  const agencyId = doc['agency_id'] as string | undefined
  if (!agencyId) {
    log.warn({ docId: doc['id'] }, 'leadRoutingHook: no agency_id on contact — skipping')
    return doc
  }

  const score = computeLeadScore({
    icp: {
      industryFit: 'medium',       // default until ICP mapping is available per agency
      companySizeFit: 'acceptable',
      roleSeniority: 'manager',
    },
    behavior: { pageViews: 0, formFills: 1, emailOpens: 0 },
    lastTouchedAt: new Date().toISOString(),
    source: (doc['source'] as string | undefined) ?? 'unknown',
  })

  const queue = createCrmLeadRoutingQueue(agencyId)
  const jobData: CrmLeadRoutingJobData = {
    contactId: doc['id'] as string,
    agencyId,
    score,
  }

  // Cast required: createEncryptedQueue returns Queue<EncryptedPayload>, but add()
  // is intercepted by the Proxy to accept T + sensitiveData option.
  await (queue as unknown as {
    add: (name: string, data: CrmLeadRoutingJobData, opts: Record<string, unknown>) => Promise<void>
  }).add('route-lead', jobData, { sensitiveData: true })

  log.info({ contactId: doc['id'], agencyId, score }, 'Lead routing job enqueued')
  return doc
}
