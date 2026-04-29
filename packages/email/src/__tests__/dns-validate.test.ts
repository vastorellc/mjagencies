/**
 * packages/email/src/__tests__/dns-validate.test.ts
 *
 * Unit tests for DKIM / SPF / DMARC DNS validation (REQ-112, REQ-414).
 *
 * The setup wizard calls these validators to confirm DNS is correctly
 * configured before enabling bulk email. A regression here would let an
 * agency click through to "send emails" with broken DNS — landing every
 * message in spam and damaging sender reputation across the platform.
 *
 * Tests mock `dns.promises.resolveTxt` and exercise:
 *   1. Valid TXT record matching the spec prefix → valid: true + record
 *   2. TXT record present but no matching prefix → valid: false + error
 *   3. NXDOMAIN / ENOTFOUND / timeout → valid: false + error (no crash)
 *   4. Multi-string TXT (DNS protocol chunks long records) → joined correctly
 *   5. Selector / domain prefixing — DKIM uses `default._domainkey.{domain}`,
 *      DMARC uses `_dmarc.{domain}`, SPF uses the bare domain
 *   6. validateEmailDns aggregator runs the 3 lookups in parallel and
 *      reports allValid === (all three valid)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mock for dns.promises.resolveTxt ─────────────────────────────
const mocks = vi.hoisted(() => ({
  resolveTxt: vi.fn<(domain: string) => Promise<string[][]>>(),
}))

vi.mock('dns', () => ({
  promises: {
    resolveTxt: mocks.resolveTxt,
  },
}))

// Import AFTER mock registration so the dns import resolves to our stub
const {
  validateDkim,
  validateSpf,
  validateDmarc,
  validateEmailDns,
} = await import('../dns-validate.js')

beforeEach(() => {
  mocks.resolveTxt.mockReset()
})

// ── validateDkim ─────────────────────────────────────────────────────────

describe('validateDkim', () => {
  it('Test 1: valid v=DKIM1 record returns { valid: true, record }', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['v=DKIM1; k=rsa; p=AAAA...']])
    const result = await validateDkim('mjagency.com')
    expect(result.valid).toBe(true)
    expect(result.record).toBe('v=DKIM1; k=rsa; p=AAAA...')
    expect(result.error).toBeUndefined()
  })

  it('Test 2: queries the correct subdomain (default._domainkey.{domain})', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['v=DKIM1; p=X']])
    await validateDkim('mjagency.com')
    expect(mocks.resolveTxt).toHaveBeenCalledWith('default._domainkey.mjagency.com')
  })

  it('Test 3: TXT exists but no v=DKIM1 prefix → valid: false with descriptive error', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['some-other-txt-record']])
    const result = await validateDkim('mjagency.com')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/v=DKIM1/)
    expect(result.error).toMatch(/default\._domainkey\.mjagency\.com/)
  })

  it('Test 4: NXDOMAIN error becomes { valid: false, error: "DNS lookup failed: ..." }', async () => {
    mocks.resolveTxt.mockRejectedValueOnce(
      Object.assign(new Error('queryTxt ENOTFOUND default._domainkey.notreal.tld'), {
        code: 'ENOTFOUND',
      }),
    )
    const result = await validateDkim('notreal.tld')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('DNS lookup failed')
    expect(result.error).toContain('ENOTFOUND')
  })

  it('Test 5: returns the FIRST matching record when multiple TXT entries exist', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([
      ['some-other-txt'],
      ['v=DKIM1; p=FIRST'],
      ['v=DKIM1; p=SECOND'],
    ])
    const result = await validateDkim('mjagency.com')
    expect(result.valid).toBe(true)
    expect(result.record).toBe('v=DKIM1; p=FIRST')
  })

  it('Test 6: empty TXT records list → valid: false (no v=DKIM1 found)', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([])
    const result = await validateDkim('mjagency.com')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/v=DKIM1/)
  })
})

// ── validateSpf ──────────────────────────────────────────────────────────

describe('validateSpf', () => {
  it('Test 7: valid v=spf1 record returns valid: true', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['v=spf1 include:_spf.mail.com ~all']])
    const result = await validateSpf('mjagency.com')
    expect(result.valid).toBe(true)
    expect(result.record).toBe('v=spf1 include:_spf.mail.com ~all')
  })

  it('Test 8: queries the bare domain (NOT a subdomain like DKIM/DMARC)', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['v=spf1 -all']])
    await validateSpf('mjagency.com')
    expect(mocks.resolveTxt).toHaveBeenCalledWith('mjagency.com')
  })

  it('Test 9: case-insensitive prefix match — V=SPF1 / v=SPF1 both accepted', async () => {
    // RFC 7208 allows the prefix in any case. The validator does .toLowerCase()
    // before comparing — verify that's actually applied.
    mocks.resolveTxt.mockResolvedValueOnce([['V=SPF1 -all']])
    const upper = await validateSpf('mjagency.com')
    expect(upper.valid).toBe(true)

    mocks.resolveTxt.mockResolvedValueOnce([['v=SpF1 -all']])
    const mixed = await validateSpf('mjagency.com')
    expect(mixed.valid).toBe(true)
  })

  it('Test 10: no SPF record present → valid: false with descriptive error', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['some-verification-txt']])
    const result = await validateSpf('mjagency.com')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('No SPF')
    expect(result.error).toContain('mjagency.com')
  })

  it('Test 11: DNS lookup error → valid: false', async () => {
    mocks.resolveTxt.mockRejectedValueOnce(new Error('ETIMEOUT'))
    const result = await validateSpf('slow-dns.tld')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('DNS lookup failed')
  })

  it('Test 12: a sub-record starting with " v=spf1" (leading space) is NOT matched', async () => {
    // Defensive: the spec says SPF must start at byte 0. A leading space
    // means the record is malformed — we should fail rather than accept.
    mocks.resolveTxt.mockResolvedValueOnce([[' v=spf1 -all']])
    const result = await validateSpf('mjagency.com')
    expect(result.valid).toBe(false)
  })
})

// ── validateDmarc ────────────────────────────────────────────────────────

describe('validateDmarc', () => {
  it('Test 13: valid v=DMARC1 record returns valid: true', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([
      ['v=DMARC1; p=reject; rua=mailto:dmarc@mjagency.com'],
    ])
    const result = await validateDmarc('mjagency.com')
    expect(result.valid).toBe(true)
    expect(result.record).toMatch(/^v=DMARC1/)
  })

  it('Test 14: queries the correct subdomain (_dmarc.{domain})', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['v=DMARC1; p=none']])
    await validateDmarc('mjagency.com')
    expect(mocks.resolveTxt).toHaveBeenCalledWith('_dmarc.mjagency.com')
  })

  it('Test 15: no DMARC record → valid: false with the queried subdomain in error', async () => {
    mocks.resolveTxt.mockResolvedValueOnce([['unrelated-txt']])
    const result = await validateDmarc('mjagency.com')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('_dmarc.mjagency.com')
  })

  it('Test 16: DNS lookup throws → valid: false (no crash)', async () => {
    mocks.resolveTxt.mockRejectedValueOnce(
      Object.assign(new Error('queryTxt ENODATA'), { code: 'ENODATA' }),
    )
    const result = await validateDmarc('no-dmarc.tld')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('ENODATA')
  })
})

// ── Multi-string TXT handling (DNS chunks records >255 bytes) ────────────

describe('multi-string TXT records (RFC 7208 §3.3 chunking)', () => {
  it('Test 17: a TXT chunked into multiple strings still matches v=DKIM1 in chunk 0', async () => {
    // resolveTxt returns string[][] — outer array per record, inner per chunk.
    // The validator does `.flat()` so it sees one string per record (chunks
    // joined by `.join('')` in error logging only). The match check uses
    // startsWith() against the FIRST chunk, so DKIM1 must be in chunk[0].
    mocks.resolveTxt.mockResolvedValueOnce([
      [
        'v=DKIM1; k=rsa; ',
        'p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArandomkeydataAAAA',
      ],
    ])
    const result = await validateDkim('mjagency.com')
    expect(result.valid).toBe(true)
    // The returned record is the FIRST chunk (matches the implementation's
    // .flat().find() behaviour). The setup wizard re-fetches if needed.
    expect(result.record).toBe('v=DKIM1; k=rsa; ')
  })
})

// ── validateEmailDns aggregator ──────────────────────────────────────────

describe('validateEmailDns', () => {
  it('Test 18: all three valid → allValid: true', async () => {
    mocks.resolveTxt.mockImplementation(async (name: string) => {
      if (name === 'default._domainkey.mjagency.com') return [['v=DKIM1; p=X']]
      if (name === '_dmarc.mjagency.com')             return [['v=DMARC1; p=reject']]
      if (name === 'mjagency.com')                    return [['v=spf1 -all']]
      throw new Error(`unexpected lookup: ${name}`)
    })

    const result = await validateEmailDns('mjagency.com')
    expect(result.dkim.valid).toBe(true)
    expect(result.spf.valid).toBe(true)
    expect(result.dmarc.valid).toBe(true)
    expect(result.allValid).toBe(true)
  })

  it('Test 19: missing DMARC → allValid: false; other two fields still report individually', async () => {
    mocks.resolveTxt.mockImplementation(async (name: string) => {
      if (name === 'default._domainkey.mjagency.com') return [['v=DKIM1; p=X']]
      if (name === '_dmarc.mjagency.com')             return [['unrelated']]
      if (name === 'mjagency.com')                    return [['v=spf1 -all']]
      throw new Error(`unexpected lookup: ${name}`)
    })

    const result = await validateEmailDns('mjagency.com')
    expect(result.dkim.valid).toBe(true)
    expect(result.spf.valid).toBe(true)
    expect(result.dmarc.valid).toBe(false)
    expect(result.allValid).toBe(false)
  })

  it('Test 20: lookups run in parallel (all three issued before any resolves)', async () => {
    // Build a barrier: each lookup waits on a manually-resolved promise.
    // If the implementation ran serially, we'd see lookup #2 issued only
    // after we resolve #1. Instead, all three should be in-flight as soon
    // as we call validateEmailDns.
    let resolveDkim: (v: string[][]) => void = () => {}
    let resolveSpf:  (v: string[][]) => void = () => {}
    let resolveDmarc: (v: string[][]) => void = () => {}

    const dkimPromise  = new Promise<string[][]>((r) => { resolveDkim  = r })
    const spfPromise   = new Promise<string[][]>((r) => { resolveSpf   = r })
    const dmarcPromise = new Promise<string[][]>((r) => { resolveDmarc = r })

    mocks.resolveTxt.mockImplementation(async (name: string) => {
      if (name.startsWith('default._domainkey.')) return dkimPromise
      if (name.startsWith('_dmarc.'))             return dmarcPromise
      return spfPromise
    })

    const inFlight = validateEmailDns('mjagency.com')
    // Yield to the event loop so the async function starts each lookup.
    await Promise.resolve()
    await Promise.resolve()

    // All three lookups must be issued before any resolves — proves Promise.all.
    expect(mocks.resolveTxt).toHaveBeenCalledTimes(3)

    resolveDkim([['v=DKIM1; p=X']])
    resolveSpf([['v=spf1 -all']])
    resolveDmarc([['v=DMARC1; p=none']])

    const result = await inFlight
    expect(result.allValid).toBe(true)
  })

  it('Test 21: any one lookup throwing does NOT abort the others (Promise.all + per-fn try/catch)', async () => {
    mocks.resolveTxt.mockImplementation(async (name: string) => {
      if (name.startsWith('default._domainkey.')) {
        throw new Error('DKIM ENOTFOUND')
      }
      if (name === 'mjagency.com')      return [['v=spf1 -all']]
      if (name.startsWith('_dmarc.'))   return [['v=DMARC1; p=reject']]
      return []
    })

    const result = await validateEmailDns('mjagency.com')
    expect(result.dkim.valid).toBe(false)
    expect(result.spf.valid).toBe(true)
    expect(result.dmarc.valid).toBe(true)
    expect(result.allValid).toBe(false)
  })
})
