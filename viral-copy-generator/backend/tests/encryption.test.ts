import { describe, it, expect, beforeAll } from 'vitest'

// Set a 48-char dev key BEFORE importing encryption.ts (the module reads env on call)
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(48)
})

const { encrypt, decrypt, maskKey } = await import('../src/lib/encryption.js')

describe('encryption (SETTINGS-01)', () => {
  it('round-trips ASCII plaintext', () => {
    const original = 'sk-test-abcdef1234567890'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('round-trips UTF-8 multibyte (Urdu + emoji)', () => {
    const original = 'سلام دنیا 🇵🇰'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('round-trips empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('produces different ciphertext for the same plaintext (random salt+IV)', () => {
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a).not.toBe(b)
  })

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const ct = encrypt('payload')
    const buf = Buffer.from(ct, 'base64')
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff
    const tampered = buf.toString('base64')
    expect(() => decrypt(tampered)).toThrow()
  })

  it('rejects ciphertext shorter than header', () => {
    expect(() => decrypt(Buffer.from('short').toString('base64'))).toThrow(/too short/)
  })

  it('throws when ENCRYPTION_KEY is missing or under 32 chars', async () => {
    const original = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'short'
    try {
      expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    } finally {
      process.env.ENCRYPTION_KEY = original
    }
  })
})

describe('maskKey', () => {
  it('returns ****last4 for a normal key', () => {
    expect(maskKey('sk-abc123XYZ7890')).toBe('****7890')
  })
  it('returns just **** for a key 4 chars or shorter', () => {
    expect(maskKey('abc')).toBe('****')
    expect(maskKey('abcd')).toBe('****')
  })
})
