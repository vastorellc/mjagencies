/**
 * packages/meta-capi/src/meta-capi-queue.ts
 *
 * REQ-142: BullMQ encrypted queue for Meta CAPI events.
 *
 * Why encrypted (CLAUDE.md rule 7, threat T-11-03-09):
 *   user_data carries PII. Even after SHA-256 hashing in sendCapiEvent, hashes are
 *   recoverable for low-cardinality inputs (a phone number's hash is uniquely
 *   identifying given the search space). A Redis MONITOR or RDB snapshot leaking
 *   plaintext jobs would still expose user identity. sensitiveData: true triggers
 *   the AES-GCM-256 wrapper from @mjagency/queue.
 *
 * Why jobId = event_id (threat T-11-03-06):
 *   BullMQ guarantees once-only processing per jobId. Pairing jobId with the
 *   event_id sent to Meta means retries — whether driven by network errors,
 *   worker crashes, or queue backoff — never produce duplicate Lead/Purchase
 *   events at Meta. Meta's own dedup is the safety net but BullMQ is the gate.
 *
 * Per-agency Redis isolation (CLAUDE.md §8):
 *   keyPrefix: REDIS_KEY.bullPrefix(agencyId) → 'agency:<id>:bull'
 *   Worker MUST be started with the same keyPrefix per agency.
 */

import type { Job } from 'bullmq'
import { createEncryptedQueue, createEncryptedWorker } from '@mjagency/queue'
import { REDIS_KEY, createLogger } from '@mjagency/config'
import { sendCapiEvent, type CapiEvent } from './meta-capi.js'

interface CapiJobData {
  agencyId: string
  event: CapiEvent
}

function getRedisHost(): string {
  return process.env['REDIS_HOST'] ?? 'localhost'
}

function getRedisPort(): number {
  return parseInt(process.env['REDIS_PORT'] ?? '6379', 10)
}

/**
 * Enqueues a Meta CAPI event for retry-safe delivery.
 *
 * Returns the event_id (caller may persist it for audit / dedup confirmation).
 * Generates a UUID when the caller has not set event.event_id.
 */
export async function enqueueCapiEvent(agencyId: string, event: CapiEvent): Promise<string> {
  const queue = createEncryptedQueue<CapiJobData>('meta-capi-events', {
    host: getRedisHost(),
    port: getRedisPort(),
    keyPrefix: REDIS_KEY.bullPrefix(agencyId),
  })

  const eventId = event.event_id ?? crypto.randomUUID()
  const eventWithId: CapiEvent = { ...event, event_id: eventId }

  // The createEncryptedQueue proxy interprets `sensitiveData: true` on opts to wrap
  // payload as { __enc: true, v: 1, data: <AES-GCM-256> }. We cast the proxy here
  // because BullMQ's type sees Queue<EncryptedPayload>, not the user-facing T.
  const q = queue as unknown as {
    add: (
      name: string,
      data: CapiJobData,
      opts: Record<string, unknown>,
    ) => Promise<{ id?: string }>
  }

  await q.add(
    event.event_name,
    { agencyId, event: eventWithId },
    {
      sensitiveData: true,        // CLAUDE.md rule 7 — PII even when hashed = sensitive
      jobId: eventId,             // BullMQ once-only processing (idempotency)
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  )

  return eventId
}

/**
 * Starts a BullMQ worker that drains the meta-capi-events queue for one agency.
 *
 * Apps wire this once at startup per agency (typically alongside other agency
 * workers — form-worker, invoice-worker, etc.). The processor decrypts the
 * payload (handled by createEncryptedWorker) then dispatches to sendCapiEvent.
 */
export function startCapiWorker(agencyId: string): void {
  const log = createLogger({ service: 'mjagency-meta-capi', agencyId })

  createEncryptedWorker<CapiJobData>(
    'meta-capi-events',
    async (job: Job<CapiJobData>) => {
      const { agencyId: jobAgencyId, event } = job.data
      try {
        await sendCapiEvent(jobAgencyId, event)
        log.info(
          { eventId: event.event_id, eventName: event.event_name },
          'Meta CAPI event delivered',
        )
      } catch (err) {
        log.error(
          { err, eventId: event.event_id, eventName: event.event_name },
          'Meta CAPI delivery failed — BullMQ will retry per attempts policy',
        )
        throw err // BullMQ retries via attempts/backoff
      }
    },
    {
      host: getRedisHost(),
      port: getRedisPort(),
      keyPrefix: REDIS_KEY.bullPrefix(agencyId),
    },
  )
}
