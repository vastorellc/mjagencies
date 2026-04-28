/**
 * packages/compliance/src/__tests__/token.test.ts
 * Plan 11-05 / REQ-144 D-04: jose-only erasure token sign + verify.
 *
 * CLAUDE.md rule 2 — verifies that tokens use HS256 with explicit issuer +
 * audience + kind=erasure claim, and that wrong-kind tokens are rejected.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT } from 'jose'
import { createErasureToken, verifyErasureToken } from '../erasure/token.js'

beforeAll(() => {
  process.env['JWT_ACCESS_SECRET'] = 'erasure-test-secret-32-chars-aaaaa'
})

describe('erasure token', () => {
  it('round-trips a signed token back to its claims', async () => {
    const token = await createErasureToken('user@example.com', 'agency-1', 'req-001')
    const verified = await verifyErasureToken(token)
    expect(verified.email).toBe('user@example.com')
    expect(verified.agencyId).toBe('agency-1')
    expect(verified.requestId).toBe('req-001')
  })

  it('rejects tokens with wrong issuer', async () => {
    const secret = new TextEncoder().encode(process.env['JWT_ACCESS_SECRET'])
    const badToken = await new SignJWT({ email: 'x', agencyId: 'a', requestId: 'r', kind: 'erasure' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('not-mjagency')
      .setAudience('mjagency-api')
      .setExpirationTime('24h')
      .sign(secret)
    await expect(verifyErasureToken(badToken)).rejects.toThrow()
  })

  it('rejects tokens with wrong audience', async () => {
    const secret = new TextEncoder().encode(process.env['JWT_ACCESS_SECRET'])
    const badToken = await new SignJWT({ email: 'x', agencyId: 'a', requestId: 'r', kind: 'erasure' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('mjagency')
      .setAudience('wrong-audience')
      .setExpirationTime('24h')
      .sign(secret)
    await expect(verifyErasureToken(badToken)).rejects.toThrow()
  })

  it('rejects tokens with wrong kind claim', async () => {
    const secret = new TextEncoder().encode(process.env['JWT_ACCESS_SECRET'])
    const badToken = await new SignJWT({ email: 'x', agencyId: 'a', requestId: 'r', kind: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('mjagency')
      .setAudience('mjagency-api')
      .setExpirationTime('24h')
      .sign(secret)
    await expect(verifyErasureToken(badToken)).rejects.toThrow(/kind/)
  })
})
