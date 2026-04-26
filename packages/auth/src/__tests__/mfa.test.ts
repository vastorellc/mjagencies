/**
 * packages/auth/src/__tests__/mfa.test.ts
 *
 * Unit tests for TOTP module (mfa.ts).
 * REQ-025, RFC 6238, SHA1 / 6 digits / 30s period / window=±1
 *
 * No DB, no Redis — pure in-process unit tests.
 */

import { describe, it, expect } from 'vitest'
import * as OTPAuth from 'otpauth'
import {
  generateTotpSecret,
  createTotpUri,
  generateQrCodeDataUrl,
  verifyTotp,
} from '../mfa.js'

describe('generateTotpSecret', () => {
  it('returns a base32 string of length >= 32', () => {
    const secret = generateTotpSecret()
    expect(typeof secret).toBe('string')
    expect(secret.length).toBeGreaterThanOrEqual(32)
    // base32 charset: A-Z 2-7 (case-insensitive)
    expect(secret.toUpperCase()).toMatch(/^[A-Z2-7]+=*$/)
  })

  it('two calls produce different secrets', () => {
    const s1 = generateTotpSecret()
    const s2 = generateTotpSecret()
    expect(s1).not.toBe(s2)
  })
})

describe('createTotpUri', () => {
  it('returns a string starting with otpauth://totp/', () => {
    const secret = generateTotpSecret()
    const uri = createTotpUri(secret, 'user@example.com')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
  })

  it('URI contains issuer=MJAgency, the userEmail, and the secret param', () => {
    const secret = generateTotpSecret()
    const email = 'testuser@example.com'
    const uri = createTotpUri(secret, email)
    expect(uri).toContain('issuer=MJAgency')
    expect(uri).toContain(encodeURIComponent(email))
    expect(uri).toContain('secret=')
  })
})

describe('generateQrCodeDataUrl', () => {
  it('returns a string starting with data:image/png;base64,', async () => {
    const secret = generateTotpSecret()
    const uri = createTotpUri(secret, 'user@example.com')
    const dataUrl = await generateQrCodeDataUrl(uri)
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})

describe('verifyTotp', () => {
  it('TOTP roundtrip — correct current token verifies successfully', () => {
    const secret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    const token = totp.generate()
    expect(verifyTotp(secret, token)).toBe(true)
  })

  it('wrong token is rejected', () => {
    const secret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    // Generate a valid token, then mutate one digit to guarantee invalidity
    const validToken = totp.generate()
    const badToken = validToken.replace(/\d$/, (d) => String((parseInt(d, 10) + 1) % 10))
    expect(verifyTotp(secret, badToken)).toBe(false)
  })

  it('±1 step window — prior-step token still accepted (clock-skew tolerance)', () => {
    const secret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    // Generate the token from 30s ago (one step back)
    const priorToken = totp.generate({ timestamp: Date.now() - 30_000 })
    expect(verifyTotp(secret, priorToken)).toBe(true)
  })

  it('beyond ±1 step — token from 90s ago is rejected', () => {
    const secret = generateTotpSecret()
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    // 3 steps back — outside the ±1 window
    const staleToken = totp.generate({ timestamp: Date.now() - 90_000 })
    expect(verifyTotp(secret, staleToken)).toBe(false)
  })
})
