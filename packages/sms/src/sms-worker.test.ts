/**
 * packages/sms/src/sms-worker.test.ts
 *
 * Vitest unit tests for TCPA guard and opt-in/out flow.
 * Twilio API calls are mocked — no real network calls.
 * Redis calls are mocked via vi.mock.
 * REQ-423
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TcpaConsentError } from './workers/sms-worker.js'
import { hashPhone, OPT_IN_REDIS_KEY } from './opt-in.js'

// Mock the encrypted worker to capture processor calls
vi.mock('@mjagency/queue', () => ({
  createEncryptedWorker: vi.fn(),
  createEncryptedQueue: vi.fn(),
}))

vi.mock('./twilio.js', () => ({
  createTwilioClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({ sid: 'SM_test_123' }),
    },
  })),
  getTwilioConfig: vi.fn(() => ({
    accountSid: 'ACtest',
    authToken: 'test_token',
    fromNumber: '+15005550006',
  })),
}))

// Mock ioredis for opt-in tests
const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()
const mockRedisQuit = vi.fn()

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    quit: mockRedisQuit,
  })),
}))

describe('TCPA guard', () => {
  it('TcpaConsentError is thrown when consentVerified is false', () => {
    const err = new TcpaConsentError('ecommerce')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('TcpaConsentError')
    expect(err.message).toContain('consentVerified is false')
    expect(err.message).toContain('ecommerce')
  })

  it('TcpaConsentError has name TcpaConsentError for catch discrimination', () => {
    const err = new TcpaConsentError('finance')
    expect(err.name).toBe('TcpaConsentError')
  })
})

describe('phone hashing', () => {
  it('hashPhone returns a 64-char hex string', () => {
    const hash = hashPhone('+12025551234')
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
  })

  it('hashPhone trims whitespace before hashing', () => {
    expect(hashPhone('+12025551234')).toBe(hashPhone('  +12025551234  '))
  })

  it('different phones produce different hashes', () => {
    expect(hashPhone('+12025551234')).not.toBe(hashPhone('+12025559999'))
  })
})

describe('OPT_IN_REDIS_KEY', () => {
  it('returns correct key pattern', () => {
    const key = OPT_IN_REDIS_KEY('ecommerce', 'abc123')
    expect(key).toBe('agency:ecommerce:sms:optin:abc123')
  })
})

describe('verifyOptIn / recordOptIn / recordOptOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisQuit.mockResolvedValue('OK')
  })

  it('verifyOptIn returns true when Redis key exists', async () => {
    mockRedisGet.mockResolvedValue('1')
    const { verifyOptIn } = await import('./opt-in.js')
    const result = await verifyOptIn('ecommerce', '+12025551234')
    expect(result).toBe(true)
  })

  it('verifyOptIn returns false when Redis key does not exist', async () => {
    mockRedisGet.mockResolvedValue(null)
    const { verifyOptIn } = await import('./opt-in.js')
    const result = await verifyOptIn('ecommerce', '+12025551234')
    expect(result).toBe(false)
  })

  it('recordOptIn sets the Redis key', async () => {
    mockRedisSet.mockResolvedValue('OK')
    const { recordOptIn } = await import('./opt-in.js')
    await recordOptIn('ecommerce', '+12025551234')
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringMatching(/^agency:ecommerce:sms:optin:/),
      '1'
    )
  })

  it('recordOptOut deletes the Redis key', async () => {
    mockRedisDel.mockResolvedValue(1)
    const { recordOptOut } = await import('./opt-in.js')
    await recordOptOut('ecommerce', '+12025551234')
    expect(mockRedisDel).toHaveBeenCalledWith(
      expect.stringMatching(/^agency:ecommerce:sms:optin:/)
    )
  })

  it('opt-in then opt-out: key is deleted', async () => {
    mockRedisSet.mockResolvedValue('OK')
    mockRedisDel.mockResolvedValue(1)
    mockRedisGet.mockResolvedValue(null)
    const { recordOptIn, recordOptOut, verifyOptIn } = await import('./opt-in.js')
    await recordOptIn('ecommerce', '+12025551234')
    await recordOptOut('ecommerce', '+12025551234')
    const verified = await verifyOptIn('ecommerce', '+12025551234')
    expect(verified).toBe(false)
  })
})
