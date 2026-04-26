/**
 * packages/auth/src/__tests__/tokens.test.ts
 *
 * Unit tests for jose-based JWT sign/verify primitives (REQ-020, REQ-021, REQ-022, REQ-300, REQ-310).
 * No external deps — no DB, no Redis. All secrets stubbed via vi.stubEnv.
 *
 * Tests cover: roundtrip, expiry, audience rejection, issuer rejection, alg rejection,
 * tampered signature, mfaVerifiedAt claim, and TTL values.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { errors as joseErrors } from 'jose'
const { JWTExpired } = joseErrors

// 64-byte hex test secrets (REQ-310: secrets must be high-entropy)
const TEST_ACCESS_SECRET = 'a'.repeat(64)
const TEST_REFRESH_SECRET = 'b'.repeat(64)

// We stub env BEFORE importing the module so the TextEncoder picks up our secrets
beforeAll(() => {
  vi.stubEnv('JWT_ACCESS_SECRET', TEST_ACCESS_SECRET)
  vi.stubEnv('JWT_REFRESH_SECRET', TEST_REFRESH_SECRET)
})

// Dynamic import ensures module reads stubbed env at load time
const getTokens = async () => {
  // Force re-import by cache-busting (vitest module registry is isolated per test file)
  return import('../tokens.js')
}

describe('signAccessToken + verifyAccessToken', () => {
  it('Test 1: roundtrip — claims preserved end-to-end', async () => {
    const { signAccessToken, verifyAccessToken } = await getTokens()
    const claims = {
      sub: crypto.randomUUID(),
      agencyId: crypto.randomUUID(),
      role: 'admin' as const,
      jti: crypto.randomUUID(),
      familyId: crypto.randomUUID(),
    }
    const token = await signAccessToken(claims)
    expect(typeof token).toBe('string')
    const payload = await verifyAccessToken(token)
    expect(payload.sub).toBe(claims.sub)
    expect(payload.agencyId).toBe(claims.agencyId)
    expect(payload.role).toBe(claims.role)
    expect(payload.jti).toBe(claims.jti)
    expect(payload.familyId).toBe(claims.familyId)
  })

  it('Test 3: access token has 15-minute expiry (exp - iat === 900)', async () => {
    const { signAccessToken, verifyAccessToken } = await getTokens()
    const token = await signAccessToken({
      sub: 'u1', agencyId: 'a1', role: 'editor',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
    })
    const payload = await verifyAccessToken(token)
    expect(payload.exp! - payload.iat!).toBe(900)
  })

  it('Test 5: wrong audience (mjagency-refresh) rejected for access token', async () => {
    const { signRefreshToken, verifyAccessToken } = await getTokens()
    // Sign a refresh token, then try to verify with access verifier (different secret + aud)
    const refreshToken = await signRefreshToken({
      sub: 'u1', agencyId: 'a1',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
    })
    // verifyAccessToken uses JWT_ACCESS_SECRET; refresh token signed with JWT_REFRESH_SECRET
    // So this should throw due to signature mismatch
    await expect(verifyAccessToken(refreshToken)).rejects.toThrow()
  })

  it('Test 6: wrong issuer rejected', async () => {
    const { verifyAccessToken } = await getTokens()
    // Sign manually with iss='other' using jose directly
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(TEST_ACCESS_SECRET)
    const badToken = await new SignJWT({ sub: 'u1', agencyId: 'a1', role: 'editor', jti: 'j1', familyId: 'f1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('other-issuer') // wrong issuer
      .setAudience('mjagency-api')
      .setExpirationTime('15m')
      .sign(secret)
    await expect(verifyAccessToken(badToken)).rejects.toThrow()
  })

  it('Test 7: wrong algorithm (HS512) rejected', async () => {
    const { verifyAccessToken } = await getTokens()
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(TEST_ACCESS_SECRET)
    const badAlgToken = await new SignJWT({ sub: 'u1', agencyId: 'a1', role: 'editor', jti: 'j1', familyId: 'f1' })
      .setProtectedHeader({ alg: 'HS512' }) // wrong alg — verifier only allows HS256
      .setIssuedAt()
      .setIssuer('mjagency')
      .setAudience('mjagency-api')
      .setExpirationTime('15m')
      .sign(secret)
    await expect(verifyAccessToken(badAlgToken)).rejects.toThrow()
  })

  it('Test 8: expired token rejected with JWTExpired', async () => {
    const { verifyAccessToken } = await getTokens()
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(TEST_ACCESS_SECRET)
    const expiredToken = await new SignJWT({ sub: 'u1', agencyId: 'a1', role: 'editor', jti: 'j1', familyId: 'f1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('mjagency')
      .setAudience('mjagency-api')
      .setExpirationTime('-1s') // already expired
      .sign(secret)
    await expect(verifyAccessToken(expiredToken)).rejects.toBeInstanceOf(JWTExpired)
  })

  it('Test 9: tampered signature rejected', async () => {
    const { signAccessToken, verifyAccessToken } = await getTokens()
    const token = await signAccessToken({
      sub: 'u1', agencyId: 'a1', role: 'editor',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
    })
    // Replace the entire signature segment with a different (invalid) signature.
    // This is guaranteed to fail HMAC verification regardless of base64 padding.
    const parts = token.split('.')
    // Use a clearly wrong signature — all 'x' characters, same length but wrong bytes
    parts[2] = 'x'.repeat(parts[2]!.length)
    const tampered = parts.join('.')
    await expect(verifyAccessToken(tampered)).rejects.toThrow()
  })

  it('Test 10: mfaVerifiedAt claim roundtrips when set', async () => {
    const { signAccessToken, verifyAccessToken } = await getTokens()
    const mfaVerifiedAt = '2026-04-25T12:00:00.000Z'
    const token = await signAccessToken({
      sub: 'u1', agencyId: 'a1', role: 'super_admin',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
      mfaVerifiedAt,
    })
    const payload = await verifyAccessToken(token)
    expect(payload.mfaVerifiedAt).toBe(mfaVerifiedAt)
  })
})

describe('signRefreshToken + verifyRefreshToken', () => {
  it('Test 2: roundtrip — refresh claims preserved', async () => {
    const { signRefreshToken, verifyRefreshToken } = await getTokens()
    const claims = {
      sub: crypto.randomUUID(),
      agencyId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
      familyId: crypto.randomUUID(),
    }
    const token = await signRefreshToken(claims)
    expect(typeof token).toBe('string')
    const payload = await verifyRefreshToken(token)
    expect(payload.sub).toBe(claims.sub)
    expect(payload.agencyId).toBe(claims.agencyId)
    expect(payload.jti).toBe(claims.jti)
    expect(payload.familyId).toBe(claims.familyId)
  })

  it('Test 4: refresh token has 7-day expiry (exp - iat === 604800)', async () => {
    const { signRefreshToken, verifyRefreshToken } = await getTokens()
    const token = await signRefreshToken({
      sub: 'u1', agencyId: 'a1',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
    })
    const payload = await verifyRefreshToken(token)
    expect(payload.exp! - payload.iat!).toBe(604800)
  })

  it('Test 5b: access token rejected by refresh verifier (wrong audience + secret)', async () => {
    const { signAccessToken, verifyRefreshToken } = await getTokens()
    const accessToken = await signAccessToken({
      sub: 'u1', agencyId: 'a1', role: 'editor',
      jti: crypto.randomUUID(), familyId: crypto.randomUUID(),
    })
    // verifyRefreshToken uses JWT_REFRESH_SECRET; access token signed with JWT_ACCESS_SECRET
    await expect(verifyRefreshToken(accessToken)).rejects.toThrow()
  })
})
