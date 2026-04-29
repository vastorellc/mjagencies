/**
 * Unit tests for enqueueCapiEvent — BullMQ encrypted queue layer.
 *
 * Asserts:
 *   - sensitiveData: true is set on every add() (CLAUDE.md rule 7, threat T-11-03-09)
 *   - jobId === event_id (BullMQ once-only retry idempotency, threat T-11-03-06)
 *   - Generated event_id is a UUID when caller does not provide one
 *   - Queue is constructed with per-agency keyPrefix
 *   - Retry policy: attempts=5 with exponential backoff (5000ms base)
 *   - add() job-name = event_name (Lead | Purchase | …)
 *
 * Strategy: mock @mjagency/queue directly so the AES-GCM-256 encryption
 * layer doesn't run during these tests. The encryption itself is covered
 * by packages/queue/src/__tests__/encrypted-queue.test.ts. Mocking at the
 * queue boundary lets us assert exactly what enqueueCapiEvent passes
 * downstream without paying the scrypt KDF cost on every test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface AddCall {
  name: string
  data: unknown
  opts: Record<string, unknown>
}

interface QueueCtor {
  name: string
  connection: { keyPrefix?: string; host?: string; port?: number }
}

const queueCtorCalls: QueueCtor[] = []
const addCalls: AddCall[] = []

const mocks = vi.hoisted(() => ({
  createEncryptedQueue:  vi.fn(),
  createEncryptedWorker: vi.fn(() => ({ close: vi.fn() })),
}))

vi.mock('@mjagency/queue', () => ({
  createEncryptedQueue:  mocks.createEncryptedQueue,
  createEncryptedWorker: mocks.createEncryptedWorker,
}))

beforeEach(() => {
  queueCtorCalls.length = 0
  addCalls.length = 0
  mocks.createEncryptedQueue.mockReset().mockImplementation((name: string, connection: QueueCtor['connection']) => {
    queueCtorCalls.push({ name, connection })
    return {
      add: vi.fn(async (jobName: string, data: unknown, opts: Record<string, unknown>) => {
        addCalls.push({ name: jobName, data, opts })
        return { id: (opts['jobId'] as string) ?? 'mock-job-id' }
      }),
      close: vi.fn(),
    } as unknown as ReturnType<typeof mocks.createEncryptedQueue>
  })
})

describe('enqueueCapiEvent', () => {
  it('sets sensitiveData: true on add() — triggers AES-GCM-256 encryption downstream', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(addCalls.length).toBe(1)
    expect(addCalls[0]!.opts['sensitiveData']).toBe(true)
  })

  it('uses event_id as BullMQ jobId (retry idempotency)', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    const eventId = await enqueueCapiEvent('web-ecommerce', {
      event_name:  'Purchase',
      event_id:    'caller-id-789',
      user_data:   { em: 'buyer@example.com' },
      custom_data: { value: 100, currency: 'USD' },
    })
    expect(eventId).toBe('caller-id-789')
    expect(addCalls[0]!.opts['jobId']).toBe('caller-id-789')
  })

  it('generates a UUID event_id when caller does not provide one', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    const eventId = await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    // jobId must equal generated event_id
    expect(addCalls[0]!.opts['jobId']).toBe(eventId)
  })

  it('uses agency-isolated Redis keyPrefix (agency:<id>:bull)', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(queueCtorCalls.length).toBe(1)
    expect(queueCtorCalls[0]!.connection.keyPrefix).toBe('agency:web-ecommerce:bull')
  })

  it('queue name is meta-capi-events', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(queueCtorCalls[0]!.name).toBe('meta-capi-events')
  })

  it('configures retry policy: attempts=5 with exponential backoff', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(addCalls[0]!.opts['attempts']).toBe(5)
    const backoff = addCalls[0]!.opts['backoff'] as { type: string; delay: number }
    expect(backoff.type).toBe('exponential')
    expect(backoff.delay).toBe(5000)
  })

  it('add() is called with event_name as job name (Lead | Purchase | …)', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Purchase',
      user_data:  { em: 'x@y.com' },
    })
    expect(addCalls[0]!.name).toBe('Purchase')
  })

  it('configures removeOnComplete / removeOnFail for queue housekeeping', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data:  { em: 'x@y.com' },
    })
    expect(addCalls[0]!.opts['removeOnComplete']).toBe(1000)
    expect(addCalls[0]!.opts['removeOnFail']).toBe(5000)
  })
})
