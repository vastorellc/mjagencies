/**
 * packages/queue/src/__tests__/encrypted-queue.test.ts
 *
 * Unit tests for BullMQ encrypted queue wrapper.
 * Queue and Worker are mocked — no Redis connection required.
 *
 * Tests cover:
 *   - REQ-306, REQ-425: sensitive payloads encrypted before Redis storage
 *   - SEC-N10: AES-GCM-256 via Node crypto (not pgcrypto)
 *   - T-02-019: BullMQ payloads with PII visible in Redis MONITOR
 *   - Key domain isolation: queue salt distinct from vault salt
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { decryptVaultValue } from '@mjagency/db'

// Type definitions for mock capture
interface MockQueueAdd {
  mock: {
    calls: Array<[string, unknown, unknown?]>
  }
}

interface MockWorkerProcessor {
  (job: { data: unknown }): Promise<void>
}

// Capture the processor function that createEncryptedWorker passes to Worker
let capturedProcessor: MockWorkerProcessor | null = null
let mockQueueAdd: ReturnType<typeof vi.fn>

vi.mock('bullmq', () => {
  mockQueueAdd = vi.fn().mockResolvedValue({ id: 'mock-job-id' })
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockQueueAdd,
      close: vi.fn(),
    })),
    Worker: vi.fn().mockImplementation((_name: string, processor: MockWorkerProcessor) => {
      capturedProcessor = processor
      return { close: vi.fn() }
    }),
  }
})

// Set queue key env before importing the module under test
beforeEach(() => {
  vi.clearAllMocks()
  capturedProcessor = null
  process.env.BULLMQ_ENCRYPTION_KEY = 'test-queue-encryption-key-for-unit-tests'
})

afterEach(() => {
  delete process.env.BULLMQ_ENCRYPTION_KEY
})

describe('createEncryptedQueue', () => {
  // Test 1: add() with sensitiveData: true wraps payload as { __enc, v, data }
  it('encrypts payload when sensitiveData: true — Queue.add receives {__enc, v, data}', async () => {
    const { createEncryptedQueue } = await import('../encrypted-queue.js')
    const { getQueueKey } = await import('../key.js')
    const conn = { host: 'localhost', port: 6379 }
    const queue = createEncryptedQueue('emails', conn)

    const originalPayload = { to: 'a@b.com', body: 'hi' }
    await queue.add('send', originalPayload as never, { sensitiveData: true } as never)

    // Capture the actual argument passed to Queue.add mock
    const addMock = mockQueueAdd as unknown as MockQueueAdd
    expect(addMock.mock.calls.length).toBe(1)
    const [, encryptedArg] = addMock.mock.calls[0]!
    const payload = encryptedArg as { __enc: boolean; v: number; data: string }

    // Must be wrapped as encrypted payload
    expect(payload.__enc).toBe(true)
    expect(payload.v).toBe(1)
    expect(typeof payload.data).toBe('string')

    // data must be base64-encoded
    expect(payload.data).toMatch(/^[A-Za-z0-9+/=]+$/)

    // Decoding must yield the original payload
    const key = getQueueKey()
    const decrypted = JSON.parse(decryptVaultValue(Buffer.from(payload.data, 'base64'), key)) as unknown
    expect(decrypted).toEqual(originalPayload)
  })

  // Test 2: add() without sensitiveData passes data through unchanged
  it('passes data through unchanged when sensitiveData is not set', async () => {
    const { createEncryptedQueue } = await import('../encrypted-queue.js')
    const conn = { host: 'localhost', port: 6379 }
    const queue = createEncryptedQueue('emails', conn)

    const originalPayload = { to: 'a@b.com', body: 'hi' }
    await queue.add('send', originalPayload as never)

    const addMock = mockQueueAdd as unknown as MockQueueAdd
    const [, passedArg] = addMock.mock.calls[0]!
    // Should be the original payload, not wrapped
    expect(passedArg).toEqual(originalPayload)
  })
})

describe('createEncryptedWorker', () => {
  // Test 3: Worker decrypts encrypted job before calling processor
  it('decrypts encrypted payload and calls processor with original data', async () => {
    const { createEncryptedWorker } = await import('../encrypted-queue.js')
    const { getQueueKey } = await import('../key.js')
    const { encryptVaultValue } = await import('@mjagency/db')

    const conn = { host: 'localhost', port: 6379 }
    const processorSpy = vi.fn().mockResolvedValue(undefined)

    createEncryptedWorker('emails', processorSpy, conn)
    expect(capturedProcessor).not.toBeNull()

    // Build an encrypted payload as if createEncryptedQueue produced it
    const originalData = { x: 1 }
    const key = getQueueKey()
    const encryptedBase64 = encryptVaultValue(JSON.stringify(originalData), key).toString('base64')
    const encryptedPayload = { __enc: true, v: 1, data: encryptedBase64 }

    // Invoke the captured processor with the encrypted job
    await capturedProcessor!({ data: encryptedPayload })

    // Processor should have been called with the decrypted data
    expect(processorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: { x: 1 } })
    )
  })

  // Test 4: Worker passes through unencrypted payloads
  it('passes unencrypted payloads directly to processor', async () => {
    const { createEncryptedWorker } = await import('../encrypted-queue.js')
    const conn = { host: 'localhost', port: 6379 }
    const processorSpy = vi.fn().mockResolvedValue(undefined)

    createEncryptedWorker('emails', processorSpy, conn)
    expect(capturedProcessor).not.toBeNull()

    const plainPayload = { y: 2 }
    await capturedProcessor!({ data: plainPayload })

    expect(processorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ data: { y: 2 } })
    )
  })
})

describe('getQueueKey', () => {
  // Test 5: getQueueKey reads BULLMQ_ENCRYPTION_KEY and uses queue salt
  it('returns 32-byte key derived from BULLMQ_ENCRYPTION_KEY, distinct from vault key', async () => {
    process.env.VAULT_ENCRYPTION_KEY = 'test-queue-encryption-key-for-unit-tests'
    process.env.BULLMQ_ENCRYPTION_KEY = 'test-queue-encryption-key-for-unit-tests'

    const { getQueueKey } = await import('../key.js')
    const { vault } = await import('@mjagency/db')

    const queueKey = getQueueKey()
    const vaultKey = vault.getVaultKey()

    // Both must be 32 bytes
    expect(queueKey.length).toBe(32)
    expect(vaultKey.length).toBe(32)

    // Must be different (different domain salts)
    expect(Buffer.compare(queueKey, vaultKey)).not.toBe(0)

    delete process.env.VAULT_ENCRYPTION_KEY
  })
})
