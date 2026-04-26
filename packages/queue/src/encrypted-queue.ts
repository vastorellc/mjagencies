/**
 * packages/queue/src/encrypted-queue.ts
 *
 * BullMQ Queue/Worker proxy that transparently AES-GCM-256-encrypts payloads
 * before they enter Redis and decrypts them inside the worker processor.
 *
 * Security context (REQ-306, REQ-425, SEC-N10, T-02-019):
 *   - Sensitive job payloads (PII, API tokens, user data) must not be stored
 *     in Redis in plaintext — a Redis MONITOR or RDB snapshot would expose them.
 *   - The `sensitiveData: true` flag in queue.add() opts a job into encryption.
 *   - Non-sensitive jobs (e.g. internal signals, retry counters) pass through
 *     unchanged — encryption is opt-in, not mandatory, to avoid unnecessary overhead.
 *   - Payload is `{ __enc: true, v: 1, data: <base64-AES-GCM-256> }`.
 *     The `v` field enables future key rotation without re-encrypting old jobs.
 *   - Key is derived via `getQueueKey()` using the queue-domain salt
 *     (distinct from vault domain salt — see packages/queue/src/key.ts).
 *
 * Performance (RESEARCH §7.3):
 *   AES-GCM-256 via Node.js crypto adds < 0.1ms per typical job payload.
 *   The overhead is negligible compared to Redis round-trip latency.
 *
 * Usage:
 *   const queue = createEncryptedQueue<EmailJobData>('emails', { host: 'localhost' })
 *   await queue.add('send', { to: 'user@example.com', body: '...' }, { sensitiveData: true })
 *
 *   createEncryptedWorker<EmailJobData>('emails', async (job) => {
 *     // job.data is already decrypted — use directly
 *     await sendEmail(job.data)
 *   }, { host: 'localhost' })
 *
 * Agency prefix convention (CLAUDE.md §8):
 *   This wrapper does NOT enforce the `agency:<id>:bull` key prefix.
 *   Consumers pass it via `connection.keyPrefix` per Phase 1 convention:
 *   `createEncryptedQueue('emails', { host, keyPrefix: REDIS_KEY.bullPrefix(agencyId) })`
 */

import { Queue, Worker, type Job } from 'bullmq'
import type { RedisOptions } from 'ioredis'
import { encryptVaultValue, decryptVaultValue } from '@mjagency/db'
import { getQueueKey } from './key.js'

/**
 * Shape of an encrypted BullMQ payload stored in Redis.
 * `v` is the key version — enables rotation without re-queuing old jobs.
 */
interface EncryptedPayload {
  __enc: true
  v: number
  data: string // base64-encoded AES-GCM-256 ciphertext
}

/**
 * Creates a BullMQ Queue proxy that encrypts payloads marked with `sensitiveData: true`.
 *
 * The returned queue is a transparent proxy over a real BullMQ Queue instance.
 * Only the `add` method is intercepted for encryption; all other methods
 * (drain, close, getJobs, etc.) pass through to the underlying queue.
 *
 * @param queueName - BullMQ queue name
 * @param connection - ioredis RedisOptions (include `keyPrefix` for agency isolation)
 * @returns Proxy over Queue<EncryptedPayload>
 */
export function createEncryptedQueue<T>(
  queueName: string,
  connection: RedisOptions
): Queue<EncryptedPayload> {
  const queue = new Queue<EncryptedPayload>(queueName, { connection })
  return new Proxy(queue, {
    get(target, prop) {
      if (prop === 'add') {
        return async (name: string, data: T, opts?: Record<string, unknown>) => {
          const payload: EncryptedPayload | T =
            opts?.sensitiveData === true
              ? {
                  __enc: true as const,
                  v: 1,
                  data: encryptVaultValue(JSON.stringify(data), getQueueKey()).toString('base64'),
                }
              : (data as unknown as EncryptedPayload)
          return target.add(name, payload as EncryptedPayload, opts)
        }
      }
      // All other Queue methods pass through without modification
      const value = (target as unknown as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/**
 * Creates a BullMQ Worker that automatically decrypts encrypted payloads
 * before passing the job to the processor function.
 *
 * If the job payload has `__enc: true`, it is decrypted using `getQueueKey()`
 * before the processor receives it. Non-encrypted payloads pass through as-is.
 *
 * @param queueName - BullMQ queue name (must match the producer queue name)
 * @param processor - Async function that receives the decrypted job
 * @param connection - ioredis RedisOptions (same `keyPrefix` as the queue)
 * @returns BullMQ Worker instance
 */
export function createEncryptedWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  connection: RedisOptions
): Worker {
  return new Worker<EncryptedPayload>(
    queueName,
    async (job) => {
      let data: T
      const payload = job.data as EncryptedPayload | T
      if (typeof payload === 'object' && payload !== null && (payload as EncryptedPayload).__enc === true) {
        const encPayload = payload as EncryptedPayload
        data = JSON.parse(
          decryptVaultValue(Buffer.from(encPayload.data, 'base64'), getQueueKey())
        ) as T
      } else {
        data = payload as T
      }
      await processor({ ...job, data } as unknown as Job<T>)
    },
    { connection }
  )
}
