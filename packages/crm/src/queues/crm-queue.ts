/**
 * packages/crm/src/queues/crm-queue.ts
 *
 * BullMQ encrypted queue for CRM lead routing.
 * sensitiveData: true — job payload contains contact PII (contactId, agencyId).
 *
 * REQ-104 (lead routing), REQ-105 (SLA timer)
 */
import { createEncryptedQueue } from '@mjagency/queue'
import { REDIS_KEY } from '@mjagency/config'

export interface CrmLeadRoutingJobData {
  contactId: string
  agencyId: string
  formId?: string
  score: number
}

export function createCrmLeadRoutingQueue(agencyId: string) {
  const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
  const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
  return createEncryptedQueue<CrmLeadRoutingJobData>('crm-lead-routing', {
    host: redisHost,
    port: redisPort,
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })
}
