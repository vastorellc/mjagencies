/**
 * packages/proposals/src/workers/expiry-worker.ts
 * Daily BullMQ worker: transitions expired proposals to grace/nurture.
 * REQ-405: 14d → expired → 7d grace → nurture.
 * Runs via BullMQ repeat job — registered in instrumentation.node.ts.
 */
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'

interface ExpiryJobData {
  agencyId: string
  triggeredAt: string
}

const redisHost = process.env['REDIS_HOST'] ?? 'localhost'
const redisPort = parseInt(process.env['REDIS_PORT'] ?? '6379', 10)

const PAYLOAD_URL = process.env['PAYLOAD_URL'] ?? 'http://localhost:3000'
const PAYLOAD_API_KEY = process.env['PAYLOAD_API_KEY'] ?? ''

async function processExpiryForAgency(agencyId: string): Promise<void> {
  const log = createLogger({ service: 'mjagency-proposals', agencyId })
  const now = new Date().toISOString()

  // Transition active → expired (past expires_at)
  const expiredRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[status][equals]=active&where[expires_at][less_than]=${now}&where[agency_id][equals]=${agencyId}&limit=100`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const expiredData = await expiredRes.json() as { docs: Array<{ id: string }> }
  for (const p of expiredData.docs) {
    await fetch(`${PAYLOAD_URL}/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
      body: JSON.stringify({ status: 'expired' }),
    })
    log.info({ proposalId: p.id }, 'Proposal transitioned: active → expired')
  }

  // Also transition viewed → expired (past expires_at, same rule as active)
  const viewedExpiredRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[status][equals]=viewed&where[expires_at][less_than]=${now}&where[agency_id][equals]=${agencyId}&limit=100`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const viewedExpiredData = await viewedExpiredRes.json() as { docs: Array<{ id: string }> }
  for (const p of viewedExpiredData.docs) {
    await fetch(`${PAYLOAD_URL}/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
      body: JSON.stringify({ status: 'expired' }),
    })
    log.info({ proposalId: p.id }, 'Proposal transitioned: viewed → expired')
  }

  // Transition expired → grace (grace_ends_at not yet reached) — set status to grace
  // Note: 'expired' with grace period active → status becomes 'grace'
  const graceRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[status][equals]=expired&where[grace_ends_at][greater_than]=${now}&where[agency_id][equals]=${agencyId}&limit=100`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const graceData = await graceRes.json() as { docs: Array<{ id: string }> }
  for (const p of graceData.docs) {
    await fetch(`${PAYLOAD_URL}/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
      body: JSON.stringify({ status: 'grace' }),
    })
    log.info({ proposalId: p.id }, 'Proposal transitioned: expired → grace')
  }

  // Transition grace/expired → nurture (past grace_ends_at)
  const nurtureRes = await fetch(
    `${PAYLOAD_URL}/api/proposals?where[status][in]=expired,grace&where[grace_ends_at][less_than]=${now}&where[agency_id][equals]=${agencyId}&limit=100`,
    { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
  )
  const nurtureData = await nurtureRes.json() as { docs: Array<{ id: string; contact_id: string }> }
  for (const p of nurtureData.docs) {
    await fetch(`${PAYLOAD_URL}/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PAYLOAD_API_KEY}` },
      body: JSON.stringify({ status: 'nurture' }),
    })
    // Enqueue nurture sequence enrollment for the associated contact
    if (p.contact_id) {
      const queue = createEncryptedQueue<{ contactId: string; agencyId: string }>('crm-lead-routing', {
        host: redisHost, port: redisPort,
        keyPrefix: REDIS_KEY.bullPrefix(agencyId),
      })
      await queue.add('enroll-nurture', { contactId: p.contact_id, agencyId }, { sensitiveData: true })
    }
    log.info({ proposalId: p.id }, 'Proposal transitioned: expired/grace → nurture')
  }
}

/**
 * Starts the daily proposal expiry worker.
 * Register this in apps/web-main/instrumentation.node.ts.
 *
 * Schedule: runs once per day at midnight UTC.
 * Each job processes all agencies (worker fetches distinct agency IDs from proposals table).
 */
export function startExpiryWorker(): void {
  const queue = createEncryptedQueue<ExpiryJobData>('proposal-expiry', {
    host: redisHost, port: redisPort,
    keyPrefix: 'platform:bull',
  })

  void queue.add(
    'daily-expiry-check',
    { agencyId: 'all', triggeredAt: new Date().toISOString() },
    { repeat: { cron: '0 0 * * *' }, jobId: 'proposal-expiry-daily' },
  )

  createEncryptedWorker<ExpiryJobData>(
    'proposal-expiry',
    async (job) => {
      const log = createLogger({ service: 'mjagency-proposals', agencyId: 'platform' })
      log.info({ triggeredAt: job.data.triggeredAt }, 'Proposal expiry worker triggered')

      // Fetch distinct agency IDs from proposals table (active + expired + viewed + grace statuses)
      const res = await fetch(
        `${PAYLOAD_URL}/api/proposals?where[status][in]=active,viewed,expired,grace&limit=0`,
        { headers: { Authorization: `Bearer ${PAYLOAD_API_KEY}` } },
      )
      const data = await res.json() as { docs: Array<{ agency_id: string }> }
      const agencyIds = [...new Set(data.docs.map((d) => d.agency_id))]

      for (const agencyId of agencyIds) {
        await processExpiryForAgency(agencyId)
      }
    },
    {
      host: redisHost, port: redisPort,
      keyPrefix: 'platform:bull',
    },
  )
}
