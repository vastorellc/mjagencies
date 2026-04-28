/**
 * Unit tests for enqueueCapiEvent — BullMQ encrypted queue layer.
 *
 * Asserts:
 *   - sensitiveData: true is set on every add() (CLAUDE.md rule 7, threat T-11-03-09)
 *   - jobId === event_id (BullMQ once-only retry idempotency, threat T-11-03-06)
 *   - Generated event_id is a UUID when caller does not provide one
 *   - Queue is constructed with per-agency keyPrefix
 *
 * BullMQ Queue/Worker are mocked — no Redis connection required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
let mockQueueAdd: ReturnType<typeof vi.fn>

vi.mock('bullmq', () => {
  mockQueueAdd = vi.fn(async (name: string, data: unknown, opts: Record<string, unknown>) => {
    addCalls.push({ name, data, opts })
    return { id: (opts['jobId'] as string) ?? 'mock-job-id' }
  })
  return {
    Queue: vi.fn().mockImplementation((name: string, opts: { connection: QueueCtor['connection'] }) => {
      queueCtorCalls.push({ name, connection: opts.connection })
      return {
        add: mockQueueAdd,
        close: vi.fn(),
      }
    }),
    Worker: vi.fn().mockImplementation(() => ({ close: vi.fn() })),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  queueCtorCalls.length = 0
  addCalls.length = 0
  process.env.BULLMQ_ENCRYPTION_KEY = 'test-queue-encryption-key-for-unit-tests'
})

afterEach(() => {
  delete process.env.BULLMQ_ENCRYPTION_KEY
})

describe('enqueueCapiEvent', () => {
  it('sets sensitiveData: true on add() — triggers AES-GCM-256 encryption', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(addCalls.length).toBe(1)
    expect(addCalls[0]!.opts['sensitiveData']).toBe(true)
  })

  it('uses event_id as BullMQ jobId (retry idempotency)', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    const eventId = await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Purchase',
      event_id: 'caller-id-789',
      user_data: { em: 'buyer@example.com' },
      custom_data: { value: 100, currency: 'USD' },
    })
    expect(eventId).toBe('caller-id-789')
    expect(addCalls[0]!.opts['jobId']).toBe('caller-id-789')
  })

  it('generates a UUID event_id when caller does not provide one', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    const eventId = await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    // jobId must equal generated event_id
    expect(addCalls[0]!.opts['jobId']).toBe(eventId)
  })

  it('uses agency-isolated Redis keyPrefix (agency:<id>:bull)', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(queueCtorCalls.length).toBe(1)
    expect(queueCtorCalls[0]!.connection.keyPrefix).toBe('agency:web-ecommerce:bull')
  })

  it('queue name is meta-capi-events', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
    })
    expect(queueCtorCalls[0]!.name).toBe('meta-capi-events')
  })

  it('configures retry policy: attempts=5 with exponential backoff', async () => {
    const { enqueueCapiEvent } = await import('../meta-capi-queue.js')
    await enqueueCapiEvent('web-ecommerce', {
      event_name: 'Lead',
      user_data: { em: 'x@y.com' },
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
      user_data: { em: 'x@y.com' },
    })
    expect(addCalls[0]!.name).toBe('Purchase')
  })
})
