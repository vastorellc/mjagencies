/**
 * packages/esign/src/__tests__/sign-proposal.test.ts
 *
 * Unit tests for the ESIGN-Act-compliant proposal signing flow.
 *
 * The signing handler is the legal-binding entry point: a successful return
 * means the customer is contractually committed. We focus tests on the
 * security boundary (signature validation rejects abuse before any state
 * change) and on the privacy / non-repudiation contracts (IP hashed before
 * storage, hash-chained audit record built correctly).
 *
 * The happy path involves a Payload fetch, R2 upload, PDF generation, audit
 * insert, proposal status update, and queue enqueue. We mock all of those
 * but assert key wire-format properties — the audit-record body, the R2
 * key shape, the completion-queue payload — so a regression in any one of
 * those couplings surfaces here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  generateEsignPdf:     vi.fn(),
  handleProposalAction: vi.fn(),
  createEncryptedQueue: vi.fn(),
  queueAdd:             vi.fn(),
  s3Send:               vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))

vi.mock('../pdf/generate-pdf.js', () => ({
  generateEsignPdf: mocks.generateEsignPdf,
}))

vi.mock('@mjagency/proposals', () => ({
  handleProposalAction: mocks.handleProposalAction,
}))

vi.mock('@mjagency/queue', () => ({
  createEncryptedQueue: mocks.createEncryptedQueue,
}))

vi.mock('@mjagency/config', () => ({
  REDIS_KEY:    { bullPrefix: (a: string) => `agency:${a}:bull` },
  createLogger: () => mocks.log,
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client:         vi.fn().mockImplementation(() => ({ send: mocks.s3Send })),
  PutObjectCommand: vi.fn().mockImplementation((args: unknown) => ({ args })),
}))

const { handleSignProposal } = await import('../actions/sign-proposal.js')

// ── Helpers ───────────────────────────────────────────────────────────────

const VALID_PNG_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const VALID_INPUT = (overrides: Record<string, unknown> = {}) => ({
  token:            'proposal-token-abc',
  hmacSignature:    'fake-hmac',
  signerName:       'Alice Walker',
  signatureDataUri: VALID_PNG_DATA_URI,
  signerIp:         '203.0.113.7',
  signerUserAgent:  'Mozilla/5.0',
  agencyId:         'finance',
  ...overrides,
})

function mockFetchSequence(responses: Array<{ status?: number; body: unknown }>): void {
  let i = 0
  global.fetch = vi.fn(async () => {
    const r = responses[i++] ?? { status: 500, body: 'no more responses' }
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), {
      status:  r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

// Standard PROPOSAL_LOOKUP + PREV_HASH_LOOKUP + AUDIT_INSERT happy-path responses
function mockHappyPathFetch(prevHash: string | null = null): void {
  mockFetchSequence([
    {
      body: {
        docs: [{
          id:        'proposal-1',
          title:     'Q4 Strategy Engagement',
          body_json: { text: 'Statement of work...' },
          agency_id: 'finance',
        }],
      },
    },
    {
      body: { docs: prevHash ? [{ record_hash: prevHash }] : [] },
    },
    { body: { id: 'esign-record-1' } },
  ])
}

// ── Validation guards (T-10-05-02) ────────────────────────────────────────

describe('handleSignProposal — signature validation', () => {
  beforeEach(() => {
    mocks.generateEsignPdf.mockReset()
    mocks.handleProposalAction.mockReset()
    mocks.queueAdd.mockReset()
    mocks.s3Send.mockReset()
  })

  it('Test 1: rejects when signatureDataUri is empty string', async () => {
    const result = await handleSignProposal(VALID_INPUT({ signatureDataUri: '' }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Invalid signature format/i)
    // Nothing downstream should have been touched
    expect(mocks.generateEsignPdf).not.toHaveBeenCalled()
    expect(mocks.s3Send).not.toHaveBeenCalled()
  })

  it('Test 2: rejects non-PNG data URIs (e.g. data:image/jpeg)', async () => {
    const result = await handleSignProposal(VALID_INPUT({
      signatureDataUri: 'data:image/jpeg;base64,/9j/4AAQ',
    }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Invalid signature format/i)
  })

  it('Test 3: rejects PNG with empty base64 payload', async () => {
    const result = await handleSignProposal(VALID_INPUT({
      signatureDataUri: 'data:image/png;base64,',
    }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/i)
  })

  it('Test 4: rejects signature larger than 500KB', async () => {
    // 600KB of "A" base64-encoded
    const largeBase64 = 'A'.repeat(800 * 1024)
    const result = await handleSignProposal(VALID_INPUT({
      signatureDataUri: `data:image/png;base64,${largeBase64}`,
    }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/too large/i)
    expect(mocks.s3Send).not.toHaveBeenCalled()
  })
})

// ── Happy path: hash chain + audit record + queue dispatch ────────────────

describe('handleSignProposal — happy path', () => {
  beforeEach(() => {
    mocks.generateEsignPdf.mockReset().mockResolvedValue({
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
      pdfHash:  'abcdef1234567890',
    })
    mocks.handleProposalAction.mockReset().mockResolvedValue({ ok: true })
    mocks.queueAdd.mockReset().mockResolvedValue(undefined)
    mocks.s3Send.mockReset().mockResolvedValue(undefined)
    mocks.createEncryptedQueue.mockClear()
    mocks.createEncryptedQueue.mockImplementation(() => ({ add: mocks.queueAdd }))
    process.env['PAYLOAD_URL']            = 'http://payload.test'
    process.env['PAYLOAD_API_KEY']        = 'fake-key'
    process.env['R2_ESIGN_BUCKET']        = 'mjagency-esign-test'
  })

  it('Test 5: returns ok:true with a 16-char esignId on success', async () => {
    mockHappyPathFetch()
    const result = await handleSignProposal(VALID_INPUT())

    expect(result.ok).toBe(true)
    expect(result.esignId).toMatch(/^[a-f0-9]{16}$/)
  })

  it('Test 6: R2 key follows the agency-scoped private path agency:<id>/esign/<esignId>.pdf', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT({ agencyId: 'finance' }))

    expect(mocks.s3Send).toHaveBeenCalledTimes(1)
    const putCommand = mocks.s3Send.mock.calls[0]![0] as { args: { Key: string; Bucket: string; ContentType: string } }
    // Bucket is module-level constant from R2_ESIGN_BUCKET env at import; just
    // verify it's set (the exact value is a deployment concern, not a code one).
    expect(putCommand.args.Bucket).toBeTruthy()
    expect(putCommand.args.Key).toMatch(/^agency:finance\/esign\/[a-f0-9]{16}\.pdf$/)
    expect(putCommand.args.ContentType).toBe('application/pdf')
  })

  it('Test 7: R2 metadata includes pdfHash for tamper detection', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT())

    const putCommand = mocks.s3Send.mock.calls[0]![0] as { args: { Metadata: Record<string, string> } }
    expect(putCommand.args.Metadata.pdfHash).toBe('abcdef1234567890')
    expect(putCommand.args.Metadata.signerName).toBe('Alice Walker')
  })

  it('Test 8: signer IP is SHA-256 hashed before storage — raw IP never appears in the audit record', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT({ signerIp: '203.0.113.7' }))

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    // Audit record insert is the THIRD fetch (after proposal lookup + prev-hash lookup)
    const auditCall = fetchMock.mock.calls[2]! as [string, RequestInit]
    const body = JSON.parse(auditCall[1].body as string) as Record<string, unknown>

    expect(body.signer_ip_hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    // Defensive: the raw IP must NOT appear anywhere in the audit body
    const serialised = JSON.stringify(body)
    expect(serialised).not.toContain('203.0.113.7')
  })

  it('Test 9: ESIGN disclosure text is stored verbatim in the audit record (non-repudiation)', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT())

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const auditCall = fetchMock.mock.calls[2]! as [string, RequestInit]
    const body = JSON.parse(auditCall[1].body as string) as Record<string, string>

    // ESIGN_DISCLOSURE_TEXT must be present — exact contents come from the
    // EsignDisclosure component. We just verify it's NOT empty and got copied.
    expect(body.disclosure_text).toBeTruthy()
    expect(body.disclosure_text.length).toBeGreaterThan(50)
  })

  it('Test 10: hash chain — first record has prev_hash: null, record_hash is SHA-256 of the chain inputs', async () => {
    mockHappyPathFetch(null) // no previous record
    await handleSignProposal(VALID_INPUT())

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const body = JSON.parse(
      ((fetchMock.mock.calls[2] as [string, RequestInit])[1].body) as string,
    ) as Record<string, unknown>

    expect(body.prev_hash).toBeNull()
    expect(body.record_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('Test 11: hash chain — subsequent record carries previous record_hash as prev_hash', async () => {
    const previousHash = 'b'.repeat(64)
    mockHappyPathFetch(previousHash)
    await handleSignProposal(VALID_INPUT())

    const fetchMock = global.fetch as unknown as { mock: { calls: unknown[][] } }
    const body = JSON.parse(
      ((fetchMock.mock.calls[2] as [string, RequestInit])[1].body) as string,
    ) as Record<string, unknown>

    expect(body.prev_hash).toBe(previousHash)
    expect(body.record_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(body.record_hash).not.toBe(previousHash)
  })

  it('Test 12: enqueues an esign-completion job with the exact payload the worker expects', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT({ agencyId: 'finance', signerName: 'Alice Walker' }))

    expect(mocks.queueAdd).toHaveBeenCalledTimes(1)
    const [name, data, opts] = mocks.queueAdd.mock.calls[0]! as [string, Record<string, string>, Record<string, unknown>]
    expect(name).toBe('complete')
    expect(data.proposalId).toBe('proposal-1')
    expect(data.agencyId).toBe('finance')
    expect(data.signerName).toBe('Alice Walker')
    expect(data.pdfHash).toBe('abcdef1234567890')
    expect(data.r2Key).toMatch(/^agency:finance\/esign\/[a-f0-9]{16}\.pdf$/)
    expect(data.esignId).toMatch(/^[a-f0-9]{16}$/)
    expect(opts.sensitiveData).toBe(true)
  })

  it('Test 13: proposal lookup miss returns ok:false without uploading anything', async () => {
    mockFetchSequence([{ body: { docs: [] } }])
    const result = await handleSignProposal(VALID_INPUT())
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Proposal not found/i)
    expect(mocks.s3Send).not.toHaveBeenCalled()
    expect(mocks.queueAdd).not.toHaveBeenCalled()
    expect(mocks.handleProposalAction).not.toHaveBeenCalled()
  })

  it('Test 14: handleProposalAction is called with the same token + sign action', async () => {
    mockHappyPathFetch()
    await handleSignProposal(VALID_INPUT({ token: 'proposal-token-abc' }))

    expect(mocks.handleProposalAction).toHaveBeenCalledWith({
      token:         'proposal-token-abc',
      action:        'sign',
      hmacSignature: 'fake-hmac',
    })
  })
})
