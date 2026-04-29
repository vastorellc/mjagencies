/**
 * packages/forms/src/__tests__/form-worker.test.ts
 *
 * Unit tests for the public-form submission worker (REQ-100, REQ-110, REQ-142).
 *
 * The form worker is the single funnel for every contact-form submission. It
 * does three things, in order:
 *   1. Create a CRM contact via Payload REST POST /api/contacts
 *   2. Enqueue a Meta CAPI Lead event (BEST EFFORT — failures non-fatal)
 *   3. Enqueue an email notification to the agency inbox
 *
 * What we lock in here:
 *   - The CRM contact request body shape and Authorization header format
 *   - PII never appears in logs (CLAUDE.md Rule 7)
 *   - A failed CRM POST throws (BullMQ retries → eventually surfaces in DLQ)
 *   - A failed CAPI enqueue is swallowed and logged WARN — the contact is
 *     already saved and the form submitter must not lose their lead because
 *     Meta is having a bad day
 *   - The notification email is enqueued with sensitiveData: true
 *   - First-name / last-name parsing handles single-word names
 *
 * Strategy: mock @mjagency/queue and @mjagency/meta-capi at the module level,
 * capture the processor closure that createEncryptedWorker receives, and
 * invoke it with controlled job data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  createEncryptedWorker: vi.fn(),
  createEncryptedQueue:  vi.fn(),
  enqueueCapiEvent:      vi.fn(),
  emailQueueAdd:         vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  capturedProcessor: null as null | ((job: { data: unknown }) => Promise<void>),
}))

// createEncryptedWorker captures the processor; queue.add captures email-send jobs
mocks.createEncryptedWorker.mockImplementation((_name, processor) => {
  mocks.capturedProcessor = processor as (job: { data: unknown }) => Promise<void>
  return { close: vi.fn() }
})
mocks.createEncryptedQueue.mockImplementation(() => ({
  add: mocks.emailQueueAdd,
}))

vi.mock('@mjagency/queue', () => ({
  createEncryptedWorker: mocks.createEncryptedWorker,
  createEncryptedQueue:  mocks.createEncryptedQueue,
}))

vi.mock('@mjagency/meta-capi', () => ({
  enqueueCapiEvent: mocks.enqueueCapiEvent,
}))

vi.mock('@mjagency/config', () => ({
  REDIS_KEY: { bullPrefix: (a: string) => `agency:${a}:bull` },
  createLogger: () => mocks.log,
}))

const { createFormWorker } = await import('../workers/form-worker.js')

// ── Helpers ───────────────────────────────────────────────────────────────

function startWorker(agencyId = 'finance'): void {
  // Reset all relevant mocks before constructing the worker
  mocks.createEncryptedWorker.mockClear()
  mocks.capturedProcessor = null
  createFormWorker(agencyId)
  if (!mocks.capturedProcessor) {
    throw new Error('createEncryptedWorker mock did not capture the processor')
  }
}

const VALID_JOB = (overrides: Record<string, unknown> = {}) => ({
  data: {
    agencyId:        'finance',
    name:            'Alice Walker',
    email:           'alice@example.com',
    phone:           '+15551234567',
    message:         'Hi, I want a quote.',
    utmSource:       'organic_search',
    utmMedium:       'organic',
    utmCampaign:     'q4-2025',
    clientIp:        '203.0.113.7',
    clientUserAgent: 'Mozilla/5.0',
    formId:          'contact',
    ...overrides,
  },
})

function mockFetchOk(json: unknown): void {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify(json), {
      status:  200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as typeof fetch
}

function mockFetchError(status: number, body = 'error'): void {
  global.fetch = vi.fn(async () => new Response(body, { status })) as typeof fetch
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('form-worker — CRM contact creation', () => {
  beforeEach(() => {
    mocks.enqueueCapiEvent.mockReset().mockResolvedValue(undefined)
    mocks.emailQueueAdd.mockReset().mockResolvedValue(undefined)
    mocks.log.info.mockReset()
    mocks.log.warn.mockReset()
    mocks.log.error.mockReset()
    process.env['PAYLOAD_SERVER_URL'] = 'http://payload.test'
    process.env['PAYLOAD_API_KEY']    = 'test-api-key'
  })

  it('Test 1: POSTs the correct contact body shape to /api/contacts', async () => {
    mockFetchOk({ doc: { id: 'contact-abc' } })
    startWorker('finance')

    await mocks.capturedProcessor!(VALID_JOB())

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('http://payload.test/api/contacts')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toEqual({
      agency_id:  'finance',
      email:      'alice@example.com',
      first_name: 'Alice',
      last_name:  'Walker',
      phone:      '+15551234567',
      source:     'organic_search',
      status:     'new',
    })
  })

  it('Test 2: Authorization header uses the Payload API-Key format', async () => {
    mockFetchOk({ doc: { id: 'c1' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('users API-Key test-api-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('Test 3: single-word name puts everything in first_name and "-" as last_name', async () => {
    mockFetchOk({ doc: { id: 'c2' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ name: 'Cher' }))

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.first_name).toBe('Cher')
    expect(body.last_name).toBe('-')
  })

  it('Test 4: missing utmSource defaults to inbound_content', async () => {
    mockFetchOk({ doc: { id: 'c3' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ utmSource: undefined }))

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.source).toBe('inbound_content')
  })

  it('Test 5: missing phone is forwarded as null (not undefined)', async () => {
    mockFetchOk({ doc: { id: 'c4' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ phone: undefined }))

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.phone).toBeNull()
  })

  it('Test 6: failed CRM POST throws so BullMQ retries', async () => {
    mockFetchError(500, 'database down')
    startWorker()

    await expect(mocks.capturedProcessor!(VALID_JOB())).rejects.toThrow(/CRM contact creation failed.*500/)
    // The downstream enqueues must NOT have run
    expect(mocks.enqueueCapiEvent).not.toHaveBeenCalled()
    expect(mocks.emailQueueAdd).not.toHaveBeenCalled()
  })
})

describe('form-worker — Meta CAPI Lead enqueue (best-effort)', () => {
  beforeEach(() => {
    mocks.enqueueCapiEvent.mockReset().mockResolvedValue(undefined)
    mocks.emailQueueAdd.mockReset().mockResolvedValue(undefined)
    mocks.log.warn.mockReset()
    process.env['PAYLOAD_SERVER_URL'] = 'http://payload.test'
    process.env['PAYLOAD_API_KEY']    = 'test-api-key'
  })

  it('Test 7: Lead event includes em, ph, client_ip_address, client_user_agent, external_id', async () => {
    mockFetchOk({ doc: { id: 'contact-xyz' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    expect(mocks.enqueueCapiEvent).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueCapiEvent).toHaveBeenCalledWith('finance', expect.objectContaining({
      event_name: 'Lead',
      user_data: {
        em:                'alice@example.com',
        ph:                '+15551234567',
        client_ip_address: '203.0.113.7',
        client_user_agent: 'Mozilla/5.0',
        external_id:       'contact-xyz',
      },
      custom_data: { content_name: 'contact' },
    }))
  })

  it('Test 8: external_id is undefined when contact id is unknown (not "unknown")', async () => {
    // The worker fetches contact id from response; if Payload returns {} the
    // id falls back to 'unknown'. We then pass undefined (not the literal
    // "unknown") to Meta — otherwise CAPI would index against a string that
    // matches every other failed insert.
    mockFetchOk({})
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    const lead = mocks.enqueueCapiEvent.mock.calls[0]![1] as { user_data: { external_id?: string } }
    expect(lead.user_data.external_id).toBeUndefined()
  })

  it('Test 9: CAPI enqueue failure is SWALLOWED (form submission still succeeds)', async () => {
    mockFetchOk({ doc: { id: 'c5' } })
    mocks.enqueueCapiEvent.mockRejectedValueOnce(new Error('Meta API down'))

    startWorker()
    // Must NOT throw — the contact is already saved, the form submitter
    // must not lose their lead because of a Meta outage.
    await expect(mocks.capturedProcessor!(VALID_JOB())).resolves.toBeUndefined()

    expect(mocks.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'finance' }),
      expect.stringMatching(/Meta CAPI Lead enqueue failed/),
    )
    // Email notification must STILL run after the CAPI failure
    expect(mocks.emailQueueAdd).toHaveBeenCalledTimes(1)
  })

  it('Test 10: formId is forwarded as content_name (defaults to "contact")', async () => {
    mockFetchOk({ doc: { id: 'c6' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ formId: 'pricing-inquiry' }))

    expect(mocks.enqueueCapiEvent).toHaveBeenCalledWith('finance', expect.objectContaining({
      custom_data: { content_name: 'pricing-inquiry' },
    }))
  })
})

describe('form-worker — agency notification email enqueue', () => {
  beforeEach(() => {
    mocks.enqueueCapiEvent.mockReset().mockResolvedValue(undefined)
    mocks.emailQueueAdd.mockReset().mockResolvedValue(undefined)
    process.env['PAYLOAD_SERVER_URL']           = 'http://payload.test'
    process.env['PAYLOAD_API_KEY']              = 'test-api-key'
    process.env['NEXT_PUBLIC_AGENCY_NAME']      = 'MJ Finance Agency'
    process.env['NEXT_PUBLIC_CONTACT_EMAIL']    = 'hello@finance.mjagency.com'
  })

  it('Test 11: enqueues an email-send job with the right shape and sensitiveData: true', async () => {
    mockFetchOk({ doc: { id: 'c7' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB({ name: 'Alice Walker' }))

    expect(mocks.emailQueueAdd).toHaveBeenCalledTimes(1)
    const [name, data, opts] = mocks.emailQueueAdd.mock.calls[0]! as [string, Record<string, string>, Record<string, unknown>]
    expect(name).toBe('send')
    expect(data.to).toBe('hello@finance.mjagency.com')
    expect(data.from).toBe('hello@finance.mjagency.com')
    expect(data.subject).toContain('New contact form submission from Alice')
    expect(data.html).toContain('Alice Walker')
    expect(data.html).toContain('alice@example.com')
    expect(data.html).toContain('Hi, I want a quote.')
    expect(data.agencyId).toBe('finance')
    expect(opts.sensitiveData).toBe(true)
  })

  it('Test 12: agency contact email defaults to hello@<agencyId>.com when env unset', async () => {
    delete process.env['NEXT_PUBLIC_CONTACT_EMAIL']
    mockFetchOk({ doc: { id: 'c8' } })
    startWorker('finance')
    await mocks.capturedProcessor!(VALID_JOB())

    const data = mocks.emailQueueAdd.mock.calls[0]![1] as Record<string, string>
    expect(data.to).toBe('hello@finance.com')
  })
})

describe('form-worker — log redaction', () => {
  beforeEach(() => {
    mocks.enqueueCapiEvent.mockReset().mockResolvedValue(undefined)
    mocks.emailQueueAdd.mockReset().mockResolvedValue(undefined)
    mocks.log.info.mockReset()
    process.env['PAYLOAD_SERVER_URL'] = 'http://payload.test'
    process.env['PAYLOAD_API_KEY']    = 'test-api-key'
  })

  it('Test 13: "Processing form submission" log line carries email: "[REDACTED]"', async () => {
    mockFetchOk({ doc: { id: 'c9' } })
    startWorker()
    await mocks.capturedProcessor!(VALID_JOB())

    // First info call is the "Processing form submission" line
    const firstInfoCall = mocks.log.info.mock.calls[0]!
    const fields = firstInfoCall[0] as Record<string, unknown>
    expect(fields.email).toBe('[REDACTED]')

    // Defensive: the actual email must NOT appear anywhere in that log call
    const serialised = JSON.stringify(firstInfoCall)
    expect(serialised).not.toContain('alice@example.com')
  })
})
